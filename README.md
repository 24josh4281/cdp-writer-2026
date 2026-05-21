# CDP Writer 2026

CDP 평가방법론을 기준으로 문항별 최대득점 경로, 증빙 기반 답변 작성, D/A/M/L 충족 확인, 감점 개선사항을 한 화면에서 처리하는 로컬 웹앱입니다.

## 실행 방법

```powershell
cd "B:\CODEX\Old\CDP Evaluation\CDP-Writer-2026"
python server.py --port 8780
```

브라우저에서 다음 주소를 엽니다.

```text
http://127.0.0.1:8780
```

## 현재 포함 데이터

- 기본 데이터셋: 2026 CDP Full Corporate Questionnaire
- 2026 문항 수: 370개
- 2026 참고문서: 9개
  - Questionnaire overview
  - Questionnaire setup
  - Glossary
  - Scoring introduction
  - Scoring changes
  - Climate change scoring category weightings
  - Climate change essential criteria
  - Water security essential criteria
  - Industry impact classification

## 현재 포함 기능

- 2026 CDP 전체 기업 문항 로드
- 2025 CDP Climate Change CH 파일럿 데이터 선택 가능
- 문항명 한국어/영어 병기
- 한국어 / English / 한·영 보기 전환
- 문항별 최대득점 경로 표시
- 문항별 작성안내, 평가기준, 점수 배분, 태그/변경사항 탭 표시
- References 화면에서 작성안내·평가방법론·필수조건·가중치·산업분류 문서 확인
- 필요 증빙과 개선사항 표시
- 지속가능경영보고서/증빙자료 텍스트 기반 답변 초안 생성
- 글자수 제한 반영
- D/A/M/L 충족 가능성 즉시 확인
- 감점/부분충족 후보 모아보기
- DOCX, PPTX, XLSX, TXT, CSV, JSON 파일 텍스트 추출
- 작성 결과 CSV/JSON 내보내기

## 사용 흐름

1. `Evidence`에서 보고서, PPT, 엑셀, 텍스트 파일을 업로드합니다.
2. `Writer`에서 문항을 선택합니다.
3. 회사명, 섹터, 글자수, 키워드를 입력합니다.
4. `답변 초안 생성`을 누릅니다.
5. 오른쪽의 D/A/M/L 충족 확인에서 부족 요소를 확인합니다.
6. `Evaluation`에서 감점 후보만 모아 봅니다.
7. `Export`에서 CSV 또는 JSON으로 내보냅니다.

## 2026 데이터 재생성

INPUT 폴더의 2026 PDF를 다시 반영해야 할 때:

```powershell
$env:CDP_2026_INPUT_DIR = "B:\CODEX\Old\CDP Evaluation\inputs\2026 CDP 자료"
python scripts\build_2026_dataset.py
```

## 주의사항

- 2026 국문 필드는 검토 편의를 위한 보조 번역/요약입니다. 공식 판단은 영문 원문을 우선하십시오.
- 자동 충족 판단은 공식 점수 확정이 아니라 사전 QA입니다.
- PDF 추출은 로컬 Python 환경에 `pypdf`가 있을 때만 동작합니다. 없으면 관련 문단을 직접 붙여넣으세요.

## 프로젝트 구조

```text
.
├─ index.html
├─ app.js
├─ styles.css
├─ server.py
├─ scripts/
│  └─ build_2026_dataset.py
├─ data/
│  ├─ cdp_2026_full_dataset.json
│  └─ cdp_cc_ch_model_answers.json
└─ docs/
   ├─ 01-plan/features/
   └─ 02-design/features/
```
