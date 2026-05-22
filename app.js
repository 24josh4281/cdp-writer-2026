const DATASET_URL = "./data/cdp_2026_full_dataset.json";
const STORAGE_KEY = "cdp-writer-2026-workspace";
const workspaceStorage = createWorkspaceStorage();

const app = document.querySelector("#app");
const datasetSelect = document.querySelector("#datasetSelect");
const apiBaseUrlInput = document.querySelector("#apiBaseUrl");
const apiTokenInput = document.querySelector("#apiToken");
const apiCheckButton = document.querySelector("#apiCheckButton");
const apiStatus = document.querySelector("#apiStatus");
const exportJsonButton = document.querySelector("#exportJsonButton");
const exportCsvButton = document.querySelector("#exportCsvButton");

function defaultApiBaseUrl() {
  if (window.CDP_API_BASE_URL) return window.CDP_API_BASE_URL;
  if (location.hostname.includes("raw.githack.com") || location.hostname.includes("rawcdn.githack.com") || location.hostname.includes("github.io")) {
    return "http://127.0.0.1:8780";
  }
  return "";
}

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
  apiBaseUrl: defaultApiBaseUrl(),
  apiToken: "",
  apiHealth: null,
  activeProjectId: "",
  projects: [],
  benchmark: {
    files: [],
    rows: [],
    comparedAt: "",
  },
  reviewerNotes: {},
  gptQualityMode: true,
  methodologySync: {
    sourceUrl: "https://myportal.cdp.net/guidance?locale=en",
    status: "대기",
    files: [],
    changes: [],
    appliedAt: "",
    appliedCount: 0,
  },
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

const ESSENTIAL_CHECKS = [
  { id: "transition_plan", label: "기후전환계획", terms: ["전환계획", "전환 계획", "transition plan", "1.5", "net zero"], levels: ["A", "A-"] },
  { id: "scope_1_2", label: "Scope 1/2 배출량", terms: ["scope 1", "scope 2", "직접배출", "간접배출", "location-based", "market-based"], levels: ["A", "A-"] },
  { id: "scope_3", label: "Scope 3 및 가치사슬", terms: ["scope 3", "가치사슬", "공급망", "value chain", "supplier"], levels: ["A", "A-"] },
  { id: "targets", label: "목표 및 진행률", terms: ["목표", "기준연도", "목표연도", "target", "progress", "sbti"], levels: ["A", "A-"] },
  { id: "assurance", label: "검증/보증", terms: ["검증", "보증", "verification", "assurance", "iso 14064"], levels: ["A", "A-"] },
  { id: "governance", label: "거버넌스 책임", terms: ["이사회", "경영진", "위원회", "board", "management", "책임"], levels: ["A", "A-"] },
];

const SECTOR_RULES = {
  CH: { label: "화학", tags: ["Chemicals", "CH"], terms: ["chemical", "chemicals", "화학", "bio-based", "hazardous", "water", "plastics"] },
  FS: { label: "금융서비스", tags: ["Financial services", "FS"], terms: ["financial services", "portfolio", "client", "investee", "financed emissions"] },
  MM: { label: "금속 및 광업", tags: ["Metals & Mining", "Metals &mining", "MM"], terms: ["metals", "mining", "tailings", "광업", "금속"] },
  COAL: { label: "석탄", tags: ["Coal", "COAL"], terms: ["coal", "석탄"] },
  GEN: { label: "일반", tags: ["General"], terms: [] },
};

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

