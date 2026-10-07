"use strict";

const { getIntentMatch, shouldSuppressRoute } = require("./codex-route-intents.js");

const ACTION_PATTERNS = [
  ["review", /\b(?:review|audit|critique|assess|check|score)\b|проверь|проверить|проверяй|проверим|аудитир|разбер|оцени|оценк[ауи]?|отрецензир/i],
  ["edit", /\b(?:rewrite|edit|revise|tighten|polish)\b|перепиш|отредакт|доработ[а-яё]*\s+текст|сделай[а-яё]*\s+понятн/i],
  ["plan", /\b(?:outline|plan|structure)\b|спланир|структур[а-яё]*\s+текст|план[а-яё]*\s+(?:стат|книг|письм|текст)/i],
  ["create", /\b(?:write|draft|compose|document|explain|describe)\b|напиш|объясни|объяснить|(?<![А-Яа-яЁё])опиши|состав[а-яё]*\s+(?:письм|сообщен|текст|стат|объявлен)|создай[а-яё]*\s+(?:текст|стат|сцен|письм)/i],
];

const ARTIFACT_PATTERN =
  /\b(?:copy|text|article|guide|how-to|manual|docs?|documentation|readme|runbook|troubleshooting|release notes?|architecture decision|adr|story|novel|chapter|scene|dialogue|screenplay|poem|email|letter|message|notification|announcement|support reply|incident update|client report|landing page|headline|ad|description|explain|describe|nonfiction book|business book|technical book)\b|текст|стат|гайд|руководств|инструкц|документац|рассказ|роман|глав[а-яё]*\s+(?:книг|роман)|сцен[а-яё]*|диалог|сценари|стих|письм|сообщен|уведомлен|объявлен|ответ[а-яё]*\s+поддерж|клиентск[а-яё]*\s+отч|лендинг|заголов|реклам[а-яё]*\s+объявлен|(?<![А-Яа-яЁё])описан|(?<![А-Яа-яЁё])опиши|объясни|лорн[а-яё]*\s+заметк/i;

const NONFICTION_BOOK_PATTERN = /\b(?:non-?fiction|business book|technical book|(?:book|chapter)\s+(?:about|on)\s+(?:business|game development|programming|software|technology))\b|(?:книг|глав)[а-яё]*[^.!?\n]{0,90}(?:бизнес|геймдев|разработк[а-яё]*\s+игр|программир|технолог|техническ)|(?:техническ|делов|нехудожественн)[а-яё]*\s+книг/iu;
const NONFICTION_PLAN_PATTERN = /\b(?:business plan|production plan|project plan|release plan|plan\s+(?:commercial game|game production|game release|novel publication))\b|бизнес-план|(?:план|спланир)[а-яё]*[^.!?\n]{0,60}(?:коммерческ[а-яё]*\s+игр|производств[а-яё]*\s+игр|релиз[а-яё]*\s+игр|работ[а-яё]*\s+над\s+роман|выпуск[а-яё]*\s+роман)/iu;

const MODE_PATTERNS = {
  marketing:
    /\b(?:marketing|advertising|ad copy|sales copy|landing page|offer|campaign|conversion copy|headline)\b|маркет|реклам|продающ|оффер|лендинг|кампан|конверси|заголов[а-яё]*\s+объявлен/i,
  literary:
    /\b(?:fiction|story|novel|chapter|scene|dialogue|screenplay|narrative|poem|game lore|character description)\b|литератур|художественн|рассказ|роман|повест|сцен[а-яё]*|диалог|стих|игров[а-яё]*\s+лор|лорн[а-яё]*\s+заметк|описан[а-яё]*\s+персонаж|опиши[а-яё]*\s+персонаж|глав[а-яё]*\s+(?:книг|роман)/i,
  informational:
    /\b(?:guide|how-to|manual|tutorial|article|docs?|documentation|readme|runbook|troubleshooting|knowledge base|explanation|report|release notes?|architecture decision|adr)\b|гайд|руководств|инструкц|стат|документац|справк|объяснен|отчет|отчёт|релизн[а-яё]*\s+замет/i,
  communication:
    /\b(?:email|letter|message|notification|announcement|support reply|incident update|pr response|client report)\b|письм|сообщен|уведомлен|объявлен|ответ[а-яё]*\s+поддерж|инцидент|клиентск[а-яё]*\s+отч/i,
};

