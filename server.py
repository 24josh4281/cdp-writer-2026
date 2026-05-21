from __future__ import annotations

import argparse
import gzip
import io
import json
import mimetypes
import re
import sys
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


def trim_extracted_text(value: str) -> str:
    if len(value) <= MAX_EXTRACTED_CHARS:
        return value
    return f"{value[:MAX_EXTRACTED_CHARS]}\n\n[추출 텍스트가 너무 길어 {MAX_EXTRACTED_CHARS:,}자로 축약되었습니다.]"


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
        if self.path != "/api/extract":
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
        if length > MAX_REQUEST_BYTES:
            self.send_json(413, {"ok": False, "error": f"Upload too large. Limit is {MAX_REQUEST_BYTES // (1024 * 1024)}MB."})
            return
        body = self.rfile.read(length)
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