function escapeRegExp(value) {
  return text(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const configured = normalizeApiBaseUrl(state.apiBaseUrl || window.CDP_API_BASE_URL || "");
  if (!configured) return path;
  return new URL(path, configured.endsWith("/") ? configured : `${configured}/`).toString();
}

function normalizeApiBaseUrl(value) {
  return text(value).trim().replace(/\/+$/, "");
}

function apiHeaders(extra = {}) {
  const headers = { ...extra };
  if (state.apiToken) headers["X-CDP-API-Token"] = state.apiToken;
  return headers;
}

function setApiStatus(code, message) {
  if (!apiStatus) return;
  apiStatus.textContent = message;
  apiStatus.classList.toggle("status-pass", code === "pass");
  apiStatus.classList.toggle("status-partial", code === "partial");
  apiStatus.classList.toggle("status-fail", code === "fail");
}

function apiStatusMessage(payload) {
  if (!payload?.ok) return "API 미확인";
  const gpt = payload.openaiConfigured ? "GPT 가능" : "GPT 키 없음";
  const token = payload.tokenRequired ? "토큰 필요" : "토큰 없음";
  return `API 연결됨 · ${gpt} · ${token}`;
}

function syncApiInputs() {
  if (apiBaseUrlInput) apiBaseUrlInput.value = state.apiBaseUrl || "";
  if (apiTokenInput) apiTokenInput.value = state.apiToken || "";
  if (state.apiHealth) {
    setApiStatus(state.apiHealth.openaiConfigured ? "pass" : "partial", apiStatusMessage(state.apiHealth));
  } else {
    setApiStatus("partial", state.apiBaseUrl ? "API 설정됨" : "기본 API");
  }
}

async function checkApiConnection() {
  try {
    const response = await fetch(apiUrl("/api/health"), {
      method: "GET",
      headers: apiHeaders(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    state.apiHealth = payload;
    setApiStatus(payload.openaiConfigured ? "pass" : "partial", apiStatusMessage(payload));
    return payload;
  } catch (error) {
    state.apiHealth = null;
    setApiStatus("fail", `API 실패: ${error.message}`);
    throw error;
  }
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
    apiBaseUrl: state.apiBaseUrl,
    activeProjectId: state.activeProjectId,
    projects: state.projects,
    benchmark: state.benchmark,
    reviewerNotes: state.reviewerNotes,
    gptQualityMode: state.gptQualityMode,
    methodologySync: {
      sourceUrl: state.methodologySync.sourceUrl,
      status: state.methodologySync.status,
      files: state.methodologySync.files,
      changes: state.methodologySync.changes,
      appliedAt: state.methodologySync.appliedAt,
      appliedCount: state.methodologySync.appliedCount,
    },
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
      apiBaseUrl: saved.apiBaseUrl || state.apiBaseUrl,
      activeProjectId: saved.activeProjectId || "",
      projects: Array.isArray(saved.projects) ? saved.projects : [],
      benchmark: saved.benchmark || state.benchmark,
      reviewerNotes: saved.reviewerNotes || {},
      gptQualityMode: saved.gptQualityMode !== false,
      methodologySync: saved.methodologySync || state.methodologySync,
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
  state.apiToken = "";
  state.apiHealth = null;
  state.activeProjectId = "";
  state.projects = [];
  state.benchmark = { files: [], rows: [], comparedAt: "" };
  state.reviewerNotes = {};
  state.gptQualityMode = true;
  state.methodologySync = {
    sourceUrl: "https://myportal.cdp.net/guidance?locale=en",
    status: "대기",
    files: [],
    changes: [],
    appliedAt: "",
    appliedCount: 0,
  };
  clearMethodologyOverlay();
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

function rowScoringText(row) {
  return row.syncScoringText || row.fullScoreChecklist_ko || row.scoring_ko || row.fullScoreChecklist || row.full_score_checklist || "";
}

function rowScoringTextEn(row) {
  return row.syncScoringText || row.scoring_en || row.fullScoreChecklist || row.full_score_checklist || "";
}

function rowAllocationText(row) {
  return row.syncScoringText || row.pointAllocation || row.scoring_en || row.fullScoreChecklist || row.full_score_checklist || "";
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

function cleanCriterionText(value) {
  return text(value)
    .replace(/\s+/g, " ")
    .replace(/\bAND\b/g, " AND ")
    .replace(/\bOR\b/g, " OR ")
    .trim();
}

function routeLabel(value) {
  const lower = normalize(value);
  if (lower.includes("not applicable")) return "Not applicable";
  const route = text(value).match(/route\s*([a-z])/i);
  return route ? `Route ${route[1].toUpperCase()}` : "";
}

function termsFromText(value) {
  const lower = normalize(value);
  const terms = new Set();
  for (const signal of SIGNALS) {
    if (signal.terms.some((term) => lower.includes(term.toLowerCase()))) {
      signal.terms.slice(0, 4).forEach((term) => terms.add(term));
    }
  }
  const quoted = [...text(value).matchAll(/['"‘’“”]([^'"‘’“”]{2,80})['"‘’“”]/g)].map((match) => match[1]);
  quoted.slice(0, 8).forEach((term) => terms.add(term));
  const keywords = [
    "short-term",
    "medium-term",
    "long-term",
    "단기",
    "중기",
    "장기",
    "yes",
    "no",
    "annually",
    "more than once a year",
    "climate change",
    "water",
    "risks",
    "opportunities",
    "scope 1",
    "scope 2",
    "scope 3",
  ];
  keywords.filter((term) => lower.includes(term.toLowerCase())).forEach((term) => terms.add(term));
  return [...terms].slice(0, 12);
}

function atomizeCriteria(criteria) {
  const source = text(criteria)
    .replace(/\r/g, "\n")
    .replace(/(ROUTE\s+[A-Z]\))/gi, "\n$1 ")
    .replace(/(NOT APPLICABLE ROUTE\))/gi, "\n$1 ")
    .replace(/([.;])\s*(AND|OR)\s+/gi, "$1\n$2 ")
    .replace(/\s+(i{1,3}|iv|v|vi{0,3}|x)\)\s+/gi, "\n$1) ")
    .replace(/\s+([a-z])\)\s+/gi, "\n$1) ");
  const routeLines = source.split(/\n+/).map(cleanCriterionText).filter(Boolean);
  const atoms = [];
  let activeRoute = "";
  for (const line of routeLines) {
    const route = routeLabel(line);
    if (route) activeRoute = route;
    const pieces = line
      .split(/\s+-\s+|;\s+|(?<=\.)\s+(?=(Columns|Both|Any|All|Either|If|For rows|Points|A maximum|Maximum|선택|입력|작성|해당|다음|모든|둘 중|하나))/)
      .map(cleanCriterionText)
      .filter((piece) => piece.length >= 18);
    for (const piece of pieces) {
      if (/^a maximum|^maximum|^points will be awarded/i.test(piece) && piece.length < 120) continue;
      atoms.push({
        id: atoms.length + 1,
        label: `조건 ${atoms.length + 1}`,
        detail: clampText(piece, 520),
        route: routeLabel(piece) || activeRoute,
        terms: termsFromText(piece),
      });
    }
  }
  if (atoms.length) return atoms.slice(0, 24);
  return requiredSignals(criteria).map((signal, index) => ({
    id: index + 1,
    label: `조건 ${index + 1}`,
    detail: signal.label,
    route: "",
    terms: signal.terms,
  }));
}

function sourceFragments(source) {
  return text(source)
    .split(/\n{2,}|(?<=다\.)\s+|(?<=요\.)\s+|(?<=\.)\s+|(?<=\))\s+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 12);
}

function evidenceSnippet(source, terms, fallback = "") {
  const fragments = sourceFragments(source);
  if (!fragments.length) return "";
  const normalizedTerms = (terms || []).map((term) => term.toLowerCase()).filter(Boolean);
  const matched = normalizedTerms.length
    ? fragments.find((fragment) => normalizedTerms.some((term) => normalize(fragment).includes(term)))
    : fragments[0];
  return clampText(matched || fallback || "", 260);
}

function signalDetail(signal, source) {
  const normalizedSource = normalize(source);
  if (!signal.terms.length) {
    const hasEnoughContext = normalizedSource.length >= 120;
    return {
      label: signal.label,
      detail: signal.detail || signal.label,
      route: signal.route || "",
      terms: [],
      statusCode: hasEnoughContext ? "pass" : "fail",
      status: hasEnoughContext ? "충족 가능" : "보완 필요",
      evidence: hasEnoughContext ? evidenceSnippet(source, [], source) : "응답 또는 증빙 문장이 충분하지 않습니다.",
      engine: "rule",
    };
  }
  const matchedTerms = signal.terms.filter((term) => normalizedSource.includes(term.toLowerCase()));
  const statusCode = matchedTerms.length ? "pass" : "fail";
  return {
    label: signal.label,
    detail: signal.detail || signal.label,
    route: signal.route || "",
    terms: signal.terms,
    matchedTerms,
    statusCode,
    status: statusCode === "pass" ? "충족 가능" : "보완 필요",
    evidence: statusCode === "pass" ? evidenceSnippet(source, matchedTerms) : `필요 키워드/근거: ${signal.terms.slice(0, 4).join(", ")}`,
    engine: "rule",
  };
}

function sectionMaxPoints(row, section) {
  const denominator = Number(row.denominators?.[section.level]);
  if (Number.isFinite(denominator) && denominator > 0) return denominator;
  const ratioMatch = text(section.points).match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (ratioMatch) return Number(ratioMatch[2]);
  const pointMatch = text(section.points).match(/(\d+(?:\.\d+)?)/);
  return pointMatch ? Number(pointMatch[1]) : 0;
}

function formatPointValue(value) {
  if (!Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function confidenceFrom(ratio, conditionRows, draft, evidence) {
  const sourceLength = charCount([draft, evidence].join(" "));
  const hasEvidence = text(evidence).trim().length >= 80;
  if (!sourceLength) return { code: "fail", label: "낮음", note: "응답 또는 증빙이 없습니다." };
  if (ratio >= 0.99 && hasEvidence && conditionRows.every((item) => item.statusCode === "pass")) {
    return { code: "pass", label: "높음", note: "조건 키워드와 증빙 문장이 함께 확인됩니다." };
  }
  if (ratio >= 0.5 || sourceLength >= 300) {
    return { code: "partial", label: "중간", note: "일부 조건은 확인되지만 원문 대조가 필요합니다." };
  }
  return { code: "fail", label: "낮음", note: "평가기준을 충족하는 근거가 부족합니다." };
}

function confidenceLabel(method, confidence) {
  const methodLabel = method === "gpt" ? "GPT 보조" : method === "manual" ? "수동 입력" : "규칙 기반";
  if (confidence.code === "pass") return `확실 · ${methodLabel}`;
  if (confidence.code === "partial") return `검토 필요 · ${methodLabel}`;
  return `판단 불가 · ${methodLabel}`;
}

function sectionRouteInfo(section, conditionRows) {
  const source = normalize([section.name, section.criteria, conditionRows.map((item) => item.route).join(" ")].join(" "));
  const routes = [...new Set(conditionRows.map((item) => item.route).filter(Boolean))];
  return {
    routes,
    hasRoute: routes.length > 0 || /route\s+[a-z]/i.test(source),
    notApplicable: source.includes("not applicable"),
    bestRow: source.includes("best row"),
    rowLevel: source.includes("row") || source.includes("rows") || source.includes("행"),
    partial: source.includes("proportion") || source.includes("partial") || source.includes("부분"),
  };
}

function scoreCalculation(row, section, ratio, conditionRows) {
  const denominator = sectionMaxPoints(row, section);
  const route = sectionRouteInfo(section, conditionRows);
  const numerator = denominator ? Math.round(denominator * ratio * 100) / 100 : 0;
  const notes = [];
  if (route.hasRoute) notes.push(`route 적용: ${route.routes.join(", ") || "원문 확인"}`);
  if (route.notApplicable) notes.push("Not applicable 경로 포함");
  if (route.bestRow) notes.push("best row scoring 문구 포함");
  if (route.rowLevel) notes.push("row-level/cell-level 조건 포함");
  if (route.partial) notes.push("부분점수/비례점수 문구 포함");
  return {
    numerator,
    denominator,
    ratio,
    route,
    method: denominator ? "조건 충족률 기반 추정" : "배점 원문 확인 필요",
    notes,
  };
}

function scoreDraft(row, draft, evidence, keywords, method = "rule") {
  const combinedSource = [draft, evidence, keywords].join("\n\n");
  const combined = normalize(combinedSource);
  const checklist = state.language === "en" ? rowScoringTextEn(row) : rowScoringText(row);
  return criteriaSections(checklist).map((section) => {
    const signals = atomizeCriteria(section.criteria);
    const conditionRows = signals.map((signal) => signalDetail(signal, combinedSource));
    const matched = signals.filter((signal) => {
      if (!signal.terms.length) return combined.length >= 120;
      return signal.terms.some((term) => combined.includes(term.toLowerCase()));
    });
    const ratio = signals.length ? matched.length / signals.length : 1;
    const statusCode = ratio >= 0.99 ? "pass" : ratio >= 0.5 ? "partial" : "fail";
    const maxPoints = sectionMaxPoints(row, section);
    const calculation = scoreCalculation(row, section, ratio, conditionRows);
    const earnedPoints = calculation.numerator;
    const confidence = confidenceFrom(ratio, conditionRows, draft, evidence);
    confidence.label = confidenceLabel(method, confidence);
    return {
      ...section,
      signals,
      matched,
      conditionRows,
      ratio,
      maxPoints,
      earnedPoints,
      calculation,
      confidence,
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
  return guardedDraftText(clampText([base, evidencePart, governance, proof].filter(Boolean).join("\n\n"), limit), row, evidence);
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
    scoring_en: rowScoringTextEn(row),
    points: row.points_ko || row.points || "",
    evidenceChecklist: row.evidenceChecklist_ko || row.evidenceChecklist || row.evidence_checklist || "",
  };
}

async function generateGptDraft(row) {
  const health = state.apiHealth || (await checkApiConnection());
  if (!health.openaiConfigured) {
    throw new Error("GPT 생성은 서버에 OPENAI_API_KEY를 설정한 뒤 사용할 수 있습니다. 파일 추출과 XLSX 생성은 현재 API로 계속 사용할 수 있습니다.");
  }
  const payload = {
    company: state.company,
    sector: state.sector,
    charLimit: state.charLimit,
    keywords: state.keywords,
    evidence: state.evidenceInput || state.evidenceLibrary,
    qualityMode: state.gptQualityMode,
    question: questionPayloadForAi(row),
  };
  const response = await fetch(apiUrl("/api/generate"), {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }
  return guardedDraftText(result.draft || "", row, state.evidenceInput || state.evidenceLibrary);
}

function saveDraft(qn, draft, options = {}) {
  const row = state.rows.find((item) => questionNumber(item) === qn);
  if (!row) return;
  const evidence = state.evidenceInput || state.evidenceLibrary;
  const method = options.method || state.drafts[qn]?.method || "manual";
  const rows = scoreDraft(row, draft, evidence, state.keywords, method);
  state.drafts[qn] = {
    draft,
    method,
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
  const scores = scoreDraft(row, record.draft, record.evidence, record.keywords, record.method);
  if (scores.every((item) => item.statusCode === "pass")) return { code: "pass", label: "충족 가능" };
  if (scores.some((item) => item.statusCode === "pass" || item.statusCode === "partial")) return { code: "partial", label: "보완 필요" };
  return { code: "fail", label: "보완 필요" };
}

function deductionRows(scope = state.evaluationScope) {
  return state.rows.flatMap((row) => {
    if (isSectorSpecificRow(row) && !isSelectedSectorRow(row)) return [];
    const qn = questionNumber(row);
    const record = draftRecord(qn);
    if (scope === "drafted" && !record?.draft) return [];
    const draft = record?.draft || "";
    const evidence = record?.evidence || state.evidenceLibrary;
    const keywords = record?.keywords || state.keywords;
    return scoreDraft(row, draft, evidence, keywords, record?.method || "rule")
      .filter((item) => item.statusCode !== "pass")
      .map((item) => ({ row, qn, record, item }));
  });
}

function combinedEvaluationText() {
  const draftText = Object.values(state.drafts)
    .map((record) => record?.draft || "")
    .filter(Boolean)
    .join("\n\n");
  return [draftText, state.evidenceLibrary, state.evidenceInput, state.keywords].join("\n\n");
}

function evaluateEssentialCriteria() {
  const source = combinedEvaluationText();
  const normalizedSource = normalize(source);
  return ESSENTIAL_CHECKS.map((check) => {
    const matchedTerms = check.terms.filter((term) => normalizedSource.includes(term.toLowerCase()));
    const statusCode = matchedTerms.length >= Math.min(2, check.terms.length) ? "pass" : matchedTerms.length ? "partial" : "fail";
    return {
      ...check,
      matchedTerms,
      statusCode,
      status: statusCode === "pass" ? "충족 가능" : statusCode === "partial" ? "검토 필요" : "미충족/증빙 필요",
      evidence: matchedTerms.length ? evidenceSnippet(source, matchedTerms) : `[증빙 필요] ${check.label} 관련 정책, 수치, 목표 또는 검증자료를 추가하세요.`,
    };
  });
}

function selectedSectorRule() {
  return SECTOR_RULES[state.sector] || SECTOR_RULES.GEN;
}

function isSectorSpecificRow(row) {
  const tags = Array.isArray(row.sectorTags) ? row.sectorTags : [];
  const flag = text(row.sectorFlag || row.sector_flag).trim();
  return Boolean(flag || tags.length);
}

function isSelectedSectorRow(row) {
  const rule = selectedSectorRule();
  if (!rule || state.sector === "GEN") return !isSectorSpecificRow(row);
  const haystack = normalize([
    row.sectorFlag,
    row.sector_flag,
    ...(Array.isArray(row.sectorTags) ? row.sectorTags : []),
    row.category,
    row.question,
    row.question_ko,
    row.scoring_en,
  ].join(" "));
  return rule.tags.some((tag) => haystack.includes(tag.toLowerCase())) || rule.terms.some((term) => haystack.includes(term.toLowerCase()));
}

function sectorApplicabilityRows() {
  return state.rows
    .filter(isSectorSpecificRow)
    .map((row) => ({
      row,
      qn: questionNumber(row),
      applicable: isSelectedSectorRow(row),
      reason: isSelectedSectorRow(row) ? `${selectedSectorRule().label} 섹터 특수 문항 후보` : "현재 선택 섹터와 직접 매칭되지 않음",
    }));
}

function improvementForCondition(condition) {
  if (condition.statusCode === "pass") return "";
  const base = condition.detail || condition.label;
  return `[증빙 필요] ${base} 조건을 충족하도록 응답 본문에 선택값, 정량값, 산정기간, 책임조직, 증빙 위치를 같은 문항 안에 추가하세요.`;
}

function scoreTotals(rows = state.rows) {
  const totals = {
    D: { numerator: 0, denominator: 0 },
    A: { numerator: 0, denominator: 0 },
    M: { numerator: 0, denominator: 0 },
    L: { numerator: 0, denominator: 0 },
  };
  for (const row of rows) {
    const qn = questionNumber(row);
    const record = draftRecord(qn);
    const scores = scoreDraft(row, record?.draft || "", record?.evidence || state.evidenceLibrary, record?.keywords || state.keywords, record?.method || "rule");
    for (const item of scores) {
      if (!totals[item.level]) totals[item.level] = { numerator: 0, denominator: 0 };
      totals[item.level].numerator += item.calculation.numerator || 0;
      totals[item.level].denominator += item.calculation.denominator || 0;
    }
  }
  return totals;
}

function applicableEvaluationRows() {
  return state.rows.filter((row) => !isSectorSpecificRow(row) || isSelectedSectorRow(row));
}

function reviewPriorityRows(limit = 80) {
  return deductionRows("all")
    .map(({ row, qn, item }) => {
      const missing = item.conditionRows.filter((condition) => condition.statusCode !== "pass");
      const scoreGap = Math.max(0, Number(item.maxPoints || 0) - Number(item.earnedPoints || 0));
      const severity = (item.statusCode === "fail" ? 3 : 1) + (item.confidence.code === "fail" ? 2 : item.confidence.code === "partial" ? 1 : 0) + Math.min(3, scoreGap);
      return {
        module: moduleId(row),
        question: qn,
        title: questionTitle(row),
        level: item.level,
        status: item.status,
        confidence: item.confidence.label,
        scoreGap,
        severity,
        missingLabels: missing.map((condition) => condition.label).join(", ") || "세부 조건 원문 확인 필요",
        firstAction: missing.map(improvementForCondition).filter(Boolean)[0] || "평가기준 원문과 증빙 위치를 대조하세요.",
      };
    })
    .sort((a, b) => b.severity - a.severity || b.scoreGap - a.scoreGap || a.module.localeCompare(b.module) || a.question.localeCompare(b.question))
    .slice(0, limit);
}

function evidenceQualityChecks() {
  const evidenceChars = charCount(state.evidenceLibrary || state.evidenceInput);
  const draftCount = Object.values(state.drafts).filter((item) => item.draft).length;
  const extractedOk = state.fileResults.filter((file) => file.ok).length;
  const extractedFail = state.fileResults.filter((file) => !file.ok).length;
  return [
    {
      item: "회사명",
      statusCode: state.company && state.company !== "회사명" ? "pass" : "partial",
      result: state.company && state.company !== "회사명" ? state.company : "기본값 사용 중",
      action: "기업별 평가 전에 회사명을 실제 법인명으로 바꾸세요.",
    },
    {
      item: "증빙 원문 길이",
      statusCode: evidenceChars >= 3000 ? "pass" : evidenceChars >= 500 ? "partial" : "fail",
      result: `${evidenceChars.toLocaleString()}자`,
      action: "보고서, 검증성명서, 정량 산정표에서 관련 문단을 추가하면 판단 정확도가 올라갑니다.",
    },
    {
      item: "파일 추출 결과",
      statusCode: extractedFail ? "partial" : extractedOk ? "pass" : "partial",
      result: `${extractedOk}개 성공 / ${extractedFail}개 실패`,
      action: "실패 파일은 PDF 암호, 이미지 PDF, 손상 파일 여부를 확인하세요.",
    },
    {
      item: "작성 초안 수",
      statusCode: draftCount >= Math.min(10, state.rows.length) ? "pass" : draftCount ? "partial" : "fail",
      result: `${draftCount}개 작성`,
      action: "우선 M1~M13 주요 문항부터 초안을 생성해 감점 후보를 확인하세요.",
    },
    {
      item: "GPT 생성 준비",
      statusCode: state.apiHealth?.openaiConfigured ? "pass" : "partial",
      result: state.apiHealth ? apiStatusMessage(state.apiHealth) : "API 연결 확인 전",
      action: "GPT 자동 작성이 필요하면 OPENAI_API_KEY 설정 후 서버를 재시작하고 API 연결을 다시 누르세요.",
    },
  ];
}

function qualityGateRows() {
  const applicableRows = applicableEvaluationRows();
  const drafted = applicableRows.filter((row) => draftRecord(questionNumber(row))?.draft).length;
  const deductions = deductionRows("all");
  const essentialRisks = evaluateEssentialCriteria().filter((row) => row.statusCode !== "pass").length;
  const lowConfidence = exportRows().filter((row) => row.confidence.includes("판단 불가")).length;
  const evidenceChars = charCount(state.evidenceLibrary || state.evidenceInput);
  return [
    ["작성 커버리지", drafted >= applicableRows.length ? "충족" : "검토 필요", `${drafted}/${applicableRows.length}`, "적용 문항 전체에 초안 또는 실제 응답이 있어야 전체 사전평가가 안정적입니다."],
    ["감점 후보", deductions.length ? "검토 필요" : "충족", `${deductions.length}건`, "감점 후보는 조건별 증빙 또는 응답 보완으로 줄입니다."],
    ["필수조건", essentialRisks ? "검토 필요" : "충족", `${essentialRisks}건`, "A/A- 상한 리스크가 있는 필수조건은 별도 증빙을 먼저 확인합니다."],
    ["평가 신뢰도", lowConfidence ? "검토 필요" : "충족", `${lowConfidence}건`, "판단 불가 문항은 사람이 원문 기준과 증빙을 대조해야 합니다."],
    ["증빙 충분성", evidenceChars >= 3000 ? "충족" : "검토 필요", `${evidenceChars.toLocaleString()}자`, "증빙 원문이 짧으면 키워드 기반 평가가 과소 또는 과대 추정될 수 있습니다."],
  ];
}

function maxScorePathRows(limit = 250) {
  return applicableEvaluationRows()
    .slice(0, limit)
    .flatMap((row) => {
      const checklist = row.fullScoreChecklist_ko || row.scoring_ko || row.fullScoreChecklist || row.full_score_checklist || "";
      return criteriaSections(checklist).map((section) => {
        const atoms = atomizeCriteria(section.criteria);
        return [
          moduleId(row),
          questionNumber(row),
          questionTitle(row),
          section.level,
          formatPointValue(sectionMaxPoints(row, section)),
          atoms.map((atom) => `${atom.label}: ${atom.detail}`).join("\n"),
          atoms.flatMap((atom) => atom.terms || []).slice(0, 12).join(", "),
          "선택값, 정량값, 산정기간, 책임조직, 증빙 위치를 같은 문항 안에서 누락 없이 제시",
        ];
      });
    });
}

function renderQualityGatePanel() {
  const checks = qualityGateRows();
  const evidenceChecks = evidenceQualityChecks();
  return `
    <div class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">품질 게이트</p>
          <h2>평가 실행 전 점검</h2>
        </div>
        <span class="status-badge ${checks.some((row) => row[1] !== "충족") ? "status-partial" : "status-pass"}">${checks.filter((row) => row[1] !== "충족").length}개 검토</span>
      </div>
      <table class="table-like compact-table">
        <thead><tr><th>점검항목</th><th>상태</th><th>현재값</th><th>조치</th></tr></thead>
        <tbody>
          ${checks
            .map((row) => `<tr><td>${escapeHtml(row[0])}</td><td><span class="status-badge ${row[1] === "충족" ? "status-pass" : "status-partial"}">${escapeHtml(row[1])}</span></td><td>${escapeHtml(row[2])}</td><td>${escapeHtml(row[3])}</td></tr>`)
            .join("")}
        </tbody>
      </table>
      <h3>증빙 품질</h3>
      <table class="table-like compact-table">
        <thead><tr><th>항목</th><th>상태</th><th>현재값</th><th>권장 조치</th></tr></thead>
        <tbody>
          ${evidenceChecks
            .map((item) => `<tr><td>${escapeHtml(item.item)}</td><td><span class="status-badge ${statusClass(item.statusCode)}">${escapeHtml(item.statusCode === "pass" ? "충족" : item.statusCode === "partial" ? "검토" : "부족")}</span></td><td>${escapeHtml(item.result)}</td><td>${escapeHtml(item.action)}</td></tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReviewPriorityPanel() {
  const rows = reviewPriorityRows(12);
  return `
    <div class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">검토 큐</p>
          <h2>우선 확인할 감점 후보</h2>
        </div>
        <span class="status-badge ${rows.length ? "status-partial" : "status-pass"}">${rows.length}건</span>
      </div>
      ${
        rows.length
          ? `<table class="table-like compact-table">
              <thead><tr><th>문항</th><th>수준</th><th>점수차</th><th>부족 조건</th><th>첫 조치</th></tr></thead>
              <tbody>
                ${rows
                  .map((row) => `<tr><td><strong>${escapeHtml(row.question)}</strong><br />${escapeHtml(row.title)}</td><td>${escapeHtml(row.level)}<br />${escapeHtml(row.confidence)}</td><td>${escapeHtml(formatPointValue(row.scoreGap))}</td><td>${escapeHtml(row.missingLabels)}</td><td>${escapeHtml(row.firstAction)}</td></tr>`)
                  .join("")}
              </tbody>
            </table>`
          : `<div class="criteria-text">현재 우선 검토할 감점 후보가 없습니다.</div>`
      }
    </div>
  `;
}

function scoringRuleForRow(row) {
  const source = rowScoringTextEn(row);
  const sections = criteriaSections(source);
  return {
    module: moduleId(row),
    question: questionNumber(row),
    title: questionTitle(row),
    sectorFlag: row.sectorFlag || row.sector_flag || "",
    sectorApplicable: !isSectorSpecificRow(row) || isSelectedSectorRow(row),
    synced: Boolean(row.syncScoringText),
    levels: sections.map((section) => {
      const atoms = atomizeCriteria(section.criteria);
      const route = sectionRouteInfo(section, atoms.map((atom) => ({ route: atom.route || "" })));
      return {
        level: section.level,
        name: section.name,
        maxPoints: sectionMaxPoints(row, section),
        route: route.routes.join(", "),
        hasRoute: route.hasRoute,
        bestRow: route.bestRow,
        rowLevel: route.rowLevel,
        partial: route.partial,
        atomCount: atoms.length,
        atoms,
      };
    }),
  };
}

function scoringRuleRows(limit = state.rows.length) {
  return applicableEvaluationRows()
    .slice(0, limit)
    .flatMap((row) => {
      const rule = scoringRuleForRow(row);
      return rule.levels.map((level) => [
        rule.module,
        rule.question,
        rule.title,
        level.level,
        formatPointValue(level.maxPoints),
        level.hasRoute ? "Y" : "N",
        level.bestRow ? "Y" : "N",
        level.rowLevel ? "Y" : "N",
        level.partial ? "Y" : "N",
        level.atomCount,
        level.atoms.map((atom) => `${atom.label}: ${atom.detail}`).join("\n"),
        rule.synced ? "Y" : "N",
      ]);
    });
}

function currentProjectSnapshot() {
  return {
    company: state.company,
    sector: state.sector,
    charLimit: state.charLimit,
    keywords: state.keywords,
    evidenceInput: state.evidenceInput,
    evidenceLibrary: state.evidenceLibrary,
    drafts: state.drafts,
    fileResults: state.fileResults,
    benchmark: state.benchmark,
    reviewerNotes: state.reviewerNotes,
    savedAt: new Date().toISOString(),
  };
}

function saveProject(name) {
  const projectName = text(name || state.company || "CDP Project").trim() || "CDP Project";
  const id = state.activeProjectId || `project-${Date.now()}`;
  const existing = state.projects.find((project) => project.id === id);
  const project = { id, name: projectName, ...currentProjectSnapshot() };
  if (existing) Object.assign(existing, project);
  else state.projects.push(project);
  state.activeProjectId = id;
  persistWorkspace();
}

function loadProject(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  Object.assign(state, {
    activeProjectId: project.id,
    company: project.company || project.name || state.company,
    sector: project.sector || state.sector,
    charLimit: Number(project.charLimit || state.charLimit || 2400),
    keywords: project.keywords || "",
    evidenceInput: project.evidenceInput || "",
    evidenceLibrary: project.evidenceLibrary || "",
    drafts: project.drafts || {},
    fileResults: project.fileResults || [],
    benchmark: project.benchmark || { files: [], rows: [], comparedAt: "" },
    reviewerNotes: project.reviewerNotes || {},
  });
  persistWorkspace();
}

function deleteProject(id) {
  state.projects = state.projects.filter((project) => project.id !== id);
  if (state.activeProjectId === id) state.activeProjectId = "";
  persistWorkspace();
}

function benchmarkText(files = state.benchmark.files) {
  return (files || [])
    .filter((file) => file.ok && file.text)
    .map((file) => `[${file.filename}]\n${file.text}`)
    .join("\n\n");
}

function parseBenchmarkRows(source) {
  const lines = text(source)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const rows = [];
  for (const line of lines) {
    const qn = line.match(/\b\d+(?:\.\d+){1,3}[a-z]?\b/)?.[0];
    if (!qn) continue;
    const levelScores = {};
    for (const level of ["D", "A", "M", "L"]) {
      const match = line.match(new RegExp(`${level}\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)(?:\\s*/\\s*(\\d+(?:\\.\\d+)?))?`, "i"));
      if (match) levelScores[level] = match[2] ? `${match[1]}/${match[2]}` : match[1];
    }
    const scoreLike = line.match(/\b\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\b/)?.[0] || "";
    if (Object.keys(levelScores).length || scoreLike) {
      rows.push({ question: qn, levelScores, scoreLike, sourceLine: line });
    }
  }
  const byQuestion = new Map();
  for (const row of rows) {
    if (!byQuestion.has(row.question)) byQuestion.set(row.question, row);
  }
  return [...byQuestion.values()];
}

function compareBenchmarkRows() {
  const parsed = parseBenchmarkRows(benchmarkText());
  const autoRows = exportRows();
  return parsed.map((bench) => {
    const auto = autoRows.find((row) => row.question === bench.question);
    const autoScore = auto?.expectedScore || "";
    const match = Object.entries(bench.levelScores || {}).every(([level, score]) => autoScore.includes(`${level}:`) && autoScore.includes(String(score).split("/")[0]));
    return {
      question: bench.question,
      title: auto?.title || "",
      benchmarkScore: Object.keys(bench.levelScores || {}).length ? Object.entries(bench.levelScores).map(([level, score]) => `${level}:${score}`).join("; ") : bench.scoreLike,
      autoScore,
      result: auto ? (match ? "일치 후보" : "차이 검토") : "자동평가 문항 없음",
      sourceLine: bench.sourceLine,
    };
  });
}

function reviewerKey(question, level = "Q") {
  return `${question}::${level}`;
}

function reviewerRows(limit = 200) {
  return deductionRows("all")
    .slice(0, limit)
    .map(({ row, qn, item }) => {
      const key = reviewerKey(qn, item.level);
      const note = state.reviewerNotes[key] || {};
      return {
        key,
        module: moduleId(row),
        question: qn,
        title: questionTitle(row),
        level: item.level,
        status: item.status,
        expectedScore: `${formatPointValue(item.earnedPoints)}/${formatPointValue(item.maxPoints)}`,
        confidence: item.confidence.label,
        decision: note.decision || "pending",
        note: note.note || "",
        updatedAt: note.updatedAt || "",
      };
    });
}

function setReviewerNote(key, patch) {
  state.reviewerNotes[key] = {
    ...(state.reviewerNotes[key] || {}),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  persistWorkspace();
}

function guardedDraftText(draft, row, evidence) {
  if (!state.gptQualityMode) return draft;
  const evidenceChars = charCount(evidence);
  const checks = [
    { label: "정량 수치", pattern: /\d+(?:\.\d+)?\s*(?:tCO2e|톤|MWh|%|원|KRW|USD|년|year)/i },
    { label: "검증/보증", pattern: /검증|보증|verification|assurance/i },
    { label: "목표/전환계획", pattern: /목표|전환계획|target|transition/i },
  ];
  const missing = checks
    .filter((check) => check.pattern.test(draft) && !check.pattern.test(evidence))
    .map((check) => `[증빙 필요: ${check.label}]`);
  if (!missing.length && evidenceChars >= 120) return draft;
  const locationHint = evidenceChars ? "증빙 위치(파일명/페이지/시트/행)를 함께 확인하세요." : "증빙 원문이 없어 사실·수치 확정이 필요합니다.";
  return clampText([draft, ...missing, `[검토 필요] ${locationHint}`].join("\n\n"), state.charLimit || 2400);
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
  const blocks = parseScoringBlocks(rowScoringTextEn(row));
  const koBlocks = parseScoringBlocks(row.scoring_ko || row.fullScoreChecklist_ko || "");
  if (!blocks.length) {
    return `<article class="criteria-card"><h3>평가기준</h3><div class="criteria-text">${localizedHtml(rowScoringTextEn(row), row.scoring_ko || row.fullScoreChecklist_ko)}</div></article>`;
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
  const tables = parseAllocationTables(rowAllocationText(row));
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

function renderScoreSummary(scores) {
  if (!scores.length) return "";
  return `
    <div class="score-summary">
      <table class="table-like compact-table">
        <thead>
          <tr><th>수준</th><th>상태</th><th>예상점수</th><th>충족률</th><th>신뢰도</th></tr>
        </thead>
        <tbody>
          ${scores
            .map(
              (item) => `
                <tr>
                  <td><strong>${escapeHtml(item.level)}</strong> ${escapeHtml(item.name)}</td>
                  <td><span class="status-badge ${statusClass(item.statusCode)}">${escapeHtml(item.status)}</span></td>
                  <td>${escapeHtml(formatPointValue(item.earnedPoints))} / ${escapeHtml(formatPointValue(item.maxPoints))}</td>
                  <td>${Math.round(item.ratio * 100)}%</td>
                  <td><span class="status-badge ${statusClass(item.confidence.code)}">${escapeHtml(item.confidence.label)}</span></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      <p class="table-note">예상점수는 사전평가 보조값입니다. route, best row, 산업별 예외는 원문 기준으로 최종 확인해야 합니다.</p>
    </div>
  `;
}

function renderConditionRows(item) {
  return `
    <table class="table-like condition-table">
      <thead>
        <tr><th>평가기준 조건</th><th>판정</th><th>응답/증빙 근거 또는 부족 사유</th></tr>
      </thead>
      <tbody>
        ${item.conditionRows
          .map(
            (condition) => `
              <tr>
                <td>
                  <strong>${escapeHtml(condition.label)}</strong>
                  ${condition.route ? `<div class="condition-terms">${escapeHtml(condition.route)}</div>` : ""}
                  <div>${escapeHtml(condition.detail || "")}</div>
                  ${condition.terms?.length ? `<div class="condition-terms">${escapeHtml(condition.terms.slice(0, 6).join(", "))}</div>` : ""}
                </td>
                <td><span class="status-badge ${statusClass(condition.statusCode)}">${escapeHtml(condition.status)}</span></td>
                <td>${escapeHtml(condition.evidence || "근거 없음")}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderFulfillment(row, draft) {
  const evidence = state.evidenceInput || state.evidenceLibrary;
  const record = draftRecord(questionNumber(row));
  const scores = scoreDraft(row, draft, evidence, state.keywords, record?.method || "manual");
  const cards = scores
    .map(
      (item) => `
        <article class="fulfillment-card">
          <div class="section-head">
            <h3>${escapeHtml(item.level)} ${escapeHtml(item.name)} · ${escapeHtml(item.points)}</h3>
            <span class="status-badge ${statusClass(item.statusCode)}">${escapeHtml(item.status)}</span>
          </div>
          <div class="score-line">
            <span>예상점수 <strong>${escapeHtml(formatPointValue(item.earnedPoints))} / ${escapeHtml(formatPointValue(item.maxPoints))}</strong></span>
            <span>충족률 <strong>${Math.round(item.ratio * 100)}%</strong></span>
            <span>평가 신뢰도 <strong>${escapeHtml(item.confidence.label)}</strong></span>
          </div>
          <p><strong>확인된 요소</strong>: ${escapeHtml(item.matched.map((signal) => signal.label).join(", ") || "없음")}</p>
          <p><strong>확인할 요소</strong>: ${escapeHtml(item.signals.map((signal) => signal.label).join(", "))}</p>
          ${renderConditionRows(item)}
          ${item.calculation.notes.length ? `<p class="table-note">공식 점수 계산 참고: ${escapeHtml(item.calculation.notes.join(" · "))}</p>` : ""}
          <p class="table-note">${escapeHtml(item.confidence.note)}</p>
          <div class="criteria-text">${localizedHtml(item.criteria, item.criteria)}</div>
        </article>
      `,
    )
    .join("");
  return `${renderScoreSummary(scores)}${cards}`;
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
  fragment.querySelector("#gptQualityMode").checked = state.gptQualityMode !== false;
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
            <p>${escapeHtml(item.level)} ${escapeHtml(item.name)} 기준: ${escapeHtml(item.status)} · 예상점수 ${escapeHtml(formatPointValue(item.earnedPoints))}/${escapeHtml(formatPointValue(item.maxPoints))} · 신뢰도 ${escapeHtml(item.confidence.label)}</p>
            <p class="table-note">부족 조건: ${escapeHtml(item.conditionRows.filter((condition) => condition.statusCode !== "pass").map((condition) => condition.label).join(", ") || "세부 조건 원문 확인 필요")}</p>
            <div class="improvement-box">${escapeHtml(item.conditionRows.filter((condition) => condition.statusCode !== "pass").map(improvementForCondition).filter(Boolean).slice(0, 3).join("\n") || action)}</div>
          </div>
          <div>
            <span class="status-badge ${statusClass(item.statusCode)}">${escapeHtml(item.status)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderEssentialPanel() {
  const rows = evaluateEssentialCriteria();
  const riskCount = rows.filter((row) => row.statusCode !== "pass").length;
  return `
    <div class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">필수조건</p>
          <h2>A/A- 등급 상한 리스크</h2>
        </div>
        <span class="status-badge ${riskCount ? "status-partial" : "status-pass"}">${riskCount ? `${riskCount}개 검토 필요` : "주요 조건 충족 가능"}</span>
      </div>
      <table class="table-like">
        <thead><tr><th>필수조건</th><th>판정</th><th>근거/보완</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td><strong>${escapeHtml(row.label)}</strong><div class="condition-terms">${escapeHtml(row.levels.join(", "))}</div></td>
                  <td><span class="status-badge ${statusClass(row.statusCode)}">${escapeHtml(row.status)}</span></td>
                  <td>${escapeHtml(row.evidence)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSectorPanel() {
  const rows = sectorApplicabilityRows();
  const applicable = rows.filter((item) => item.applicable);
  return `
    <div class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">산업 특수 문항</p>
          <h2>${escapeHtml(selectedSectorRule().label)} 섹터 적용 점검</h2>
        </div>
        <span class="status-badge status-partial">${applicable.length}개 적용 후보</span>
      </div>
      <table class="table-like">
        <thead><tr><th>문항</th><th>적용</th><th>사유</th></tr></thead>
        <tbody>
          ${(applicable.length ? applicable : rows.slice(0, 12))
            .slice(0, 30)
            .map(
              (item) => `
                <tr>
                  <td><strong>${escapeHtml(item.qn)}</strong><br />${escapeHtml(questionTitle(item.row))}</td>
                  <td><span class="status-badge ${item.applicable ? "status-pass" : "status-fail"}">${item.applicable ? "적용 후보" : "비적용 후보"}</span></td>
                  <td>${escapeHtml(item.reason)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      <p class="table-note">산업 특수성은 sector tag와 문항 원문 키워드 기반의 사전 필터입니다. 최종 적용 여부는 CDP 산업분류 원문과 대조하세요.</p>
    </div>
  `;
}

function renderScoreTotalPanel() {
  const totals = scoreTotals(state.rows.filter((row) => !isSectorSpecificRow(row) || isSelectedSectorRow(row)));
  return `
    <div class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">배점 요약</p>
          <h2>D/A/M/L 예상 numerator / denominator</h2>
        </div>
      </div>
      <table class="table-like compact-table">
        <thead><tr><th>수준</th><th>Numerator</th><th>Denominator</th><th>충족률</th></tr></thead>
        <tbody>
          ${["D", "A", "M", "L"]
            .map((level) => {
              const item = totals[level] || { numerator: 0, denominator: 0 };
              const pct = item.denominator ? Math.round((item.numerator / item.denominator) * 100) : 0;
              return `<tr><td><strong>${level}</strong></td><td>${formatPointValue(item.numerator)}</td><td>${formatPointValue(item.denominator)}</td><td>${pct}%</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderEvaluation() {
  const fragment = cloneTemplate("#evaluationTemplate");
  fragment.querySelectorAll("[data-eval-scope]").forEach((button) => {
    button.classList.toggle("primary-button", button.dataset.evalScope === state.evaluationScope);
    button.classList.toggle("ghost-button", button.dataset.evalScope !== state.evaluationScope);
  });
  fragment.querySelector('[data-field="deductionTable"]').innerHTML = [
    renderQualityGatePanel(),
    renderScoreTotalPanel(),
    renderReviewPriorityPanel(),
    renderEssentialPanel(),
    renderSectorPanel(),
    renderDeductionList(deductionRows()),
  ].join("");
  app.replaceChildren(fragment);
}

function renderProjects() {
  const fragment = cloneTemplate("#projectsTemplate");
  const active = state.projects.find((project) => project.id === state.activeProjectId);
  fragment.querySelector("#projectNameInput").value = active?.name || `${state.company || "기업"} CDP`;
  fragment.querySelector("#projectCompanyInput").value = state.company;
  fragment.querySelector('[data-field="activeProjectBadge"]').textContent = active ? `현재: ${active.name}` : "현재 세션";
  fragment.querySelector('[data-field="projectTable"]').innerHTML = state.projects.length
    ? `
      <table class="table-like compact-table">
        <thead><tr><th>프로젝트</th><th>회사</th><th>섹터</th><th>초안</th><th>저장일</th><th>작업</th></tr></thead>
        <tbody>
          ${state.projects
            .map(
              (project) => `
                <tr>
                  <td><strong>${escapeHtml(project.name)}</strong>${project.id === state.activeProjectId ? `<div class="condition-terms">현재 열림</div>` : ""}</td>
                  <td>${escapeHtml(project.company || "-")}</td>
                  <td>${escapeHtml(sectorDisplayValue(project.sector || "GEN"))}</td>
                  <td>${Object.values(project.drafts || {}).filter((item) => item.draft).length}개</td>
                  <td>${escapeHtml(project.savedAt || "-")}</td>
                  <td>
                    <button type="button" class="ghost-button" data-project-load="${escapeHtml(project.id)}">불러오기</button>
                    <button type="button" class="ghost-button" data-project-delete="${escapeHtml(project.id)}">삭제</button>
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    `
    : `<div class="criteria-text">저장된 기업 프로젝트가 없습니다. 현재 작업을 저장하면 기업별로 초안, 증빙, 리뷰, 벤치마크를 따로 관리할 수 있습니다.</div>`;
  app.replaceChildren(fragment);
}

function renderEssential() {
  const fragment = cloneTemplate("#essentialTemplate");
  const rows = evaluateEssentialCriteria();
  const riskRows = rows.filter((row) => row.statusCode !== "pass");
  fragment.querySelector('[data-field="essentialDetail"]').innerHTML = `
    <div class="metric-grid">
      <div class="metric-card"><span>전체 필수조건</span><strong>${rows.length}</strong></div>
      <div class="metric-card"><span>검토 필요</span><strong>${riskRows.length}</strong></div>
      <div class="metric-card"><span>대상 등급</span><strong>A/A-</strong></div>
    </div>
    <table class="table-like">
      <thead><tr><th>필수조건</th><th>상태</th><th>대상 등급</th><th>매칭 근거</th><th>보완 조치</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td><strong>${escapeHtml(row.label)}</strong></td>
                <td><span class="status-badge ${statusClass(row.statusCode)}">${escapeHtml(row.status)}</span></td>
                <td>${escapeHtml(row.levels.join(", "))}</td>
                <td>${escapeHtml(row.matchedTerms.join(", ") || row.evidence)}</td>
                <td>${escapeHtml(row.statusCode === "pass" ? "현재 증빙으로 충족 가능성이 있습니다." : row.evidence)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
  app.replaceChildren(fragment);
}

function renderBenchmark() {
  const fragment = cloneTemplate("#benchmarkTemplate");
  const rows = compareBenchmarkRows();
  const diffCount = rows.filter((row) => row.result === "차이 검토").length;
  fragment.querySelector('[data-field="benchmarkStatus"]').textContent = state.benchmark.comparedAt ? `${rows.length}개 비교 · ${diffCount}개 차이` : "대기";
  fragment.querySelector('[data-field="benchmarkTable"]').innerHTML = rows.length
    ? `
      <table class="table-like compact-table">
        <thead><tr><th>문항</th><th>결과</th><th>정답지 점수</th><th>자동평가 점수</th><th>정답지 원문</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td><strong>${escapeHtml(row.question)}</strong><br />${escapeHtml(row.title)}</td>
                  <td><span class="status-badge ${row.result === "일치 후보" ? "status-pass" : "status-partial"}">${escapeHtml(row.result)}</span></td>
                  <td>${escapeHtml(row.benchmarkScore || "-")}</td>
                  <td>${escapeHtml(row.autoScore || "-")}</td>
                  <td>${escapeHtml(row.sourceLine)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    `
    : `<div class="criteria-text">아직 비교된 정답지가 없습니다. 기존 사전평가 XLSX/CSV를 업로드해 비교하세요.</div>`;
  app.replaceChildren(fragment);
}

function renderReview() {
  const fragment = cloneTemplate("#reviewTemplate");
  const rows = reviewerRows();
  fragment.querySelector('[data-field="reviewTable"]').innerHTML = rows.length
    ? `
      <table class="table-like compact-table">
        <thead><tr><th>문항</th><th>자동평가</th><th>리뷰 판단</th><th>리뷰 메모</th><th>수정일</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td><strong>${escapeHtml(row.question)}</strong> · ${escapeHtml(row.level)}<br />${escapeHtml(row.title)}</td>
                  <td>${escapeHtml(row.status)}<br />${escapeHtml(row.expectedScore)} · ${escapeHtml(row.confidence)}</td>
                  <td>
                    <select data-review-decision="${escapeHtml(row.key)}">
                      ${[
                        ["pending", "보류"],
                        ["accepted", "인정"],
                        ["revised", "수정 필요"],
                        ["excluded", "제외"],
                      ]
                        .map(([value, label]) => `<option value="${value}" ${row.decision === value ? "selected" : ""}>${label}</option>`)
                        .join("")}
                    </select>
                  </td>
                  <td><textarea rows="2" data-review-note="${escapeHtml(row.key)}">${escapeHtml(row.note)}</textarea></td>
                  <td>${escapeHtml(row.updatedAt || "-")}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    `
    : `<div class="criteria-text">검토할 감점 후보가 없습니다. 평가 화면에서 전체 문항 초안을 생성하거나 실제 응답을 입력하세요.</div>`;
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

function methodologySourceText(files = state.methodologySync.files) {
  return (files || [])
    .filter((file) => file.ok && file.text)
    .map((file) => `[${file.filename}]\n${file.text}`)
    .join("\n\n");
}

function firstTitleWords(row) {
  return [row.title_en || row.title || "", row.title_ko || ""]
    .flatMap((title) => text(title).split(/\s+/).slice(0, 5))
    .filter((word) => word.length >= 3)
    .slice(0, 8);
}

function findMethodologySegment(source, row) {
  const qn = questionNumber(row);
  if (!qn || qn.length < 3) return "";
  const titleWords = firstTitleWords(row).map(escapeRegExp);
  const qnPattern = escapeRegExp(qn);
  const patterns = [
    new RegExp(`(^|[^\\d.])${qnPattern}\\s*[–-]`, "i"),
    new RegExp(`(^|[^\\d.])\\(${qnPattern}\\)`, "i"),
    titleWords.length ? new RegExp(`(^|[^\\d.])${qnPattern}\\s+(?:${titleWords.join("|")})`, "i") : null,
  ].filter(Boolean);
  const matches = patterns
    .map((pattern) => {
      const match = pattern.exec(source);
      return match ? match.index + (match[1] ? match[1].length : 0) : -1;
    })
    .filter((index) => index >= 0);
  if (!matches.length) return "";
  const start = Math.min(...matches);
  const tail = source.slice(start + qn.length + 8);
  const next = tail.search(/\n\s*\d+(?:\.\d+){1,3}[a-z]?\s*[–-]/);
  const end = next >= 0 ? start + qn.length + 8 + next : start + 12000;
  return clampText(source.slice(start, Math.min(end, source.length)), 12000);
}

function methodologySignals(segment) {
  const lower = normalize(segment);
  const signals = [];
  if (/scoring criteria|point allocations|disclosure scoring|awareness scoring|management scoring|leadership scoring/i.test(segment)) signals.push("평가기준");
  if (/requested content|guidance|additional information|change from last year/i.test(segment)) signals.push("작성안내");
  if (/essential criteria|a list|a-|minimum criteria|verification|transition plan/i.test(segment)) signals.push("필수조건");
  if (/sector|financial services|chemicals|metals|mining|coal|plastics|biodiversity|forests|water/i.test(segment)) signals.push("산업/이슈");
  if (lower.includes("route") || lower.includes("best row") || lower.includes("not applicable")) signals.push("채점 경로");
  return signals;
}

function allocationDiff(row, segment) {
  const tables = parseAllocationTables(segment);
  if (!tables.length) return "";
  const values = tables[0].values || {};
  const checks = [
    ["D", values.dDen],
    ["A", values.aDen],
    ["M", values.mDen],
    ["L", values.lDen],
  ];
  const changed = checks
    .filter(([level, den]) => den !== "" && Number(den) !== Number(row.denominators?.[level] || 0))
    .map(([level, den]) => `${level}: 현재 ${formatPointValue(Number(row.denominators?.[level] || 0))} → 포털 ${den}`);
  return changed.join("; ");
}

function methodologyChangeRows(source) {
  const rows = [];
  for (const row of state.rows) {
    const segment = findMethodologySegment(source, row);
    if (segment.length < 160) continue;
    const signals = methodologySignals(segment);
    if (!signals.length) continue;
    const oldText = rowScoringTextEn(row);
    const oldNorm = normalize(oldText);
    const newNorm = normalize(segment);
    const oldAtomCount = atomizeCriteria(oldText).length;
    const newAtomCount = atomizeCriteria(segment).length;
    const allocation = allocationDiff(row, segment);
    const textLikelyChanged = oldNorm && newNorm ? !oldNorm.includes(newNorm.slice(0, 500)) && !newNorm.includes(oldNorm.slice(0, 500)) : true;
    const status = allocation ? "배점 변경 후보" : textLikelyChanged || oldAtomCount !== newAtomCount ? "방법론 변경 후보" : "동일 가능";
    if (status === "동일 가능") continue;
    rows.push({
      id: `${questionNumber(row)}-${rows.length + 1}`,
      module: moduleId(row),
      question: questionNumber(row),
      title: questionTitle(row),
      status,
      confidence: allocation ? "높음" : signals.includes("평가기준") ? "중간" : "낮음",
      signals,
      allocation,
      oldChars: charCount(oldText),
      newChars: charCount(segment),
      oldAtomCount,
      newAtomCount,
      segment,
      decision: "pending",
      applied: false,
    });
  }
  return rows.slice(0, 250);
}

function analyzeMethodologySync(files) {
  const source = methodologySourceText(files);
  const changes = methodologyChangeRows(source);
  state.methodologySync.files = files || [];
  state.methodologySync.changes = changes;
  state.methodologySync.status = changes.length ? `${changes.length}개 변경 후보` : "변경 후보 없음";
  state.methodologySync.appliedAt = "";
  state.methodologySync.appliedCount = 0;
  clearMethodologyOverlay();
  persistWorkspace();
}

function clearMethodologyOverlay() {
  if (!state.rows) return;
  for (const row of state.rows) {
    delete row.syncScoringText;
    delete row.syncSourceUrl;
    delete row.syncAppliedAt;
  }
}

function restoreMethodologyOverlay() {
  const changes = state.methodologySync?.changes || [];
  for (const change of changes.filter((item) => item.applied)) {
    const row = state.rows.find((item) => questionNumber(item) === change.question);
    if (!row) continue;
    row.syncScoringText = change.segment;
    row.syncSourceUrl = state.methodologySync.sourceUrl;
    row.syncAppliedAt = state.methodologySync.appliedAt;
  }
}

function applyMethodologySyncChanges() {
  const changes = (state.methodologySync.changes || []).filter((change) => change.decision === "approved");
  let applied = 0;
  for (const change of changes) {
    const row = state.rows.find((item) => questionNumber(item) === change.question);
    if (!row || !change.segment) continue;
    row.syncScoringText = change.segment;
    row.syncSourceUrl = state.methodologySync.sourceUrl;
    row.syncAppliedAt = new Date().toISOString();
    change.applied = true;
    applied += 1;
  }
  state.methodologySync.appliedAt = new Date().toISOString();
  state.methodologySync.appliedCount = applied;
  state.methodologySync.status = applied ? `${applied}개 승인 적용` : "승인된 변경 후보 없음";
  persistWorkspace();
}

function methodologySyncReport() {
  return {
    exportedAt: new Date().toISOString(),
    sourceUrl: state.methodologySync.sourceUrl,
    status: state.methodologySync.status,
    appliedAt: state.methodologySync.appliedAt,
    appliedCount: state.methodologySync.appliedCount,
    files: (state.methodologySync.files || []).map((file) => ({
      filename: file.filename,
      ok: file.ok,
      characters: file.characters,
      truncated: file.truncated,
      error: file.error || "",
    })),
    changes: (state.methodologySync.changes || []).map((change) => ({
      module: change.module,
      question: change.question,
      title: change.title,
      status: change.status,
      decision: change.decision || "pending",
      confidence: change.confidence,
      signals: change.signals,
      allocation: change.allocation,
      oldChars: change.oldChars,
      newChars: change.newChars,
      oldAtomCount: change.oldAtomCount,
      newAtomCount: change.newAtomCount,
      applied: Boolean(change.applied),
    })),
  };
}

function methodologySyncRows() {
  const changes = state.methodologySync.changes || [];
  return changes.map((change) => [
    change.module,
    change.question,
    change.title,
    change.status,
    change.decision || "pending",
    change.confidence,
    change.signals.join(", "),
    change.allocation,
    change.oldChars,
    change.newChars,
    `${change.oldAtomCount} → ${change.newAtomCount}`,
    change.applied ? "Y" : "N",
  ]);
}

function renderSync() {
  const fragment = cloneTemplate("#syncTemplate");
  const sync = state.methodologySync;
  fragment.querySelector("#syncSourceUrl").value = sync.sourceUrl || "https://myportal.cdp.net/guidance?locale=en";
  fragment.querySelector('[data-field="syncStatus"]').textContent = sync.status || "대기";
  fragment.querySelector('[data-field="syncSummary"]').innerHTML = [
    ["파일", `${(sync.files || []).length}개`],
    ["추출 성공", `${(sync.files || []).filter((file) => file.ok).length}개`],
    ["변경 후보", `${(sync.changes || []).length}개`],
    ["승인 적용", `${sync.appliedCount || 0}개`],
  ]
    .map(([label, value]) => `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
  fragment.querySelector('[data-field="syncFiles"]').innerHTML = (sync.files || [])
    .map(
      (file) => `
        <div class="status-card">
          <strong>${escapeHtml(file.filename)}</strong>
          <p>${file.ok ? `${file.characters}자 추출${file.truncated ? " · 축약됨" : ""}` : escapeHtml(file.error || "추출 실패")}</p>
        </div>
      `,
    )
    .join("");
  const changes = sync.changes || [];
  fragment.querySelector('[data-field="syncChanges"]').innerHTML = changes.length
    ? `
      <table class="table-like compact-table">
        <thead><tr><th>문항</th><th>상태</th><th>결정</th><th>신뢰도</th><th>감지 항목</th><th>배점 차이</th><th>조건 수</th><th>적용</th></tr></thead>
        <tbody>
          ${changes
            .map(
              (change) => `
                <tr>
                  <td><strong>${escapeHtml(change.question)}</strong><br />${escapeHtml(change.module)} · ${escapeHtml(change.title)}</td>
                  <td><span class="status-badge ${change.confidence === "높음" ? "status-pass" : change.confidence === "중간" ? "status-partial" : "status-fail"}">${escapeHtml(change.status)}</span></td>
                  <td>
                    <select data-sync-decision="${escapeHtml(change.id)}">
                      ${[
                        ["pending", "보류"],
                        ["approved", "승인"],
                        ["ignored", "제외"],
                      ]
                        .map(([value, label]) => `<option value="${value}" ${value === (change.decision || "pending") ? "selected" : ""}>${label}</option>`)
                        .join("")}
                    </select>
                  </td>
                  <td>${escapeHtml(change.confidence)}</td>
                  <td>${escapeHtml(change.signals.join(", "))}</td>
                  <td>${escapeHtml(change.allocation || "-")}</td>
                  <td>${escapeHtml(`${change.oldAtomCount} → ${change.newAtomCount}`)}</td>
                  <td>${change.applied ? "Y" : "N"}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      <p class="table-note">승인 적용은 원본 데이터셋을 덮어쓰지 않고, 현재 브라우저 세션에서 평가기준 overlay로 적용합니다. 초기화하면 원본 기준으로 돌아갑니다.</p>
    `
    : `<div class="criteria-text">아직 분석된 변경 후보가 없습니다. CDP Portal에서 export한 파일을 업로드한 뒤 분석하세요.</div>`;
  app.replaceChildren(fragment);
}

function exportRows() {
  return state.rows.map((row) => {
    const qn = questionNumber(row);
    const record = draftRecord(qn);
    const scores = scoreDraft(row, record?.draft || "", record?.evidence || state.evidenceLibrary, record?.keywords || state.keywords, record?.method || "rule");
    return {
      module: moduleId(row),
      question: qn,
      title: questionTitle(row),
      sectorFlag: row.sectorFlag || row.sector_flag || "",
      sectorApplicable: !isSectorSpecificRow(row) || isSelectedSectorRow(row) ? "Y" : "N",
      status: scores.map((item) => `${item.level}:${item.status}`).join("; "),
      expectedScore: scores.map((item) => `${item.level}:${formatPointValue(item.earnedPoints)}/${formatPointValue(item.maxPoints)}`).join("; "),
      confidence: scores.map((item) => `${item.level}:${item.confidence.label}`).join("; "),
      engine: record?.method || "rule",
      scoreNotes: scores.flatMap((item) => item.calculation.notes.map((note) => `${item.level}:${note}`)).join("; "),
      missingConditions: scores
        .flatMap((item) => item.conditionRows.filter((condition) => condition.statusCode !== "pass").map((condition) => `${item.level}-${condition.label}`))
        .join("; "),
      evidenceMapping: scores
        .flatMap((item) => item.conditionRows.filter((condition) => condition.statusCode === "pass").map((condition) => `${item.level}-${condition.label}: ${condition.evidence}`))
        .join(" | "),
      draft: record?.draft || "",
    };
  });
}

function safeSpreadsheetValue(value) {
  const raw = text(value);
  return /^[=+\-@]/.test(raw.trim()) ? `'${raw}` : raw;
}

function safeSpreadsheetRows(rows) {
  return rows.map((row) => row.map(safeSpreadsheetValue));
}

function apiHealthRows() {
  const health = state.apiHealth || {};
  return [
    ["API 서버", state.apiBaseUrl || "동일 출처"],
    ["연결 확인", health.ok ? "성공" : "미확인"],
    ["지원 기능", Array.isArray(health.features) ? health.features.join(", ") : "미확인"],
    ["GPT 설정", health.openaiConfigured ? "OPENAI_API_KEY 설정됨" : "OPENAI_API_KEY 없음"],
    ["토큰 보호", health.tokenRequired ? "사용 중" : "미사용"],
    ["서버 버전", health.version || "-"],
    ["업로드 제한", health.limits?.maxFileMB ? `${health.limits.maxFileMB}MB/file, ${health.limits.maxFiles} files` : "-"],
  ];
}

function workbookPayload() {
  const allRows = exportRows();
  const deductions = deductionRows("all").map(({ row, qn, item }) => [
    moduleId(row),
    qn,
    questionTitle(row),
    item.level,
    item.status,
    `${formatPointValue(item.earnedPoints)}/${formatPointValue(item.maxPoints)}`,
    item.confidence.label,
    item.conditionRows.filter((condition) => condition.statusCode !== "pass").map((condition) => condition.detail || condition.label).join("\n"),
    item.conditionRows.filter((condition) => condition.statusCode !== "pass").map(improvementForCondition).join("\n"),
  ]);
  const essentials = evaluateEssentialCriteria().map((item) => [item.label, item.status, item.levels.join(", "), item.matchedTerms.join(", "), item.evidence]);
  const sectorRows = sectorApplicabilityRows().map((item) => [moduleId(item.row), item.qn, questionTitle(item.row), item.applicable ? "적용 후보" : "비적용 후보", item.reason]);
  const totals = scoreTotals(state.rows.filter((row) => !isSectorSpecificRow(row) || isSelectedSectorRow(row)));
  const reviewRows = reviewPriorityRows(200).map((row) => [row.module, row.question, row.title, row.level, formatPointValue(row.scoreGap), row.confidence, row.missingLabels, row.firstAction]);
  const qualityRows = qualityGateRows();
  const evidenceQualityRows = evidenceQualityChecks().map((item) => [item.item, item.statusCode === "pass" ? "충족" : item.statusCode === "partial" ? "검토 필요" : "부족", item.result, item.action]);
  const evidenceMapping = state.rows.flatMap((row) => {
    const qn = questionNumber(row);
    const record = draftRecord(qn);
    const scores = scoreDraft(row, record?.draft || "", record?.evidence || state.evidenceLibrary, record?.keywords || state.keywords, record?.method || "rule");
    return scores.flatMap((item) =>
      item.conditionRows.map((condition) => [
        moduleId(row),
        qn,
        item.level,
        condition.label,
        condition.detail,
        condition.status,
        condition.evidence,
        record?.method || "rule",
      ]),
    );
  });
  return {
    filename: `cdp-preassessment-${new Date().toISOString().slice(0, 10)}.xlsx`,
    sheets: [
      {
        name: "전체 문항",
        rows: safeSpreadsheetRows([["Module", "Question", "Title", "Sector Flag", "Sector Applicable", "Status", "Expected Score", "Confidence", "Engine", "Score Notes", "Missing Conditions", "Evidence Mapping", "Draft"], ...allRows.map((row) => [row.module, row.question, row.title, row.sectorFlag, row.sectorApplicable, row.status, row.expectedScore, row.confidence, row.engine, row.scoreNotes, row.missingConditions, row.evidenceMapping, row.draft])]),
      },
      { name: "감점 문항", rows: safeSpreadsheetRows([["Module", "Question", "Title", "Level", "Status", "Expected Score", "Confidence", "Missing Conditions", "Improvement"], ...deductions]) },
      { name: "검토우선순위", rows: safeSpreadsheetRows([["Module", "Question", "Title", "Level", "Score Gap", "Confidence", "Missing Conditions", "First Action"], ...reviewRows]) },
      { name: "최대득점경로", rows: safeSpreadsheetRows([["Module", "Question", "Title", "Level", "Max Points", "Atomic Conditions", "Key Terms", "Recommended Answer Pattern"], ...maxScorePathRows()]) },
      { name: "필수조건", rows: safeSpreadsheetRows([["Condition", "Status", "Target Grade", "Matched Terms", "Evidence or Gap"], ...essentials]) },
      { name: "산업특수문항", rows: safeSpreadsheetRows([["Module", "Question", "Title", "Applicability", "Reason"], ...sectorRows]) },
      { name: "품질게이트", rows: safeSpreadsheetRows([["Check", "Status", "Current Value", "Action"], ...qualityRows, [], ["Evidence Check", "Status", "Current Value", "Action"], ...evidenceQualityRows]) },
      { name: "배점요약", rows: safeSpreadsheetRows([["Level", "Numerator", "Denominator", "Fulfillment"], ...["D", "A", "M", "L"].map((level) => {
        const item = totals[level] || { numerator: 0, denominator: 0 };
        return [level, formatPointValue(item.numerator), formatPointValue(item.denominator), item.denominator ? `${Math.round((item.numerator / item.denominator) * 100)}%` : "0%"];
      })]) },
      { name: "증빙매핑", rows: safeSpreadsheetRows([["Module", "Question", "Level", "Condition", "Criteria Detail", "Status", "Evidence or Gap", "Engine"], ...evidenceMapping]) },
      { name: "API상태", rows: safeSpreadsheetRows([["Item", "Value"], ...apiHealthRows()]) },
      { name: "채점규칙DB", rows: safeSpreadsheetRows([["Module", "Question", "Title", "Level", "Max Points", "Has Route", "Best Row", "Row-level", "Partial", "Atomic Condition Count", "Atomic Conditions", "Synced"], ...scoringRuleRows()]) },
      { name: "벤치마크비교", rows: safeSpreadsheetRows([["Question", "Title", "Result", "Benchmark Score", "Auto Score", "Source Line"], ...compareBenchmarkRows().map((row) => [row.question, row.title, row.result, row.benchmarkScore, row.autoScore, row.sourceLine])]) },
      { name: "리뷰의견", rows: safeSpreadsheetRows([["Key", "Module", "Question", "Title", "Level", "Auto Status", "Expected Score", "Confidence", "Reviewer Decision", "Reviewer Note", "Updated At"], ...reviewerRows(500).map((row) => [row.key, row.module, row.question, row.title, row.level, row.status, row.expectedScore, row.confidence, row.decision, row.note, row.updatedAt])]) },
      { name: "방법론동기화", rows: safeSpreadsheetRows([["Module", "Question", "Title", "Status", "Decision", "Confidence", "Detected Signals", "Allocation Diff", "Old chars", "New chars", "Condition Count", "Applied"], ...methodologySyncRows()]) },
    ],
  };
}

function renderExport() {
  const fragment = cloneTemplate("#exportTemplate");
  const rows = exportRows();
  fragment.querySelector('[data-field="exportTable"]').innerHTML = `
    <table class="table-like">
      <thead><tr><th>Module</th><th>Question</th><th>Sector</th><th>Status</th><th>Expected Score</th><th>Confidence</th><th>Engine</th><th>Draft chars</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.module)}</td>
                <td>${escapeHtml(row.question)}</td>
                <td>${escapeHtml(row.sectorApplicable)}</td>
                <td>${escapeHtml(row.status)}</td>
                <td>${escapeHtml(row.expectedScore)}</td>
                <td>${escapeHtml(row.confidence)}</td>
                <td>${escapeHtml(row.engine)}</td>
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
  if (state.activeView === "projects") renderProjects();
  if (state.activeView === "writer") renderWriter();
  if (state.activeView === "evaluation") renderEvaluation();
  if (state.activeView === "essential") renderEssential();
  if (state.activeView === "benchmark") renderBenchmark();
  if (state.activeView === "review") renderReview();
  if (state.activeView === "references") renderReferences();
  if (state.activeView === "sync") renderSync();
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
    evaluationRows: exportRows(),
    scoringRules: scoringRuleRows(),
    benchmark: {
      comparedAt: state.benchmark.comparedAt,
      rows: compareBenchmarkRows(),
    },
    reviewerNotes: state.reviewerNotes,
    projects: state.projects.map((project) => ({ id: project.id, name: project.name, company: project.company, sector: project.sector, savedAt: project.savedAt })),
    workbook: workbookPayload(),
    methodologySync: methodologySyncReport(),
    evidenceCharacters: charCount(state.evidenceLibrary),
  };
  download("cdp-writer-export.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
}

function csvEscape(value) {
  return `"${safeSpreadsheetValue(value).replaceAll('"', '""')}"`;
}

function exportCsv() {
  const header = ["Module", "Question", "Title", "Sector Flag", "Sector Applicable", "Status", "Expected Score", "Confidence", "Engine", "Score Notes", "Missing Conditions", "Evidence Mapping", "Draft"];
  const lines = [header.map(csvEscape).join(",")];
  for (const row of exportRows()) {
    lines.push([row.module, row.question, row.title, row.sectorFlag, row.sectorApplicable, row.status, row.expectedScore, row.confidence, row.engine, row.scoreNotes, row.missingConditions, row.evidenceMapping, row.draft].map(csvEscape).join(","));
  }
  download("cdp-writer-export.csv", `\ufeff${lines.join("\n")}`, "text/csv;charset=utf-8");
}

async function exportXlsx() {
  const payload = workbookPayload();
  const response = await fetch(apiUrl("/api/export-xlsx"), {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = payload.filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function extractFileTexts(files) {
  if (!files.length) return;
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  const response = await fetch(apiUrl("/api/extract"), { method: "POST", headers: apiHeaders(), body: formData });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return payload.files || [];
}

async function extractFiles(files) {
  const results = await extractFileTexts(files);
  state.fileResults = results || [];
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
    saveDraft(questionNumber(row), draft, { method: "rule" });
    renderWriter();
    return;
  }
  if (target.id === "generateGptButton") {
    const row = currentRow();
    target.disabled = true;
    target.textContent = "GPT 생성 중...";
    try {
      const draft = await generateGptDraft(row);
      saveDraft(questionNumber(row), draft, { method: "gpt" });
      renderWriter();
    } catch (error) {
      alert(`GPT 답변 생성에 실패했습니다.\n\n${error.message}\n\n로컬 서버에서 OPENAI_API_KEY를 설정한 뒤 다시 실행하세요.`);
      target.disabled = false;
      target.textContent = "GPT 답변 생성";
    }
    return;
  }
  if (target.id === "saveDraftButton") {
    saveDraft(state.selectedQuestion, currentDraftText(), { method: "manual" });
    renderWriter();
    return;
  }
  if (target.id === "evaluateDraftButton") {
    saveDraft(state.selectedQuestion, currentDraftText(), { method: "manual" });
    renderWriter();
    return;
  }
  if (target.id === "copyDraftButton") {
    await navigator.clipboard?.writeText(currentDraftText());
    return;
  }
  if (target.id === "generateAllButton") {
    for (const row of state.rows) {
      saveDraft(questionNumber(row), composeDraft(row, { evidence: state.evidenceLibrary, keywords: state.keywords }), { method: "rule" });
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
      syncApiInputs();
      render();
    }
    return;
  }
  if (target.id === "saveProjectButton") {
    state.company = document.querySelector("#projectCompanyInput")?.value || state.company;
    saveProject(document.querySelector("#projectNameInput")?.value || `${state.company} CDP`);
    renderProjects();
    return;
  }
  if (target.id === "newProjectButton") {
    if (!confirm("현재 화면을 새 기업 프로젝트로 비울까요? 저장하지 않은 초안은 먼저 프로젝트 저장을 권장합니다.")) return;
    state.activeProjectId = "";
    state.company = document.querySelector("#projectCompanyInput")?.value || "회사명";
    state.keywords = "";
    state.evidenceInput = "";
    state.evidenceLibrary = "";
    state.drafts = {};
    state.fileResults = [];
    state.benchmark = { files: [], rows: [], comparedAt: "" };
    state.reviewerNotes = {};
    persistWorkspace();
    renderProjects();
    return;
  }
  if (target.dataset.projectLoad) {
    loadProject(target.dataset.projectLoad);
    renderProjects();
    return;
  }
  if (target.dataset.projectDelete) {
    if (confirm("선택한 기업 프로젝트 저장본을 삭제할까요? 현재 원본 파일과 내보낸 파일은 삭제되지 않습니다.")) {
      deleteProject(target.dataset.projectDelete);
      renderProjects();
    }
    return;
  }
  if (target.id === "benchmarkExtractButton") {
    const files = [...(document.querySelector("#benchmarkFileInput")?.files || [])];
    if (!files.length) {
      alert("비교할 기존 사전평가 파일을 먼저 선택하세요.");
      return;
    }
    target.disabled = true;
    target.textContent = "비교 중...";
    try {
      const results = await extractFileTexts(files);
      state.benchmark.files = results || [];
      state.benchmark.rows = compareBenchmarkRows();
      state.benchmark.comparedAt = new Date().toISOString();
    } catch (error) {
      state.benchmark.files = [{ filename: "benchmark-upload", ok: false, characters: 0, text: "", error: error.message }];
      state.benchmark.rows = [];
      state.benchmark.comparedAt = new Date().toISOString();
    }
    persistWorkspace();
    renderBenchmark();
    return;
  }
  if (target.id === "benchmarkClearButton") {
    state.benchmark = { files: [], rows: [], comparedAt: "" };
    persistWorkspace();
    renderBenchmark();
    return;
  }
  if (target.id === "apiCheckButton") {
    state.apiBaseUrl = normalizeApiBaseUrl(apiBaseUrlInput?.value || "");
    state.apiToken = text(apiTokenInput?.value || "");
    persistWorkspace();
    try {
      await checkApiConnection();
    } catch {
      // Status is already shown in the header.
    }
    return;
  }
  if (target.id === "syncExtractButton") {
    const files = [...(document.querySelector("#syncFileInput")?.files || [])];
    state.methodologySync.sourceUrl = document.querySelector("#syncSourceUrl")?.value || state.methodologySync.sourceUrl;
    if (!files.length) {
      alert("CDP Portal에서 export한 PDF/XLSX 파일을 먼저 선택하세요.");
      return;
    }
    target.disabled = true;
    target.textContent = "방법론 분석 중...";
    try {
      const results = await extractFileTexts(files);
      analyzeMethodologySync(results || []);
    } catch (error) {
      state.methodologySync.files = [{ filename: "methodology-upload", ok: false, characters: 0, error: error.message }];
      state.methodologySync.changes = [];
      state.methodologySync.status = "분석 실패";
    }
    renderSync();
    return;
  }
  if (target.id === "syncApplyButton") {
    const approvedChanges = (state.methodologySync.changes || []).filter((change) => change.decision === "approved");
    if (!approvedChanges.length) {
      alert("승인된 방법론 변경 후보가 없습니다. 먼저 변경 후보별로 '승인'을 선택하세요.");
      return;
    }
    if (confirm(`${approvedChanges.length}개 승인 후보를 현재 세션의 평가기준 overlay로 적용할까요? 원본 데이터셋 파일은 덮어쓰지 않습니다.`)) {
      applyMethodologySyncChanges();
      renderSync();
    }
    return;
  }
  if (target.id === "syncClearButton") {
    if (confirm("방법론 동기화 결과와 현재 세션 overlay를 초기화할까요?")) {
      clearMethodologyOverlay();
      state.methodologySync = {
        sourceUrl: "https://myportal.cdp.net/guidance?locale=en",
        status: "대기",
        files: [],
        changes: [],
        appliedAt: "",
        appliedCount: 0,
      };
      persistWorkspace();
      renderSync();
    }
    return;
  }
  if (target.id === "syncExportButton") {
    download(`cdp-methodology-sync-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(methodologySyncReport(), null, 2), "application/json;charset=utf-8");
    return;
  }
  if (target.dataset.export === "csv") exportCsv();
  if (target.dataset.export === "json") exportJson();
  if (target.dataset.export === "xlsx") {
    try {
      await exportXlsx();
    } catch (error) {
      alert(`XLSX 내보내기에 실패했습니다.\n\n${error.message}\n\n로컬 서버에서 실행 중인지 확인하세요.`);
    }
  }
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
    saveDraft(state.selectedQuestion, target.value, { method: "manual" });
  }
  if (target.id === "evidenceLibraryText") {
    state.evidenceLibrary = target.value;
    if (!state.evidenceInput) state.evidenceInput = target.value;
  }
  if (target.id === "apiBaseUrl") {
    state.apiBaseUrl = normalizeApiBaseUrl(target.value);
    state.apiHealth = null;
    setApiStatus(state.apiBaseUrl ? "partial" : "partial", state.apiBaseUrl ? "API 설정됨" : "기본 API");
  }
  if (target.id === "apiToken") {
    state.apiToken = target.value;
    state.apiHealth = null;
    setApiStatus("partial", "API 토큰 입력됨");
  }
  if (target.id === "syncSourceUrl") {
    state.methodologySync.sourceUrl = target.value;
  }
  if (target.id === "projectCompanyInput") {
    state.company = target.value;
  }
  if (target.dataset.reviewNote) {
    setReviewerNote(target.dataset.reviewNote, { note: target.value });
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
  if (target.id === "gptQualityMode") {
    state.gptQualityMode = target.checked;
    persistWorkspace();
  }
  if (target.dataset.reviewDecision) {
    setReviewerNote(target.dataset.reviewDecision, { decision: target.value });
  }
  if (target.dataset.syncDecision) {
    const change = (state.methodologySync.changes || []).find((item) => item.id === target.dataset.syncDecision);
    if (change) {
      change.decision = target.value;
      persistWorkspace();
    }
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
  restoreMethodologyOverlay();
  if (!state.rows.some((row) => questionNumber(row) === state.selectedQuestion)) {
    state.selectedQuestion = state.rows[0] ? questionNumber(state.rows[0]) : "";
  }
  if (!["dashboard", "projects", "writer", "evaluation", "essential", "benchmark", "review", "references", "sync", "evidence", "export"].includes(state.activeView)) {
    state.activeView = "dashboard";
  }
  syncApiInputs();
  render();
}

datasetSelect.addEventListener("change", () => loadDataset(datasetSelect.value));

loadDataset(DATASET_URL).catch((error) => {
  app.innerHTML = `<div class="loading-panel">데이터를 불러오지 못했습니다: ${escapeHtml(error.message)}</div>`;
});