const OVERLAY_PATTERNS = {
  api: /\b(?:api|endpoint|openapi|schema)\b|(?:^|[^А-Яа-яЁё])апи(?:$|[^А-Яа-яЁё])|эндпоинт|схем[а-яё]*\s+api/i,
};

const SPECIALIZATION_PATTERNS = {
  technical:
    /\b(?:api|sdk|cli|endpoint|openapi|orm|data model|database|schema|developer docs?|technical documentation|how-to|readme|runbook|troubleshooting|deployment guide|configuration guide|integration guide|migration guide|release notes?|architecture decision|adr)\b|техническ[а-яё]*\s+документац|(?:^|[^А-Яа-яЁё])апи(?:$|[^А-Яа-яЁё])|эндпоинт|ранбук|ридми|устранен[а-яё]*\s+неисправност/i,
};

const RUSSIAN_INFRASTRUCTURE_PATTERN =
  /(?:^|[^\p{L}])(?:баз(?:а|у|е|ы|ой|ами|ах)|данн(?:ые|ых|ым|ыми)|сервер(?:а|у|е|ы|ом|ами|ах)?|хранилищ(?:е|а|у|ем|ами|ах)?)(?=$|[^\p{L}])/iu;
const RUSSIAN_OPERATIONAL_PATTERN =
  /(?:^|[^\p{L}])(?:восстанов\p{L}*|резервн\p{L}*\s+коп\p{L}*|авари\p{L}*|сбо\p{L}*|отказ\p{L}*)(?=$|[^\p{L}])/iu;

const VENDOR_PATTERNS = {
  openai: /\b(?:openai|codex|gpt(?:-?\d(?:\.\d)?)?|responses api)\b|опенаи/i,
};

const EXTERNAL_TOOL_PATTERNS = {
  "glavred-api": /\bglavred\b|\bglvrd\b|главред/i,
};

const RUSSIAN_OUTPUT_PATTERN = /\b(?:in russian|russian-language|russian)\b|на\s+русском|по-русски|русскоязычн|русск[а-яё]*\s+(?:текст|документац|руководств|стат)/i;
const ENGLISH_OUTPUT_PATTERN = /\b(?:in english|english-language|english)\b|на\s+английском|по-английски|англоязычн|английск[а-яё]*\s+(?:текст|документац|руководств|стат)/i;
const MIXED_OUTPUT_PATTERN = /\b(?:in russian\s+(?:and|\/)\s+english|russian\s*\/\s*english|russian\s+and\s+english\s+versions?)\b|на\s+русском\s+и\s+английском|по-русски\s+и\s+по-английски|русск(?:ая|ую|ие|их)\s+и\s+английск(?:ая|ую|ие|их)\s+верс(?:ия|ию|ии|ий)/i;
const BILINGUAL_OUTPUT_PATTERN = /\bbilingual\b(?=[^\n]*(?:russian|русск))(?=[^\n]*(?:english|английск))/i;
const OTHER_LANGUAGE_PATTERNS = [
  ["fr", /\b(?:in french|french-language|french documentation)\b|на\s+французском|по-французски|французск/i],
  ["de", /\b(?:in german|german-language|german documentation)\b|на\s+немецком|по-немецки|немецк/i],
  ["es", /\b(?:in spanish|spanish-language|spanish documentation)\b|на\s+испанском|по-испански|испанск/i],
];
const CYRILLIC_PATTERN = /[А-Яа-яЁё]/;

function normalizeTask(task) {
  return String(task || "").replace(/ё/g, "е").trim();
}

function findAction(task) {
  return ACTION_PATTERNS.find(([, pattern]) => pattern.test(task))?.[0] || null;
}

function findPrimaryMode(task, externalTools = []) {
  if (MODE_PATTERNS.marketing.test(task)) return "marketing";
  if (NONFICTION_PLAN_PATTERN.test(task)) return "informational";
  if (NONFICTION_BOOK_PATTERN.test(task)) return "informational";
  if (MODE_PATTERNS.literary.test(task) && (MODE_PATTERNS.informational.test(task) || SPECIALIZATION_PATTERNS.technical.test(task))) return "informational";
  if (MODE_PATTERNS.literary.test(task)) return "literary";
  if (MODE_PATTERNS.communication.test(task)) return "communication";
  if (MODE_PATTERNS.informational.test(task)) return "informational";
  if (SPECIALIZATION_PATTERNS.technical.test(task)) return "informational";
  if (ARTIFACT_PATTERN.test(task)) return "informational";
  if (externalTools.length) return "informational";
  return null;
}

