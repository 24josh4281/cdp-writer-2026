from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any

import argostranslate.translate

from translation_utils import DATASET, FIELD_MAP, postprocess, quality, split_chunks


CACHE = Path(__file__).resolve().parents[1] / "data" / "translation_cache_argos_en_ko.json"
MODEL_NAME = "argos-en-ko-1.1"


def load_cache() -> dict[str, str]:
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict[str, str]) -> None:
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def cache_key(text: str) -> str:
    return f"{MODEL_NAME}:{hashlib.sha256(text.encode('utf-8')).hexdigest()}"


def translate_text(text: str, cache: dict[str, str]) -> str:
    chunks = split_chunks(text, max_chars=500)
    translated: list[str] = []
    for chunk in chunks:
        key = cache_key(chunk)
        if key not in cache:
            cache[key] = postprocess(argostranslate.translate.translate(chunk, "en", "ko"))
        translated.append(cache[key])
    return postprocess("\n".join(translated))


def selected_fields(names: list[str]) -> list[tuple[str, str, str]]:
    pairs: list[tuple[str, str, str]] = []
    for name in names:
        if name not in FIELD_MAP:
            raise SystemExit(f"Unknown field group: {name}. Choose from {', '.join(FIELD_MAP)}")
        source, target = FIELD_MAP[name]
        pairs.append((name, source, target))
    return pairs


def cleanup_translation(value: str) -> str:
    replacements = {
        "시간 지평": "시간범위",
        "환경 위험": "환경 리스크",
        "위험과 기회": "리스크 및 기회",
        "의존성": "의존도",
        "재무 계획": "재무계획",
        "재정 계획": "재무계획",
        "포인트": "점수",
        "이 질문": "이 문항",
        "조직": "귀사",
        "당신의": "귀사의",
        "귀하의 귀사": "귀사",
        "귀사의 귀사": "귀사",
        "귀사은": "귀사는",
        "귀사이": "귀사가",
        "귀사에": "귀사에",
        "짧은, 중간 및 장기": "단기·중기·장기",
        "중간 및 장기": "중기 및 장기",
        "금융 계획": "재무계획",
        "수익": "매출",
        "시설": "사업장",
        "세부사항": "세부 정보",
        "자주 묻는 질문": "작성안내",
        "주요사업": "일반",
        "column": "열",
        "Column": "열",
        "row": "행",
        "Row": "행",
        "rows": "행",
        "Rows": "행",
        "table": "표",
        "General": "일반",
        "Requested Content": "작성안내",
        "Additional Information": "추가 정보",
        "Explanation of Terms": "용어 설명",
        "Emissions": "배출량",
        "emissions": "배출량",
        "Emission": "배출",
        "emission": "배출",
        "Environmental": "환경",
        "environmental": "환경",
        "Risk": "리스크",
        "risk": "리스크",
        "Data users": "데이터 이용자",
        "data users": "데이터 이용자",
        "metric": "지표",
        "Metric": "지표",
        "source": "배출원",
        "sources": "배출원",
        "reporting year": "보고연도",
        "Reporting year": "보고연도",
        "field": "입력란",
        "criteria": "기준",
        "standard": "기준",
        "scoring": "평가",
        "Disclosure": "공시",
        "Awareness": "인식",
        "Management": "관리",
        "Leadership": "리더십",
        "제공합니다": "제공하십시오",
        "선택합니다": "선택하십시오",
        "어떤 언어가 응답을 제출합니까?": "응답 제출 언어를 선택하십시오.",
        "어떤 언어로 응답을 제출합니까?": "응답 제출 언어를 선택하십시오.",
        "공개": "공시",
        "관리 점수 기준": "관리 평가기준",
        "리더십 점수 기준": "리더십 평가기준",
        "인식 점수 기준": "인식 평가기준",
        "공시 점수 기준": "공시 평가기준",
    }
    result = value
    for src, dst in replacements.items():
        result = result.replace(src, dst)
    result = re.sub(r"(\d)\s+/\s+(\d)", r"\1/\2", result)
    result = result.replace("CDP는", "CDP는")
    return result.strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="Translate CDP dataset English fields into Korean with local Argos Translate.")
    parser.add_argument("--modules", nargs="*", help="Module IDs to translate, e.g. M2 M4. Omit for all modules.")
    parser.add_argument("--fields", nargs="*", default=["title", "intro", "guidance", "requested", "scoring"], help="Field groups to translate.")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--skip-existing-method", action="store_true", help="Skip rows already translated by this method.")
    args = parser.parse_args()

    data = json.loads(DATASET.read_text(encoding="utf-8"))
    cache = load_cache()
    fields = selected_fields(args.fields)
    modules = set(args.modules or [])
    rows = [row for row in data.get("qualitativeRows", []) if not modules or row.get("moduleId") in modules]
    if args.limit:
        rows = rows[: args.limit]

    started = time.time()
    for row_index, row in enumerate(rows, start=1):
        if args.skip_existing_method and row.get("translationQuality", {}).get("method") == MODEL_NAME:
            continue
        print(f"[{row_index}/{len(rows)}] {row.get('moduleId')} {row.get('questionNumber')}")
        field_quality: dict[str, Any] = {}
        for name, source_key, target_key in fields:
            source = row.get(source_key) or ""
            if not source:
                continue
            translated = cleanup_translation(translate_text(source, cache))
            row[target_key] = translated
            field_quality[name] = quality(translated)
            if target_key == "scoring_ko":
                row["fullScoreChecklist_ko"] = translated
        row["translationQuality"] = {
            "method": MODEL_NAME,
            "regenerated": True,
            "fields": field_quality,
        }
        if row_index % 10 == 0:
            save_cache(cache)
            DATASET.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    save_cache(cache)
    DATASET.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"rows": len(rows), "elapsedSeconds": round(time.time() - started, 1)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
