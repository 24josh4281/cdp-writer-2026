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

정적 링크에서는 질문지 탐색, 작성안내/평가기준 확인, 수동 증빙 붙여넣기, 로컬 브라우저 임시저장 기능을 사용할 수 있습니다. 파일 업로드 추출, GPT 생성, XLSX 생성은 화면 상단의 `API 서버`에 로컬 서버 또는 별도 보안 서버 주소를 연결하면 동작합니다.

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
- 평가조건별 충족/감점 사유와 응답·증빙 근거 문장 표시
- D/A/M/L 예상 점수와 평가 신뢰도 표시
- Route, best row, row-level, 부분점수 문구 감지 및 점수 계산 참고 표시
- A/A- 필수조건 자동 점검
- 선택 섹터 기준 산업 특수 문항 적용 후보 표시
- 감점 후보 및 보완 필요 요소 모아보기
- 품질 게이트로 작성 커버리지, 필수조건 리스크, 증빙 충분성 점검
- 감점 후보를 점수차와 신뢰도 기준으로 정렬한 검토 우선순위 큐
- 감점 조건별 응답 개선안 자동 제안
- 문항별 최대 득점 경로와 원자화된 평가조건 XLSX 출력
- CDP Portal export 파일 기반 방법론 동기화 센터
- DOCX, PPTX, XLSX, TXT, CSV, JSON, PDF 텍스트 추출
- 증빙자료 기반 답변 초안 생성
- OpenAI GPT 기반 답변 초안 생성
- 브라우저 로컬 자동 임시저장
- CSV/JSON 및 사전평가 XLSX 내보내기
- XLSX 내보내기 시 검토우선순위, 품질게이트, API상태, 최대득점경로 시트 포함
- XLSX 내보내기 시 방법론 동기화 변경 후보 시트 포함
- 기업별 프로젝트 저장/불러오기로 10개 이상 기업 응답을 분리 관리
- 기존 사전평가 XLSX/CSV와 자동평가 결과를 비교하는 벤치마크 QA
- 필수조건 전용 화면과 리뷰어 모드로 사람 검토 의견 기록
- 증빙 없는 수치·목표·검증 표현을 `[증빙 필요]`로 표시하는 GPT 품질통제
- XLSX 내보내기 시 채점규칙DB, 벤치마크비교, 리뷰의견 시트 포함

## 방법론 동기화 센터

CDP Portal의 공식 방법론은 로그인, 권한, export 형식, 게시 시점에 따라 접근 방식이 달라질 수 있습니다. 이 앱은 보안과 정확도를 위해 포털을 자동으로 긁어와 즉시 덮어쓰지 않고, 사용자가 CDP Portal에서 export한 PDF/XLSX 파일을 업로드해 변경 후보를 검토한 뒤 승인 적용하는 방식을 사용합니다.

사용 흐름:

1. CDP Portal에서 기업 질문지, 작성안내, 평가방법론을 PDF 또는 Excel로 export합니다.
2. 앱의 `방법론 동기화` 메뉴에서 export 파일을 업로드합니다.
3. `방법론 파일 분석`을 눌러 문항번호별 변경 후보, 배점 차이, 조건 수 변화를 확인합니다.
4. 변경 후보별로 `승인`, `보류`, `제외`를 선택한 뒤 `검토 후보 승인 적용`을 누르면 승인된 항목만 현재 브라우저 세션의 평가기준 overlay로 반영됩니다.
5. 원본 데이터셋 파일은 덮어쓰지 않으며, `동기화 초기화`로 언제든 원본 기준으로 되돌릴 수 있습니다.

동기화 결과는 사전평가 XLSX의 `방법론동기화` 시트와 `동기화 리포트 JSON`으로 남길 수 있습니다.

## GPT 답변 생성 설정

GPT 답변 생성은 API 키가 브라우저에 노출되지 않도록 `server.py`에서만 호출합니다. 실행 전에 PowerShell에서 아래처럼 환경변수를 설정합니다. `CDP_API_TOKEN`은 외부 정적 링크에서 API 서버를 호출할 때 사용할 선택적 보호 토큰입니다.

```powershell
$env:OPENAI_API_KEY = "여기에 OpenAI API 키 입력"
$env:OPENAI_MODEL = "gpt-5.2"
$env:CDP_API_TOKEN = "원하는_토큰_문자열"
python server.py --port 8780
```

`OPENAI_MODEL`은 필요 시 회사에서 승인한 모델명으로 바꿀 수 있습니다. 실제 API 키는 `.env`, 문서, 코드, GitHub에 저장하지 마십시오.

## 외부 링크에서 서버 API 연결