function findOverlays(task) {
  return Object.entries(OVERLAY_PATTERNS)
    .filter(([, pattern]) => pattern.test(task))
    .map(([name]) => name);
}

function findSpecializations(task) {
  const specializations = Object.entries(SPECIALIZATION_PATTERNS)
    .filter(([, pattern]) => pattern.test(task))
    .map(([name]) => name);
  if (!specializations.includes("technical") &&
      RUSSIAN_INFRASTRUCTURE_PATTERN.test(task) &&
      RUSSIAN_OPERATIONAL_PATTERN.test(task)) {
    specializations.push("technical");
  }
  return specializations;
}

function findVendors(task) {
  return Object.entries(VENDOR_PATTERNS)
    .filter(([, pattern]) => pattern.test(task))
    .map(([name]) => name);
}

function findExternalTools(task) {
  return Object.entries(EXTERNAL_TOOL_PATTERNS)
    .filter(([, pattern]) => pattern.test(task))
    .map(([name]) => name);
}

function resolveOutputLanguage(task) {
  if (MIXED_OUTPUT_PATTERN.test(task) || BILINGUAL_OUTPUT_PATTERN.test(task)) {
    return { outputLanguage: "mixed", languageResolution: "explicit" };
  }
  const requestsRussian = RUSSIAN_OUTPUT_PATTERN.test(task);
  const requestsEnglish = ENGLISH_OUTPUT_PATTERN.test(task);
  if (requestsRussian && requestsEnglish) return { outputLanguage: "mixed", languageResolution: "explicit" };
  if (requestsRussian) return { outputLanguage: "ru", languageResolution: "explicit" };
  if (requestsEnglish) return { outputLanguage: "en", languageResolution: "explicit" };
  const other = OTHER_LANGUAGE_PATTERNS.find(([, pattern]) => pattern.test(task));
  if (other) return { outputLanguage: other[0], languageResolution: "explicit" };
  return { outputLanguage: CYRILLIC_PATTERN.test(task) ? "ru" : "en", languageResolution: "inferred" };
}

function classifyWritingIntent(rawTask) {
  const task = normalizeTask(rawTask);
  const detectedAction = findAction(task);
  const externalTools = findExternalTools(task);
  let primaryMode = findPrimaryMode(task, externalTools);
  const hasArtifact = ARTIFACT_PATTERN.test(task) || NONFICTION_PLAN_PATTERN.test(task);
  const action = detectedAction || (hasArtifact ? "create" : null);
  const isProgressiveProductPlan = action === "plan" &&
    getIntentMatch("progressive-planning", task).isMatch &&
    !shouldSuppressRoute("progressive-planning", task) &&
    !/\b(?:write|draft|document|compose|author)\b|напиш|составь|подготовь\s+(?:план|документ)|оформи\s+(?:план|документ)/iu.test(task);
  // A product plan is informational text even when planning owns execution.
  // Do not lose its mandatory primary-source grounding to route precedence.
  if (isProgressiveProductPlan) primaryMode = "informational";
  const isWriting = Boolean(primaryMode && action &&
    (hasArtifact || externalTools.length || action !== "review"));
  const language = isWriting ? resolveOutputLanguage(task) : { outputLanguage: null, languageResolution: null };

  return {
    task,
    isWriting,
    action: isWriting ? action : null,
    primaryMode: isWriting ? primaryMode : null,
    overlays: isWriting ? findOverlays(task) : [],
    specializations: isWriting ? findSpecializations(task) : [],
    domains: isWriting ? findOverlays(task) : [],
    vendors: isWriting ? findVendors(task) : [],
    externalTools: isWriting ? externalTools : [],
    outputLanguage: language.outputLanguage,
    languageResolution: language.languageResolution,
  };
}

function main(argv) {
  const isTsv = argv[0] === "--tsv";
  const task = isTsv ? argv.slice(1).join(" ") : argv.join(" ");
  const result = classifyWritingIntent(task);
  if (isTsv) {
    process.stdout.write([
      result.isWriting ? "1" : "0",
      result.action || "",
      result.primaryMode || "",
      result.overlays.join(","),
      result.specializations.join(","),
      result.domains.join(","),
      result.vendors.join(","),
      result.outputLanguage || "",
      result.languageResolution || "",
      result.externalTools.join(","),
    ].join("\t"));
    return;
  }
  process.stdout.write(JSON.stringify(result));
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { classifyWritingIntent };
