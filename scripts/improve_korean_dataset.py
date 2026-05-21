from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "data" / "cdp_2026_full_dataset.json"


PHRASE_REPLACEMENTS: list[tuple[str, str]] = [
    ("Requested Content", "작성안내"),
    ("Additional Information", "추가 정보"),
    ("Explanation of Terms", "용어 설명"),
    ("Change From Last Year", "전년 대비 변경사항"),
    ("Scoring - Question Level", "문항별 평가기준"),
    ("Scoring - Point Allocation", "점수 배분"),
    ("Disclosure scoring criteria", "공시 평가기준"),
    ("Awareness scoring criteria", "인식 평가기준"),
    ("Management scoring criteria", "관리 평가기준"),
    ("Leadership scoring criteria", "리더십 평가기준"),
    ("Climate change scoring criteria for all sectors", "기후변화 평가기준 - 전체 섹터"),
    ("Forests scoring criteria for all sectors", "산림 평가기준 - 전체 섹터"),
    ("Water scoring criteria for all sectors", "물 평가기준 - 전체 섹터"),
    ("Climate change point allocations for all sectors", "기후변화 배점 - 전체 섹터"),
    ("Forests point allocations for all sectors", "산림 배점 - 전체 섹터"),
    ("Water point allocations for all sectors", "물 배점 - 전체 섹터"),
    ("Points will be awarded per completed cell in proportion to the number of cells displayed.", "표시된 셀 수 대비 작성 완료된 셀 수에 비례하여 점수가 부여됩니다."),
    ("A maximum of", "최대"),
    ("points is available for this question.", "점까지 받을 수 있습니다."),
    ("point is available for this question.", "점까지 받을 수 있습니다."),
    ("points", "점"),
    ("point", "점"),
    ("Not scored.", "평가 제외."),
    ("Not scored", "평가 제외"),
    ("Select one option", "하나의 선택지를 선택하십시오."),
    ("Select all that apply", "해당하는 항목을 모두 선택하십시오."),
    ("Complete the following table", "다음 표를 작성하십시오."),
    ("Write your answer here", "답변을 작성하십시오."),
    ("Note:", "참고:"),
    ("Note", "참고"),
    ("Please explain", "설명하십시오"),
    ("please explain", "설명하십시오"),
    ("Please provide", "제공하십시오"),
    ("please provide", "제공하십시오"),
    ("provide details", "세부 정보를 제공"),
    ("Provide details", "세부 정보를 제공"),
    ("provide a value", "값을 제공"),
    ("provide the value", "값을 제공"),
    ("provide", "제공"),
    ("reported", "보고된"),
    ("reporting", "보고"),
    ("report", "보고"),
    ("disclose", "공시"),
    ("disclosed", "공시된"),
    ("disclosing", "공시"),
    ("Text field", "서술형 입력란"),
    ("Numerical field", "숫자 입력란"),
    ("Percentage field", "비율 입력란"),
    ("Attach a file", "파일을 첨부하십시오."),
    ("From (years)", "From (years)"),
    ("To (years)", "To (years)"),
    ("column", "열"),
    ("row", "행"),
    ("questions", "문항"),
    ("question", "문항"),
    ("this question", "이 문항"),
    ("This question", "이 문항"),
    ("this column", "이 열"),
    ("This column", "이 열"),
    ("this row", "이 행"),
    ("This row", "이 행"),
    ("the following", "다음"),
    ("following", "다음"),
    ("additional", "추가"),
    ("General", "일반"),
    ("Publicly traded organization", "상장 조직"),
    ("Privately owned organization", "비상장 민간 조직"),
    ("State owned organization", "국영 조직"),
    ("Partially privately owned and partially state owned organization", "민간 및 국영 지분이 혼합된 조직"),
    ("Type of financial institution", "금융기관 유형"),
    ("Organization type", "조직 유형"),
    ("Description of organization", "조직 설명"),
    ("Description of legislative mandate", "법적 권한 설명"),
    ("reporting boundary", "보고경계"),
    ("reporting period", "보고기간"),
    ("financial statements", "재무제표"),
    ("consolidation approach", "연결 접근법"),
    ("operational control", "운영통제"),
    ("financial control", "재무통제"),
    ("equity share", "지분할당"),
    ("environmental performance data", "환경성과 데이터"),
    ("GHG emissions", "온실가스 배출량"),
    ("greenhouse gas emissions", "온실가스 배출량"),
    ("emissions data", "배출량 데이터"),
    ("water withdrawals", "취수량"),
    ("water discharges", "방류량"),
    ("water consumption", "물 소비량"),
    ("dependencies", "의존도"),
    ("dependency", "의존도"),
    ("impacts", "영향"),
    ("impact", "영향"),
    ("risks", "리스크"),
    ("risk", "리스크"),
    ("opportunities", "기회"),
    ("opportunity", "기회"),
    ("short-, medium- and long-term", "단기·중기·장기"),
    ("short-, medium-, and long-term", "단기·중기·장기"),
    ("short-term", "단기"),
    ("Short-term", "단기"),
    ("medium-term", "중기"),
    ("Medium-term", "중기"),
    ("long-term", "장기"),
    ("Long-term", "장기"),
    ("time horizons", "시간범위"),
    ("time horizon", "시간범위"),
    ("strategic and/or financial planning", "전략 및/또는 재무계획"),
    ("strategic or financial planning", "전략 또는 재무계획"),
    ("financial planning", "재무계획"),
    ("strategic planning", "전략계획"),
    ("capital planning", "자본계획"),
    ("business strategy", "사업 전략"),
    ("scenario analysis", "시나리오 분석"),
    ("scenario used", "사용한 시나리오"),
    ("analysis frequency", "분석 빈도"),
    ("climate transition plan", "기후 전환계획"),
    ("transition plan", "전환계획"),
    ("board of directors", "이사회"),
    ("equivalent governing body", "동등한 의사결정기구"),
    ("board-level oversight", "이사회 차원의 감독"),
    ("C-suite", "최고경영진"),
    ("governance", "거버넌스"),
    ("policy", "정책"),
    ("procedure", "절차"),
    ("procedures", "절차"),
    ("processes", "프로세스"),
    ("process", "프로세스"),
    ("targets", "목표"),
    ("target", "목표"),
    ("base year", "기준연도"),
    ("target year", "목표연도"),
    ("near-term", "단기"),
    ("net-zero", "넷제로"),
    ("renewable electricity", "재생전력"),
    ("energy consumption", "에너지 소비량"),
    ("fuel consumption", "연료 소비량"),
    ("gross global Scope 1 emissions", "전 세계 총 Scope 1 배출량"),
    ("gross global Scope 2 emissions", "전 세계 총 Scope 2 배출량"),
    ("Scope 1 emissions", "Scope 1 배출량"),
    ("Scope 2 emissions", "Scope 2 배출량"),
    ("Scope 3 emissions", "Scope 3 배출량"),
    ("value chain", "가치사슬"),
    ("supplier engagement", "공급업체 참여"),
    ("suppliers", "공급업체"),
    ("supplier", "공급업체"),
    ("verification", "검증"),
    ("assurance", "보증"),
    ("methodology", "방법론"),
    ("calculation", "산정"),
    ("emission factor", "배출계수"),
    ("emission factors", "배출계수"),
    ("market-based", "시장기반"),
    ("location-based", "지역기반"),
    ("portfolio", "포트폴리오"),
    ("financed emissions", "금융배출량"),
    ("portfolio impact", "포트폴리오 영향"),
    ("financial products and services", "금융상품 및 서비스"),
    ("investments", "투자"),
    ("Climate Change", "기후변화"),
    ("climate change", "기후변화"),
    ("Water Security", "물 안보"),
    ("water security", "물 안보"),
    ("Forests", "산림"),
    ("forests", "산림"),
    ("Biodiversity", "생물다양성"),
    ("biodiversity", "생물다양성"),
    ("Plastics", "플라스틱"),
    ("plastics", "플라스틱"),
    ("organization-wide", "조직 전체"),
    ("organizations", "조직"),
    ("organization", "조직"),
    ("your organization", "귀사"),
    ("Your organization", "귀사"),
    ("your process", "귀사의 프로세스"),
    ("your processes", "귀사의 프로세스"),
    ("your response", "귀사의 응답"),
    ("your disclosure", "귀사의 공시"),
    ("your portfolio", "귀사의 포트폴리오"),
    ("your operations", "귀사의 운영"),
    ("your strategy", "귀사의 전략"),
    ("your financial planning", "귀사의 재무계획"),
    ("your value chain", "귀사의 가치사슬"),
    ("company", "회사"),
    ("companies", "회사"),
    ("businesses", "사업"),
    ("business", "사업"),
    ("data users", "데이터 이용자"),
    ("users", "이용자"),
    ("user", "이용자"),
    ("disclosure", "공시"),
    ("disclosures", "공시"),
    ("response", "응답"),
    ("respondents", "응답 기업"),
    ("CDP’s corporate questionnaire", "CDP 기업 질문지"),
    ("financial statement", "재무제표"),
    ("financial statements", "재무제표"),
    ("IFRS and ESRS reporting standards", "IFRS 및 ESRS 보고 기준"),
    ("global standards", "글로벌 기준"),
    ("legal or accounting advisor", "법무 또는 회계 자문가"),
    ("entities", "대상 법인"),
    ("entity", "대상 법인"),
    ("consolidated accounting group", "연결 회계 그룹"),
    ("facilities", "사업장"),
    ("facility", "사업장"),
    ("geolocation data", "지리적 위치 데이터"),
    ("approximate proportion", "대략적인 비율"),
    ("latitude", "위도"),
    ("longitude", "경도"),
    ("nameplate capacity", "정격용량"),
    ("electricity generation", "전력 생산"),
    ("power generation", "발전"),
    ("technology employed", "적용 기술"),
    ("agricultural commodities", "농산물 원자재"),
    ("commodity", "원자재"),
    ("commodities", "원자재"),
    ("produces", "생산하는"),
    ("sources", "조달하는"),
    ("sourced", "조달한"),
    ("significant", "중요한"),
    ("revenue", "매출"),
    ("board", "이사회"),
    ("equivalent body", "동등한 기구"),
    ("key functions", "핵심 기능"),
    ("organizational purpose", "조직 목적"),
    ("two-tier board system", "이원화된 이사회 구조"),
    ("frequency", "빈도"),
    ("meets", "개최됩니다"),
    ("committee", "위원회"),
    ("committees", "위원회"),
    ("individuals", "개인"),
    ("positions", "직책"),
    ("accountability", "책임"),
    ("oversight", "감독"),
    ("mechanisms", "메커니즘"),
    ("mechanism", "메커니즘"),
    ("competency", "역량"),
    ("competence", "역량"),
    ("environmental expertise", "환경 전문성"),
    ("senior management-level", "고위 경영진 수준"),
    ("responsibility", "책임"),
    ("responsible", "책임이 있는"),
    ("management-level responsibility", "경영진 수준의 책임"),
    ("publicly available", "공개적으로 이용 가능한"),
    ("available", "이용 가능한"),
    ("outcomes", "결과"),
    ("preferred future", "선호하는 미래"),
    ("plausible future states", "개연성 있는 미래 상태"),
    ("normative scenarios", "규범적 시나리오"),
    ("exploratory scenarios", "탐색적 시나리오"),
    ("lending", "대출"),
    ("insurance", "보험"),
    ("investing activities", "투자 활동"),
    ("asset managers", "자산운용사"),
    ("asset owners", "자산소유자"),
    ("banks", "은행"),
    ("credit and exclusion policies", "여신 및 제외 정책"),
    ("temperature alignment", "온도 목표 정렬"),
    ("standalone element", "독립된 요소"),
    ("Technical Note", "기술노트"),
    ("structural changes", "구조적 변화"),
    ("structural change", "구조적 변화"),
    ("acquired", "인수한"),
    ("divested", "매각한"),
    ("merged", "합병한"),
    ("completion dates", "완료일"),
    ("methodological", "방법론적"),
    ("methodology protocol", "방법론 프로토콜"),
    ("boundary", "경계"),
    ("reporting year", "보고연도"),
    ("base year recalculation policy", "기준연도 재산정 정책"),
    ("recalculated", "재산정된"),
    ("material", "중요한"),
    ("threshold", "임계값"),
    ("water-related data", "물 관련 데이터"),
    ("water aspects", "물 관련 항목"),
    ("measured and monitored", "측정 및 모니터링"),
    ("regularly measured", "정기적으로 측정"),
    ("monitored", "모니터링됨"),
    ("Not monitored", "모니터링하지 않음"),
    ("operations", "운영"),
    ("direct operations", "직접 운영"),
    ("hydropower operations", "수력발전 운영"),
    ("dam operation", "댐 운영"),
    ("natural river flow", "자연 하천 유량"),
    ("fossil fuel assets", "화석연료 자산"),
    ("financing and insurance", "금융 및 보험"),
    ("financing", "금융"),
    ("asset class", "자산군"),
    ("industry", "산업"),
    ("carbon footprinting metrics", "탄소발자국 지표"),
    ("metric value", "지표값"),
    ("metric", "지표"),
    ("method of allocation", "배분 방법"),
    ("assumptions", "가정"),
    ("assessment", "평가"),
    ("assessment process", "평가 프로세스"),
    ("approach", "접근법"),
    ("details", "세부 정보"),
    ("further details", "추가 세부 정보"),
    ("completed", "작성 완료된"),
    ("complete", "작성"),
    ("must be completed", "반드시 작성해야 함"),
    ("selected", "선택된"),
    ("select", "선택"),
    ("Select", "선택"),
    ("where", "다음의 경우"),
    ("whether", "여부"),
    ("only", "만"),
    ("should", "해야 합니다"),
    ("must", "해야 합니다"),
    ("will be", "됩니다"),
    ("can be", "될 수 있습니다"),
    ("used", "사용된"),
    ("using", "사용하여"),
    ("include", "포함"),
    ("included", "포함된"),
    ("including", "포함"),
    ("exclude", "제외"),
    ("excluding", "제외"),
    ("within", "이내"),
    ("next two years", "향후 2년 이내"),
    ("in the reporting year", "보고연도에"),
    ("across", "전반에 걸쳐"),
    ("both", "둘 다"),
    ("either", "둘 중 하나"),
    ("each", "각"),
    ("total", "총"),
    ("percentage", "비율"),
    ("% of", "비율"),
    ("figure", "수치"),
    ("figures", "수치"),
    ("other, please specify", "기타, 직접 입력"),
    ("Other, please specify", "기타, 직접 입력"),
    ("Yes", "예"),
    ("No", "아니요"),
]


