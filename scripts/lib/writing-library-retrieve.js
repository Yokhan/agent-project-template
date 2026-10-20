"use strict";

const path = require("path");
const crypto = require("crypto");
const { defaultCatalog, sha256, libraryStatus, readChecked, splitUnits } = require("./writing-library-store.js");
const { selectLibrarySources } = require("./writing-library-policy.js");
const { classifyWritingIntent } = require("./writing-intent.js");
const { planReading } = require("./writing-reading-plan.js");

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FUTURE_CLOCK_TOLERANCE_MS = 60000;

function timestamp(value, name) {
  const match = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/u);
  if (!match) {
    throw new Error(`Invalid ${name}; expected an ISO 8601 timestamp with timezone`);
  }
  const [, year, month, day, hour, minute, second, zone, offsetHour, offsetMinute] = match;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const daysInMonth = [31, Number(year) % 4 === 0 && (Number(year) % 100 !== 0 || Number(year) % 400 === 0) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31][monthNumber - 1];
  if (!daysInMonth || dayNumber < 1 || dayNumber > daysInMonth || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 ||
      (zone !== "Z" && (Number(offsetHour) > 14 || Number(offsetMinute) > 59 || (Number(offsetHour) === 14 && Number(offsetMinute) !== 0)))) {
    throw new Error(`Invalid ${name}; expected an ISO 8601 timestamp with timezone`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${name}; expected an ISO 8601 timestamp with timezone`);
  return parsed;
}

function maxAge(options) {
  const value = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("max-age-ms must be a positive safe integer");
  return value;
}

function packetDigest(packet) {
  const binding = { requestId: packet.requestId, taskSha256: packet.taskSha256, catalogSha256: packet.catalogSha256,
    retrievedAt: packet.retrievedAt, passages: packet.passages, receipts: packet.receipts };
  if (packet.readerPlan) Object.assign(binding, { readerPlan: packet.readerPlan, plannedCoverage: packet.plannedCoverage, navigation: packet.navigation });
  return sha256(JSON.stringify(binding));
}

function passageChunks(unit, size = 3500) {
  const chunks = [];
  for (let start = 0; start < unit.text.length; start += size) {
    chunks.push({ locator: unit.locator, startCharacter: start, endCharacter: Math.min(start + size, unit.text.length), text: unit.text.slice(start, start + size) });
  }
  return chunks;
}

function rankPassages(units, query) {
  const tokens = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])];
  return units.flatMap((unit) => passageChunks(unit)).map((passage, index) => {
    const text = passage.text.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + Math.min(5, text.split(token).length - 1), 0);
    return { ...passage, score, index };
  }).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score || left.index - right.index);
}

function retrievePacket(task, options = {}) {
  if (!String(task).trim()) throw new Error("A current task is required for task-bound source grounding");
  const catalog = options.catalog || defaultCatalog;
  const selection = selectLibrarySources(task, options.intent || classifyWritingIntent(task), options.kind || "auto");
  if (!selection.required) return { state: "not-required", selection, taskSha256: sha256(task), passages: [], receipts: [] };
  const status = libraryStatus(options);
  if (status.state !== "ready") throw new Error(`source-grounding-blocked: ${status.issues.join("; ")}`);
  const sourceIds = options.sourceIds || selection.sourceIds;
  if (!sourceIds.length || new Set(sourceIds).size !== sourceIds.length) throw new Error("Select nonduplicate relevant sources");
  if (sourceIds.some((id) => !selection.sourceIds.includes(id))) throw new Error("Source selection is irrelevant to this artifact; classify the artifact or revise the current task");
  const perSource = options.perSource ?? 1;
  const maxCharacters = options.maxCharacters ?? 24000;
  if (!Number.isInteger(perSource) || perSource < 1 || perSource > 3 || !Number.isInteger(maxCharacters) || maxCharacters < 3500 || maxCharacters > 96000) {
    throw new Error("Packet bounds: per-source 1..3; max-characters 3500..96000");
  }
  const passages = [];
  let remaining = maxCharacters;
  for (const id of sourceIds) {
    const source = catalog.sources.find((item) => item.id === id);
    if (!source) throw new Error(`Unknown source: ${id}`);
    const bytes = readChecked(path.join(status.root, "text", `${id}.txt`), source.textSha256);
    const locator = options.locators?.[id];
    const units = splitUnits(bytes.toString("utf8"), source.format);
    const targeted = locator ? units.filter((unit) => unit.locator === locator) : units;
    if (!targeted.length) throw new Error(`source-grounding-blocked: unknown primary locator for ${id}`);
    const ranked = locator ? targeted.flatMap((unit) => passageChunks(unit)) : rankPassages(targeted, options.query || task);
    if (!ranked.length) throw new Error(`source-grounding-blocked: no relevant passage match for ${id}; use source-language keywords or inspect the original's contents`);
    for (const match of ranked.slice(0, perSource)) {
      if (match.text.length > remaining) throw new Error("Packet budget cannot cover selected sources; narrow the source packet or increase bounded max-characters");
      remaining -= match.text.length;
      const { score, index, ...passage } = match;
      passages.push({ sourceId: id, title: source.title, originalSha256: source.originalSha256, textSha256: source.textSha256,
        originalPath: path.join(status.root, "originals", source.originalFile), ...passage, passageSha256: sha256(passage.text) });
    }
  }
  const taskSha256 = sha256(task);
  const requestId = options.requestId || crypto.randomUUID();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/u.test(requestId)) throw new Error("Invalid request-id");
  const retrievedAt = new Date().toISOString();
  const retrievedAtMs = timestamp(retrievedAt, "retrieval timestamp");
  const requestStartedAtMs = options.requestStartedAt === undefined ? null : timestamp(options.requestStartedAt, "request-started-at");
  if (requestStartedAtMs !== null && requestStartedAtMs > retrievedAtMs) throw new Error("request-started-at is after retrieval time");
  const receipts = passages.map(({ sourceId, originalSha256, textSha256, locator, passageSha256, startCharacter, endCharacter }) => ({
    sourceId, originalSha256, textSha256, locator, passageSha256, startCharacter, endCharacter, readAt: retrievedAt, evidence: "tool-read-current-primary-text-cache",
  }));
  const packet = { state: "retrieved-not-yet-applied", requestId, retrievedAt, taskSha256, catalogSha256: status.catalogSha256, selection,
    coveredSourceIds: [...new Set(passages.map(({ sourceId }) => sourceId))],
    pendingSourceIds: selection.sourceIds.filter((id) => !passages.some((passage) => passage.sourceId === id)), passages, receipts,
    application: "agent must read these passages, record task-specific principles and concrete draft/review effects; retrieval alone is not application evidence" };
  packet.packetId = packetDigest(packet);
  return packet;
}

