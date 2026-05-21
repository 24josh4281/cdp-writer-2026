from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
INPUT_DIR = Path(os.environ.get("CDP_2026_INPUT_DIR", ROOT.parent / "inputs" / "2026 CDP 자료"))
OUT = ROOT / "data" / "cdp_2026_full_dataset.json"

QUESTIONNAIRE = "CDP 2026 questionnaire_Full.pdf"

REFERENCE_FILES = {
    "questionnaire_overview": "CDP_Full_Corporate_Questionnaire_Overview_2026.pdf",
    "questionnaire_setup": "CDP_Corporate_Questionnaire_Setup_Preview_2026.pdf",
    "glossary": "CDP_Full_Corporate_Questionnaire_Glossary_-_2026.pdf",
    "scoring_intro": "CDP_Full_Corporate_Scoring_Introduction_2026.pdf",
    "scoring_changes": "CDP_Full_Corporate_Scoring_Changes_2026.pdf",
    "climate_weightings": "CDP_Scoring_Category_Weightings_2026_-_Climate_Change.pdf",
    "climate_essential": "CDP_Climate_Change_Scoring_Essential_Criteria_2026.pdf",
    "water_essential": "CDP_Water_Security_Scoring_Essential_Criteria_2026.pdf",
    "industry_classification": "CDP_Industry_Impact_Classification_2026.pdf",
}

MODULE_TITLES = {
    "M1": "Introduction",
    "M2": "Identification, assessment, and management of dependencies, impacts, risks, and opportunities",
    "M3": "Disclosure of risks and opportunities",
    "M4": "Governance",
    "M5": "Business strategy",
    "M6": "Environmental Performance - Consolidation Approach",
    "M7": "Environmental performance - Climate Change",
    "M8": "Environmental performance - Forests",
    "M9": "Environmental performance - Water Security",
    "M10": "Environmental Performance - Plastics",
    "M11": "Environmental Performance - Biodiversity",
    "M12": "Environmental Performance - Financial Services",
    "M13": "Further information & sign off",
}

MODULE_TITLES_KO = {
    "M1": "소개",
    "M2": "의존도, 영향, 리스크 및 기회의 식별·평가·관리",
    "M3": "리스크와 기회의 공시",
    "M4": "거버넌스",
    "M5": "사업 전략",
    "M6": "환경성과 - 연결 접근법",
    "M7": "환경성과 - 기후변화",
    "M8": "환경성과 - 산림",
    "M9": "환경성과 - 물 안보",
    "M10": "환경성과 - 플라스틱",
    "M11": "환경성과 - 생물다양성",
    "M12": "환경성과 - 금융서비스",
    "M13": "추가 정보 및 서명",
}

SECTION_HEADINGS = [
    "Tags",
    "Change From Last Year",
    "Requested Content",
    "Explanation of Terms",
    "Additional Information",
    "Scoring - Question Level",
    "Scoring - Point Allocation",
]

QUESTION_START_RE = re.compile(r"^\s*(\d+(?:\.\d+)+)\s*(?:\*\(mandatory\)|\(mandatory\)|\*)?\s*$")