TITLE_PATTERNS: list[tuple[str, str]] = [
    ("in which language are you submitting your response", "응답 제출 언어를 선택하십시오."),
    ("select the currency used for all financial information", "응답 전반의 모든 재무정보에 사용할 통화를 선택하십시오."),
    ("provide an overview and introduction to your organization", "귀사의 개요와 소개 정보를 제공하십시오."),
    ("what is your organization’s annual revenue", "보고기간 동안 귀사의 연간 매출액은 얼마입니까?"),
    ("provide details on your reporting boundary", "보고경계에 대한 세부 정보를 제공하십시오."),
    ("does your organization have an isin code", "귀사는 ISIN 코드 또는 기타 고유 식별자를 보유하고 있습니까?"),
    ("select the countries/areas in which you operate", "귀사가 운영되는 국가/지역을 선택하십시오."),
    ("are you able to provide geolocation data", "귀사는 사업장의 지리적 위치 데이터를 제공할 수 있습니까?"),
    ("has your organization mapped its value chain", "귀사는 가치사슬을 매핑했습니까?"),
    ("for your electricity generation activities", "귀사의 전력 생산 활동에 대해 적용 기술별 정격용량과 전력 생산 세부 정보를 제공하십시오."),
    ("which of the following agricultural commodities", "다음 농산물 원자재 중 귀사가 생산 및/또는 조달하며 매출 기준으로 가장 중요한 항목은 무엇입니까?"),
    ("how does your organization define short-, medium-", "귀사는 환경 의존도, 영향, 리스크 및 기회의 식별·평가·관리와 관련해 단기·중기·장기 시간범위를 어떻게 정의합니까?"),
    ("does your organization have a process for identifying", "귀사는 환경 의존도, 영향, 리스크 및 기회를 식별·평가·관리하는 프로세스를 보유하고 있습니까?"),
    ("have you identified any environmental risks", "귀사는 환경 관련 리스크를 식별했습니까?"),
    ("have you identified any environmental opportunities", "귀사는 환경 관련 기회를 식별했습니까?"),
    ("does your organization have a board of directors", "귀사는 이사회 또는 동등한 의사결정기구를 보유하고 있습니까?"),
    ("is there board-level oversight", "환경 이슈에 대한 이사회 차원의 감독이 있습니까?"),
    ("identify the positions", "환경 이슈에 대한 책임을 가진 이사회 내 개인 또는 위원회의 직책을 식별하고, 이사회의 감독 내용을 제공하십시오."),
    ("does your organization’s board have competency", "귀사의 이사회는 환경 이슈에 대한 역량을 보유하고 있습니까?"),
    ("provide the highest senior management-level positions", "환경 이슈에 대한 책임을 가진 최고위 경영진 직책 또는 위원회를 제공하십시오."),
    ("does your organization use scenario analysis", "귀사는 환경 관련 결과를 식별하기 위해 시나리오 분석을 사용합니까?"),
    ("provide details of the scenarios used", "귀사의 시나리오 분석에 사용한 시나리오의 세부 정보를 제공하십시오."),
    ("provide details of the outcomes", "귀사의 시나리오 분석 결과에 대한 세부 정보를 제공하십시오."),
    ("does your organization’s strategy include a climate transition plan", "귀사의 전략에는 기후 전환계획이 포함되어 있습니까?"),
    ("is this your first year of reporting emissions data", "CDP에 배출량 데이터를 보고하는 첫해입니까?"),
    ("has your organization undergone any structural changes", "귀사는 보고연도에 구조적 변화를 겪었거나 이전 구조적 변화를 배출량 데이터 공시에 반영하고 있습니까?"),
    ("has your emissions accounting methodology", "보고연도에 배출량 산정 방법론, 경계 및/또는 보고연도 정의가 변경되었습니까?"),
    ("have your organization’s base year emissions", "7.1.1 및/또는 7.1.2에서 보고한 변경 또는 오류로 인해 기준연도 및 과거연도 배출량을 재산정했습니까?"),
    ("provide your gross global scope 1 emissions", "전 세계 총 Scope 1 배출량을 제공하십시오."),
    ("provide your gross global scope 2 emissions", "전 세계 총 Scope 2 배출량을 제공하십시오."),
    ("account for your organization’s gross global scope 3 emissions", "귀사의 전 세계 총 Scope 3 배출량을 산정하여 제공하십시오."),
    ("are there any exclusions from your disclosure of water-related data", "물 관련 데이터 공시에서 제외된 항목이 있습니까?"),
    ("provide details on these exclusions", "이러한 제외 항목에 대한 세부 정보를 제공하십시오."),
    ("across all your operations", "귀사의 전체 운영에서 다음 물 관련 항목 중 정기적으로 측정 및 모니터링되는 비율은 얼마입니까?"),
    ("for your hydropower operations", "귀사의 수력발전 운영에서 다음 물 관련 항목 중 정기적으로 측정 및 모니터링되는 비율은 얼마입니까?"),
    ("does your organization measure the impact of your portfolio on the environment", "귀사는 포트폴리오가 환경에 미치는 영향을 측정합니까?"),
    ("disclose or restate your financed emissions", "이전 연도의 금융배출량을 공시하거나 재작성하십시오."),
    ("provide details of the other metrics", "포트폴리오가 환경에 미치는 영향을 추적하는 데 사용하는 기타 지표의 세부 정보를 제공하십시오."),
    ("break down your organization’s financed emissions", "귀사의 금융배출량 및 기타 포트폴리오 탄소발자국 지표를 자산군, 산업 및/또는 Scope별로 구분하십시오."),
    ("state the values of your financing and insurance of fossil fuel assets", "보고연도 중 화석연료 자산에 대한 금융 및 보험 금액을 기재하십시오."),
    ("do you have plastics-related targets", "플라스틱 관련 목표가 있습니까?"),
    ("provide details of your plastics-related targets", "플라스틱 관련 목표의 세부 정보를 제공하십시오."),
    ("indicate whether your organization engages in the following activities", "귀사가 다음 활동에 참여하는지 표시하십시오."),
    ("provide the total weight of plastic polymers sold", "판매한 플라스틱 폴리머의 총 중량을 제공하십시오."),
]