1. 로컬 또는 별도 서버에서 `python server.py --port 8780`을 실행합니다.
2. 외부 공개 링크를 엽니다.
3. 화면 상단 `API 서버`에 `http://127.0.0.1:8780` 또는 공개 HTTPS API 주소를 입력합니다.
4. `CDP_API_TOKEN`을 설정했다면 `토큰` 칸에 같은 값을 입력합니다.
5. `API 연결`을 눌러 `extract`, `generate`, `export-xlsx` 기능 연결을 확인합니다.

다른 PC에서도 서버 API를 사용하려면 로컬 주소 대신 HTTPS 터널 또는 배포 서버 주소를 입력해야 합니다. 공개 API 서버를 열 때는 반드시 `CDP_API_TOKEN`을 설정하고, 필요 시 `CDP_ALLOWED_ORIGINS`로 허용 출처를 제한하십시오.

## 자동 임시저장

작성 초안, 증빙 입력, 회사명, 섹터, 키워드, 선택 문항은 브라우저 탭의 `sessionStorage`에 자동 저장됩니다. 같은 탭에서 새로고침해도 작업 상태를 복구할 수 있지만, 브라우저 탭을 닫으면 사라질 수 있습니다. API 토큰은 보안상 자동 저장하지 않습니다.

민감한 기업 자료를 입력한 뒤 공용 PC를 사용할 경우, `내보내기` 화면의 `임시저장 초기화` 버튼으로 브라우저 저장값을 삭제하십시오.

## 보안 메모

- 기본 서버 주소는 `127.0.0.1`로, 같은 PC에서만 접속됩니다.
- 외부 공유가 필요한 경우에만 임시 터널을 열고, 사용 후 즉시 종료하십시오.
- `/api/extract` 업로드는 허용 확장자, 파일 수, 파일 크기, 압축 해제 크기, PDF 페이지 수, 추출 텍스트 길이를 제한합니다.
- `/api/generate`는 서버 환경변수의 `OPENAI_API_KEY`만 사용하며, 브라우저 코드에는 키를 저장하지 않습니다.
- CSV/XLSX 내보내기는 `=`, `+`, `-`, `@`로 시작하는 값을 텍스트로 처리해 수식 주입 위험을 낮춥니다.
- 외부 정적 링크에서 서버 API를 호출할 수 있도록 CORS를 허용하되, 공개 서버 운영 시 `CDP_API_TOKEN`으로 보호하십시오.
- 로컬 audit 로그와 번역 캐시는 GitHub에 올리지 않도록 `.gitignore`에 포함되어 있습니다.

## 2026 데이터 재생성

INPUT 폴더의 2026 CDP 원본 자료를 다시 반영해야 할 때 사용합니다.

```powershell
$env:CDP_2026_INPUT_DIR = "B:\CODEX\Old\CDP Evaluation\inputs\2026 CDP 자료"
python scripts\build_2026_dataset.py
python scripts\polish_korean_titles.py
python scripts\normalize_korean_mixed_text.py
```

## 사전평가 벤치마크 보정

기존 사전평가 XLSX를 기준으로 자동평가 로직을 보정하려면 원본 파일 경로를 UTF-8 텍스트 파일에 한 줄씩 적은 뒤 아래처럼 실행합니다. 원본 엑셀은 읽기만 하며, 결과는 Git에 올라가지 않는 `outputs/benchmark/`에 생성됩니다.

```powershell
python scripts\benchmark_preassessment.py --path-file outputs\benchmark\benchmark_paths.txt --output-xlsx outputs\benchmark\preassessment_benchmark.xlsx --output-json outputs\benchmark\preassessment_benchmark.json
```

생성 결과:

- `Summary`: 기업별 파싱 성공 여부, 문항 수, 감점 총량, 배점 일치/불일치 수
- `Parsed Scores`: 문항별 D/A/M/L 점수와 배점
- `Deduction Priority`: 감점이 큰 문항 우선순위
- `Denominator Check`: 현재 데이터셋 배점과 기존 사전평가 배점의 차이
- `Calibration Candidates`: 여러 기업에서 반복되는 배점 차이와 감점 갭을 모은 보정 우선순위

2025 사전평가 파일을 2026 데이터셋과 비교하면 기준 연도 차이 때문에 배점 불일치가 발생할 수 있습니다. 이 경우 불일치 항목은 오류가 아니라 방법론 변경 또는 보정 후보로 검토해야 합니다.

## 주의사항

- 자동 평가와 답변 생성은 사전평가 및 작성 보조용입니다. 최종 제출 전에는 반드시 평가방법론 원문과 증빙자료를 대조하십시오.
- 예상 점수는 조건 키워드와 증빙 매핑 기반의 보조값이며, route, best row, 산업별 예외는 추가 검토가 필요합니다.
- XLSX 내보내기는 서버의 `/api/export-xlsx`를 사용하므로 정적 공개 링크에서는 `API 서버` 연결이 필요합니다.
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
