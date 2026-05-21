from __future__ import annotations

import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "data" / "cdp_2026_full_dataset.json"

FIELD_MAP = {
    "title": ("title_en", "title_ko"),
    "intro": ("intro_en", "intro_ko"),
    "guidance": ("guidance_en", "guidance_ko"),
    "requested": ("requestedContent", "requestedContent_ko"),
    "scoring": ("scoring_en", "scoring_ko"),
    "allocation": ("pointAllocation", "pointAllocation_ko"),
    "tags": ("tags", "tags_ko"),
}


def normalize_source(text: str) -> str:
    value = str(text or "")
    fixes = {
        "\u00a0": " ",
        "\r": "",
        "andmanagement": "and management",
        "risksand": "risks and",
        "opportunitiesand": "opportunities and",
        "assets orinfrastructure": "assets or infrastructure",
        "canmanifest": "can manifest",
        "conductoperational": "conduct operational",
        "mayhave": "may have",
        "environmentaldependencies": "environmental dependencies",
        "organizationsresponding": "organizations responding",
        "thecollection": "the collection",
        "from12": "from 12",
        "Japaneseand": "Japanese and",
        "andChinese": "and Chinese",
        "withwater": "with water",
        "formore": "for more",
        "andwhich": "and which",
        "tounderstand": "to understand",
        "thefuture": "the future",
    }
    for src, dst in fixes.items():
        value = value.replace(src, dst)
    value = re.sub(r"([.!?])(?=[A-Z])", r"\1 ", value)
    return value.strip()


def split_chunks(text: str, max_chars: int = 650) -> list[str]:
    source = normalize_source(text)
    if not source:
        return []
    paragraphs = re.split(r"(\n{1,2})", source)
    chunks: list[str] = []
    current = ""

    def push() -> None:
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    for part in paragraphs:
        if not part:
            continue
        if part.startswith("\n"):
            push()
            continue
        sentences = re.split(r"(?<=[.!?])\s+", part.strip())
        for sentence in sentences:
            if not sentence:
                continue
            if len(sentence) > max_chars:
                push()
                for offset in range(0, len(sentence), max_chars):
                    chunks.append(sentence[offset : offset + max_chars].strip())
                continue
            candidate = f"{current} {sentence}".strip()
            if len(candidate) > max_chars:
                push()
                current = sentence
            else:
                current = candidate
    push()
    return chunks


def postprocess(text: str) -> str:
    value = text
    value = re.sub(r"\s+([,.!?])", r"\1", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    value = re.sub(r"[ \t]+\n", "\n", value)
    return value.strip()


def quality(text: str) -> dict[str, Any]:
    korean = len(re.findall(r"[가-힣]", text))
    latin = len(re.findall(r"\b[A-Za-z]{4,}\b", text))
    bad = bool(re.search(r"귀사\s+has|This\s+|If\s+|Select\s+|Provide\s+|Does\s+|What\s+|How\s+", text))
    return {
        "hangulChars": korean,
        "latinWords": latin,
        "badPatternFound": bad,
        "quality": "review" if bad or (latin > max(20, korean * 0.2)) else "translated",
    }