TITLE_REGEX_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"Please provide all available geolocation data for your facilities\.?", re.I), "사업장에 대해 이용 가능한 모든 지리적 위치 데이터를 제공하십시오."),
    (re.compile(r"What was the size of your organization based on total assets value at the end of the reporting period\?", re.I), "보고기간 말 총자산 기준 귀사의 규모는 얼마입니까?"),
    (re.compile(r"In which part of the (.+?) value chain does your organization operate\?", re.I), r"귀사는 \1 가치사슬의 어느 부분에서 운영됩니까?"),
    (re.compile(r"For which transport modes will you be providing data\?", re.I), "어떤 운송수단에 대해 데이터를 제공할 예정입니까?"),
    (re.compile(r"Have you mapped where in your direct operations or elsewhere in your value chain plastics are produced, commercialized, used, and/or disposed of\?", re.I), "직접 운영 또는 가치사슬 내에서 플라스틱이 생산·상업화·사용·폐기되는 위치를 매핑했습니까?"),
    (re.compile(r"Does your organization consider environmental information about your clients/investees as part of your due diligence.*", re.I), "귀사는 실사 또는 환경 의존도·영향·리스크·기회 평가 과정에서 고객/피투자사의 환경 정보를 고려합니까?"),
    (re.compile(r"Indicate the environmental information your organization considers about clients/investees.*", re.I), "고객/피투자사에 대해 고려하는 환경 정보와 그 정보가 의사결정에 미치는 영향을 표시하십시오."),
    (re.compile(r"Have you identified priority locations across your value chain\?", re.I), "귀사는 가치사슬 전반에서 우선순위 지역을 식별했습니까?"),
    (re.compile(r"How does your organization define substantive effects on your organization\?", re.I), "귀사는 자사에 대한 중대한 영향을 어떻게 정의합니까?"),
    (re.compile(r"Describe how your organization minimizes the adverse impacts of potential water pollutants.*", re.I), "귀사의 활동과 관련된 잠재적 수질오염물질이 수생태계 또는 인체 건강에 미치는 부정적 영향을 어떻게 최소화하는지 설명하십시오."),
    (re.compile(r"By river basin, what number of active and inactive tailings dams are within your control\?", re.I), "유역별로 귀사가 통제하는 운영 중 및 비운영 광미댐 수는 몇 개입니까?"),
    (re.compile(r"Do you evaluate and classify the tailings dams under your control.*", re.I), "귀사는 통제하에 있는 광미댐을 사고 발생 시 인체 건강과 생태계에 미치는 결과에 따라 평가·분류합니까?"),
    (re.compile(r"To manage the potential impacts to human health or water ecosystems associated with the tailings dams.*", re.I), "통제하에 있는 광미댐과 관련된 인체 건강 또는 수생태계 잠재 영향을 관리하기 위해 모든 댐에 어떤 절차를 적용하고 있습니까?"),
    (re.compile(r"Provide details of the environmental risks identified which have had.*", re.I), "보고연도에 귀사에 중대한 영향을 미쳤거나 향후 중대한 영향을 미칠 것으로 예상되는 환경 리스크의 세부 정보를 제공하십시오."),
    (re.compile(r"Provide details of the environmental opportunities identified which have had.*", re.I), "보고연도에 귀사에 중대한 영향을 미쳤거나 향후 중대한 영향을 미칠 것으로 예상되는 환경 기회의 세부 정보를 제공하십시오."),
    (re.compile(r"Provide the amount and proportion of your financial metrics.*environmental risks\.?", re.I), "환경 리스크의 중대한 영향에 취약한 재무지표의 금액과 비율을 제공하십시오."),
    (re.compile(r"Provide the amount and proportion of your financial metrics.*environmental opportunities\.?", re.I), "환경 기회의 중대한 영향과 연계된 재무지표의 금액과 비율을 제공하십시오."),
    (re.compile(r"Within each river basin, how many facilities are exposed.*", re.I), "각 유역에서 물 관련 리스크의 중대한 영향에 노출된 사업장은 몇 개이며, 전체 사업장 수 대비 비율은 얼마입니까?"),
    (re.compile(r"Select the carbon pricing regulation.*", re.I), "귀사의 운영에 영향을 미치는 탄소가격제 규제를 선택하십시오."),
    (re.compile(r"Provide details of each Emissions Trading Scheme.*", re.I), "귀사가 적용받는 각 배출권거래제(ETS)의 세부 정보를 제공하십시오."),
    (re.compile(r"What is your strategy for complying with the systems.*", re.I), "귀사가 적용받거나 향후 적용될 것으로 예상되는 제도를 준수하기 위한 전략은 무엇입니까?"),
    (re.compile(r"Have environmental risks and opportunities affected your strategy and/or financial planning\?", re.I), "환경 리스크와 기회가 귀사의 전략 및/또는 재무계획에 영향을 미쳤습니까?"),
    (re.compile(r"Describe where and how environmental risks and opportunities have affected your strategy.*", re.I), "환경 리스크와 기회가 귀사의 전략에 어디에서 어떻게 영향을 미쳤는지 설명하십시오."),
    (re.compile(r"Describe where and how environmental risks and opportunities have affected your financial planning\.?", re.I), "환경 리스크와 기회가 귀사의 재무계획에 어디에서 어떻게 영향을 미쳤는지 설명하십시오."),
    (re.compile(r"In your organization’s financial accounting, do you identify spending/revenue.*", re.I), "귀사의 재무회계에서 기후 전환과 연계된 지출 또는 매출을 식별합니까?"),
    (re.compile(r"Quantify the amount and percentage share of your spending/revenue.*", re.I), "기후 전환과 연계된 지출 또는 매출의 금액과 비율을 정량화하십시오."),
    (re.compile(r"Quantify the percentage share of your spending/revenue.*sustainable finance taxonomy.*", re.I), "보고연도에 지속가능금융 분류체계상 적격 및 연계 활동과 관련된 지출 또는 매출 비율을 정량화하십시오."),
    (re.compile(r"Does your organization invest in research and development.*low-carbon products.*", re.I), "귀사는 섹터 활동과 관련된 저탄소 제품 또는 서비스 연구개발(R&D)에 투자합니까?"),
    (re.compile(r"Provide details of your organization's investments in low-carbon R&D.*", re.I), "최근 3년간 섹터 활동과 관련된 저탄소 R&D 투자 세부 정보를 제공하십시오."),
    (re.compile(r"Are there any sources .*Scope 1, Scope 2 or Scope 3 emissions.*excluded.*", re.I), "Scope 1, Scope 2 또는 Scope 3 배출량 중 기후 관련 데이터 공시에서 제외된 배출원이 있습니까?"),
    (re.compile(r"Provide details of the sources of Scope 1, Scope 2, or Scope 3 emissions.*", re.I), "귀사의 공시에 포함되지 않은 Scope 1, Scope 2 또는 Scope 3 배출원의 세부 정보를 제공하십시오."),
    (re.compile(r"What were your organization’s gross global Scope 1 emissions.*", re.I), "귀사의 전 세계 총 Scope 1 배출량은 몇 tCO2e입니까?"),
    (re.compile(r"What were your organization’s gross global Scope 2 emissions.*", re.I), "귀사의 전 세계 총 Scope 2 배출량은 몇 tCO2e입니까?"),
    (re.compile(r"Disclose or restate your Scope 3 emissions data for previous years.*", re.I), "이전 연도의 Scope 3 배출량 데이터를 공시하거나 재작성하십시오."),
    (re.compile(r"In your oil & gas sector operations, what are the total volumes of water withdrawn.*", re.I), "석유·가스 부문 운영에서 취수·방류·소비한 총 물량은 얼마이며, 전년 대비 및 향후 전망은 어떠합니까?"),
    (re.compile(r"Indicate whether water is withdrawn from areas with water stress.*", re.I), "물 스트레스 지역에서 취수하는지 여부, 물량, 전년 대비 변화 및 향후 전망을 표시하십시오."),
    (re.compile(r"What proportion of the produced agricultural commodities.*water stress\?", re.I), "귀사에 중요한 생산 농산물 원자재 중 물 스트레스 지역에서 유래한 비율은 얼마입니까?"),
    (re.compile(r"What proportion of the sourced agricultural commodities.*water stress\?", re.I), "귀사에 중요한 조달 농산물 원자재 중 물 스트레스 지역에서 유래한 비율은 얼마입니까?"),
    (re.compile(r"Do you calculate water intensity.*chemical sector.*", re.I), "귀사는 화학 부문 활동에 대해 물 집약도 정보를 산정합니까?"),
    (re.compile(r"For your top five products by production weight/volume.*chemical sector.*", re.I), "생산 중량/부피 기준 상위 5개 제품에 대해 화학 부문 활동 관련 물 집약도 정보를 제공하십시오."),
    (re.compile(r"Do you calculate water intensity information for your metals and mining activities\?", re.I), "귀사는 금속 및 광업 활동에 대한 물 집약도 정보를 산정합니까?"),
    (re.compile(r"Do any of your products contain substances classified as hazardous.*", re.I), "귀사의 제품 중 규제기관이 유해물질로 분류한 물질을 포함한 제품이 있습니까?"),
    (re.compile(r"What percentage of your company’s revenue is associated with products containing substances classified as hazardous.*", re.I), "규제기관이 유해물질로 분류한 물질을 포함한 제품과 관련된 매출 비율은 얼마입니까?"),
    (re.compile(r"Do any of your existing products and services enable clients to mitigate.*", re.I), "귀사의 기존 제품과 서비스가 고객의 환경 이슈 완화 및/또는 적응을 지원합니까?"),
    (re.compile(r"Which data points within your CDP response are verified.*", re.I), "CDP 응답 내 어떤 데이터 포인트가 제3자 검증 또는 보증을 받았으며 어떤 기준을 사용했습니까?"),
    (re.compile(r"Provide the following information for the person that has signed off.*", re.I), "CDP 응답을 승인한 담당자의 다음 정보를 제공하십시오."),
    (re.compile(r"Please indicate your consent for CDP to share contact details.*", re.I), "CDP가 우선 유역의 공동 행동을 촉진하기 위해 Pacific Institute와 연락처 정보를 공유하는 데 동의하는지 표시하십시오."),
]


