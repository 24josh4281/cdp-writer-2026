const DATASET_URL = "./data/cdp_2026_full_dataset.json";
const STORAGE_KEY = "cdp-writer-2026-workspace";
const workspaceStorage = createWorkspaceStorage();

const app = document.querySelector("#app");
const datasetSelect = document.querySelector("#datasetSelect");
const exportJsonButton = document.querySelector("#exportJsonButton");
const exportCsvButton = document.querySelector("#exportCsvButton");

const state = {
  dataset: null,
  rows: [],
  activeView: "dashboard",
  selectedModule: "all",
  selectedIssue: "all",
  selectedQuestion: "",
  search: "",
  company: "회사명",
  sector: "CH",
  charLimit: 2400,
  keywords: "",
  evidenceInput: "",
  evidenceLibrary: "",
  drafts: {},
  fileResults: [],
  evaluationScope: "drafted",
  language: "ko",
  guideTab: "guidance",
  referenceKey: "",
};

const SIGNALS = [
  { label: "표/셀 작성", terms: ["표", "셀", "작성", "completed", "table", "row"] },
  { label: "요구 선택지", terms: ["선택", "예", "yes", "no", "select", "process in place"] },
  { label: "보고기간/날짜", terms: ["보고기간", "보고연도", "종료일", "date", "year", "2024", "2025"] },
  { label: "리스크/기회", terms: ["리스크", "기회", "식별", "평가", "관리", "risk", "opportun"] },
  { label: "재무계획/전략", terms: ["재무", "전략", "투자", "capex", "opex", "financial", "strategy"] },
  { label: "거버넌스", terms: ["이사회", "경영진", "위원회", "ceo", "cfo", "board", "management"] },
  { label: "전환계획", terms: ["전환계획", "전환 계획", "transition", "1.5"] },
  { label: "시나리오 분석", terms: ["시나리오", "scenario"] },
  { label: "목표/진행률", terms: ["목표", "기준연도", "목표연도", "진행률", "target", "sbti"] },
  { label: "Scope/배출량", terms: ["scope", "배출량", "온실가스", "emissions", "co2e"] },
  { label: "검증/보증", terms: ["검증", "보증", "assurance", "verification", "iso"] },
  { label: "가치사슬/공급망", terms: ["가치사슬", "공급망", "scope 3", "supplier", "value chain"] },
  { label: "공개/첨부", terms: ["공개", "첨부", "url", "페이지", "public", "attached"] },
  { label: "정량 산정", terms: ["산정", "계산", "계수", "methodology", "factor", "market-based", "location-based"] },
];

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return text(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function charCount(value) {
  return [...text(value)].length;
}

function createWorkspaceStorage() {
  try {
    const storage = window.sessionStorage;
    const testKey = `${STORAGE_KEY}:test`;
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
}

function apiUrl(path) {
  const configured = text(window.CDP_API_BASE_URL || "").trim();
  if (!configured) return path;
  return new URL(path, configured.endsWith("/") ? configured : `${configured}/`).toString();
}

function workspaceSnapshot() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    datasetUrl: datasetSelect?.value || DATASET_URL,
    activeView: state.activeView,
    selectedModule: state.selectedModule,
    selectedIssue: state.selectedIssue,
    selectedQuestion: state.selectedQuestion,
    search: state.search,
    company: state.company,
    sector: state.sector,
    charLimit: state.charLimit,
    keywords: state.keywords,
    evidenceInput: state.evidenceInput,
    evidenceLibrary: state.evidenceLibrary,
    drafts: state.drafts,
    evaluationScope: state.evaluationScope,
    language: state.language,
    guideTab: state.guideTab,
    referenceKey: state.referenceKey,
  };
}

function persistWorkspace() {
  try {
    workspaceStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceSnapshot()));
  } catch {
    // Local autosave is best-effort. Export remains the reliable backup.
  }
}

function restoreWorkspace(datasetUrl) {
  try {
    const saved = JSON.parse(workspaceStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || saved.datasetUrl !== datasetUrl) return;
    Object.assign(state, {
      activeView: saved.activeView || state.activeView,
      selectedModule: saved.selectedModule || "all",
      selectedIssue: saved.selectedIssue || "all",
      selectedQuestion: saved.selectedQuestion || state.selectedQuestion,
      search: saved.search || "",
      company: saved.company || state.company,
      sector: saved.sector || state.sector,
      charLimit: Number(saved.charLimit || state.charLimit || 2400),
      keywords: saved.keywords || "",
      evidenceInput: saved.evidenceInput || "",
      evidenceLibrary: saved.evidenceLibrary || "",
      drafts: saved.drafts || {},
      evaluationScope: saved.evaluationScope || state.evaluationScope,
      language: saved.language || state.language,
      guideTab: saved.guideTab || state.guideTab,
      referenceKey: saved.referenceKey || state.referenceKey,
    });
  } catch {
    workspaceStorage.removeItem(STORAGE_KEY);
  }
}

function clearWorkspaceStorage() {
  workspaceStorage.removeItem(STORAGE_KEY);
  state.drafts = {};
  state.evidenceInput = "";
  state.evidenceLibrary = "";
  state.fileResults = [];
  state.keywords = "";
  state.search = "";
  state.selectedModule = "all";
  state.selectedIssue = "all";
  state.selectedQuestion = state.rows[0] ? questionNumber(state.rows[0]) : "";
}

function clampText(value, limit) {
  const chars = [...text(value)];
  if (chars.length <= limit) return text(value);
  return `${chars.slice(0, Math.max(0, limit - 20)).join("")}\n[글자수 제한으로 축약]`;
}

