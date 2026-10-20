"use strict";

const fs = require("fs");
const path = require("path");
const { defaultCatalog, catalogHash, sha256, libraryStatus, readChecked, splitUnits } = require("./writing-library-store.js");
const { selectLibrarySources } = require("./writing-library-policy.js");
const { classifyWritingIntent } = require("./writing-intent.js");

const readingMap = require("../../.claude/library/technical/writing-reading-map.json");
const MAP_PATH = path.resolve(__dirname, "../../.claude/library/technical/writing-reading-map.json");

function taskKinds(task, intent) {
  const complaint = /complaint|grievance|support issue|incident|delay|refund|жалоб|претенз|недоволь|ошибк|сбо[йя]|задержк|возврат/iu.test(task);
  const sales = intent.primaryMode === "marketing" || /sales|sell|offer|advert|promotion|маркет|прода|продаж|оффер|реклам|лендинг|описан[а-яё]*\s+услуг/iu.test(task);
  const game = /game|gamedev|игр[а-яё]*|геймдев/iu.test(task);
  const project = /project|roadmap|production|launch|release|architecture|migration|проект|бизнес-план|план[а-яё]*\s+(?:разработ|производств|запуск|релиз)|производств|запуск|релиз|архитектур|миграц/iu.test(task);
  const explanation = !sales && !complaint && !project && (intent.primaryMode === "informational" || /explain|how does|guide|tutorial|troubleshoot|объяс|как работает|поясн|руководств|инструкц/iu.test(task));
  const examples = /\b(?:example|illustration|case study|for instance)\b|(?<![А-Яа-яЁё])пример(?:а|е|ом|ы|ов|у)?(?![А-Яа-яЁё])|проиллюстр|покажи[^.!?\n]{0,50}пример/iu.test(task);
  const counterexamples = /\b(?:counterexample|counter-example|exception|edge case)\b|контрпример|антипример|исключени|пограничн[а-яё]*\s+случай|похож[а-яё]*\s+случай/iu.test(task);
  const preserveValue = /preserv(?:e|ing)[^.!?\n]{0,80}(?:value|benefit|advantage)|(?:value|benefit|advantage)[^.!?\n]{0,80}preserv|preserve product value|retain(?:ing)?[^.!?\n]{0,80}(?:value|benefit|advantage)|сохран(?:и|ить|яя)[^.!?\n]{0,80}(?:ценност|польз|преимуществ|выгод)|(?:ценност|польз|преимуществ|выгод)[^.!?\n]{0,80}сохран/iu.test(task);
  const metrics = /metric|measure|effectiveness|roi|return|conversion|окупаем|эффективност|метрик|конверс/iu.test(task);
  const publisher = /publisher|publish|издател|питч|презентац/iu.test(task);
  const prototype = /prototype|vertical slice|прототип|вертикальн[а-яё]*\s+срез/iu.test(task);
  return { complaint, sales, game, project, explanation, examples, counterexamples, preserveValue, metrics, publisher, prototype };
}

function topicIdsFor(task, intent, sourceId) {
  const kinds = taskKinds(task, intent);
  if (sourceId === "write-short") {
    const ids = ["reader-job", "truth-boundary"];
    ids.push(intent.outputLanguage === "ru" || /[А-Яа-яЁё]/u.test(task) ? "basic-style-rhythm" : "purpose-and-structure");
    if (kinds.explanation && !kinds.examples && !kinds.counterexamples) ids.push("explanation-structure");
    if (kinds.project) ids.push("purpose-and-structure");
    return ids;
  }
  if (sourceId === "business-correspondence") return [kinds.complaint ? "complaint-response" : "recipient-action", "care-and-boundaries"];
  if (sourceId === "clear-understood") {
    if (kinds.complaint) return ["context", "reader-respect"];
    if (kinds.counterexamples) return ["context", "explain-from-both-sides", ...(kinds.examples ? ["examples", "explanation-order"] : [])];
    if (kinds.explanation) return ["context", ...(kinds.examples ? ["examples"] : ["facts-and-measures"]), "explanation-order"];
    if (kinds.sales) return kinds.preserveValue ? ["reader-value"] : ["context"];
    return ["context", ...(kinds.project ? [] : ["facts-and-measures"] )];
  }
  if (sourceId === "social-media") {
    if (kinds.metrics) return ["audience-value", "social-metrics", "content-return"];
    if (kinds.sales && kinds.preserveValue) return ["sales-copy"];
    if (kinds.sales) return /strategy|content plan|контент-план|стратег|контент-календар/iu.test(task) ? ["audience-value"] : ["sales-copy"];
    return ["audience-value", "social-metrics"];
  }
  if (sourceId === "game-as-business") {
    if (kinds.publisher) return ["publisher-materials"];
    if (kinds.prototype) return ["game-direction", "game-vertical-slice"];
    return ["game-direction", "game-production-plan"];
  }
  if (sourceId === "project-resolution") {
    const ids = ["project-purpose", "complete-result"];
    if (/accept|done|ready|приемк|готовност|завершен/iu.test(task)) ids.push("acceptance");
    if (/unknown|uncertain|risk|hypothes|неизвест|неопредел|риск|гипотез/iu.test(task)) ids.push("uncertainty-check");
    return ids;
  }
  return [];
}