EXACT_BLOCKS: list[tuple[str, str]] = [
    (
        "From (years) (column 1) and To (years) (column 3)",
        "\nFrom (years)(열 1) 및 To (years)(열 3)\n",
    ),
    (
        "To define your short-, medium- and long-term time horizons, provide details of the length of time in the “From” and “To” years columns (e.g., from 5 to 10 years, or from 12 to 25 years).",
        "단기·중기·장기 시간범위를 정의하기 위해 ‘From’ 및 ‘To’ 연도 열에 각 시간범위의 길이를 입력하십시오. 예를 들어 5년부터 10년까지, 또는 12년부터 25년까지와 같이 작성합니다.",
    ),
    (
        "How this time horizon is linked to strategic and/or financial planning (column 4)",
        "\n이 시간범위가 전략 및/또는 재무계획과 어떻게 연결되는지(열 4)\n",
    ),
    (
        "Provide the reasons for the choice of time horizon and explain how the use of this time horizon supports your strategic and/or financial planning.",
        "해당 시간범위를 선택한 이유를 설명하고, 이 시간범위의 사용이 귀사의 전략 및/또는 재무계획을 어떻게 뒷받침하는지 설명하십시오.",
    ),
    (
        "If you undertake strategic and/or financial planning under a different timeframe, explain why the time horizon chosen for the identification, assessment, and management of environmental issues is different to that used in these other processes.",
        "전략 또는 재무계획에서 다른 시간범위를 사용하는 경우, 환경 이슈의 식별·평가·관리를 위해 선택한 시간범위가 다른 프로세스에서 사용하는 시간범위와 다른 이유를 설명하십시오.",
    ),
    (
        "TCFD and TNFD position on time horizons:",
        "\n시간범위에 대한 TCFD 및 TNFD의 입장\n",
    ),
    (
        "Because the timing of effects on organizations will vary, specifying set timeframes across sectors could hinder organizations’ consideration of the environmental risks and opportunities specific to their businesses.",
        "조직마다 영향이 발생하는 시점이 다르기 때문에, 모든 섹터에 동일한 시간범위를 지정하면 각 기업이 자사 사업에 특화된 환경 리스크와 기회를 고려하는 데 제약이 될 수 있습니다.",
    ),
    (
        "TCFD and TNFD do not define timeframes and encourage respondents to decide how to define their own timeframes considering the useful life of their assets or infrastructure, the profile of the environmental risks they face, the sectors and geographies in which they operate, and that environmental risks and opportunities can manifest themselves over the medium and long term.",
        "TCFD와 TNFD는 시간범위를 별도로 정의하지 않으며, 응답 기업이 자산 또는 인프라의 내용연수, 직면한 환경 리스크의 특성, 사업을 영위하는 섹터와 지역, 그리고 환경 리스크와 기회가 중장기적으로 나타날 수 있다는 점을 고려해 자체 시간범위를 정하도록 권장합니다.",
    ),
    (
        "In assessing environmental issues, organizations should be sensitive to the timeframe used to conduct their assessments.",
        "환경 이슈를 평가할 때에는 평가에 사용하는 시간범위가 적절한지 유의해야 합니다.",
    ),
    (
        "While many organizations conduct operational and financial planning over a 1–2-year timeframe, and strategic and capital planning over a 2-5-year timeframe, environmental risks and opportunities may have implications over a longer period.",
        "많은 조직이 운영 및 재무계획은 1~2년, 전략 및 자본계획은 2~5년 기준으로 수행하지만, 환경 리스크와 기회는 더 긴 기간에 걸쳐 영향을 미칠 수 있습니다.",
    ),
    (
        "It is therefore important for organizations to consider the appropriate timeframes when assessing environmental dependencies, impacts, risks, and opportunities.",
        "따라서 환경 의존도, 영향, 리스크 및 기회를 평가할 때 적절한 시간범위를 고려하는 것이 중요합니다.",
    ),
    (
        "Points will be awarded per completed cell in proportion to the number of cells displayed.",
        "표시된 셀 수 대비 작성 완료된 셀 수에 비례하여 점수가 부여됩니다.",
    ),
    (
        "Consecutive time horizons entered in rows 'Short-term', 'Medium-term', 'Long-term' - 3 points",
        "‘단기’, ‘중기’, ‘장기’ 행에 서로 연속되는 시간범위를 입력하면 3점입니다.",
    ),
    (
        "(Please note: As an example, 'Short-term' is '0-2', 'Medium term' is '3-9', and 'Long-term' is 'from 10 years' OR 'Short-term' is '0-3', 'Medium-term' is '3-10' and 'Long-term' is'from 10 years'. If 'No' is selected in column 'Is your long-term time horizon open ended?', column 'To (years)' must be completed to be eligible for awareness points.)",
        "(참고: 예를 들어 단기는 0~2년, 중기는 3~9년, 장기는 10년 이상으로 작성하거나, 단기는 0~3년, 중기는 3~10년, 장기는 10년 이상으로 작성할 수 있습니다. ‘장기 시간범위가 개방형입니까?’ 열에서 ‘아니요’를 선택한 경우 인식 점수를 받으려면 ‘To (years)’ 열을 작성해야 합니다.)",
    ),
]


