from __future__ import annotations

import argparse
import gzip
import io
import json
import mimetypes
import os
import re
import sys
import urllib.error
import urllib.request
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent
ALLOWED_UPLOAD_SUFFIXES = {".docx", ".pptx", ".xlsx", ".pdf", ".txt", ".csv", ".json", ".md"}
MAX_REQUEST_BYTES = 30 * 1024 * 1024
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_FILES = 10
MAX_EXTRACTED_CHARS = 500_000
MAX_ZIP_MEMBERS = 2500
MAX_ZIP_UNCOMPRESSED_BYTES = 80 * 1024 * 1024
MAX_PDF_PAGES = 120
MAX_GENERATE_REQUEST_BYTES = 1 * 1024 * 1024
MAX_EXPORT_REQUEST_BYTES = 20 * 1024 * 1024
MAX_AI_INPUT_CHARS = 24_000
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"


def trim_extracted_text(value: str) -> str:
    if len(value) <= MAX_EXTRACTED_CHARS:
        return value
    return f"{value[:MAX_EXTRACTED_CHARS]}\n\n[추출 텍스트가 너무 길어 {MAX_EXTRACTED_CHARS:,}자로 축약되었습니다.]"


def clamp_chars(value: Any, limit: int = MAX_AI_INPUT_CHARS) -> str:
    text_value = "" if value is None else str(value)
    if len(text_value) <= limit:
        return text_value
    return f"{text_value[:limit]}\n\n[입력 내용이 길어 {limit:,}자로 축약되었습니다.]"


def checked_zip(data: bytes) -> zipfile.ZipFile:
    zf = zipfile.ZipFile(io.BytesIO(data))
    infos = zf.infolist()
    if len(infos) > MAX_ZIP_MEMBERS:
        zf.close()
        raise ValueError("압축 파일 내부 항목이 너무 많습니다.")
    total_size = sum(info.file_size for info in infos)
    if total_size > MAX_ZIP_UNCOMPRESSED_BYTES:
        zf.close()
        raise ValueError("압축 해제 후 파일 크기가 너무 큽니다.")
    return zf