function retrievePlannedPacket(task, options = {}) {
  const plan = options.plan || planReading(task, options);
  if (plan.state === "not-required") return { state: "not-required", selection: plan.selection, taskSha256: plan.taskSha256, passages: [], receipts: [] };
  if (plan.state !== "ready" || plan.pendingTopics?.length || plan.issues?.length) {
    const details = [...(plan.issues || []), ...(plan.pendingTopics || []).map(({ topicId, sourceId, locator, reason }) =>
      `${topicId || sourceId}${locator ? `@${locator}` : ""}: ${reason}`)];
    throw new Error(`source-grounding-blocked: planned reading is incomplete: ${details.join("; ")}`);
  }
  const expectedPlan = planReading(task, options);
  if (JSON.stringify(plan) !== JSON.stringify(expectedPlan)) throw new Error("source-grounding-blocked: planned reading target mismatch");
  if (plan.taskSha256 !== sha256(task)) throw new Error("Planned reading task binding mismatch");
  const catalog = options.catalog || defaultCatalog;
  const status = libraryStatus(options);
  if (status.state !== "ready") throw new Error(`source-grounding-blocked: ${status.issues.join("; ")}`);
  const maxCharacters = options.maxCharacters ?? 96000;
  if (!Number.isInteger(maxCharacters) || maxCharacters < 3500 || maxCharacters > 96000) throw new Error("Packet bounds: max-characters 3500..96000");
  const targetsByUnit = new Map();
  for (const target of plan.targets) {
    const key = `${target.sourceId}\0${target.locator}`;
    const topics = targetsByUnit.get(key) || [];
    topics.push(target.topicId);
    targetsByUnit.set(key, topics);
  }
  let remaining = maxCharacters;
  const passages = [];
  const plannedCoverage = [];
  for (const [key, topicIds] of targetsByUnit) {
    const [sourceId, locator] = key.split("\0");
    const source = catalog.sources.find(({ id }) => id === sourceId);
    if (!source || plan.targets.some((target) => target.sourceId === sourceId && target.locator === locator && target.editionTextSha256 !== source.textSha256)) {
      throw new Error(`source-grounding-blocked: planned edition mismatch for ${sourceId}@${locator}`);
    }
    const cache = readChecked(path.join(status.root, "text", `${sourceId}.txt`), source.textSha256);
    const unit = splitUnits(cache.toString("utf8"), source.format).find((item) => item.locator === locator);
    if (!unit?.text) throw new Error(`source-grounding-blocked: planned primary locator is missing: ${sourceId}@${locator}`);
    if (unit.text.length > remaining) throw new Error(`source-grounding-blocked: packet budget cannot include complete planned section ${sourceId}@${locator}`);
    remaining -= unit.text.length;
    const passage = { sourceId, title: source.title, originalSha256: source.originalSha256, textSha256: source.textSha256,
      originalPath: path.join(status.root, "originals", source.originalFile), locator, startCharacter: 0, endCharacter: unit.text.length,
      text: unit.text, passageSha256: sha256(unit.text), topicIds: [...new Set(topicIds)] };
    passages.push(passage);
    for (const topicId of passage.topicIds) plannedCoverage.push({ topicId, sourceId, locator, passageSha256: passage.passageSha256 });
  }
  const query = String(options.query || "").trim();
  const navigation = { query: query || null, state: query ? "searched" : "not-requested", pendingSourceIds: [], passageIds: [] };
  if (query) {
    const navigationSourceIds = options.navigationSourceIds || plan.selection.sourceIds;
    if (!Array.isArray(navigationSourceIds) || navigationSourceIds.some((id) => !plan.selection.sourceIds.includes(id))) {
      throw new Error("Navigation source selection must be relevant to the planned artifact");
    }
    for (const sourceId of navigationSourceIds) {
      const source = catalog.sources.find(({ id }) => id === sourceId);
      const cache = readChecked(path.join(status.root, "text", `${sourceId}.txt`), source.textSha256);
      const units = splitUnits(cache.toString("utf8"), source.format);
      const plannedLocators = new Set(plan.targets.filter((target) => target.sourceId === sourceId).map(({ locator }) => locator));
      const ranked = rankPassages(units.filter((unit) => !plannedLocators.has(unit.locator)), query);
      const match = ranked[0];
      if (!match) {
        navigation.pendingSourceIds.push({ sourceId, reason: "No query match in unplanned sections; the mapped task plan remains complete" });
        continue;
      }
      if (match.text.length > remaining) {
        navigation.pendingSourceIds.push({ sourceId, reason: "Packet budget leaves no room for the optional query passage" });
        continue;
      }
      remaining -= match.text.length;
      const passage = { sourceId, title: source.title, originalSha256: source.originalSha256, textSha256: source.textSha256,
        originalPath: path.join(status.root, "originals", source.originalFile), locator: match.locator,
        startCharacter: match.startCharacter, endCharacter: match.endCharacter, text: match.text, passageSha256: sha256(match.text),
        navigationOnly: true };
      passages.push(passage);
      navigation.passageIds.push(passage.passageSha256);
    }
    if (navigation.pendingSourceIds.length) navigation.state = navigation.passageIds.length ? "partial" : "pending";
  }
  const requestId = options.requestId || crypto.randomUUID();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/u.test(requestId)) throw new Error("Invalid request-id");
  const retrievedAt = new Date().toISOString();
  const retrievedAtMs = timestamp(retrievedAt, "retrieval timestamp");
  const requestStartedAtMs = options.requestStartedAt === undefined ? null : timestamp(options.requestStartedAt, "request-started-at");
  if (requestStartedAtMs !== null && requestStartedAtMs > retrievedAtMs) throw new Error("request-started-at is after retrieval time");
  const receipts = passages.map(({ sourceId, originalSha256, textSha256, locator, passageSha256, startCharacter, endCharacter }) => ({
    sourceId, originalSha256, textSha256, locator, passageSha256, startCharacter, endCharacter,
    readAt: retrievedAt, evidence: "tool-read-current-primary-text-cache",
  }));
  const sourceIds = [...new Set(passages.map(({ sourceId }) => sourceId))];
  const packet = { state: "retrieved-not-yet-applied", requestId, retrievedAt, taskSha256: sha256(task), catalogSha256: status.catalogSha256,
    selection: plan.selection, coveredSourceIds: sourceIds, pendingSourceIds: plan.selection.sourceIds.filter((id) => !sourceIds.includes(id)),
    passages, receipts, readerPlan: plan, plannedCoverage, navigation,
    application: "read the complete mapped sections, then record task-specific principles and concrete draft/review effects; navigation is not comprehension" };
  packet.packetId = packetDigest(packet);
  return packet;
}