REGEX_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"A maximum of\s+([\d.]+\/[\d.]+|[\d.]+)\s+points?\s+is available for this question\.?", re.I),
        r"이 문항은 최대 \1점까지 받을 수 있습니다.",
    ),
    (
        re.compile(r"This column (?:is only presented|only appears) if (.+?)(?=\.|$)", re.I),
        r"이 열은 \1 경우에만 표시됩니다.",
    ),
    (
        re.compile(r"This question only appears if (.+?)(?=\.|$)", re.I),
        r"이 문항은 \1 경우에만 표시됩니다.",
    ),
    (
        re.compile(r"If you select [“\"]([^”\"]+)[”\"](?: in column (\d+))?,?\s*(?:please )?(.*?)(?=\.|$)", re.I),
        r"\2열에서 ‘\1’을 선택한 경우 \3.",
    ),
    (
        re.compile(r"Only select [“\"]([^”\"]+)[”\"] if (.+?)(?=\.|$)", re.I),
        r"\2인 경우에만 ‘\1’을 선택하십시오.",
    ),
    (
        re.compile(r"You should only select [“\"]([^”\"]+)[”\"] if (.+?)(?=\.|$)", re.I),
        r"\2인 경우에만 ‘\1’을 선택하십시오.",
    ),
    (
        re.compile(r"Select [“\"]([^”\"]+)[”\"] regardless of whether (.+?)(?=\.|$)", re.I),
        r"\2 여부와 관계없이 ‘\1’을 선택하십시오.",
    ),
    (
        re.compile(r"Select the (.+?)(?=\.|$)", re.I),
        r"\1을(를) 선택하십시오.",
    ),
    (
        re.compile(r"Provide details on (.+?)(?=\.|$)", re.I),
        r"\1에 대한 세부 정보를 제공하십시오.",
    ),
    (
        re.compile(r"Provide details of (.+?)(?=\.|$)", re.I),
        r"\1의 세부 정보를 제공하십시오.",
    ),
    (
        re.compile(r"Please explain why (.+?)(?=\.|$)", re.I),
        r"\1인 이유를 설명하십시오.",
    ),
    (
        re.compile(r"All of the following met\s*-\s*([\d.]+)\s+points?", re.I),
        r"다음 조건을 모두 충족: \1점",
    ),
    (
        re.compile(r"Any of the following met\s*-\s*([\d.]+)\s+points?", re.I),
        r"다음 조건 중 하나 충족: \1점",
    ),
    (
        re.compile(r"(ROUTE|Route)\s+([A-Z])\)", re.I),
        r"경로 \2)",
    ),
]