TRANSLATION_REPLACEMENTS = [
    ("Climate change", "기후변화"),
    ("climate change", "기후변화"),
    ("Water Security", "물 안보"),
    ("Water", "물"),
    ("Forests", "산림"),
    ("Biodiversity", "생물다양성"),
    ("Plastics", "플라스틱"),
    ("Disclosure scoring criteria", "공시 평가기준"),
    ("Awareness scoring criteria", "인식 평가기준"),
    ("Management scoring criteria", "관리 평가기준"),
    ("Leadership scoring criteria", "리더십 평가기준"),
    ("Scoring - Question Level", "문항 수준 평가기준"),
    ("Scoring - Point Allocation", "점수 배분"),
    ("Requested Content", "작성안내"),
    ("Explanation of Terms", "용어 설명"),
    ("Additional Information", "추가 정보"),
    ("Change From Last Year", "전년 대비 변경사항"),
    ("Tags", "태그"),
    ("Module overview", "모듈 개요"),
    ("Sector-specific content", "산업 특수 내용"),
    ("General", "일반"),
    ("Select one option", "하나의 선택지를 선택"),
    ("Select all that apply", "해당하는 항목을 모두 선택"),
    ("Complete the following table", "다음 표를 작성"),
    ("Write your answer here", "답변을 작성"),
    ("Text field", "서술형 입력란"),
    ("Numerical field", "숫자 입력란"),
    ("Date", "날짜"),
    ("Not scored", "평가 제외"),
    ("points", "점"),
    ("point", "점"),
    ("Disclosure", "공시"),
    ("Awareness", "인식"),
    ("Management", "관리"),
    ("Leadership", "리더십"),
    ("dependencies", "의존도"),
    ("impacts", "영향"),
    ("risks", "리스크"),
    ("opportunities", "기회"),
    ("risk", "리스크"),
    ("opportunity", "기회"),
    ("governance", "거버넌스"),
    ("strategy", "전략"),
    ("financial planning", "재무계획"),
    ("short-term", "단기"),
    ("medium-term", "중기"),
    ("long-term", "장기"),
    ("emissions", "배출량"),
    ("emission", "배출"),
    ("Scope 1", "Scope 1"),
    ("Scope 2", "Scope 2"),
    ("Scope 3", "Scope 3"),
    ("value chain", "가치사슬"),
    ("supplier", "공급업체"),
    ("suppliers", "공급업체"),
    ("target", "목표"),
    ("targets", "목표"),
    ("verification", "검증"),
    ("assurance", "보증"),
    ("board", "이사회"),
    ("C-suite", "최고경영진"),
    ("policy", "정책"),
    ("procedure", "절차"),
    ("process", "프로세스"),
    ("organization", "조직"),
    ("your organization", "귀사"),
    ("business", "사업"),
    ("reporting period", "보고기간"),
    ("reporting boundary", "보고경계"),
    ("financial year", "회계연도"),
    ("Please explain", "설명하십시오"),
    ("Provide", "제공하십시오"),
    ("provide", "제공하십시오"),
    ("Describe", "설명하십시오"),
    ("describe", "설명하십시오"),
    ("Indicate", "표시하십시오"),
    ("indicate", "표시하십시오"),
    ("Identify", "식별하십시오"),
    ("identify", "식별하십시오"),
]


@dataclass
class QuestionBlock:
    number: str
    body: str
    page_start: int
    page_end: int


def clean_page_text(text: str) -> str:
    lines: list[str] = []
    for raw in text.replace("\xa0", " ").splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line:
            continue
        if "설정에서 퀵메뉴" in line or "바로가기" == line:
            continue
        if line.startswith("https://myportal.cdp.net"):
            continue
        if re.match(r"^26\.\s*5\.\s*2\.", line):
            continue
        if re.search(r"\d+/\d+$", line) and "CDP 2026 questionnaire" in line:
            continue
        lines.append(line)
    return "\n".join(lines)


def extract_pdf_pages(path: Path) -> list[str]:
    reader = PdfReader(str(path))
    pages: list[str] = []
    for page in reader.pages:
        pages.append(clean_page_text(page.extract_text() or ""))
    return pages


def auto_ko(text: str, limit: int | None = None) -> str:
    source = re.sub(r"\s+", " ", text.replace("\n", " ")).strip()
    if limit and len(source) > limit:
        source = source[:limit].rsplit(" ", 1)[0] + " ..."
    translated = source
    for src, dst in sorted(TRANSLATION_REPLACEMENTS, key=lambda item: len(item[0]), reverse=True):
        translated = translated.replace(src, dst)
    return translated


