# CDP Methodology Sync Center - PDCA 결과

작성일: 2026-05-22

## Current Situation

CDP 2026 평가방법론은 CDP Portal에서 확인 및 PDF export가 가능하다. 포털 자료는 로그인, 권한, export 형식, 게시 시점에 따라 달라질 수 있으므로, 앱이 임의로 실시간 덮어쓰기를 수행하면 평가 결과가 갑자기 바뀌는 리스크가 있다.

## Problem Understanding

목표는 최신 CDP 기업 평가방법론을 사전평가 기능에 반영하는 것이다. 단, 정확도가 중요하므로 자동 크롤링보다 공식 export 파일을 기준으로 변경 후보를 검토하고 승인 적용하는 방식이 적합하다.

## Approach

1. `방법론 동기화` 메뉴 추가
2. CDP Portal export 파일 업로드
3. 기존 `/api/extract`를 재사용해 PDF/XLSX/DOCX/PPTX/TXT 텍스트 추출
4. 문항번호 기준으로 현재 데이터셋과 포털 export 텍스트 비교
5. 변경 후보, 배점 차이, 평가조건 수 변화를 표시
6. 사용자가 승인하면 현재 브라우저 세션의 평가기준 overlay로 적용
7. 원본 데이터셋은 보존하고, 초기화로 rollback 가능
8. 사전평가 XLSX와 JSON 리포트에 동기화 이력 포함

## Implemented

- `index.html`: 사이드 메뉴와 `syncTemplate` 추가
- `app.js`: 방법론 파일 분석, 변경 후보 생성, 승인 적용, 초기화, 리포트 export 추가
- `README.md`: 동기화 센터 사용법 추가
- `workbookPayload`: `방법론동기화` 시트 추가

## Validation Plan

- `node --check app.js`
- `python -m py_compile server.py`
- `/api/health` 확인
- 샘플 텍스트 파일 업로드 분석
- XLSX 내보내기 정상 생성 확인

## Remaining Risks

- Portal export 파일의 문항번호/줄바꿈 구조가 크게 바뀌면 일부 문항 매칭이 누락될 수 있다.
- 승인 적용은 원본 JSON 파일을 변경하지 않는 세션 overlay이다. 공식 기준으로 장기 반영하려면 별도 dataset build 단계가 필요하다.
- CDP 저작권 및 포털 이용약관을 준수해야 하며, 로그인 정보나 세션 쿠키를 앱에 저장하지 않는다.