BAD_PATTERNS = re.compile(
    r"제공하십시오\s+[A-Za-z]|조직s|사업es|프로세스es|리스크and|기회 specific|"
    r"financial planning|To define your|How this time horizon|Because the timing|"
    r"provide details|Select\s+[“\"']|Does your|What is|How does|Which of",
    re.I,
)


def clean_source(text: str) -> str:
    value = str(text or "")
    value = value.replace("\u00a0", " ").replace("\r", "")
    glue_fixes = {
        "andmanagement": "and management",
        "andmanagement": "and management",
        "risksand": "risks and",
        "assets orinfrastructure": "assets or infrastructure",
        "canmanifest": "can manifest",
        "conductoperational": "conduct operational",
        "mayhave": "may have",
        "environmentaldependencies": "environmental dependencies",
        "environmentalissues": "environmental issues",
        "from12": "from 12",
        "and/orfinancial": "and/or financial",
        "tosupport": "to support",
        "yourorganization": "your organization",
        "criteriaPoints": "criteria Points",
        "criteriaNot": "criteria Not",
        "pointsA maximum": "points. A maximum",
        "pointA maximum": "point. A maximum",
        "pointsFull": "points. Full",
        "pointFull": "point. Full",
        "pointsOR": "points. OR",
        "pointOR": "point. OR",
        "ORRow": "OR Row",
        "andRow": "and Row",
    }
    for src, dst in glue_fixes.items():
        value = value.replace(src, dst)
    value = re.sub(r"(scoring criteria)(?=[A-Z'‘])", r"\1 ", value)
    value = re.sub(r"(points?)(?=A maximum|Full|OR|Route|ROUTE)", r"\1. ", value)
    value = re.sub(r"([.!?])(?=[A-Z])", r"\1 ", value)
    value = re.sub(r"\s+", " ", value)
    value = value.replace(" Requested Content ", "\nRequested Content\n")
    value = value.replace(" Additional Information ", "\nAdditional Information\n")
    value = value.replace(" Explanation of Terms ", "\nExplanation of Terms\n")
    value = value.replace(" Change From Last Year ", "\nChange From Last Year\n")
    return value.strip()