def title_ko(title: str) -> str:
    lower = title.lower()
    exact_patterns = [
        ("in which language are you submitting your response", "응답 제출 언어를 선택하십시오."),
        ("select the currency used for all financial information", "응답 전반의 모든 재무정보에 사용할 통화를 선택하십시오."),
        ("provide an overview and introduction to your organization", "귀사의 개요와 소개 정보를 제공하십시오."),
        ("state the end of the year for which you are reporting data", "보고 데이터의 대상 연도 종료일을 기재하십시오."),
        ("provide details on your reporting boundary", "보고경계에 대한 세부 정보를 제공하십시오."),
        ("does your organization have a process for identifying", "귀사는 환경 의존도, 영향, 리스크 및 기회를 식별·평가·관리하는 프로세스를 보유하고 있습니까?"),
        ("how does your organization define short-, medium-, and long-term time horizons", "귀사는 환경 의존도, 영향, 리스크 및 기회의 식별·평가·관리와 관련해 단기·중기·장기 시간범위를 어떻게 정의합니까?"),
        ("have you identified any environmental risks", "귀사는 환경 관련 리스크를 식별했습니까?"),
        ("have you identified any environmental opportunities", "귀사는 환경 관련 기회를 식별했습니까?"),
        ("is there board-level oversight", "환경 이슈에 대한 이사회 차원의 감독이 있습니까?"),
        ("does your organization have a climate transition plan", "귀사는 기후 전환계획을 보유하고 있습니까?"),
        ("provide details of your organization’s emissions", "귀사의 배출량 세부 정보를 제공하십시오."),
        ("provide your gross global scope 1 emissions", "전 세계 총 Scope 1 배출량을 제공하십시오."),
        ("provide your gross global scope 2 emissions", "전 세계 총 Scope 2 배출량을 제공하십시오."),
        ("account for your organization’s gross global scope 3 emissions", "귀사의 전 세계 총 Scope 3 배출량을 산정하여 제공하십시오."),
    ]
    for needle, korean in exact_patterns:
        if needle in lower:
            return korean
    return auto_ko(title)


def section_between(body: str, heading: str) -> str:
    pattern = re.escape(heading)
    match = re.search(pattern, body)
    if not match:
        return ""
    start = match.end()
    next_positions = []
    for other in SECTION_HEADINGS:
        if other == heading:
            continue
        other_match = re.search(re.escape(other), body[start:])
        if other_match:
            next_positions.append(start + other_match.start())
    end = min(next_positions) if next_positions else len(body)
    return body[start:end].strip()


def detect_answer_type(lines: list[str]) -> str:
    markers = [
        "Select one option",
        "Select all that apply",
        "Complete the following table",
        "Text field",
        "Numerical field",
        "Date",
        "Percentage field",
        "Attach a file",
    ]
    found = [marker for marker in markers if any(marker in line for line in lines)]
    return "; ".join(found)


def extract_title_and_intro(body: str, number: str) -> tuple[str, str, str]:
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    if lines and QUESTION_START_RE.match(lines[0]):
        lines = lines[1:]
    stop_words = [
        "Tags",
        "Select one option",
        "Select all that apply",
        "Complete the following table",
        "Text field",
        "Numerical field",
        "Date",
        "Percentage field",
    ]
    candidate_lines: list[str] = []
    intro_lines: list[str] = []
    stopped = False
    for line in lines:
        if any(line.startswith(stop) for stop in stop_words):
            stopped = True
            break
        if len(candidate_lines) < 4:
            candidate_lines.append(line)
        else:
            intro_lines.append(line)
    candidate = " ".join(candidate_lines).strip()
    title = candidate
    intro_extra = ""
    explanatory_markers = [". This question", ". Understanding", ". CDP ", ". Your response", ". Establishing"]
    marker_positions = [candidate.find(marker) for marker in explanatory_markers if candidate.find(marker) > 0]
    first_marker = min(marker_positions) if marker_positions else -1
    question_mark = candidate.find("?")
    if first_marker > 0:
        title = candidate[: first_marker + 1].strip()
        intro_extra = candidate[first_marker + 1 :].strip()
    elif question_mark >= 0:
        title = candidate[: question_mark + 1].strip()
        intro_extra = candidate[question_mark + 1 :].strip()
    else:
        sentence_match = re.match(r"(.+?[.!])\s+(.+)$", candidate)
        if sentence_match:
            title = sentence_match.group(1).strip()
            intro_extra = sentence_match.group(2).strip()
    if not title:
        title = f"Question {number}"
    intro = " ".join(part for part in [intro_extra, " ".join(intro_lines).strip()] if part).strip()
    return title, title_ko(title), intro


