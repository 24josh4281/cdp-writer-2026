# CDP Writer Integrated Homepage - Design

## Design Decision

| 선택지 | 설명 | 판단 |
| --- | --- | --- |
| 정적 HTML만 사용 | 배포는 단순하지만 Office/PDF 텍스트 추출이 어렵습니다. | 제외 |
| 대형 풀스택 앱 | 계정, DB, 배포 파이프라인까지 포함합니다. | 현재 단계에서는 과함 |
| 로컬 웹앱 + Python 서버 | 브라우저 UI와 로컬 파일 추출 API를 결합합니다. | 채택 |

## Data Flow

```mermaid
flowchart LR
  A["2026 CDP 데이터셋"] --> B["문항 탐색"]
  C["기업 증빙자료"] --> D["텍스트 추출 API"]
  D --> E["증빙 보관함"]
  B --> F["규칙 기반 답변 초안 생성"]
  B --> J["GPT 답변 생성 API"]
  E --> F
  E --> J
  J --> F
  F --> G["D/A/M/L 충족 점검"]
  G --> H["감점 후보"]
  H --> I["CSV/JSON 내보내기"]
```

## Main Screens

- 대시보드: 데이터셋, 문항 수, 산업 특수 문항, 감점 후보 요약
- 작성: 문항 탐색, 작성안내, 평가기준, 배점, 증빙 입력, 답변 초안
- 평가: 감점 후보와 보완 필요 요소 목록
- 자료: 원본 문서 참조 텍스트
- 증빙: DOCX/PPTX/XLSX/PDF 등 파일 텍스트 추출
- 내보내기: CSV/JSON 다운로드와 임시저장 초기화

## Scoring Logic

- 문항별 평가기준을 D/A/M/L 섹션으로 분리합니다.
- 각 섹션에서 표/셀 작성, 선택지, 리스크/기회, 전략/재무계획, 목표, 검증 등 핵심 신호를 추출합니다.
- 사용자가 입력한 답변 초안, 증빙자료, 키워드에서 해당 신호가 확인되는지 점검합니다.
- 결과는 `충족 가능`, `부분 보완 필요`, `보완 필요`로 표시합니다.
- 각 평가수준별 조건을 표로 보여주고, 응답/증빙에서 확인된 근거 문장을 함께 표시합니다.
- D/A/M/L별 예상 점수, 충족률, 평가 신뢰도를 계산해 사전평가 검토용으로 제공합니다.
- route, not applicable, best row, row-level, partial scoring 문구를 감지해 점수 계산 참고사항으로 표시합니다.
- A/A- 필수조건과 산업특수 문항 적용 후보는 평가 화면의 별도 패널로 보여줍니다.
- 이 결과는 사전평가 보조이며 공식 점수 확정이 아닙니다.

## GPT Generation

- 브라우저는 문항번호, 모듈, 국문/영문 작성안내, 평가기준, 배점, 증빙자료, 키워드를 `/api/generate`로 보냅니다.
- `server.py`는 `OPENAI_API_KEY` 환경변수로만 OpenAI Responses API를 호출합니다.
- API 키는 HTML, JavaScript, JSON 데이터셋, GitHub 저장소에 저장하지 않습니다.
- 증빙에 없는 수치, 날짜, 목표, 검증 여부는 자동으로 단정하지 않고 대괄호 placeholder로 남기도록 지시합니다.
- GPT 생성 후에도 기존 D/A/M/L 충족 점검을 다시 실행합니다.

## Persistence Design

- 작업 상태는 브라우저 탭의 `sessionStorage`에 자동 임시저장합니다.
- 저장 항목은 회사명, 섹터, 키워드, 증빙 입력, 문항별 초안, 선택 문항, 보기 언어입니다.
- 데이터셋 URL이 다르면 이전 작업 상태를 자동 복원하지 않습니다.
- 민감자료 보호를 위해 내보내기 화면에 `임시저장 초기화` 버튼을 제공합니다.
- `sessionStorage`는 같은 탭 새로고침 복구를 지원하지만, 브라우저 탭을 닫으면 사라질 수 있습니다.

## File Extraction

- DOCX: `word/*.xml` 텍스트 추출
- PPTX: `ppt/slides/*.xml`, `ppt/notesSlides/*.xml` 텍스트 추출
- XLSX: `openpyxl` 우선 사용, 실패 시 ZIP XML fallback
- PDF: `pypdf` 사용 가능 시 텍스트 추출
- TXT/CSV/JSON/MD: 인코딩 감지 후 텍스트 추출
- 업로드 방어선: 허용 확장자, 요청 크기, 개별 파일 크기, 파일 수, 압축 해제 크기, PDF 페이지 수, 추출 텍스트 길이 제한
- XLSX Export: `/api/export-xlsx`에서 전체 문항, 감점 문항, 필수조건, 산업특수 문항, 배점요약, 증빙매핑 시트를 생성합니다.

## Public Link Design

- GitHub Pages 배포 워크플로를 제공해 상시 정적 링크를 유지합니다.
- 정적 링크에서는 데이터셋 탐색, 작성안내/평가기준 확인, 수동 증빙 붙여넣기, 브라우저 임시저장이 가능합니다.
- 파일 추출과 GPT 생성은 서버 기능이므로 로컬 서버 또는 별도 보안 서버 배포가 필요합니다.

## Implementation Map

- `server.py`: 정적 파일 제공, gzip 압축, `/api/extract` 파일 추출 API, `/api/generate` GPT 생성 API
- `index.html`: 단일 페이지 레이아웃과 템플릿
- `styles.css`: 업무용 UI 스타일
- `app.js`: 상태 관리, 자동 임시저장, 문항 탐색, 초안 생성, 평가 점검, 내보내기
- `scripts/build_2026_dataset.py`: 2026 원본 자료 기반 데이터셋 생성
- `scripts/polish_korean_titles.py`: 문항명 국문 품질 보정
- `scripts/normalize_korean_mixed_text.py`: 국문 필드의 영문 혼용 정규화