function formatScore(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function questionNumber(row) {
  return row.questionNumber || row.question_number || "";
}

function moduleId(row) {
  return row.moduleId || row.module_id || "";
}

function localizedPair(en, ko) {
  const english = text(en).trim();
  const korean = text(ko).trim();
  if (state.language === "ko") return korean || english;
  if (state.language === "en") return english || korean;
  if (korean && english && korean !== english) return `${korean}\n${english}`;
  return korean || english;
}

function uiText(ko, en = ko) {
  if (state.language === "en") return en;
  if (state.language === "both" && en !== ko) return `${ko} / ${en}`;
  return ko;
}

function sectorDisplayValue(value) {
  const raw = text(value).trim();
  const labels = {
    FULL: { ko: "전체", en: "FULL" },
    CH: { ko: "화학", en: "CH" },
    GEN: { ko: "일반", en: "GEN" },
    FS: { ko: "금융서비스", en: "FS" },
    MM: { ko: "금속 및 광업", en: "MM" },
    COAL: { ko: "석탄", en: "COAL" },
  };
  const label = labels[raw.toUpperCase()];
  return label ? uiText(label.ko, label.en) : raw;
}

function categoryLabel(value) {
  const raw = text(value).trim();
  if (state.language === "en") return raw;
  return raw
    .replace(/2026\s+FULL\s+CORPORATE/gi, "2026 전체 기업")
    .replace(/FULL\s+CORPORATE/gi, "전체 기업")
    .replace(/CORPORATE/gi, "기업");
}

function sourceFileLabel(value) {
  const raw = text(value).trim();
  if (state.language === "en") return raw || "dataset";
  const lower = raw.toLowerCase();
  if (lower.includes("questionnaire")) return "CDP 2026 전체 기업 질문지";
  if (lower.includes("scoring")) return "CDP 2026 평가방법론";
  if (lower.includes("dataset")) return "데이터셋";
  return raw || "데이터셋";
}

function tagLabel(value) {
  const raw = text(value).trim();
  const labels = {
    Chemicals: { ko: "화학", en: "Chemicals" },
    "Financial services": { ko: "금융서비스", en: "Financial services" },
    "Oil & Gas": { ko: "석유 및 가스", en: "Oil & Gas" },
    Coal: { ko: "석탄", en: "Coal" },
    General: { ko: "일반", en: "General" },
    Aviation: { ko: "항공", en: "Aviation" },
    "Capital goods": { ko: "자본재", en: "Capital goods" },
    "Transport OEMS - EPM": { ko: "운송 OEMS - EPM", en: "Transport OEMS - EPM" },
    "Transport OEMS": { ko: "운송 OEMS", en: "Transport OEMS" },
    "Transport services": { ko: "운송 서비스", en: "Transport services" },
    "Metals & Mining": { ko: "금속 및 광업", en: "Metals & Mining" },
    "Metals &mining": { ko: "금속 및 광업", en: "Metals & Mining" },
    Steel: { ko: "철강", en: "Steel" },
    Ocean: { ko: "해양", en: "Ocean" },
    "Agricultural commodities": { ko: "농산물 원자재", en: "Agricultural commodities" },
    Biodiversity: { ko: "생물다양성", en: "Biodiversity" },
    Plastics: { ko: "플라스틱", en: "Plastics" },
    "Climate Change": { ko: "기후변화", en: "Climate Change" },
    "Energy utilities & power generators": { ko: "에너지 유틸리티 및 발전사업자", en: "Energy utilities & power generators" },
    Forests: { ko: "산림", en: "Forests" },
    Cement: { ko: "시멘트", en: "Cement" },
    "Food, beverage & tobacco": { ko: "식품·음료·담배", en: "Food, beverage & tobacco" },
    "Paper & forestry": { ko: "제지 및 임업", en: "Paper & forestry" },
    "Real estate": { ko: "부동산", en: "Real estate" },
    Construction: { ko: "건설", en: "Construction" },
  };
  const label = labels[raw];
  return label ? uiText(label.ko, label.en) : raw;
}

function safeKoreanText(en, ko) {
  const curated = polishedKoreanOverride(en);
  if (curated) return curated;
  const candidate = text(ko).trim();
  return shouldRegenerateKorean(candidate) ? "" : candidate;
}

function localizedHtml(en, ko) {
  const english = readableMethodologyText(en);
  const korean = readableMethodologyText(safeKoreanText(en, ko));
  const pending = translationPendingText(english);
  if (state.language === "ko") return `<div class="localized-block ko">${escapeHtml(korean || pending)}</div>`;
  if (state.language === "en") return `<div class="localized-block en">${escapeHtml(english || korean)}</div>`;
  return `
    <div class="localized-block ko"><strong>국문</strong><br />${escapeHtml(korean || pending)}</div>
    <div class="localized-block en"><strong>English</strong><br />${escapeHtml(english || korean)}</div>
  `;
}

function questionTitle(row) {
  const english = row.title_en || row.title;
  return localizedPair(english, safeKoreanText(english, row.title_ko));
}

function moduleTitle(module) {
  const ko = state.dataset?.moduleTitles_ko?.[module.id] || module.title_ko;
  return localizedPair(module.title, ko);
}

function readableMethodologyText(value) {
  return text(value)
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/([.!?])(?=[A-Z가-힣])/g, "$1\n")
    .replace(/criteria(Points|Not scored|Consecutive|A maximum)/g, "criteria\n$1")
    .replace(/평가기준(Points|Not scored|Consecutive|A maximum)/g, "평가기준\n$1")
    .replace(/(displayed\.|question\.|points\)|점\))(?=A maximum|If|Please|This|The|A maximum)/g, "$1\n")
    .replace(/\)(A maximum)/g, ")\n$1")
    .replace(/points\(/g, "points\n(")
    .replace(/점\(/g, "점\n(")
    .replace(/(Disclosure|Awareness|Management|Leadership) scoring criteria/g, "\n$1 scoring criteria\n")
    .replace(/(공시|인식|관리|리더십) 평가기준/g, "\n$1 평가기준\n")
    .replace(/(Management scoring criteria|Leadership scoring criteria)\s*Not scored\./g, "$1\nNot scored.")
    .replace(/(관리 평가기준|리더십 평가기준)\s*평가 제외\./g, "$1\n평가 제외.")
    .replace(/(\d+(?:\.\d+)+)\s*[–-]\s*(Climate change|Forests|Water|기후변화|산림|물)/g, "\n$1 – $2")
    .replace(/Disclosurenumerator/g, "Disclosure numerator")
    .replace(/Disclosuredenominator/g, "Disclosure denominator")
    .replace(/Awarenessnumerator/g, "Awareness numerator")
    .replace(/Awarenessdenominator/g, "Awareness denominator")
    .replace(/Managementnumerator/g, "Management numerator")
    .replace(/Managementdenominator/g, "Management denominator")
    .replace(/Leadershipnumerator/g, "Leadership numerator")
    .replace(/Leadershipdenominator/g, "Leadership denominator")
    .replace(/공시numerator/g, "공시 분자")
    .replace(/공시denominator/g, "공시 분모")
    .replace(/인식numerator/g, "인식 분자")
    .replace(/인식denominator/g, "인식 분모")
    .replace(/관리numerator/g, "관리 분자")
    .replace(/관리denominator/g, "관리 분모")
    .replace(/리더십numerator/g, "리더십 분자")
    .replace(/리더십denominator/g, "리더십 분모")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function shouldRegenerateKorean(value) {
  const source = text(value);
  if (!source.trim()) return true;
  const latinWords = source.match(/\b[A-Za-z]{4,}\b/g) || [];
  const hangulChars = source.match(/[가-힣]/g) || [];
  const allowedLatin = latinWords.filter((word) => !/^(CDP|TCFD|TNFD|IFRS|ESRS|GHG|Scope|SBTi|RE100|PCAF|CAPEX|OPEX|CO2e?|tCO2e|USD)$/i.test(word));
  if (allowedLatin.length > 10 && allowedLatin.length > Math.max(8, hangulChars.length / 18)) return true;
  return /제공하십시오\s+[a-zA-Z]|귀사\s+has|조직s|사업es|프로세스es|리스크and|기회 specific|financial planning|To define your|How this time horizon|Because the timing|provide details|This column|If you select|Select [“"']|Does your|What is|How does|Awareness scoring|Disclosure scoring|Management scoring|Leadership scoring/i.test(source);
}

function translationPendingText(english) {
  return [
    "국문 번역 검토 필요",
    "이 영역은 아직 전체 문장 번역이 완료되지 않아, 일부 단어만 바뀐 국문을 표시하지 않습니다.",
    "",
    "영문 원문",
    english,
  ].join("\n");
}

function polishedKoreanOverride(value) {
  const source = readableMethodologyText(value);
  const lower = source.toLowerCase();

  if (lower.includes("from (years) (column 1)") && lower.includes("tcfd and tnfd position on time horizons")) {
    return [
      "시작연도(열 1) 및 종료연도(열 3)",
      "단기·중기·장기 시간범위를 정의하기 위해 ‘시작연도’ 및 ‘종료연도’ 열에 각 시간범위의 길이를 입력하십시오. 예를 들어 5년부터 10년까지, 또는 12년부터 25년까지와 같이 작성합니다.",
      "",
      "이 시간범위가 전략 및/또는 재무계획과 어떻게 연결되는지(열 4)",
      "해당 시간범위를 선택한 이유를 설명하고, 이 시간범위의 사용이 귀사의 전략 및/또는 재무계획을 어떻게 뒷받침하는지 설명하십시오.",
      "전략 또는 재무계획에서 다른 시간범위를 사용하는 경우, 환경 이슈의 식별·평가·관리를 위해 선택한 시간범위가 다른 프로세스에서 사용하는 시간범위와 다른 이유를 설명하십시오.",
      "",
      "추가 정보",
      "",
      "시간범위에 대한 TCFD 및 TNFD의 입장",
      "조직마다 영향이 발생하는 시점이 다르기 때문에, 모든 섹터에 동일한 시간범위를 지정하면 각 기업이 자사 사업에 특화된 환경 리스크와 기회를 고려하는 데 제약이 될 수 있습니다.",
      "TCFD와 TNFD는 시간범위를 별도로 정의하지 않으며, 응답 기업이 자산 또는 인프라의 내용연수, 직면한 환경 리스크의 특성, 사업을 영위하는 섹터와 지역, 그리고 환경 리스크와 기회가 중장기적으로 나타날 수 있다는 점을 고려해 자체 시간범위를 정하도록 권장합니다.",
      "환경 이슈를 평가할 때에는 평가에 사용하는 시간범위가 적절한지 유의해야 합니다. 많은 조직이 운영 및 재무계획은 1~2년, 전략 및 자본계획은 2~5년 기준으로 수행하지만, 환경 리스크와 기회는 더 긴 기간에 걸쳐 영향을 미칠 수 있습니다.",
      "따라서 환경 의존도, 영향, 리스크 및 기회를 평가할 때 적절한 시간범위를 고려하는 것이 중요합니다.",
    ].join("\n");
  }

  if (lower.includes("points will be awarded per completed cell in proportion to the number of cells displayed")) {
    return [
      "표시된 셀 수 대비 작성 완료된 셀 수에 비례하여 점수가 부여됩니다.",
      "이 문항은 최대 3/3점까지 받을 수 있습니다.",
    ].join("\n");
  }

  if (lower.includes("consecutive time horizons entered in rows")) {
    return [
      "‘단기’, ‘중기’, ‘장기’ 행에 서로 연속되는 시간범위를 입력하면 3점입니다.",
      "예: 단기 0~2년, 중기 3~9년, 장기 10년 이상 또는 단기 0~3년, 중기 3~10년, 장기 10년 이상과 같이 작성할 수 있습니다.",
      "‘장기 시간범위가 개방형입니까?’ 열에서 ‘아니요’를 선택한 경우, 인식 점수를 받으려면 ‘종료연도’ 열을 반드시 작성해야 합니다.",
      "이 문항은 최대 3/3점까지 받을 수 있습니다.",
    ].join("\n");
  }

  return "";
}

function helperKoreanText(value) {
  const override = polishedKoreanOverride(value);
  if (override) return override;
  const replacements = [
    ["Climate change scoring criteria for all sectors", "기후변화 평가기준 - 전체 섹터"],
    ["Forests scoring criteria for all sectors", "산림 평가기준 - 전체 섹터"],
    ["Water scoring criteria for all sectors", "물 평가기준 - 전체 섹터"],
    ["Climate change point allocations for all sectors", "기후변화 배점 - 전체 섹터"],
    ["Forests point allocations for all sectors", "산림 배점 - 전체 섹터"],
    ["Water point allocations for all sectors", "물 배점 - 전체 섹터"],
    ["Disclosure scoring criteria", "공시 평가기준"],
    ["Awareness scoring criteria", "인식 평가기준"],
    ["Management scoring criteria", "관리 평가기준"],
    ["Leadership scoring criteria", "리더십 평가기준"],
    ["Points will be awarded per completed cell in proportion to the number of cells displayed.", "표시된 셀 수 대비 작성 완료된 셀 수에 비례하여 점수가 부여됩니다."],
    ["A maximum of", "최대"],
    ["points is available for this question.", "점까지 받을 수 있습니다."],
    ["point is available for this question.", "점까지 받을 수 있습니다."],
    ["Consecutive time horizons entered", "연속적인 시간범위가 입력됨"],
    ["Not scored.", "평가 제외."],
    ["short-term", "단기"],
    ["Short-term", "단기"],
    ["medium-term", "중기"],
    ["Medium-term", "중기"],
    ["long-term", "장기"],
    ["Long-term", "장기"],
    ["Disclosure numerator", "공시 분자"],
    ["Disclosure denominator", "공시 분모"],
    ["Awareness numerator", "인식 분자"],
    ["Awareness denominator", "인식 분모"],
    ["Management numerator", "관리 분자"],
    ["Management denominator", "관리 분모"],
    ["Leadership numerator", "리더십 분자"],
    ["Leadership denominator", "리더십 분모"],
    ["Climate change", "기후변화"],
    ["Forests", "산림"],
    ["Water", "물"],
    ["points", "점"],
  ];
  let output = text(value);
  for (const [from, to] of replacements.sort((a, b) => b[0].length - a[0].length)) {
    output = output.replaceAll(from, to);
  }
  return readableMethodologyText(output);
}

function issueLabel(issue) {
  const english = text(issue).trim();
  const labels = {
    "climate change": "기후변화",
    forests: "산림",
    water: "물",
  };
  const korean = labels[english.toLowerCase()] || english;
  if (state.language === "ko") return korean;
  if (state.language === "en") return english;
  return `${korean} / ${english}`;
}

function levelMeta(label) {
  const lower = text(label).toLowerCase();
  if (lower.includes("disclosure")) return { code: "D", ko: "공시", en: "Disclosure" };
  if (lower.includes("awareness")) return { code: "A", ko: "인식", en: "Awareness" };
  if (lower.includes("management")) return { code: "M", ko: "관리", en: "Management" };
  if (lower.includes("leadership")) return { code: "L", ko: "리더십", en: "Leadership" };
  if (label.includes("공시")) return { code: "D", ko: "공시", en: "Disclosure" };
  if (label.includes("인식")) return { code: "A", ko: "인식", en: "Awareness" };
  if (label.includes("관리")) return { code: "M", ko: "관리", en: "Management" };
  if (label.includes("리더십")) return { code: "L", ko: "리더십", en: "Leadership" };
  return { code: "Q", ko: label, en: label };
}

function parseScoringBlocks(source) {
  const clean = readableMethodologyText(source).replace(/\n\d+(?:\.\d+)+\s*[–-]\s*.+?point allocations for all sectors[\s\S]*$/i, "");
  const headingRegex = /(?:^|\n)(\d+(?:\.\d+)+)\s*[–-]\s*(.+?)\s+(?:scoring criteria for all sectors|평가기준\s*-\s*전체 섹터|금융서비스 기업 평가기준)\s*/gi;
  const headings = [...clean.matchAll(headingRegex)];
  return headings.map((heading, index) => {
    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : clean.length;
    const body = clean.slice(start, end).trim();
    const sections = [...body.matchAll(/((?:Disclosure|Awareness|Management|Leadership)\s+scoring criteria|(?:공시|인식|관리|리더십)\s+평가기준)\s*([\s\S]*?)(?=\n(?:(?:Disclosure|Awareness|Management|Leadership)\s+scoring criteria|(?:공시|인식|관리|리더십)\s+평가기준)|\n\d+(?:\.\d+)+\s*[–-]|\s*$)/gi)].map((match) => {
      const meta = levelMeta(match[1]);
      const criteria = readableMethodologyText(match[2]);
      const max = criteria.match(/maximum of\s+([\d.]+\/[\d.]+|[\d.]+)\s+points?/i)?.[1] || criteria.match(/-\s*([\d.]+)\s+points?/i)?.[1] || "기준";
      return { ...meta, criteria, points: max };
    });
    return {
      question: heading[1],
      issue: heading[2].trim(),
      sections,
    };
  });
}

function parseAllocationTables(source) {
  const clean = readableMethodologyText(source);
  const headingRegex = /(?:^|\n)(\d+(?:\.\d+)+)\s*[–-]\s*(.+?)\s+point allocations for all sectors\s*([\s\S]*?)(?=\n\d+(?:\.\d+)+\s*[–-]\s*.+?\s+point allocations for all sectors|\s*$)/gi;
  return [...clean.matchAll(headingRegex)]
    .map((match) => {
      const numbers = [...match[3].matchAll(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g)].map((item) => item[0]);
      if (numbers.length < 8) return null;
      return {
        question: match[1],
        issue: match[2].trim(),
        values: {
          dNum: numbers[0],
          dDen: numbers[1],
          aNum: numbers[2],
          aDen: numbers[3],
          mNum: numbers[4],
          mDen: numbers[5],
          lNum: numbers[6],
          lDen: numbers[7],
        },
      };
    })
    .filter(Boolean);
}

function currentRow() {
  return state.rows.find((row) => questionNumber(row) === state.selectedQuestion) || state.rows[0];
}

function draftRecord(qn = state.selectedQuestion) {
  return state.drafts[qn] || null;
}

function moduleGroups() {
  const map = new Map();
  for (const row of state.rows) {
    const id = moduleId(row);
    if (!map.has(id)) {
      map.set(id, {
        id,
        title: row.module || state.dataset?.moduleTitles?.[id] || id,
        title_ko: row.module_ko || state.dataset?.moduleTitles_ko?.[id] || "",
        count: 0,
        drafted: 0,
        sector: 0,
      });
    }
    const item = map.get(id);
    item.count += 1;
    if (state.drafts[questionNumber(row)]?.draft) item.drafted += 1;
    if (text(row.sectorFlag || row.sector_flag).trim()) item.sector += 1;
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

function rowIssues(row) {
  const issues = Array.isArray(row.issues) ? row.issues : [];
  if (issues.length) return issues;
  const haystack = normalize([row.tags, row.title, row.scoring_en, row.fullScoreChecklist].join(" "));
  return ["Climate Change", "Water", "Forests", "Biodiversity", "Plastics"].filter((issue) => haystack.includes(issue.toLowerCase()));
}

function issueOptions() {
  const order = ["Climate Change", "Water", "Forests", "Biodiversity", "Plastics"];
  const available = new Set(state.rows.flatMap((row) => rowIssues(row)));
  return order.filter((issue) => available.has(issue));
}

function issueFilterLabel(issue) {
  const labels = {
    "Climate Change": { ko: "기후변화", en: "Climate Change" },
    Water: { ko: "물", en: "Water" },
    Forests: { ko: "산림", en: "Forests" },
    Biodiversity: { ko: "생물다양성", en: "Biodiversity" },
    Plastics: { ko: "플라스틱", en: "Plastics" },
  };
  const label = labels[issue];
  return label ? uiText(label.ko, label.en) : issue;
}

function compactTagList(items, limit = 5) {
  const values = [...new Set((items || []).map((item) => text(item).trim()).filter(Boolean))];
  if (values.length <= limit) return values.join(", ");
  return `${values.slice(0, limit).join(", ")} +${values.length - limit}`;
}

function passesIssueFilter(row) {
  if (state.selectedIssue === "all") return true;
  return rowIssues(row).some((issue) => issue.toLowerCase() === state.selectedIssue.toLowerCase());
}

function criteriaSections(checklist) {
  const source = text(checklist);
  const matches = [...source.matchAll(/(^|\n)([DAML])\s+([^\n(]+)\(([^)]+)\)\n-?\s*([\s\S]*?)(?=\n\n[DAML]\s+[^\n(]+\(|$)/g)];
  if (matches.length) {
    return matches.map((match) => ({
      level: match[2],
      name: match[3].trim(),
      points: match[4].trim(),
      criteria: match[5].trim(),
    }));
  }
  const scoringBlocks = parseScoringBlocks(source);
  if (scoringBlocks.length) {
    const preferred = scoringBlocks.find((block) => /climate|기후/.test(block.issue.toLowerCase())) || scoringBlocks[0];
    return preferred.sections.map((section) => ({
      level: section.code,
      name: state.language === "en" ? section.en : section.ko,
      points: section.points,
      criteria: section.criteria,
    }));
  }
  if (source.trim()) {
    return [{ level: "Q", name: "Question", points: "기준", criteria: readableMethodologyText(source) }];
  }
  return [];
}

function requiredSignals(criteria) {
  const lower = normalize(criteria);
  const found = SIGNALS.filter((signal) => signal.terms.some((term) => lower.includes(term.toLowerCase())));
  return found.length ? found : [{ label: "평가기준 원문 대응", terms: [] }];
}

function scoreDraft(row, draft, evidence, keywords) {
  const combined = normalize([draft, evidence, keywords].join(" "));
  const checklist = state.language === "en" ? row.fullScoreChecklist || row.full_score_checklist : row.fullScoreChecklist_ko || row.scoring_ko || row.fullScoreChecklist || row.full_score_checklist;
  return criteriaSections(checklist).map((section) => {
    const signals = requiredSignals(section.criteria);
    const matched = signals.filter((signal) => {
      if (!signal.terms.length) return combined.length >= 120;
      return signal.terms.some((term) => combined.includes(term.toLowerCase()));
    });
    const ratio = signals.length ? matched.length / signals.length : 1;
    const statusCode = ratio >= 0.99 ? "pass" : ratio >= 0.5 ? "partial" : "fail";
    return {
      ...section,
      signals,
      matched,
      ratio,
      statusCode,
      status: statusCode === "pass" ? "충족 가능" : statusCode === "partial" ? "부분 보완 필요" : "보완 필요",
    };
  });
}

function statusClass(code) {
  if (code === "pass") return "status-pass";
  if (code === "partial") return "status-partial";
  return "status-fail";
}

function splitKeywords(value) {
  return text(value)
    .split(/[,;/\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractSnippets(source, keywords, limit = 900) {
  const paragraphs = text(source)
    .split(/\n{2,}|(?<=다\.)\s+|(?<=\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!paragraphs.length) return "";
  const terms = splitKeywords(keywords).map((item) => item.toLowerCase());
  const scored = paragraphs
    .map((paragraph, index) => {
      const lower = paragraph.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (term && lower.includes(term) ? 1 : 0), 0);
      return { paragraph, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const picked = scored.filter((item) => item.score > 0).slice(0, 4);
  return clampText((picked.length ? picked : scored.slice(0, 3)).map((item) => item.paragraph).join("\n"), limit);
}

function replacePlaceholders(template, company, evidenceSummary) {
  return text(template)
    .replaceAll("[회사명]", company || "회사")
    .replaceAll("[YYYY-MM-DD]", "보고연도 종료일")
    .replaceAll("[YYYY-MM-DD~YYYY-MM-DD]", "보고기간")
    .replaceAll("[연도 범위]", "과거 배출량 제공 연도")
    .replaceAll("[운영통제/재무통제/지분할당]", "운영통제")
    .replaceAll("[사유]", "보고경계와 조직경계의 차이")
    .replaceAll("[YYYY]", "기준연도")
    .replaceAll("[목표연도]", "목표연도")
    .replaceAll("[범위]", "Scope 1, Scope 2 및 관련 Scope 3")
    .replaceAll("[x]", evidenceSummary || "보고연도 산정값")
    .replaceAll("[기준/배출계수]", "GHG Protocol 및 적용 배출계수")
    .replaceAll("[PPA/REC/EAC]", "PPA, REC, EAC");
}

function composeDraft(row, override = {}) {
  const company = override.company || state.company;
  const keywords = override.keywords ?? state.keywords;
  const evidence = override.evidence ?? (state.evidenceInput || state.evidenceLibrary);
  const limit = Number(override.limit || state.charLimit || 2400);
  const evidenceSummary = extractSnippets(evidence, keywords);
  const base = replacePlaceholders(row.modelAnswer || row.model_answer || "", company, evidenceSummary);
  const keywordSentence = splitKeywords(keywords).length ? splitKeywords(keywords).join(", ") : "문항별 핵심 평가항목";
  const evidencePart = evidenceSummary
    ? `${company}의 증빙자료에서 확인되는 주요 근거는 다음과 같습니다. ${evidenceSummary}`
    : `${company}은 해당 문항에서 요구하는 선택값, 정량값, 설명 및 증빙 위치를 같은 문항 안에서 확인 가능하도록 관리합니다.`;
  const governance = `${company}은 ${keywordSentence}를 핵심 관리항목으로 설정하고, 산정·검토·승인 절차와 책임조직을 명확히 운영합니다. 해당 결과는 기후 전략, 리스크 관리, 목표 이행 및 외부 공시에 반영됩니다.`;
  const proof = `관련 증빙은 ${row.evidenceChecklist || row.evidence_checklist || "내부 정책, 산정 파일, 승인자료, 검증자료"}에서 확인할 수 있으며, 제출 전 증빙명과 페이지를 함께 기재합니다.`;
  return clampText([base, evidencePart, governance, proof].filter(Boolean).join("\n\n"), limit);
}

function questionPayloadForAi(row) {
  return {
    number: questionNumber(row),
    module: moduleId(row),
    title_ko: row.question_ko || questionTitle(row),
    title_en: row.question || row.question_en || "",
    guidance_ko: row.guidance_ko || row.requestedContent_ko || "",
    guidance_en: row.guidance_en || row.requestedContent || "",
    scoring_ko: row.scoring_ko || row.fullScoreChecklist_ko || "",
    scoring_en: row.scoring_en || row.fullScoreChecklist || row.full_score_checklist || "",
    points: row.points_ko || row.points || "",
    evidenceChecklist: row.evidenceChecklist_ko || row.evidenceChecklist || row.evidence_checklist || "",
  };
}

async function generateGptDraft(row) {
  const payload = {
    company: state.company,
    sector: state.sector,
    charLimit: state.charLimit,
    keywords: state.keywords,
    evidence: state.evidenceInput || state.evidenceLibrary,
    question: questionPayloadForAi(row),
  };
  const response = await fetch(apiUrl("/api/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }
  return result.draft || "";
}

function saveDraft(qn, draft) {
  const row = state.rows.find((item) => questionNumber(item) === qn);
  if (!row) return;
  const evidence = state.evidenceInput || state.evidenceLibrary;
  const rows = scoreDraft(row, draft, evidence, state.keywords);
  state.drafts[qn] = {
    draft,
    company: state.company,
    sector: state.sector,
    keywords: state.keywords,
    evidence,
    charLimit: state.charLimit,
    updatedAt: new Date().toISOString(),
    statuses: rows.map((item) => item.statusCode),
  };
  persistWorkspace();
}

function questionOverallStatus(row) {
  const record = draftRecord(questionNumber(row));
  if (!record?.draft) return { code: "fail", label: "미작성" };
  const scores = scoreDraft(row, record.draft, record.evidence, record.keywords);
  if (scores.every((item) => item.statusCode === "pass")) return { code: "pass", label: "충족 가능" };
  if (scores.some((item) => item.statusCode === "pass" || item.statusCode === "partial")) return { code: "partial", label: "보완 필요" };
  return { code: "fail", label: "보완 필요" };
}

function deductionRows(scope = state.evaluationScope) {
  return state.rows.flatMap((row) => {
    const qn = questionNumber(row);
    const record = draftRecord(qn);
    if (scope === "drafted" && !record?.draft) return [];
    const draft = record?.draft || "";
    const evidence = record?.evidence || state.evidenceLibrary;
    const keywords = record?.keywords || state.keywords;
    return scoreDraft(row, draft, evidence, keywords)
      .filter((item) => item.statusCode !== "pass")
      .map((item) => ({ row, qn, record, item }));
  });
}

function cloneTemplate(id) {
  return document.querySelector(id).content.cloneNode(true);
}

function setActiveNav(view) {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
}

function renderDashboard() {
  const fragment = cloneTemplate("#dashboardTemplate");
  const modules = moduleGroups();
  const drafted = Object.values(state.drafts).filter((item) => item.draft).length;
  const deductions = deductionRows("drafted");
  fragment.querySelector('[data-field="datasetTitle"]').textContent = localizedPair(state.dataset?.title, state.dataset?.title_ko) || "CDP methodology";
  fragment.querySelector('[data-field="noticeGrid"]').innerHTML = [
    [uiText("섹터", "Sector"), sectorDisplayValue(state.dataset?.sector || state.sector)],
    [uiText("생성일", "Generated"), state.dataset?.generatedAt || "-"],
    [uiText("모드", "Mode"), uiText("작성 + 검토", "Answer + QA")],
  ]
    .map(([label, value]) => `<div class="status-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
  fragment.querySelector('[data-field="metricGrid"]').innerHTML = [
    ["정성 문항", state.rows.length],
    ["작성 문항", drafted],
    ["산업 특수", state.rows.filter((row) => text(row.sectorFlag || row.sector_flag).trim()).length],
    ["감점 후보", deductions.length],
  ]
    .map(([label, value]) => `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
  fragment.querySelector('[data-field="moduleGrid"]').innerHTML = modules
    .map((module) => {
      const pct = module.count ? Math.round((module.drafted / module.count) * 100) : 0;
      return `
        <button type="button" class="module-card" data-module-open="${escapeHtml(module.id)}">
          <span class="eyebrow">${escapeHtml(module.id)}</span>
          <h3>${escapeHtml(moduleTitle(module))}</h3>
          <div class="tag-row">
            <span class="tag">${module.count}${escapeHtml(uiText("개 문항", " questions"))}</span>
            <span class="tag">${module.sector}${escapeHtml(uiText("개 산업특수", " sector-specific"))}</span>
          </div>
          <div class="progress-line"><span style="width:${pct}%"></span></div>
        </button>
      `;
    })
    .join("");
  fragment.querySelector('[data-field="deductionPreview"]').innerHTML = renderDeductionList(deductions.slice(0, 6));
  app.replaceChildren(fragment);
}

function filteredQuestions() {
  const search = normalize(state.search);
  return state.rows.filter((row) => {
    if (state.selectedModule !== "all" && moduleId(row) !== state.selectedModule) return false;
    if (!passesIssueFilter(row)) return false;
    if (!search) return true;
    return normalize([questionNumber(row), row.title, row.title_ko, row.category, row.module, row.module_ko].join(" ")).includes(search);
  });
}

function renderQuestionList() {
  const rows = filteredQuestions();
  if (!rows.length) return `<div class="panel">표시할 문항이 없습니다.</div>`;
  return rows
    .map((row) => {
      const qn = questionNumber(row);
      const status = questionOverallStatus(row);
      return `
        <button type="button" class="question-card ${qn === state.selectedQuestion ? "is-active" : ""}" data-question="${escapeHtml(qn)}">
          <strong>${escapeHtml(qn)} · ${escapeHtml(moduleId(row))}</strong>
          <span class="question-title">${escapeHtml(questionTitle(row))}</span>
          <div class="tag-row">
            <span class="status-badge ${statusClass(status.code)}">${escapeHtml(status.label)}</span>
            ${text(row.sectorFlag || row.sector_flag).trim() ? `<span class="tag">${escapeHtml(uiText("산업 특수", "Industry"))}</span>` : ""}
          </div>
        </button>
      `;
    })
    .join("");
}

function renderCriteriaStack(row) {
  const tab = state.guideTab;
  if (tab === "guidance") {
    return `<article class="criteria-card"><h3>작성안내</h3><div class="criteria-text">${localizedHtml(row.guidance_en || row.requestedContent, row.guidance_ko || row.requestedContent_ko)}</div></article>`;
  }
  if (tab === "allocation") {
    return renderAllocationTables(row);
  }
  if (tab === "source") {
    const en = [`Change From Last Year\n${row.changeFromLastYear || ""}`, `Tags\n${row.tags || ""}`, `Source pages\n${(row.sourcePages || []).join(" - ")}`].join("\n\n");
    const ko = [`전년 대비 변경사항\n${row.changeFromLastYear_ko || ""}`, `태그\n${row.tags_ko || ""}`, `원문 페이지\n${(row.sourcePages || []).join(" - ")}`].join("\n\n");
    return `<article class="criteria-card"><h3>태그와 변경사항</h3><div class="criteria-text">${localizedHtml(en, ko)}</div></article>`;
  }
  return renderScoringCards(row);
}

function renderScoringCards(row) {
  const blocks = parseScoringBlocks(row.scoring_en || row.fullScoreChecklist || row.full_score_checklist);
  const koBlocks = parseScoringBlocks(row.scoring_ko || row.fullScoreChecklist_ko || "");
  if (!blocks.length) {
    return `<article class="criteria-card"><h3>평가기준</h3><div class="criteria-text">${localizedHtml(row.scoring_en || row.fullScoreChecklist || row.full_score_checklist, row.scoring_ko || row.fullScoreChecklist_ko)}</div></article>`;
  }
  return blocks
    .map(
      (block) => `
        <article class="scoring-issue-card">
          <h3>${escapeHtml(block.question)} · ${escapeHtml(issueLabel(block.issue))}</h3>
          <div class="criterion-grid">
            ${block.sections
              .map((section, sectionIndex) => {
                const koSection = koBlocks.find((candidate) => candidate.question === block.question)?.sections?.[sectionIndex];
                const koCandidate = koSection?.criteria || "";
                const koBody = safeKoreanText(section.criteria, koCandidate) || translationPendingText(readableMethodologyText(section.criteria));
                const enBody = readableMethodologyText(section.criteria);
                const body =
                  state.language === "ko"
                    ? `<div class="criterion-body">${escapeHtml(koBody)}</div>`
                    : state.language === "en"
                      ? `<div class="criterion-body">${escapeHtml(enBody)}</div>`
                      : `<div class="criterion-body"><strong>국문</strong><br />${escapeHtml(koBody)}<br /><br /><strong>English</strong><br />${escapeHtml(enBody)}</div>`;
                return `
                  <section class="criterion-level">
                    <div class="criterion-level-head">
                      <span class="level-chip">${escapeHtml(section.code)}</span>
                      <strong>${escapeHtml(state.language === "en" ? section.en : state.language === "ko" ? section.ko : `${section.ko} / ${section.en}`)}</strong>
                      <span>${escapeHtml(section.points)}</span>
                    </div>
                    ${body}
                  </section>
                `;
              })
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderAllocationTables(row) {
  const tables = parseAllocationTables(row.pointAllocation || row.scoring_en || row.fullScoreChecklist || row.full_score_checklist);
  if (!tables.length) {
    return `<article class="criteria-card"><h3>점수 배분</h3><div class="criteria-text">${localizedHtml(row.pointAllocation, row.pointAllocation_ko)}</div></article>`;
  }
  const headers =
    state.language === "en"
      ? ["Issue", "D num", "D den", "A num", "A den", "M num", "M den", "L num", "L den"]
      : ["이슈", "D 분자", "D 분모", "A 분자", "A 분모", "M 분자", "M 분모", "L 분자", "L 분모"];
  return `
    <article class="criteria-card">
      <h3>${escapeHtml(uiText("점수 배분", "Point Allocation"))}</h3>
      <div class="allocation-table-wrap">
        <table class="table-like allocation-table">
          <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${tables
              .map(
                (table) => `
                  <tr>
                    <td><strong>${escapeHtml(table.question)}</strong><br />${escapeHtml(issueLabel(table.issue))}</td>
                    <td>${escapeHtml(table.values.dNum)}</td>
                    <td>${escapeHtml(table.values.dDen)}</td>
                    <td>${escapeHtml(table.values.aNum)}</td>
                    <td>${escapeHtml(table.values.aDen)}</td>
                    <td>${escapeHtml(table.values.mNum)}</td>
                    <td>${escapeHtml(table.values.mDen)}</td>
                    <td>${escapeHtml(table.values.lNum)}</td>
                    <td>${escapeHtml(table.values.lDen)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="table-note">분자는 충족 예상 점수, 분모는 해당 평가수준의 최대 배점을 뜻합니다. D/A/M/L은 각각 공시/인식/관리/리더십 평가수준입니다.</p>
    </article>
  `;
}

function renderFulfillment(row, draft) {
  const evidence = state.evidenceInput || state.evidenceLibrary;
  const scores = scoreDraft(row, draft, evidence, state.keywords);
  return scores
    .map(
      (item) => `
        <article class="fulfillment-card">
          <div class="section-head">
            <h3>${escapeHtml(item.level)} ${escapeHtml(item.name)} · ${escapeHtml(item.points)}</h3>
            <span class="status-badge ${statusClass(item.statusCode)}">${escapeHtml(item.status)}</span>
          </div>
          <p><strong>확인된 요소</strong>: ${escapeHtml(item.matched.map((signal) => signal.label).join(", ") || "없음")}</p>
          <p><strong>확인할 요소</strong>: ${escapeHtml(item.signals.map((signal) => signal.label).join(", "))}</p>
          <div class="criteria-text">${localizedHtml(item.criteria, item.criteria)}</div>
        </article>
      `,
    )
    .join("");
}

function renderWriter() {
  const row = currentRow();
  const qn = questionNumber(row);
  const record = draftRecord(qn);
  const fragment = cloneTemplate("#writerTemplate");
  const modules = moduleGroups();
  const moduleFilter = fragment.querySelector("#moduleFilter");
  const issueFilter = fragment.querySelector("#issueFilter");
  moduleFilter.innerHTML = `<option value="all">${escapeHtml(uiText("전체 모듈", "All modules"))}</option>${modules
    .map((module) => `<option value="${escapeHtml(module.id)}">${escapeHtml(module.id)} · ${escapeHtml(moduleTitle(module))}</option>`)
    .join("")}`;
  moduleFilter.value = state.selectedModule;
  issueFilter.innerHTML = `<option value="all">${escapeHtml(uiText("전체 이슈", "All issues"))}</option>${issueOptions()
    .map((issue) => `<option value="${escapeHtml(issue)}">${escapeHtml(issueFilterLabel(issue))}</option>`)
    .join("")}`;
  issueFilter.value = state.selectedIssue;
  fragment.querySelector("#questionSearch").value = state.search;
  fragment.querySelector('[data-field="questionList"]').innerHTML = renderQuestionList();
  fragment.querySelector('[data-field="questionMeta"]').textContent = `${moduleId(row)} · ${qn} · ${categoryLabel(row.category || "")}`;
  fragment.querySelector('[data-field="questionTitle"]').textContent = questionTitle(row);
  const sourcePages = Array.isArray(row.sourcePages) ? row.sourcePages.join(" - ") : "";
  const issueTags = compactTagList(rowIssues(row).map(issueFilterLabel), 4);
  const sectorTags = compactTagList((Array.isArray(row.sectorTags) ? row.sectorTags : []).map(tagLabel), 4);
  fragment.querySelector('[data-field="questionSource"]').innerHTML = `
    <span>${escapeHtml(uiText("출처", "Source"))}: ${escapeHtml(sourceFileLabel(row.sourceFile || "dataset"))}${sourcePages ? ` · ${escapeHtml(uiText("쪽", "p."))}${escapeHtml(sourcePages)}` : ""}</span>
    ${issueTags ? `<span>${escapeHtml(uiText("이슈", "Issue"))}: ${escapeHtml(issueTags)}</span>` : ""}
    ${sectorTags ? `<span>${escapeHtml(uiText("섹터", "Sector"))}: ${escapeHtml(sectorTags)}</span>` : ""}
  `;
  const den = row.denominators || {};
  fragment.querySelector('[data-field="scorePills"]').innerHTML = ["D", "A", "M", "L"]
    .map((level) => `<span>${level} ${escapeHtml(formatScore(den[level]))}</span>`)
    .join("");
  fragment.querySelector("#companyName").value = state.company;
  fragment.querySelector("#sectorSelect").value = state.sector;
  fragment.querySelector("#charLimit").value = state.charLimit;
  fragment.querySelector("#keywords").value = state.keywords;
  fragment.querySelector("#evidenceText").value = state.evidenceInput || state.evidenceLibrary;
  const draft = record?.draft || "";
  fragment.querySelector("#draftText").value = draft;
  fragment.querySelector('[data-field="charCounter"]').textContent = `${charCount(draft)}자 / ${state.charLimit}자`;
  fragment.querySelector('[data-field="criteriaStack"]').innerHTML = renderCriteriaStack(row);
  fragment.querySelectorAll("[data-guide-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.guideTab === state.guideTab);
  });
  fragment.querySelector('[data-field="evidenceChecklist"]').innerHTML = localizedHtml(
    row.evidenceChecklist || row.evidence_checklist || "",
    row.evidenceChecklist_ko || row.evidenceChecklist || row.evidence_checklist || "",
  );
  fragment.querySelector('[data-field="fulfillmentPanel"]').innerHTML = renderFulfillment(row, draft);
  app.replaceChildren(fragment);
}

function renderDeductionList(rows) {
  if (!rows.length) return `<div class="criteria-text">현재 감점 후보가 없습니다. 초안을 생성하면 문항별 보완 필요 요소가 표시됩니다.</div>`;
  return rows
    .map(({ row, qn, item }) => {
      const action = localizedPair(
        row.improvementActions || row.improvement_actions || "Add the required choices, values, explanations, and evidence location in the same question.",
        row.improvementActions_ko || "평가기준에서 요구하는 선택값, 설명, 정량값, 증빙 위치를 보완하세요.",
      );
      return `
        <article class="deduction-row">
          <div>
            <strong>${escapeHtml(qn)}</strong>
            <div class="eyebrow">${escapeHtml(moduleId(row))}</div>
          </div>
          <div>
            <strong>${escapeHtml(questionTitle(row))}</strong>
            <p>${escapeHtml(item.level)} ${escapeHtml(item.name)} 기준: ${escapeHtml(item.status)}</p>
            <div class="improvement-box">${escapeHtml(action)}</div>
          </div>
          <div>
            <span class="status-badge ${statusClass(item.statusCode)}">${escapeHtml(item.status)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderEvaluation() {
  const fragment = cloneTemplate("#evaluationTemplate");
  fragment.querySelectorAll("[data-eval-scope]").forEach((button) => {
    button.classList.toggle("primary-button", button.dataset.evalScope === state.evaluationScope);
    button.classList.toggle("ghost-button", button.dataset.evalScope !== state.evaluationScope);
  });
  fragment.querySelector('[data-field="deductionTable"]').innerHTML = renderDeductionList(deductionRows());
  app.replaceChildren(fragment);
}

function renderEvidence() {
  const fragment = cloneTemplate("#evidenceTemplate");
  fragment.querySelector("#evidenceLibraryText").value = state.evidenceLibrary;
  fragment.querySelector('[data-field="fileResults"]').innerHTML = state.fileResults
    .map(
      (file) => `
        <div class="status-card">
          <strong>${escapeHtml(file.filename)}</strong>
          <p>${file.ok ? `${file.characters}자 추출` : escapeHtml(file.error || "추출 실패")}</p>
        </div>
      `,
    )
    .join("");
  app.replaceChildren(fragment);
}

function referenceTitle(ref) {
  const labels = {
    questionnaire_overview: { ko: "질문지 개요", en: "Questionnaire Overview" },
    questionnaire_setup: { ko: "질문지 설정", en: "Questionnaire Setup" },
    glossary: { ko: "용어집", en: "Glossary" },
    scoring_intro: { ko: "평가방법론 소개", en: "Scoring Introduction" },
    scoring_changes: { ko: "평가 변경사항", en: "Scoring Changes" },
    climate_weightings: { ko: "기후변화 평가 가중치", en: "Climate Change Weightings" },
    climate_essential: { ko: "기후변화 필수조건", en: "Climate Essential Criteria" },
    water_essential: { ko: "물 안보 필수조건", en: "Water Essential Criteria" },
    industry_classification: { ko: "산업 영향 분류", en: "Industry Impact Classification" },
  };
  const label = labels[ref.key];
  return label ? uiText(label.ko, label.en) : ref.filename;
}

function renderReferences() {
  const references = state.dataset?.references || [];
  if (!state.referenceKey && references.length) state.referenceKey = references[0].key;
  const active = references.find((ref) => ref.key === state.referenceKey) || references[0];
  const fragment = cloneTemplate("#referencesTemplate");
  fragment.querySelector('[data-field="referenceButtons"]').innerHTML = references
    .map(
      (ref) => `
        <button type="button" class="reference-button ${active?.key === ref.key ? "is-active" : ""}" data-reference-key="${escapeHtml(ref.key)}">
          <strong>${escapeHtml(referenceTitle(ref))}</strong>
          <span>${escapeHtml(ref.filename)} · ${escapeHtml(ref.pages)} pages</span>
        </button>
      `,
    )
    .join("");
  if (active) {
    fragment.querySelector('[data-field="referenceMeta"]').textContent = `${active.filename} · ${active.pages} pages`;
    fragment.querySelector('[data-field="referenceTitle"]').textContent = referenceTitle(active);
    fragment.querySelector('[data-field="translationNote"]').textContent =
      state.dataset?.translationNotice_ko || "국문은 검토 편의를 위한 보조 번역/요약입니다. 공식 판단은 영문 원문을 우선하십시오.";
    fragment.querySelector('[data-field="referenceText"]').innerHTML = localizedHtml(active.text_en, active.text_ko);
  } else {
    fragment.querySelector('[data-field="referenceText"]').innerHTML = `<div class="criteria-text">참고문서가 없습니다.</div>`;
  }
  app.replaceChildren(fragment);
}

function exportRows() {
  return state.rows.map((row) => {
    const qn = questionNumber(row);
    const record = draftRecord(qn);
    const scores = scoreDraft(row, record?.draft || "", record?.evidence || state.evidenceLibrary, record?.keywords || state.keywords);
    return {
      module: moduleId(row),
      question: qn,
      title: questionTitle(row),
      sectorFlag: row.sectorFlag || row.sector_flag || "",
      status: scores.map((item) => `${item.level}:${item.status}`).join("; "),
      draft: record?.draft || "",
    };
  });
}

function renderExport() {
  const fragment = cloneTemplate("#exportTemplate");
  const rows = exportRows();
  fragment.querySelector('[data-field="exportTable"]').innerHTML = `
    <table class="table-like">
      <thead><tr><th>Module</th><th>Question</th><th>Status</th><th>Draft chars</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.module)}</td>
                <td>${escapeHtml(row.question)}</td>
                <td>${escapeHtml(row.status)}</td>
                <td>${charCount(row.draft)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
  app.replaceChildren(fragment);
}

function render() {
  setActiveNav(state.activeView);
  document.querySelectorAll("[data-language]").forEach((button) => button.classList.toggle("is-active", button.dataset.language === state.language));
  if (state.activeView === "dashboard") renderDashboard();
  if (state.activeView === "writer") renderWriter();
  if (state.activeView === "evaluation") renderEvaluation();
  if (state.activeView === "references") renderReferences();
  if (state.activeView === "evidence") renderEvidence();
  if (state.activeView === "export") renderExport();
}

function switchView(view) {
  state.activeView = view;
  history.replaceState(null, "", `#${view}`);
  render();
  persistWorkspace();
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    dataset: state.dataset?.title,
    company: state.company,
    sector: state.sector,
    drafts: state.drafts,
    evidenceCharacters: charCount(state.evidenceLibrary),
  };
  download("cdp-writer-export.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
}

function csvEscape(value) {
  return `"${text(value).replaceAll('"', '""')}"`;
}

function exportCsv() {
  const header = ["Module", "Question", "Title", "Sector Flag", "Status", "Draft"];
  const lines = [header.map(csvEscape).join(",")];
  for (const row of exportRows()) {
    lines.push([row.module, row.question, row.title, row.sectorFlag, row.status, row.draft].map(csvEscape).join(","));
  }
  download("cdp-writer-export.csv", `\ufeff${lines.join("\n")}`, "text/csv;charset=utf-8");
}

async function extractFiles(files) {
  if (!files.length) return;
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  const response = await fetch(apiUrl("/api/extract"), { method: "POST", body: formData });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  state.fileResults = payload.files || [];
  const extracted = state.fileResults.filter((file) => file.ok && file.text).map((file) => `[${file.filename}]\n${file.text}`);
  if (extracted.length) {
    state.evidenceLibrary = [state.evidenceLibrary, ...extracted].filter(Boolean).join("\n\n");
    if (!state.evidenceInput) state.evidenceInput = state.evidenceLibrary;
  }
  persistWorkspace();
}

function currentDraftText() {
  return document.querySelector("#draftText")?.value || "";
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.view) {
    switchView(target.dataset.view);
    return;
  }
  if (target.dataset.viewLink) {
    switchView(target.dataset.viewLink);
    return;
  }
  if (target.dataset.language) {
    state.language = target.dataset.language;
    document.querySelectorAll("[data-language]").forEach((button) => button.classList.toggle("is-active", button.dataset.language === state.language));
    render();
    persistWorkspace();
    return;
  }
  if (target.dataset.guideTab) {
    state.guideTab = target.dataset.guideTab;
    renderWriter();
    persistWorkspace();
    return;
  }
  if (target.dataset.referenceKey) {
    state.referenceKey = target.dataset.referenceKey;
    renderReferences();
    persistWorkspace();
    return;
  }
  if (target.dataset.moduleOpen) {
    state.selectedModule = target.dataset.moduleOpen;
    state.activeView = "writer";
    state.selectedQuestion = filteredQuestions()[0] ? questionNumber(filteredQuestions()[0]) : state.selectedQuestion;
    render();
    persistWorkspace();
    return;
  }
  if (target.dataset.question) {
    state.selectedQuestion = target.dataset.question;
    renderWriter();
    persistWorkspace();
    return;
  }
  if (target.id === "generateButton") {
    const row = currentRow();
    const draft = composeDraft(row);
    saveDraft(questionNumber(row), draft);
    renderWriter();
    return;
  }
  if (target.id === "generateGptButton") {
    const row = currentRow();
    target.disabled = true;
    target.textContent = "GPT 생성 중...";
    try {
      const draft = await generateGptDraft(row);
      saveDraft(questionNumber(row), draft);
      renderWriter();
    } catch (error) {
      alert(`GPT 답변 생성에 실패했습니다.\n\n${error.message}\n\n로컬 서버에서 OPENAI_API_KEY를 설정한 뒤 다시 실행하세요.`);
      target.disabled = false;
      target.textContent = "GPT 답변 생성";
    }
    return;
  }
  if (target.id === "saveDraftButton") {
    saveDraft(state.selectedQuestion, currentDraftText());
    renderWriter();
    return;
  }
  if (target.id === "evaluateDraftButton") {
    saveDraft(state.selectedQuestion, currentDraftText());
    renderWriter();
    return;
  }
  if (target.id === "copyDraftButton") {
    await navigator.clipboard?.writeText(currentDraftText());
    return;
  }
  if (target.id === "generateAllButton") {
    for (const row of state.rows) {
      saveDraft(questionNumber(row), composeDraft(row, { evidence: state.evidenceLibrary, keywords: state.keywords }));
    }
    renderEvaluation();
    return;
  }
  if (target.dataset.evalScope) {
    state.evaluationScope = target.dataset.evalScope;
    renderEvaluation();
    return;
  }
  if (target.id === "extractButton") {
    const files = [...(document.querySelector("#fileInput")?.files || [])];
    try {
      await extractFiles(files);
    } catch (error) {
      state.fileResults = [{ filename: "upload", ok: false, characters: 0, error: error.message }];
    }
    renderEvidence();
    return;
  }
  if (target.id === "clearEvidenceButton") {
    state.evidenceLibrary = "";
    state.evidenceInput = "";
    state.fileResults = [];
    renderEvidence();
    persistWorkspace();
    return;
  }
  if (target.id === "clearWorkspaceButton") {
    if (confirm("브라우저에 임시저장된 초안과 증빙 입력을 모두 삭제할까요? 내보낸 CSV/JSON 파일은 영향을 받지 않습니다.")) {
      clearWorkspaceStorage();
      render();
    }
    return;
  }
  if (target.dataset.export === "csv") exportCsv();
  if (target.dataset.export === "json") exportJson();
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "questionSearch") {
    state.search = target.value;
    document.querySelector('[data-field="questionList"]').innerHTML = renderQuestionList();
  }
  if (target.id === "companyName") state.company = target.value;
  if (target.id === "charLimit") state.charLimit = Number(target.value || 2400);
  if (target.id === "keywords") state.keywords = target.value;
  if (target.id === "evidenceText") state.evidenceInput = target.value;
  if (target.id === "draftText") {
    const counter = document.querySelector('[data-field="charCounter"]');
    if (counter) counter.textContent = `${charCount(target.value)}자 / ${state.charLimit}자`;
    saveDraft(state.selectedQuestion, target.value);
  }
  if (target.id === "evidenceLibraryText") {
    state.evidenceLibrary = target.value;
    if (!state.evidenceInput) state.evidenceInput = target.value;
  }
  persistWorkspace();
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.id === "moduleFilter") {
    state.selectedModule = target.value;
    const rows = filteredQuestions();
    state.selectedQuestion = rows[0] ? questionNumber(rows[0]) : state.selectedQuestion;
    renderWriter();
    persistWorkspace();
  }
  if (target.id === "issueFilter") {
    state.selectedIssue = target.value;
    const rows = filteredQuestions();
    state.selectedQuestion = rows[0] ? questionNumber(rows[0]) : state.selectedQuestion;
    renderWriter();
    persistWorkspace();
  }
  if (target.id === "sectorSelect") {
    state.sector = target.value;
    persistWorkspace();
  }
});

exportJsonButton.addEventListener("click", exportJson);
exportCsvButton.addEventListener("click", exportCsv);

async function loadDataset(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const dataset = await response.json();
  state.dataset = dataset;
  state.rows = dataset.qualitativeRows || [];
  state.selectedQuestion = state.rows[0] ? questionNumber(state.rows[0]) : "";
  state.selectedModule = "all";
  state.selectedIssue = "all";
  state.referenceKey = dataset.references?.[0]?.key || "";
  state.activeView = location.hash.replace("#", "") || "dashboard";
  restoreWorkspace(url);
  if (!state.rows.some((row) => questionNumber(row) === state.selectedQuestion)) {
    state.selectedQuestion = state.rows[0] ? questionNumber(state.rows[0]) : "";
  }
  if (!["dashboard", "writer", "evaluation", "references", "evidence", "export"].includes(state.activeView)) {
    state.activeView = "dashboard";
  }
  render();
}

datasetSelect.addEventListener("change", () => loadDataset(datasetSelect.value));

loadDataset(DATASET_URL).catch((error) => {
  app.innerHTML = `<div class="loading-panel">데이터를 불러오지 못했습니다: ${escapeHtml(error.message)}</div>`;
});