def split_questions(pages: list[str]) -> list[QuestionBlock]:
    blocks: list[QuestionBlock] = []
    current_number = ""
    current_lines: list[str] = []
    start_page = 1

    for page_index, page in enumerate(pages, start=1):
        for line in page.splitlines():
            match = QUESTION_START_RE.match(line)
            if match:
                number = match.group(1)
                if current_number and current_lines:
                    blocks.append(QuestionBlock(current_number, "\n".join(current_lines).strip(), start_page, page_index))
                current_number = number
                current_lines = [line]
                start_page = page_index
            elif current_number:
                current_lines.append(line)
    if current_number and current_lines:
        blocks.append(QuestionBlock(current_number, "\n".join(current_lines).strip(), start_page, len(pages)))
    return blocks


def climate_point_allocations(scoring: str) -> dict[str, float]:
    den = {"D": 0.0, "A": 0.0, "M": 0.0, "L": 0.0}
    block_match = re.search(r"Climate change point allocations[\s\S]*?(?:\n\s*[\d.]+\s+–|\Z)", scoring, flags=re.I)
    block = block_match.group(0) if block_match else scoring
    numbers = [float(x) for x in re.findall(r"(?<![\w.])\d+(?:\.\d+)?(?![\w.])", block)]
    if len(numbers) >= 8:
        den = {"D": numbers[1], "A": numbers[3], "M": numbers[5], "L": numbers[7]}
    return den


def issue_tags(tags: str) -> list[str]:
    issues = []
    for label in ["Climate Change", "Water", "Forests", "Biodiversity", "Plastics"]:
        if label.lower() in tags.lower():
            issues.append(label)
    return issues


def sector_tags(tags: str) -> list[str]:
    sectors = [
        "Chemicals",
        "Financial services",
        "Oil & Gas",
        "Coal",
        "Aviation",
        "Capital goods",
        "Transport OEMS",
        "Metals & mining",
        "Transport services",
        "Steel",
        "Agricultural commodities",
        "Energy utilities & power generators",
        "Cement",
        "Food, beverage & tobacco",
        "Paper & forestry",
        "Real estate",
        "Construction",
    ]
    lower = tags.lower()
    return [sector for sector in sectors if sector.lower() in lower]


