# CDP Writer 2026

CDP 2026 평가방법론과 질문지 데이터를 기반으로 문항별 작성안내, 평가기준, 배점, 증빙 요구사항, 답변 초안, 감점 후보를 한 화면에서 확인하기 위한 로컬 웹앱입니다.

## 실행 방법

```powershell
cd "B:\CODEX\Old\CDP Evaluation\CDP-Writer-2026"
python server.py --port 8780
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:8780
```

## 외부 공개 링크

- 상시 정적 링크: https://raw.githack.com/24josh4281/CDP-Writer-2026/public/index.html
- GitHub Pages 예정 링크: https://24josh4281.github.io/CDP-Writer-2026/

정적 링크에서는 질문지 탐색, 작성안내/평가기준 확인, 수동 증빙 붙여넣기, 로컬 브라우저 임시저장 기능을 사용할 수 있습니다. 파일 업로드 추출과 GPT 생성은 API 키 보호가 필요하므로 `python server.py`로 실행한 로컬 서버 또는 별도 보안 서버에서만 동작합니다.

GitHub Pages 워크플로는 저장소 설정에서 Pages를 활성화한 뒤 수동 실행하도록 구성되어 있습니다.

## 포함 데이터

- 기본 데이터셋: 2026 CDP Full Corporate Questionnaire
- 정성 문항: 370개
- 참조 문서: 질문지, 작성안내, 평가방법론, 필수조건, 가중치, 산업분류 자료

## 주요 기능

- M1~M13 문항 탐색
- 국문/영문/원문 비교 보기
- 문항별 작성안내, 평가기준, 배점, 태그/변경사항 표시
- 문항별 D/A/M/L 충족 가능성 점검
- 감점 후보 및 보완 필요 요소 모아보기
- DOCX, PPTX, XLSX, TXT, CSV, JSON, PDF 텍스트 추출
- 증빙자료 기반 답변 초안 생성
- OpenAI GPT 기반 답변 초안 생성
- 브라우저 로컬 자동 임시저장
- CSV/JSON 내보내기

## GPT 답변 생성 설정

GPT 답변 생성은 API 키가 브라우저에 노출되지 않도록 `server.py`에서만 호출합니다. 실행 전에 PowerShell에서 아래처럼 환경변수를 설정합니다.

```powershell
$env:OPENAI_API_KEY = "여기에 OpenAI API 키 입력"
$env:OPENAI_MODEL = "gpt-5.2"
python server.py --port 8780
```

`OPENAI_MODEL`은 필요 시 회사에서 승인한 모델명으로 바꿀 수 있습니다. 실제 API 키는 `.env`, 문서, 코드, GitHub에 저장하지 마십시오.

## 자동 임시저장

작성 초안, 증빙 입력, 회사명, 섹터, 키워드, 선택 문항은 브라우저 탭의 `sessionStorage`에 자동 저장됩니다. 같은 탭에서 새로고침해도 작업 상태를 복구할 수 있지만, 브라우저 탭을 닫으면 사라질 수 있습니다.

민감한 기업 자료를 입력한 뒤 공용 PC를 사용할 경우, `내보내기` 화면의 `임시저장 초기화` 버튼으로 브라우저 저장값을 삭제하십시오.

## 보안 메모

- 기본 서버 주소는 `127.0.0.1`로, 같은 PC에서만 접속됩니다.
- 외부 공유가 필요한 경우에만 임시 터널을 열고, 사용 후 즉시 종료하십시오.
- `/api/extract` 업로드는 허용 확장자, 파일 수, 파일 크기, 압축 해제 크기, PDF 페이지 수, 추출 텍스트 길이를 제한합니다.
- `/api/generate`는 서버 환경변수의 `OPENAI_API_KEY`만 사용하며, 브라우저 코드에는 키를 저장하지 않습니다.
- 로컬 audit 로그와 번역 캐시는 GitHub에 올리지 않도록 `.gitignore`에 포함되어 있습니다.

## 2026 데이터 재생성

INPUT 폴더의 2026 CDP 원본 자료를 다시 반영해야 할 때 사용합니다.

```powershell
$env:CDP_2026_INPUT_DIR = "B:\CODEX\Old\CDP Evaluation\inputs\2026 CDP 자료"
python scripts\build_2026_dataset.py
python scripts\polish_korean_titles.py
python scripts\normalize_korean_mixed_text.py
```

## 주의사항

- 자동 평가와 답변 생성은 사전평가 및 작성 보조용입니다. 최종 제출 전에는 반드시 평가방법론 원문과 증빙자료를 대조하십시오.
- CDP, TCFD, GHG, Scope, ISO 등 공식 약어는 국문 화면에서도 유지됩니다.
- 브라우저 자동 임시저장은 로컬 편의 기능이며, 공식 백업은 CSV/JSON 내보내기 파일을 사용하십시오.

## 프로젝트 구조

```text
.
├─ index.html
├─ app.js
├─ styles.css
├─ server.py
├─ data/
│  └─ cdp_2026_full_dataset.json
├─ scripts/
│  ├─ build_2026_dataset.py
│  ├─ polish_korean_titles.py
│  └─ normalize_korean_mixed_text.py
└─ docs/
   ├─ 01-plan/features/
   └─ 02-design/features/
```
