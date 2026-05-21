const DATASET_URL = "./data/cdp_2026_full_dataset.json";

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
  language: "both",
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

function localizedHtml(en, ko) {
  const english = readableMethodologyText(en);
  const korean = readableMethodologyText(ko || helperKoreanText(en));
  if (state.language === "ko") return `<div class="localized-block ko">${escapeHtml(korean || english)}</div>`;
  if (state.language === "en") return `<div class="localized-block en">${escapeHtml(english || korean)}</div>`;
  return `
    <div class="localized-block ko"><strong>국문</strong><br />${escapeHtml(korean || english)}</div>
    <div class="localized-block en"><strong>English</strong><br />${escapeHtml(english || korean)}</div>
  `;
}

function questionTitle(row) {
  return localizedPair(row.title_en || row.title, row.title_ko);
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
    .replace(/공시numerator/g, "공시 numerator")
    .replace(/공시denominator/g, "공시 denominator")
    .replace(/인식numerator/g, "인식 numerator")
    .replace(/인식denominator/g, "인식 denominator")
    .replace(/관리numerator/g, "관리 numerator")
    .replace(/관리denominator/g, "관리 denominator")
    .replace(/리더십numerator/g, "리더십 numerator")
    .replace(/리더십denominator/g, "리더십 denominator")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function helperKoreanText(value) {
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
  return { code: "Q", ko: label, en: label };
}

function parseScoringBlocks(source) {
  const clean = readableMethodologyText(source).replace(/\n\d+(?:\.\d+)+\s*[–-]\s*.+?point allocations for all sectors[\s\S]*$/i, "");
  const headingRegex = /(?:^|\n)(\d+(?:\.\d+)+)\s*[–-]\s*(.+?)\s+scoring criteria for all sectors\s*/gi;
  const headings = [...clean.matchAll(headingRegex)];
  return headings.map((heading, index) => {
    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : clean.length;
    const body = clean.slice(start, end).trim();
    const sections = [...body.matchAll(/(Disclosure|Awareness|Management|Leadership) scoring criteria\s*([\s\S]*?)(?=\n(?:Disclosure|Awareness|Management|Leadership) scoring criteria|\n\d+(?:\.\d+)+\s*[–-]|\s*$)/gi)].map((match) => {
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
    "Climate Change": "기후변화 / Climate Change",
    Water: "물 / Water",
    Forests: "산림 / Forests",
    Biodiversity: "생물다양성 / Biodiversity",
    Plastics: "플라스틱 / Plastics",
  };
  return labels[issue] || issue;
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
    const preferred = scoringBlocks.find((block) => block.issue.toLowerCase().includes("climate")) || scoringBlocks[0];
    return preferred.sections.map((section) => ({
      level: section.code,
      name: section.en,
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
  return criteriaSections(row.fullScoreChecklist || row.full_score_checklist).map((section) => {
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
    ["Sector", state.dataset?.sector || state.sector],
    ["Generated", state.dataset?.generatedAt || "-"],
    ["Mode", "Answer + QA"],
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
            <span class="tag">${module.count} questions</span>
            <span class="tag">${module.sector} sector</span>
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
            ${text(row.sectorFlag || row.sector_flag).trim() ? '<span class="tag">Industry</span>' : ""}
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
              .map((section) => {
                const koBody = helperKoreanText(section.criteria);
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
      <h3>점수 배분 / Point Allocation</h3>
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
      <p class="table-note">분자는 충족 예상 점수, 분모는 해당 평가수준의 최대 배점을 뜻합니다. D/A/M/L은 Disclosure/Awareness/Management/Leadership입니다.</p>
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
  moduleFilter.innerHTML = `<option value="all">All modules</option>${modules
    .map((module) => `<option value="${escapeHtml(module.id)}">${escapeHtml(module.id)} · ${escapeHtml(moduleTitle(module))}</option>`)
    .join("")}`;
  moduleFilter.value = state.selectedModule;
  issueFilter.innerHTML = `<option value="all">All issues</option>${issueOptions()
    .map((issue) => `<option value="${escapeHtml(issue)}">${escapeHtml(issueFilterLabel(issue))}</option>`)
    .join("")}`;
  issueFilter.value = state.selectedIssue;
  fragment.querySelector("#questionSearch").value = state.search;
  fragment.querySelector('[data-field="questionList"]').innerHTML = renderQuestionList();
  fragment.querySelector('[data-field="questionMeta"]').textContent = `${moduleId(row)} · ${qn} · ${row.category || ""}`;
  fragment.querySelector('[data-field="questionTitle"]').textContent = questionTitle(row);
  const sourcePages = Array.isArray(row.sourcePages) ? row.sourcePages.join(" - ") : "";
  const issueTags = compactTagList(rowIssues(row).map(issueFilterLabel), 4);
  const sectorTags = compactTagList(Array.isArray(row.sectorTags) ? row.sectorTags : [], 4);
  fragment.querySelector('[data-field="questionSource"]').innerHTML = `
    <span>Source: ${escapeHtml(row.sourceFile || "dataset")}${sourcePages ? ` · p.${escapeHtml(sourcePages)}` : ""}</span>
    ${issueTags ? `<span>Issue: ${escapeHtml(issueTags)}</span>` : ""}
    ${sectorTags ? `<span>Sector: ${escapeHtml(sectorTags)}</span>` : ""}
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
    questionnaire_overview: "Questionnaire Overview / 질문지 개요",
    questionnaire_setup: "Questionnaire Setup / 질문지 설정",
    glossary: "Glossary / 용어집",
    scoring_intro: "Scoring Introduction / 평가방법론 소개",
    scoring_changes: "Scoring Changes / 평가 변경사항",
    climate_weightings: "Climate Change Weightings / 기후변화 평가 가중치",
    climate_essential: "Climate Essential Criteria / 기후변화 필수조건",
    water_essential: "Water Essential Criteria / 물 안보 필수조건",
    industry_classification: "Industry Impact Classification / 산업 영향 분류",
  };
  return labels[ref.key] || ref.filename;
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
  const response = await fetch("/api/extract", { method: "POST", body: formData });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  state.fileResults = payload.files || [];
  const extracted = state.fileResults.filter((file) => file.ok && file.text).map((file) => `[${file.filename}]\n${file.text}`);
  if (extracted.length) {
    state.evidenceLibrary = [state.evidenceLibrary, ...extracted].filter(Boolean).join("\n\n");
    if (!state.evidenceInput) state.evidenceInput = state.evidenceLibrary;
  }
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
    return;
  }
  if (target.dataset.guideTab) {
    state.guideTab = target.dataset.guideTab;
    renderWriter();
    return;
  }
  if (target.dataset.referenceKey) {
    state.referenceKey = target.dataset.referenceKey;
    renderReferences();
    return;
  }
  if (target.dataset.moduleOpen) {
    state.selectedModule = target.dataset.moduleOpen;
    state.activeView = "writer";
    state.selectedQuestion = filteredQuestions()[0] ? questionNumber(filteredQuestions()[0]) : state.selectedQuestion;
    render();
    return;
  }
  if (target.dataset.question) {
    state.selectedQuestion = target.dataset.question;
    renderWriter();
    return;
  }
  if (target.id === "generateButton") {
    const row = currentRow();
    const draft = composeDraft(row);
    saveDraft(questionNumber(row), draft);
    renderWriter();
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
  }
  if (target.id === "evidenceLibraryText") {
    state.evidenceLibrary = target.value;
    if (!state.evidenceInput) state.evidenceInput = target.value;
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.id === "moduleFilter") {
    state.selectedModule = target.value;
    const rows = filteredQuestions();
    state.selectedQuestion = rows[0] ? questionNumber(rows[0]) : state.selectedQuestion;
    renderWriter();
  }
  if (target.id === "issueFilter") {
    state.selectedIssue = target.value;
    const rows = filteredQuestions();
    state.selectedQuestion = rows[0] ? questionNumber(rows[0]) : state.selectedQuestion;
    renderWriter();
  }
  if (target.id === "sectorSelect") state.sector = target.value;
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
  if (!["dashboard", "writer", "evaluation", "references", "evidence", "export"].includes(state.activeView)) {
    state.activeView = "dashboard";
  }
  render();
}

datasetSelect.addEventListener("change", () => loadDataset(datasetSelect.value));

loadDataset(DATASET_URL).catch((error) => {
  app.innerHTML = `<div class="loading-panel">데이터를 불러오지 못했습니다: ${escapeHtml(error.message)}</div>`;
});
