"use strict";

const path = require("path");
const crypto = require("crypto");
const { defaultCatalog, sha256, libraryStatus, readChecked, splitUnits } = require("./writing-library-store.js");
const { selectLibrarySources } = require("./writing-library-policy.js");
const { classifyWritingIntent } = require("./writing-intent.js");

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
  if (!Number.isInteger(perSource) || perSource < 1 || perSource > 3 || !Number.isInteger(maxCharacters) || maxCharacters < 3500 || maxCharacters > 48000) {
    throw new Error("Packet bounds: per-source 1..3; max-characters 3500..48000");
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
  const packetId = sha256(JSON.stringify({ requestId, taskSha256, catalogSha256: status.catalogSha256, passages }));
  const readAt = new Date().toISOString();
  return { state: "retrieved-not-yet-applied", requestId, packetId, taskSha256, catalogSha256: status.catalogSha256, selection,
    coveredSourceIds: sourceIds, pendingSourceIds: selection.sourceIds.filter((id) => !sourceIds.includes(id)), passages,
    receipts: passages.map(({ sourceId, originalSha256, textSha256, locator, passageSha256, startCharacter, endCharacter }) => ({
      sourceId, originalSha256, textSha256, locator, passageSha256, startCharacter, endCharacter, readAt, evidence: "tool-read-current-primary-text-cache",
    })), application: "agent must read these passages, record task-specific principles and concrete draft/review effects; retrieval alone is not application evidence" };
}

function verifyApplication(task, packet, application, artifactBytes, options = {}) {
  const status = libraryStatus(options);
  if (status.state !== "ready") throw new Error(`source-grounding-blocked: ${status.issues.join("; ")}`);
  if (!options.requestId || packet.requestId !== options.requestId || application.requestId !== options.requestId) throw new Error("Current request-id mismatch; receipts cannot be reused across requests");
  if (packet.taskSha256 !== sha256(task) || packet.catalogSha256 !== status.catalogSha256 || application.packetId !== packet.packetId) throw new Error("Task/catalog/packet binding mismatch");
  const packetId = sha256(JSON.stringify({ requestId: packet.requestId, taskSha256: packet.taskSha256, catalogSha256: packet.catalogSha256, passages: packet.passages }));
  if (packetId !== packet.packetId || !packet.passages?.length) throw new Error("Invalid source packet digest");
  const artifactSha256 = sha256(artifactBytes);
  if (application.artifactSha256 !== artifactSha256) throw new Error("Draft changed or application belongs to another artifact");
  const required = selectLibrarySources(task, options.intent || classifyWritingIntent(task), options.kind || "auto").sourceIds;
  for (const id of required) if (!packet.passages.some(({ sourceId }) => sourceId === id)) throw new Error(`Primary reading missing: ${id}`);
  for (const passage of packet.passages) {
    const source = (options.catalog || defaultCatalog).sources.find(({ id }) => id === passage.sourceId);
    if (!source || passage.originalSha256 !== source.originalSha256 || passage.textSha256 !== source.textSha256) throw new Error("Passage edition mismatch");
    const cache = readChecked(path.join(status.root, "text", `${source.id}.txt`), source.textSha256);
    const unit = splitUnits(cache.toString("utf8"), source.format).find(({ locator }) => locator === passage.locator);
    const actual = unit?.text.slice(passage.startCharacter, passage.endCharacter);
    if (!actual || actual !== passage.text || sha256(actual) !== passage.passageSha256) throw new Error("Passage does not match current primary cache");
    const receipt = packet.receipts?.find((item) => item.passageSha256 === passage.passageSha256 && item.sourceId === passage.sourceId);
    if (!receipt || receipt.locator !== passage.locator || receipt.originalSha256 !== source.originalSha256 || receipt.textSha256 !== source.textSha256 ||
        !Number.isFinite(Date.parse(receipt.readAt)) || Date.parse(receipt.readAt) > Date.now() + 60000) throw new Error("Missing/invalid read receipt");
    const note = application.principles?.find((item) => item.sourceId === passage.sourceId && item.passageSha256 === passage.passageSha256);
    if (!note || !String(note.principle || "").trim() || !String(note.effect || "").trim()) throw new Error(`Missing concrete principle/application: ${passage.sourceId}`);
  }
  return { state: "application-record-verified", requestId: options.requestId, packetId, artifactSha256,
    limit: "verifies current-source/request/draft bindings and complete records; semantic fidelity, agent comprehension and writing quality still require review" };
}

module.exports = { rankPassages, retrievePacket, verifyApplication };