def build_rows(blocks: list[QuestionBlock]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for block in blocks:
        first_segment = block.number.split(".")[0]
        if not first_segment.isdigit() or int(first_segment) > 13:
            continue
        title_en, title_ko, intro = extract_title_and_intro(block.body, block.number)
        tags = section_between(block.body, "Tags")
        requested = section_between(block.body, "Requested Content")
        terms = section_between(block.body, "Explanation of Terms")
        additional = section_between(block.body, "Additional Information")
        scoring = section_between(block.body, "Scoring - Question Level")
        allocation = section_between(block.body, "Scoring - Point Allocation")
        change = section_between(block.body, "Change From Last Year")
        guidance_en = "\n\n".join(
            part
            for part in [
                f"Requested Content\n{requested}" if requested else "",
                f"Explanation of Terms\n{terms}" if terms else "",
                f"Additional Information\n{additional}" if additional else "",
            ]
            if part
        )
        scoring_en = "\n\n".join(part for part in [scoring, allocation] if part)
        module = f"M{block.number.split('.')[0]}"
        rows.append(
            {
                "year": 2026,
                "module_id": module,
                "moduleId": module,
                "module": MODULE_TITLES.get(module, module),
                "module_ko": MODULE_TITLES_KO.get(module, module),
                "category": "2026 Full Corporate",
                "questionNumber": block.number,
                "question_number": block.number,
                "title": title_en,
                "title_en": title_en,
                "title_ko": title_ko,
                "intro_en": intro,
                "intro_ko": auto_ko(intro),
                "answerType": detect_answer_type(block.body.splitlines()),
                "tags": tags,
                "tags_ko": auto_ko(tags, 1200),
                "issues": issue_tags(tags),
                "sectorTags": sector_tags(tags),
                "sectorFlag": "X" if sector_tags(tags) else "",
                "sector_flag": "X" if sector_tags(tags) else "",
                "changeFromLastYear": change,
                "changeFromLastYear_ko": auto_ko(change, 1000),
                "guidance_en": guidance_en,
                "guidance_ko": auto_ko(guidance_en, 5000),
                "requestedContent": requested,
                "requestedContent_ko": auto_ko(requested, 3500),
                "scoring_en": scoring_en,
                "scoring_ko": auto_ko(scoring_en, 5000),
                "fullScoreChecklist": scoring_en,
                "full_score_checklist": scoring_en,
                "fullScoreChecklist_ko": auto_ko(scoring_en, 5000),
                "pointAllocation": allocation,
                "pointAllocation_ko": auto_ko(allocation, 1800),
                "denominators": climate_point_allocations(allocation),
                "evidenceChecklist": "문항의 선택값/표 입력값, 산정근거, 내부 승인자료, 보고서·검증서 페이지, 관련 정책/절차 문서를 증빙으로 연결하세요.",
                "evidenceChecklist_ko": "문항의 선택값/표 입력값, 산정근거, 내부 승인자료, 보고서·검증서 페이지, 관련 정책/절차 문서를 증빙으로 연결하세요.",
                "improvementActions": "평가기준과 작성안내에서 요구하는 선택값, 정량값, 설명, 증빙 위치가 같은 문항 안에서 확인되도록 보완하세요.",
                "improvementActions_ko": "평가기준과 작성안내에서 요구하는 선택값, 정량값, 설명, 증빙 위치가 같은 문항 안에서 확인되도록 보완하세요.",
                "modelAnswer": f"[회사명]은 {title_ko} 문항에 대해 작성안내와 평가기준에서 요구하는 선택값, 정량값, 설명 및 증빙 위치를 일관되게 제공합니다.",
                "modelAnswer_ko": f"[회사명]은 {title_ko} 문항에 대해 작성안내와 평가기준에서 요구하는 선택값, 정량값, 설명 및 증빙 위치를 일관되게 제공합니다.",
                "sourcePages": [block.page_start, block.page_end],
                "sourceFile": QUESTIONNAIRE,
            }
        )
    return rows


def extract_reference(path: Path, key: str) -> dict[str, Any]:
    pages = extract_pdf_pages(path)
    text = "\n\n".join(pages)
    summary = auto_ko(text, 7000)
    return {
        "key": key,
        "filename": path.name,
        "pages": len(pages),
        "text_en": text[:60000],
        "text_ko": summary,
        "note_ko": "국문은 검토 편의를 위한 자동 보조 번역/요약입니다. 공식 해석은 영문 원문을 우선하십시오.",
    }


def build_dataset() -> dict[str, Any]:
    questionnaire_path = INPUT_DIR / QUESTIONNAIRE
    pages = extract_pdf_pages(questionnaire_path)
    blocks = split_questions(pages)
    rows = build_rows(blocks)
    references = []
    for key, filename in REFERENCE_FILES.items():
        path = INPUT_DIR / filename
        if path.exists():
            references.append(extract_reference(path, key))
    return {
        "title": "CDP 2026 Full Corporate Questionnaire Dataset",
        "title_ko": "CDP 2026 전체 기업 질문지 데이터셋",
        "year": 2026,
        "sector": "FULL",
        "generatedAt": "2026-05-21",
        "sourceFolder": str(INPUT_DIR),
        "translationNotice": "Korean fields are assistant-generated review aids based on glossary replacement and summarization; English source text remains authoritative.",
        "translationNotice_ko": "국문 필드는 검토 편의를 위한 보조 번역/요약입니다. 공식 판단은 영문 원문을 우선하십시오.",
        "moduleTitles": MODULE_TITLES,
        "moduleTitles_ko": MODULE_TITLES_KO,
        "qualitativeCount": len(rows),
        "quantitativeCount": 0,
        "qualitativeRows": rows,
        "references": references,
    }


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    dataset = build_dataset()
    OUT.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUT), "rows": dataset["qualitativeCount"], "references": len(dataset["references"])}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