function verifyApplication(task, packet, application, artifactBytes, options = {}) {
  const status = libraryStatus(options);
  if (status.state !== "ready") throw new Error(`source-grounding-blocked: ${status.issues.join("; ")}`);
  if (!options.requestId || packet.requestId !== options.requestId || application.requestId !== options.requestId) throw new Error("Current request-id mismatch; receipts cannot be reused across requests");
  if (packet.taskSha256 !== sha256(task) || packet.catalogSha256 !== status.catalogSha256 || application.packetId !== packet.packetId) throw new Error("Task/catalog/packet binding mismatch");
  const packetId = packetDigest(packet);
  if (packetId !== packet.packetId || !packet.passages?.length) throw new Error("Invalid source packet digest");
  if (!Array.isArray(packet.receipts) || packet.receipts.length !== packet.passages.length) throw new Error("Read receipt coverage does not match packet passages");
  const now = Date.now();
  const freshnessMs = maxAge(options);
  const retrievedAtMs = timestamp(packet.retrievedAt, "packet retrieval timestamp");
  const requestStartedAtMs = options.requestStartedAt === undefined ? null : timestamp(options.requestStartedAt, "request-started-at");
  if (retrievedAtMs > now + FUTURE_CLOCK_TOLERANCE_MS || now - retrievedAtMs > freshnessMs) throw new Error("Source packet is stale or has a future retrieval timestamp");
  if (requestStartedAtMs !== null && retrievedAtMs < requestStartedAtMs) throw new Error("Source packet predates the current request");
  const artifactSha256 = sha256(artifactBytes);
  if (application.artifactSha256 !== artifactSha256) throw new Error("Draft changed or application belongs to another artifact");
  const required = selectLibrarySources(task, options.intent || classifyWritingIntent(task), options.kind || "auto").sourceIds;
  const actualCovered = [...new Set(packet.passages.map(({ sourceId }) => sourceId))];
  const expectedCovered = packet.selection?.sourceIds;
  if (!Array.isArray(expectedCovered) || expectedCovered.some((id) => !required.includes(id)) ||
      !Array.isArray(packet.coveredSourceIds) || !Array.isArray(packet.pendingSourceIds) ||
      JSON.stringify([...packet.coveredSourceIds].sort()) !== JSON.stringify([...actualCovered].sort()) ||
      JSON.stringify([...packet.pendingSourceIds].sort()) !== JSON.stringify(required.filter((id) => !actualCovered.includes(id)).sort()) ||
      JSON.stringify([...expectedCovered].sort()) !== JSON.stringify([...actualCovered, ...packet.pendingSourceIds].sort())) {
    throw new Error("Inconsistent covered/pending source coverage");
  }
  for (const id of required) if (!actualCovered.includes(id)) throw new Error(`Primary reading missing: ${id}`);
  if (packet.readerPlan) {
    const expectedPlan = planReading(task, options);
    if (expectedPlan.state !== "ready" || packet.readerPlan.planSha256 !== expectedPlan.planSha256 ||
        JSON.stringify(packet.readerPlan) !== JSON.stringify(expectedPlan)) throw new Error("Planned reading target mismatch");
    const navigationPassages = packet.passages.filter((passage) => passage.navigationOnly).map(({ passageSha256 }) => passageSha256).sort();
    const declaredNavigation = [...(packet.navigation?.passageIds || [])].sort();
    if (!packet.navigation || JSON.stringify(navigationPassages) !== JSON.stringify(declaredNavigation) ||
        !Array.isArray(packet.navigation.pendingSourceIds) || !["not-requested", "searched", "partial", "pending"].includes(packet.navigation.state)) {
      throw new Error("Planned query-navigation coverage mismatch");
    }
    const expectedCoverage = [];
    for (const target of expectedPlan.targets) {
      const matching = packet.passages.filter((passage) => passage.sourceId === target.sourceId && passage.locator === target.locator &&
        passage.topicIds?.includes(target.topicId));
      if (matching.length !== 1) throw new Error(`Planned reading missing: ${target.topicId}@${target.locator}`);
      const [passage] = matching;
      const source = (options.catalog || defaultCatalog).sources.find(({ id }) => id === target.sourceId);
      const cache = readChecked(path.join(status.root, "text", `${target.sourceId}.txt`), source.textSha256);
      const unit = splitUnits(cache.toString("utf8"), source.format).find(({ locator }) => locator === target.locator);
      if (!unit || passage.startCharacter !== 0 || passage.endCharacter !== unit.text.length || passage.text !== unit.text) {
        throw new Error(`Planned context incomplete: ${target.topicId}@${target.locator}`);
      }
      expectedCoverage.push({ topicId: target.topicId, sourceId: target.sourceId, locator: target.locator, passageSha256: passage.passageSha256 });
    }
    if (JSON.stringify(packet.plannedCoverage) !== JSON.stringify(expectedCoverage)) throw new Error("Planned target coverage mismatch");
  }
  for (const passage of packet.passages) {
    const source = (options.catalog || defaultCatalog).sources.find(({ id }) => id === passage.sourceId);
    if (!source || passage.originalSha256 !== source.originalSha256 || passage.textSha256 !== source.textSha256) throw new Error("Passage edition mismatch");
    const cache = readChecked(path.join(status.root, "text", `${source.id}.txt`), source.textSha256);
    const unit = splitUnits(cache.toString("utf8"), source.format).find(({ locator }) => locator === passage.locator);
    const actual = unit?.text.slice(passage.startCharacter, passage.endCharacter);
    if (!actual || actual !== passage.text || sha256(actual) !== passage.passageSha256) throw new Error("Passage does not match current primary cache");
    const matches = packet.receipts?.filter((item) => item.passageSha256 === passage.passageSha256 && item.sourceId === passage.sourceId) || [];
    if (matches.length !== 1) throw new Error("Missing/duplicate read receipt");
    const [receipt] = matches;
    const readAtMs = timestamp(receipt.readAt, "read receipt timestamp");
    if (receipt.locator !== passage.locator || receipt.startCharacter !== passage.startCharacter || receipt.endCharacter !== passage.endCharacter ||
        receipt.originalSha256 !== source.originalSha256 || receipt.textSha256 !== source.textSha256 || readAtMs > now + FUTURE_CLOCK_TOLERANCE_MS ||
        now - readAtMs > freshnessMs || readAtMs < retrievedAtMs ||
        (requestStartedAtMs !== null && readAtMs < requestStartedAtMs)) throw new Error("Missing/invalid/stale read receipt");
    const note = application.principles?.find((item) => item.sourceId === passage.sourceId && item.passageSha256 === passage.passageSha256);
    if (!note || !String(note.principle || "").trim() || !String(note.effect || "").trim()) throw new Error(`Missing concrete principle/application: ${passage.sourceId}`);
  }
  return { state: "application-record-verified", requestId: options.requestId, packetId, artifactSha256,
    limit: "verifies current-source/request/draft bindings and complete records; semantic fidelity, agent comprehension and writing quality still require review" };
}

module.exports = { DEFAULT_MAX_AGE_MS, rankPassages, retrievePacket, retrievePlannedPacket, verifyApplication };