def decode_text(data: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp949", "euc-kr", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def xml_text(data: bytes) -> str:
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        return ""
    parts: list[str] = []
    for node in root.iter():
        tag = node.tag.split("}")[-1].lower()
        if tag in {"t", "instrtext"} and node.text:
            parts.append(node.text.strip())
    return " ".join(part for part in parts if part)


def extract_docx(data: bytes) -> str:
    with checked_zip(data) as zf:
        names = [
            name
            for name in zf.namelist()
            if name.startswith("word/")
            and name.endswith(".xml")
            and any(part in name for part in ("document", "header", "footer", "footnotes", "endnotes"))
        ]
        return "\n".join(xml_text(zf.read(name)) for name in sorted(names)).strip()


def extract_pptx(data: bytes) -> str:
    with checked_zip(data) as zf:
        names = [
            name
            for name in zf.namelist()
            if name.endswith(".xml") and (name.startswith("ppt/slides/") or name.startswith("ppt/notesSlides/"))
        ]

        def slide_order(name: str) -> tuple[int, str]:
            match = re.search(r"(\d+)\.xml$", name)
            return (int(match.group(1)) if match else 0, name)

        return "\n\n".join(xml_text(zf.read(name)) for name in sorted(names, key=slide_order)).strip()


def extract_xlsx_with_openpyxl(data: bytes) -> str:
    import openpyxl  # type: ignore

    wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    chunks: list[str] = []
    for ws in wb.worksheets:
        chunks.append(f"[Sheet] {ws.title}")
        for row in ws.iter_rows(values_only=True):
            values = [str(value).strip() for value in row if value not in (None, "")]
            if values:
                chunks.append(" | ".join(values))
    return "\n".join(chunks).strip()


def extract_xlsx_fallback(data: bytes) -> str:
    with checked_zip(data) as zf:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for item in root.iter():
                if item.tag.split("}")[-1] == "si":
                    shared.append(xml_text(ET.tostring(item)))

        chunks: list[str] = []
        for name in sorted(n for n in zf.namelist() if n.startswith("xl/worksheets/") and n.endswith(".xml")):
            chunks.append(f"[Sheet XML] {Path(name).stem}")
            root = ET.fromstring(zf.read(name))
            row_values: list[str] = []
            for cell in root.iter():
                if cell.tag.split("}")[-1] != "c":
                    continue
                cell_type = cell.attrib.get("t")
                value_node = next((child for child in cell if child.tag.split("}")[-1] == "v"), None)
                if value_node is None or value_node.text is None:
                    continue
                value = value_node.text
                if cell_type == "s" and value.isdigit() and int(value) < len(shared):
                    value = shared[int(value)]
                row_values.append(value)
            if row_values:
                chunks.append(" | ".join(row_values))
    return "\n".join(chunks).strip()


def extract_xlsx(data: bytes) -> str:
    with checked_zip(data):
        pass
    try:
        return extract_xlsx_with_openpyxl(data)
    except Exception:
        return extract_xlsx_fallback(data)


def extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception:
        return "PDF text extraction requires pypdf. Please paste the relevant evidence text manually."

    reader = PdfReader(io.BytesIO(data))
    if len(reader.pages) > MAX_PDF_PAGES:
        raise ValueError(f"PDF 페이지 수가 너무 많습니다. 최대 {MAX_PDF_PAGES}쪽까지 추출합니다.")
    return "\n".join((page.extract_text() or "").strip() for page in reader.pages).strip()


def extract_file_text(filename: str, data: bytes) -> dict[str, Any]:
    suffix = Path(filename).suffix.lower()
    try:
        if suffix not in ALLOWED_UPLOAD_SUFFIXES:
            return {
                "filename": filename,
                "ok": False,
                "characters": 0,
                "text": "",
                "error": "허용되지 않는 파일 형식입니다.",
            }
        if len(data) > MAX_FILE_BYTES:
            return {
                "filename": filename,
                "ok": False,
                "characters": 0,
                "text": "",
                "error": f"파일이 너무 큽니다. 최대 {MAX_FILE_BYTES // (1024 * 1024)}MB까지 허용됩니다.",
            }
        if suffix == ".docx":
            text = extract_docx(data)
        elif suffix == ".pptx":
            text = extract_pptx(data)
        elif suffix == ".xlsx":
            text = extract_xlsx(data)
        elif suffix == ".pdf":
            text = extract_pdf(data)
        elif suffix in {".txt", ".csv", ".json", ".md"}:
            text = decode_text(data)
        else:
            text = decode_text(data)
        return {
            "filename": filename,
            "ok": True,
            "characters": len(text),
            "text": trim_extracted_text(text),
            "truncated": len(text) > MAX_EXTRACTED_CHARS,
        }
    except Exception as error:
        return {
            "filename": filename,
            "ok": False,
            "characters": 0,
            "text": "",
            "error": str(error),
        }


def extract_openai_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"].strip()
    parts: list[str] = []
    for item in payload.get("output", []) or []:
        for content in item.get("content", []) or []:
            if isinstance(content, dict) and isinstance(content.get("text"), str):
                parts.append(content["text"])
    return "\n".join(part.strip() for part in parts if part.strip()).strip()


def generate_openai_draft(payload: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return {
            "ok": False,
            "error": "OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다. 로컬 서버 실행 전에 API 키를 설정하세요.",
        }

    question = payload.get("question") or {}
    company = clamp_chars(payload.get("company") or "회사명", 200)
    sector = clamp_chars(payload.get("sector") or "", 100)
    keywords = clamp_chars(payload.get("keywords") or "", 2000)
    evidence = clamp_chars(payload.get("evidence") or "")
    try:
        char_limit = int(payload.get("charLimit") or 2400)
    except (TypeError, ValueError):
        char_limit = 2400
    char_limit = max(300, min(char_limit, 8000))

    instructions = (
        "You are a CDP disclosure drafting assistant for ESG consultants. "
        "Write in Korean unless the source field explicitly requires English. "
        "Use only the supplied evidence, keywords, question guidance, and scoring criteria. "
        "Do not invent numeric values, dates, targets, assurance status, or governance bodies. "
        "When evidence is missing, write a conservative placeholder in Korean using brackets. "
        "Prioritize CDP scoring coverage across Disclosure, Awareness, Management, and Leadership criteria. "
        "Keep the response within the requested character limit."
    )
    user_input = {
        "task": "Create a CDP answer draft that maximizes scoring coverage while remaining evidence-based.",
        "company": company,
        "sector": sector,
        "character_limit": char_limit,
        "keywords": keywords,
        "question": {
            "number": clamp_chars(question.get("number"), 50),
            "module": clamp_chars(question.get("module"), 50),
            "title_ko": clamp_chars(question.get("title_ko"), 2000),
            "title_en": clamp_chars(question.get("title_en"), 2000),
            "guidance_ko": clamp_chars(question.get("guidance_ko"), 6000),
            "guidance_en": clamp_chars(question.get("guidance_en"), 6000),
            "scoring_ko": clamp_chars(question.get("scoring_ko"), 8000),
            "scoring_en": clamp_chars(question.get("scoring_en"), 8000),
            "point_allocation": clamp_chars(question.get("points"), 3000),
            "evidence_checklist": clamp_chars(question.get("evidenceChecklist"), 3000),
        },
        "evidence": evidence,
        "output_requirements": [
            "한국어 본문으로 작성",
            "문항에서 요구하는 선택값, 정량값, 설명, 증빙 위치를 빠뜨리지 않기",
            "증빙이 없는 값은 대괄호 placeholder로 남기기",
            "문장 마지막에 불필요한 면책 문구 넣지 않기",
        ],
    }
    body = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-5.2"),
        "instructions": instructions,
        "input": json.dumps(user_input, ensure_ascii=False),
    }
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        OPENAI_RESPONSES_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        return {"ok": False, "error": f"OpenAI API 오류: HTTP {error.code} {detail[:500]}"}
    except urllib.error.URLError as error:
        return {"ok": False, "error": f"OpenAI API 연결 오류: {error.reason}"}

    draft = extract_openai_text(response_payload)
    if not draft:
        return {"ok": False, "error": "OpenAI 응답에서 초안 텍스트를 찾지 못했습니다."}
    return {
        "ok": True,
        "model": body["model"],
        "draft": clamp_chars(draft, char_limit),
    }


def xml_escape(value: Any) -> str:
    return (
        "" if value is None else str(value)
    ).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def column_name(index: int) -> str:
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def safe_sheet_name(value: Any, fallback: str) -> str:
    name = re.sub(r"[\[\]\:\*\?\/\\]", " ", str(value or fallback)).strip()[:31]
    return name or fallback


def worksheet_xml(rows: list[list[Any]]) -> str:
    xml_rows: list[str] = []
    for r_idx, row in enumerate(rows[:20000], start=1):
        cells: list[str] = []
        for c_idx, value in enumerate(row[:80], start=1):
            cell_ref = f"{column_name(c_idx)}{r_idx}"
            cell_value = xml_escape(value)
            cells.append(f'<c r="{cell_ref}" t="inlineStr"><is><t xml:space="preserve">{cell_value}</t></is></c>')
        xml_rows.append(f'<row r="{r_idx}">{"".join(cells)}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetData>'
        f'{"".join(xml_rows)}'
        '</sheetData></worksheet>'
    )


def workbook_xml(sheet_names: list[str]) -> str:
    sheets = "".join(
        f'<sheet name="{xml_escape(name)}" sheetId="{index}" r:id="rId{index}"/>'
        for index, name in enumerate(sheet_names, start=1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets>{sheets}</sheets></workbook>'
    )


def workbook_rels_xml(sheet_count: int) -> str:
    rels = "".join(
        f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>'
        for index in range(1, sheet_count + 1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'{rels}</Relationships>'
    )


def content_types_xml(sheet_count: int) -> str:
    overrides = "".join(
        f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for index in range(1, sheet_count + 1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        f'{overrides}</Types>'
    )


def create_xlsx(payload: dict[str, Any]) -> bytes:
    sheets = payload.get("sheets")
    if not isinstance(sheets, list) or not sheets:
        raise ValueError("No sheets supplied")
    normalized: list[tuple[str, list[list[Any]]]] = []
    used_names: set[str] = set()
    for index, sheet in enumerate(sheets[:12], start=1):
        if not isinstance(sheet, dict):
            continue
        name = safe_sheet_name(sheet.get("name"), f"Sheet{index}")
        base_name = name
        suffix = 2
        while name in used_names:
            name = safe_sheet_name(f"{base_name}_{suffix}", f"Sheet{index}")
            suffix += 1
        used_names.add(name)
        rows = sheet.get("rows") if isinstance(sheet.get("rows"), list) else []
        normalized.append((name, rows))
    if not normalized:
        raise ValueError("No valid sheets supplied")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml(len(normalized)))
        zf.writestr("_rels/.rels", (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>'
        ))
        zf.writestr("xl/workbook.xml", workbook_xml([name for name, _ in normalized]))
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml(len(normalized)))
        for index, (_, rows) in enumerate(normalized, start=1):
            zf.writestr(f"xl/worksheets/sheet{index}.xml", worksheet_xml(rows))
    return buffer.getvalue()


def parse_multipart(content_type: str, body: bytes) -> list[dict[str, Any]]:
    match = re.search(r"boundary=(.+)", content_type)
    if not match:
        return []
    boundary = match.group(1).strip().strip('"').encode()
    files: list[dict[str, Any]] = []
    for raw_part in body.split(b"--" + boundary):
        part = raw_part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        headers_raw, _, content = part.partition(b"\r\n\r\n")
        headers = decode_text(headers_raw)
        disposition = next((line for line in headers.splitlines() if line.lower().startswith("content-disposition")), "")
        filename_match = re.search(r'filename="([^"]*)"', disposition)
        if not filename_match:
            continue
        filename = Path(filename_match.group(1)).name
        if content.endswith(b"--"):
            content = content[:-2]
        files.append({"filename": filename, "data": content.rstrip(b"\r\n")})
        if len(files) > MAX_FILES:
            break
    return files


class Handler(SimpleHTTPRequestHandler):
    server_version = "CDPWriterHTTP/0.1"

    def translate_path(self, path: str) -> str:
        requested = super().translate_path(path)
        try:
            relative = Path(requested).resolve().relative_to(Path.cwd().resolve())
        except ValueError:
            relative = Path("index.html")
        return str(ROOT / relative)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_binary(self, status: int, data: bytes, content_type: str, filename: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_compressed_file(self) -> bool:
        if "gzip" not in self.headers.get("Accept-Encoding", "").lower():
            return False
        path = Path(self.translate_path(self.path.split("?", 1)[0]))
        if not path.is_file() or path.suffix.lower() not in {".html", ".js", ".css", ".json"}:
            return False
        data = gzip.compress(path.read_bytes())
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Vary", "Accept-Encoding")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        return True

    def do_GET(self) -> None:
        if self.path in {"/", ""}:
            self.path = "/index.html"
        if self.send_compressed_file():
            return
        return super().do_GET()

    def do_POST(self) -> None:
        if self.path not in {"/api/extract", "/api/generate", "/api/export-xlsx"}:
            self.send_json(404, {"ok": False, "error": "Unknown endpoint"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"ok": False, "error": "Invalid Content-Length"})
            return
        if length <= 0:
            self.send_json(400, {"ok": False, "error": "No upload body"})
            return
        if self.path == "/api/generate" and length > MAX_GENERATE_REQUEST_BYTES:
            self.send_json(413, {"ok": False, "error": f"Generate request too large. Limit is {MAX_GENERATE_REQUEST_BYTES // (1024 * 1024)}MB."})
            return
        if self.path == "/api/export-xlsx" and length > MAX_EXPORT_REQUEST_BYTES:
            self.send_json(413, {"ok": False, "error": f"Export request too large. Limit is {MAX_EXPORT_REQUEST_BYTES // (1024 * 1024)}MB."})
            return
        if length > MAX_REQUEST_BYTES:
            self.send_json(413, {"ok": False, "error": f"Upload too large. Limit is {MAX_REQUEST_BYTES // (1024 * 1024)}MB."})
            return
        body = self.rfile.read(length)

        if self.path == "/api/generate":
            try:
                payload = json.loads(body.decode("utf-8-sig"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self.send_json(400, {"ok": False, "error": "Invalid JSON body"})
                return
            result = generate_openai_draft(payload)
            self.send_json(200 if result.get("ok") else 502, result)
            return

        if self.path == "/api/export-xlsx":
            try:
                payload = json.loads(body.decode("utf-8-sig"))
                data = create_xlsx(payload)
            except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
                self.send_json(400, {"ok": False, "error": str(error)})
                return
            filename = re.sub(r'[^A-Za-z0-9._-]+', "_", str(payload.get("filename") or "cdp-preassessment.xlsx"))
            if not filename.endswith(".xlsx"):
                filename += ".xlsx"
            self.send_binary(200, data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename)
            return

        files = parse_multipart(self.headers.get("Content-Type", ""), body)
        if len(files) > MAX_FILES:
            self.send_json(413, {"ok": False, "error": f"Too many files. Limit is {MAX_FILES} files."})
            return
        results = [extract_file_text(item["filename"], item["data"]) for item in files]
        self.send_json(200, {"ok": True, "files": results})


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the CDP Writer local web app.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8780, type=int)
    args = parser.parse_args()

    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    mimetypes.add_type("application/json", ".json")

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"CDP Writer 2026 is running at http://{args.host}:{args.port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