def title_ko(title: str) -> str:
    source = str(title or "")
    for pattern, replacement in TITLE_REGEX_REPLACEMENTS:
        if pattern.search(source):
            return pattern.sub(replacement, source).strip()
    lower = source.lower()
    for needle, korean in TITLE_PATTERNS:
        if needle in lower:
            return korean
    return translate_text(source, mode="title")


def translate_text(text: str, mode: str = "body") -> str:
    value = clean_source(text)
    for src, dst in EXACT_BLOCKS:
        value = value.replace(src, dst)
    for pattern, replacement in REGEX_REPLACEMENTS:
        value = pattern.sub(replacement, value)

    value = re.sub(r"\(column\s+(\d+)\)", r"(열 \1)", value, flags=re.I)
    value = re.sub(r"\(row\s+(\d+)\)", r"(행 \1)", value, flags=re.I)
    value = re.sub(r"Select [“\"]([^”\"]+)[”\"] if (.+?)(?=\.|$)", r"\2 경우 ‘\1’을 선택하십시오", value)
    value = re.sub(r"This column only appears if (.+?)(?=\.|$)", r"이 열은 \1 경우에만 표시됩니다", value)
    value = re.sub(r"This question is seeking to understand whether (.+?)(?=\.|$)", r"이 문항은 \1 여부를 확인하기 위한 것입니다", value)
    value = re.sub(r"This question helps data users (.+?)(?=\.|$)", r"이 문항은 데이터 이용자가 \1 데 도움을 줍니다", value)
    value = re.sub(r"Provide details of (.+?)(?=\.|$)", r"\1에 대한 세부 정보를 제공하십시오", value)
    value = re.sub(r"Provide (.+?)(?=\.|$)", r"\1을(를) 제공하십시오", value)
    value = re.sub(r"Describe (.+?)(?=\.|$)", r"\1을(를) 설명하십시오", value)
    value = re.sub(r"Explain (.+?)(?=\.|$)", r"\1을(를) 설명하십시오", value)
    value = re.sub(r"Indicate (.+?)(?=\.|$)", r"\1을(를) 표시하십시오", value)
    value = re.sub(r"Identify (.+?)(?=\.|$)", r"\1을(를) 식별하십시오", value)

    for src, dst in sorted(PHRASE_REPLACEMENTS, key=lambda item: len(item[0]), reverse=True):
        pattern = re.escape(src)
        if re.match(r"^[A-Za-z0-9]", src) and re.search(r"[A-Za-z0-9]$", src):
            pattern = rf"\b{pattern}\b"
        value = re.sub(pattern, dst, value, flags=re.I if src.islower() else 0)
    for pattern, replacement in REGEX_REPLACEMENTS:
        value = pattern.sub(replacement, value)

    value = value.replace("귀사의 귀사", "귀사")
    value = value.replace("귀사s", "귀사")
    value = value.replace("조직s", "조직")
    value = value.replace("사업es", "사업")
    value = value.replace("프로세스es", "프로세스")
    value = value.replace("리스크and", "리스크 및")
    value = value.replace("기회and", "기회 및")
    value = value.replace("제공하십시오d", "제공한")
    value = value.replace("표시하십시오d", "표시된")
    value = value.replace("식별하십시오ing", "식별")
    value = value.replace("설명하십시오ing", "설명")
    value = value.replace("평가하십시오ing", "평가")
    value = value.replace("예을", "예를")
    value = value.replace("아니요을", "아니요를")
    value = value.replace("‘예’을", "‘예’를")
    value = value.replace("‘아니요’을", "‘아니요’를")
    value = value.replace("세부 정보 of", "세부 정보")
    value = value.replace("세부 정보 on", "관련 세부 정보")
    value = value.replace("세부 정보 about", "관련 세부 정보")
    value = value.replace("for this environmental issue", "이 환경 이슈에 대해")
    value = value.replace("in this 프로세스", "이 프로세스에서")
    value = value.replace("in this process", "이 프로세스에서")
    value = value.replace("in the 보고연도", "보고연도에")
    value = value.replace("in 열", "열")
    value = value.replace("in 행", "행")
    value = value.replace("이 열은 you 선택", "이 열은 귀사가 선택")
    value = value.replace("귀사 has any 프로세스", "귀사가 프로세스")
    value = value.replace("프로세스 in place", "보유한 프로세스")
    value = value.replace("for identifying, assessing, 및 managing", "식별·평가·관리를 위한")
    value = value.replace("identifying, assessing, 및 managing", "식별·평가·관리")
    value = value.replace("이용 가능한 to 보고", "보고 가능한")
    value = value.replace("공시 점", "공시 점수")
    value = value.replace("인식 점", "인식 점수")
    value = value.replace("관리 점", "관리 점수")
    value = value.replace("리더십 점", "리더십 점수")
    value = value.replace("AND", "및")
    value = value.replace(" OR ", " 또는 ")
    value = value.replace("ROUTE", "경로")
    value = value.replace("ORNON-공시 경로", "또는 비공시 경로")
    value = value.replace("NON-공시 경로", "비공시 경로")
    value = value.replace("Financial services 회사", "금융서비스 기업")
    value = value.replace("Awarenessnumerator", "인식 분자")
    value = value.replace("Awarenessdenominator", "인식 분모")
    value = value.replace("Managementnumerator", "관리 분자")
    value = value.replace("Managementdenominator", "관리 분모")
    value = value.replace("Leadershipnumerator", "리더십 분자")
    value = value.replace("Leadershipdenominator", "리더십 분모")
    value = value.replace("Disclosurenumerator", "공시 분자")
    value = value.replace("Disclosuredenominator", "공시 분모")
    value = re.sub(r"최대\s+([\d.]+\/[\d.]+|[\d.]+)\s+점\s+is 이용 가능한 for this route\.?", r"이 경로는 최대 \1점까지 받을 수 있습니다.", value)
    value = re.sub(r"최대\s+([\d.]+\/[\d.]+|[\d.]+)\s+점\s+is 이용 가능한 for this question\.?", r"이 문항은 최대 \1점까지 받을 수 있습니다.", value)
    value = re.sub(r"Full\s+(공시|인식|관리)\s+점수?\s+해야 합니다 be awarded to be eligible for\s+(Awareness|Management|Leadership|인식|관리|리더십)\s+점", r"\1 점수를 모두 받아야 \2 점수 대상이 됩니다", value)
    value = value.replace("Awareness 점수 대상", "인식 점수 대상")
    value = value.replace("Management 점수 대상", "관리 점수 대상")
    value = value.replace("Leadership 점수 대상", "리더십 점수 대상")
    value = value.replace("Full Awareness 점 해야 합니다 be awarded to be eligible for Management 점", "인식 점수를 모두 받아야 관리 점수 대상이 됩니다")
    value = value.replace("Full Management 점 해야 합니다 be awarded to be eligible for Leadership 점", "관리 점수를 모두 받아야 리더십 점수 대상이 됩니다")
    value = value.replace("Full 공시 점수 awarded in all 다음 문항", "다음 문항에서 공시 점수를 모두 획득")
    value = value.replace("Full 공시 점수 NOT awarded in all 다음 문항", "다음 문항에서 공시 점수를 모두 획득하지 못함")
    value = re.sub(r"점\s+됩니다\s+awarded per 작성 완료된 cell in proportion to the number of cells displayed", "표시된 셀 수 대비 작성 완료된 셀 수에 비례하여 점수가 부여됩니다", value)
    value = re.sub(r"점\s+됩니다\s+awarded per 작성 완료된 행 in proportion to the number of 행s 공시된", "공시된 행 수 대비 작성 완료된 행 수에 비례하여 점수가 부여됩니다", value)
    value = re.sub(r"점\s+됩니다\s+awarded per 작성 완료된 행 in proportion to the number of rows 공시된", "공시된 행 수 대비 작성 완료된 행 수에 비례하여 점수가 부여됩니다", value)
    value = re.sub(r"점\s+됩니다\s+awarded per 작성 완료된 cell in proportion to the number of 행s 공시된", "공시된 행 수 대비 작성 완료된 셀 수에 비례하여 점수가 부여됩니다", value)
    value = value.replace("NOT 작성 완료된", "미작성")
    value = value.replace("점수수", "점수")
    value = value.replace("scoring criteria for 금융서비스 기업", "금융서비스 기업 평가기준")
    value = value.replace("For '기후변화' 행:", "'기후변화' 행 기준:")
    value = value.replace("For '물' 행:", "'물' 행 기준:")
    value = value.replace("For '산림' 행:", "'산림' 행 기준:")
    value = value.replace("Use of 시나리오 분석", "시나리오 분석 사용 여부")
    value = value.replace("Existing products 및 services", "기존 제품 및 서비스")
    value = value.replace("예, 및 it is 공개적으로 이용 가능한", "예, 공개적으로 이용 가능")
    value = value.replace("예, but it is not 공개적으로 이용 가능한", "예, 공개되어 있지 않음")
    value = value.replace("아니요, but we plan to 이내 the 향후 2년 이내", "아니요, 향후 2년 이내 계획 있음")
    value = value.replace("아니요, 및 we do not plan to 이내 the 향후 2년 이내", "아니요, 향후 2년 이내 계획 없음")
    value = value.replace("but we plan to", "향후 계획 있음")
    value = value.replace("we do not plan to", "계획 없음")
    value = value.replace("it is not", "그렇지 않음")
    value = value.replace(" it is ", " ")
    value = value.replace("Either", "둘 중 하나")
    value = value.replace("Row", "행")
    value = value.replace("OR 행", "또는 행")
    value = value.replace("and/or", "및/또는")
    value = value.replace(" and ", " 및 ")
    value = value.replace(" or ", " 또는 ")

    value = re.sub(r"(전체 섹터)(?=\s*(공시|인식|관리|리더십) 평가기준)", r"\1\n", value)
    value = re.sub(r"((?:공시|인식|관리|리더십) 평가기준)(?=\S)", r"\1\n", value)
    value = re.sub(r"((?:공시|인식|관리|리더십) 평가기준)\s+(?=\S)", r"\1\n", value)
    value = re.sub(r"(있습니다\.)(?=(?:공시|인식|관리|리더십) 평가기준)", r"\1\n", value)
    value = re.sub(r"(경로 [A-Z]\))", r"\n\1", value)
    value = re.sub(r"(비공시 경로\))", r"\n\1", value)
    value = re.sub(r"(또는 경로 [A-Z]\))", r"\n\1", value)
    value = re.sub(r"\bOR\s*(?=경로|비공시)", "또는\n", value)
    value = re.sub(r"([.!?])\s+", "\\1\n", value)
    value = re.sub(r"\n\s*(작성안내|추가 정보|용어 설명|문항별 평가기준|점수 배분|일반)\s*", r"\n\1\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    value = re.sub(r"[ \t]+\n", "\n", value)
    return value.strip()


def translate_scoring(text: str) -> str:
    return translate_text(text)


def translate_allocation(text: str) -> str:
    return translate_text(text)


def translate_tags(text: str) -> str:
    return translate_text(text)


def improve_dataset_object(data: dict[str, Any]) -> dict[str, Any]:
    for row in data.get("qualitativeRows", []):
        row["title_ko"] = title_ko(row.get("title_en") or row.get("title") or "")
        row["intro_ko"] = translate_text(row.get("intro_en") or "")
        row["guidance_ko"] = translate_text(row.get("guidance_en") or row.get("requestedContent") or "")
        row["requestedContent_ko"] = translate_text(row.get("requestedContent") or "")
        row["scoring_ko"] = translate_scoring(row.get("scoring_en") or row.get("fullScoreChecklist") or "")
        row["fullScoreChecklist_ko"] = row["scoring_ko"]
        row["pointAllocation_ko"] = translate_allocation(row.get("pointAllocation") or "")
        row["tags_ko"] = translate_tags(row.get("tags") or "")
        row["translationQuality"] = {
            "regenerated": True,
            "badPatternFound": bool(BAD_PATTERNS.search("\n".join(str(row.get(k, "")) for k in ["title_ko", "guidance_ko", "scoring_ko", "pointAllocation_ko"]))),
        }
    data["translationNotice_ko"] = "국문 필드는 2026 영문 원문을 기준으로 생성한 검토용 번역입니다. 최종 해석은 영문 원문과 대조하십시오."
    return data


def module_quality(data: dict[str, Any]) -> list[dict[str, Any]]:
    summary: dict[str, dict[str, Any]] = {}
    for row in data.get("qualitativeRows", []):
        module = row.get("module_id", "")
        record = summary.setdefault(module, {"module": module, "rows": 0, "badRows": 0, "latinWords": 0})
        record["rows"] += 1
        text = "\n".join(str(row.get(k, "")) for k in ["title_ko", "guidance_ko", "scoring_ko", "pointAllocation_ko"])
        if BAD_PATTERNS.search(text):
            record["badRows"] += 1
        record["latinWords"] += len(re.findall(r"[A-Za-z]{4,}", text))
    return [summary[key] for key in sorted(summary, key=lambda item: int(item[1:]) if item[1:].isdigit() else 99)]


def main() -> None:
    data = json.loads(DATASET.read_text(encoding="utf-8"))
    improved = improve_dataset_object(data)
    DATASET.write_text(json.dumps(improved, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"dataset": str(DATASET), "modules": module_quality(improved)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