function validateReadingMap(options = {}) {
  const catalog = options.catalog || defaultCatalog;
  const status = libraryStatus(options);
  const issues = [];
  const unitsBySource = new Map();
  if (readingMap.schemaVersion !== 1 || readingMap.catalogId !== catalog.catalogId) issues.push("reading map/catalog identity mismatch");
  const ids = new Set();
  for (const source of catalog.sources) {
    if (readingMap.editions?.[source.id] !== source.textSha256) issues.push(`reading map edition mismatch: ${source.id}`);
  }
  for (const topic of readingMap.topics || []) {
    if (!topic.id || ids.has(topic.id)) issues.push(`missing or duplicate reading topic: ${topic.id || "(empty)"}`);
    ids.add(topic.id);
    const source = catalog.sources.find(({ id }) => id === topic.sourceId);
    if (!source) {
      issues.push(`unknown reading map source: ${topic.sourceId}`);
      continue;
    }
    if (!Array.isArray(topic.locators) || !topic.locators.length) {
      issues.push(`topic has no primary locators: ${topic.id}`);
      continue;
    }
    if (status.state !== "ready") continue;
    try {
      if (!unitsBySource.has(source.id)) {
        const cache = readChecked(path.join(status.root, "text", `${source.id}.txt`), source.textSha256);
        unitsBySource.set(source.id, splitUnits(cache.toString("utf8"), source.format));
      }
      const units = unitsBySource.get(source.id);
      for (const locator of topic.locators) {
        if (!units.some((unit) => unit.locator === locator && unit.text.length > 0)) issues.push(`unknown or empty primary locator for ${topic.id}: ${locator}`);
      }
    } catch (error) { issues.push(`${topic.id}: ${error.message}`); }
  }
  if (status.state !== "ready") issues.push(`source-grounding-blocked: ${status.issues.join("; ")}`);
  return { state: issues.length ? "blocked" : "ready", mapSha256: sha256(JSON.stringify(readingMap)), catalogSha256: catalogHash(catalog), issues };
}

function listReadingTopics(options = {}) {
  const topics = readingMap.topics.filter((topic) => !options.sourceId || topic.sourceId === options.sourceId)
    .map(({ id, sourceId, label, question, locators }) => ({ id, sourceId, label, question, locators: [...locators] }));
  return { state: "navigation-only", mapSha256: sha256(JSON.stringify(readingMap)), topics,
    limit: "labels and locators help navigate the pinned local edition; they do not establish comprehension or coverage" };
}

function planReading(task, options = {}) {
  if (!String(task || "").trim()) throw new Error("A current task is required for task-bound source reading");
  const intent = options.intent || classifyWritingIntent(task);
  const selection = selectLibrarySources(task, intent, options.kind || "auto");
  const mapStatus = validateReadingMap(options);
  const plan = { schemaVersion: 1, taskSha256: sha256(task), catalogSha256: mapStatus.catalogSha256, mapSha256: mapStatus.mapSha256,
    selection, topics: [], targets: [], pendingTopics: [], issues: [] };
  if (!selection.required) {
    plan.state = "not-required";
    plan.planSha256 = sha256(JSON.stringify(plan));
    return plan;
  }
  const catalog = options.catalog || defaultCatalog;
  for (const sourceId of selection.sourceIds) {
    const ids = [...new Set(topicIdsFor(task, intent, sourceId))];
    if (!ids.length) plan.pendingTopics.push({ sourceId, reason: "No task-specific reading topics are mapped for this applicable source" });
    for (const id of ids) {
      const topic = readingMap.topics.find((item) => item.id === id && item.sourceId === sourceId);
      if (!topic) {
        plan.pendingTopics.push({ topicId: id, sourceId, reason: "Selected reading topic is missing from the edition map" });
        continue;
      }
      const source = catalog.sources.find((item) => item.id === sourceId);
      const topicEntry = { id: topic.id, sourceId, label: topic.label, question: topic.question, locators: [...topic.locators] };
      plan.topics.push(topicEntry);
      for (const locator of topic.locators) {
        const target = { topicId: topic.id, sourceId, locator, editionTextSha256: source?.textSha256 || null };
        plan.targets.push(target);
        if (!source || mapStatus.state !== "ready") {
          plan.pendingTopics.push({ topicId: topic.id, sourceId, locator, reason: mapStatus.issues[0] || "Source is unavailable" });
        }
      }
    }
  }
  if (mapStatus.state !== "ready") plan.issues.push(...mapStatus.issues);
  plan.state = plan.pendingTopics.length || plan.issues.length ? "blocked" : "ready";
  plan.planSha256 = sha256(JSON.stringify(plan));
  return plan;
}

module.exports = { MAP_PATH, readingMap, validateReadingMap, listReadingTopics, planReading };
