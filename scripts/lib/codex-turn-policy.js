"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { retrievePlannedPacket, verifyApplication } = require("./writing-library-retrieve.js");
const editorial = require("./writing-editorial-review.js");
const { getFanoutDecision, getAgentProfile, MODEL_CAPABILITIES } = require("../codex-agent-policy.js");
const { classifyWritingIntent } = require("./writing-intent.js");
const { sha256 } = require("./writing-library-store.js");

const CACHE = ".session-cache/codex-turns";
const MAX_REPAIRS = 2;
const FALLBACK_CATEGORIES = new Set(["host-unavailable", "unsafe-split", "judgment", "coordination-cost", "external-host"]);
const EXTERNAL_EVIDENCE_LIMIT = 32768;

function localFile(root, file) {
  const base = path.resolve(root);
  const target = path.resolve(base, file);
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error("Evidence path escapes project");
  for (let current = target; current !== path.dirname(base); current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error("Evidence symlink is not allowed");
    if (current === base) break;
  }
  return target;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(temporary, file);
}
function sessionRoot(root, sessionId) {
  if (!sessionId) throw new Error("Native session_id is required");
  return localFile(root, path.join(CACHE, sha256(String(sessionId)).slice(0, 24)));
}
function loadState(root, file) {
  const safe = localFile(root, file);
  const state = readJson(safe);
  if (state.schemaVersion !== 1 || state.root !== fs.realpathSync(root) || !state.requestId || !state.startedAt) throw new Error("Invalid current-request ledger");
  return { state, file: safe, directory: path.dirname(safe) };
}
function findState(root, input) {
  const session = sessionRoot(root, input.session_id);
  const turn = input.turn_id && path.join(session, "turns", sha256(input.turn_id) + ".json");
  const pointer = turn && fs.existsSync(turn) ? readJson(turn) : fs.existsSync(path.join(session, "current.json")) ? readJson(path.join(session, "current.json")) : null;
  if (!pointer) throw new Error("No UserPromptSubmit evidence for this session/turn");
  const record = loadState(root, pointer.file);
  if (record.state.sessionId !== input.session_id) throw new Error("Ledger belongs to another native session");
  return record;
}
function isSmall(task) {
  return /^(?:спасибо|понятно|ок(?:ей)?|хорошо|thanks|ok|done)[.!\s]*$/iu.test(task.trim());
}
function substantive(message) {
  const prose = String(message || "").replace(/<oai-mem-citation>[\s\S]*?<\/oai-mem-citation>/gu, "").replace(/```[\s\S]*?```/gu, "").trim();
  return prose.length >= 120 || prose.split(/\s+/u).length >= 20;
}
function actualNarrative(task, intent) {
  // Separate the requested artifact from its subject. A plan for a novel is
  // nonfiction, while a story about a business plan remains narrative.
  const outputPhrase = task.split(/\b(?:about|where|with)\b|(?:^|\s)(?:о|об|про|где)(?:\s|$)/iu)[0];
  const nonfictionArtifact = /\b(?:plan|analysis|explanation|guide|proposal|pitch|review|report|roadmap)\b|\b(?:план[\p{L}]*|анализ[\p{L}]*|объяснен[\p{L}]*|руководств[\p{L}]*|отч[её]т[\p{L}]*)/iu;
  if (nonfictionArtifact.test(outputPhrase)) return false;
  const explanatoryOutput = /^(?:please\s+|пожалуйста[,\s]+)?(?:explain|compare|describe\s+how|plan|объясн|сравни|спланируй|почему)|(?:write|draft)\s+(?:an?\s+)?(?:explanation|analysis|plan)\b|(?:напиши|составь)\s+(?:объяснен|анализ|план)/iu;
  const narrativeOutput = /(?:write|draft|compose|continue|edit)\s+(?:(?:a|an|the|short|brief|new|fictional)\s+){0,6}(?:scene|poem|novel|story|lore)\b|(?:напиши|сочини|продолжи|отредактируй|перепиши|расскажи)\s+(?:(?:коротк[\p{L}]*|нов[\p{L}]*|небольш[\p{L}]*|художественн[\p{L}]*)\s+){0,6}(?:сцен|стих|роман|рассказ|диалог|сказк|лор)/iu;
  return !explanatoryOutput.test(task) && narrativeOutput.test(task);
}
function startRequest(root, input, route, provenance = null) {
  const session = sessionRoot(root, input.session_id);
  if (!input.turn_id || typeof input.prompt !== "string") throw new Error("Native turn_id/prompt required");
  const pendingFile = path.join(session, "pending.json");
  if (fs.existsSync(pendingFile)) {
    const pending = readJson(pendingFile);
    if (input.prompt === pending.reason && sha256(input.prompt) === pending.reasonSha256) {
      fs.unlinkSync(pendingFile);
      const inherited = loadState(root, pending.file);
      writeJson(path.join(session, "turns", sha256(input.turn_id) + ".json"), { file: inherited.file });
      writeJson(path.join(session, "current.json"), { file: inherited.file });
      return { ...inherited, resumed: true };
    }
    // A genuine new user request never inherits a pending continuation.
    fs.unlinkSync(pendingFile);
  }
  const requestId = crypto.randomUUID();
  const directory = path.join(session, "requests", requestId);
  const file = path.join(directory, "request.json");
  const classificationTask = typeof provenance?.classificationTask === "string" ? provenance.classificationTask : input.prompt;
  const intent = classifyWritingIntent(classificationTask);
  const materialWriting = editorial.editorialPolicy(classificationTask).independentRequired;
  const state = { schemaVersion: 1, root: fs.realpathSync(root), sessionId: input.session_id,
    rootTurnId: input.turn_id, requestId, startedAt: new Date().toISOString(), promptSha256: provenance?.rawPromptSha256 || sha256(input.prompt),
    preferredWorkerProfile: (({ model, effort }) => ({ model, effort }))(getAgentProfile("implementer")),
    task: input.prompt, routeSha256: sha256(JSON.stringify(route)), delegation: route.delegationDecision || { required: false, state: "skip", reason: "no-execution-lane" },
    writingExempt: isSmall(classificationTask) || actualNarrative(classificationTask, intent),
    writingRequested: intent.isWriting || /\bexplain\b|объясн|почему/iu.test(classificationTask),
    editorial: editorial.editorialPolicy(classificationTask, { optOut: getFanoutDecision({ task: classificationTask, candidates: [] }).reason === "explicit-user-opt-out" }),
    direct: route.workflowDepth === "direct" && !materialWriting, repairs: 0 };
  if (route.planContract?.required && route.modes?.some(mode => ["product-goal", "progressive-planning"].includes(mode))) state.waveHandoffContractVersion = 2;
  if (provenance?.rawPromptSha256) state.rawPromptSha256 = provenance.rawPromptSha256;
  if (typeof provenance?.rawPrompt === "string" && provenance.rawPrompt !== input.prompt) state.rawPrompt = provenance.rawPrompt;
  if (provenance?.contextResolution) state.contextResolution = provenance.contextResolution;
  if (provenance?.continuationOf) state.continuationOf = provenance.continuationOf;
  if (provenance?.sourcePromptSha256) state.sourcePromptSha256 = provenance.sourcePromptSha256;
  if (provenance) {
    state.requestOrigin = provenance.requestOrigin;
    state.recoveryEvidence = provenance.recoveryEvidence;
  }
  writeJson(file, state);
  writeJson(path.join(session, "current.json"), { file });
  writeJson(path.join(session, "turns", sha256(input.turn_id) + ".json"), { file });
  return { state, file, directory, resumed: false };
}
function groundRequest(record, options = {}) {
  const { state, directory } = record;
  const packetFile = path.join(directory, "packet.json");
  if (fs.existsSync(packetFile) && !options.refresh) return readJson(packetFile);
  const packet = retrievePlannedPacket(state.task, { requestId: state.requestId, requestStartedAt: state.startedAt, kind: "nonfiction", query: options.query });
  writeJson(packetFile, packet);
  return packet;
}
function editorialAssignment(root, file, artifact) {
  const record = loadState(root, file);
  const packet = groundRequest(record);
  const bytes = fs.readFileSync(localFile(root, artifact));
  const assignment = editorial.buildEditorialAssignment({ task: record.state.task, requestId: record.state.requestId,
    artifactBytes: bytes, packet, readingMap: packet.readerPlan, policyOptions: { explicitIndependent: true } });
  const assignmentFile = path.join(record.directory, `editorial-assignment-${sha256(bytes)}.json`);
  writeJson(assignmentFile, assignment);
  return { state: "editorial-assignment-ready", assignmentFile, artifactSha256: assignment.artifactSha256,
    criteria: assignment.criteria, instruction: "Give this file and relevant project facts/approved samples to a distinct read-only writing_editor (see current agent profile). Read its exact JSON final, fix findings and obtain a new review after changing the artifact. Accept via codex-turn.js review-accept using the observed native child ID." };
}
function reviewEvidence(record, childId, artifactBytes, review) {
  if (!/^[a-f0-9-]{36}$/iu.test(childId || "")) throw new Error("Use the native child UUID from codex-turn status, not its /root/role name");
  const child = readJson(path.join(record.directory, "children", sha256(childId) + ".json"));
  const profile = observeProfile(child, record.state);
  if (!child.completedAt || !child.resultJson || profile.status !== "runtime-correlated") throw new Error("Independent editor completion/result/runtime unavailable");
  const packet = groundRequest(record);
  const assignment = editorial.buildEditorialAssignment({ task: record.state.task, requestId: record.state.requestId,
    artifactBytes, packet, readingMap: packet.readerPlan, policyOptions: { explicitIndependent: true } });
  return { completedDistinctChild: child.id !== record.state.sessionId, runtimeProfileCorrelated: true,
    resultMatchesReview: editorial.stableJson(child.resultJson) === editorial.stableJson(review),
    reviewerId: child.id, reviewerRole: child.type, authorId: record.state.sessionId, model: profile.model, effort: profile.effort,
    requestId: record.state.requestId, artifactSha256: sha256(artifactBytes), readingBindingSha256: assignment.readingBindingSha256,
    reviewSha256: sha256(editorial.stableJson(review)) };
}
function acceptEditorialReview(root, file, artifact, childId) {
  if (!/^[a-f0-9-]{36}$/iu.test(childId || "")) throw new Error("Use the native child UUID from codex-turn status, not its /root/role name");
  const record = loadState(root, file);
  const bytes = fs.readFileSync(localFile(root, artifact));
  const child = readJson(path.join(record.directory, "children", sha256(childId) + ".json"));
  const review = child.resultJson;
  const packet = groundRequest(record);
  const output = path.join(record.directory, `editorial-${sha256(bytes)}.json`);
  const previousReview = fs.existsSync(output) ? readJson(output).review : undefined;
  const result = editorial.verifyEditorialReview(record.state.task, review, { requestId: record.state.requestId,
    artifactBytes: bytes, packet, readingMap: packet.readerPlan, previousReview, reviewerEvidence: reviewEvidence(record, childId, bytes, review) });
  writeJson(output, { childId, review, result });
  return result;
}
function assertCurrentEditorialProfile(evidence) {
  const preferred = getAgentProfile("writing_editor");
  if (evidence.model !== preferred.model || evidence.effort !== preferred.effort) {
    const error = new Error(`Observed editor profile ${evidence.model}/${evidence.effort} differs from current ${preferred.model}/${preferred.effort}; obtain a fresh independent review for these exact bytes`);
    error.code = "EDITORIAL_PROFILE_MISMATCH";
    throw error;
  }
}
function checkEditorial(record, bytes) {
  if (!record.state.editorial?.independentRequired) return null;
  const reviewFile = path.join(record.directory, `editorial-${sha256(bytes)}.json`);
  if (!fs.existsSync(reviewFile)) {
    const error = new Error("No hash-bound independent editorial review is recorded for these exact final bytes");
    error.code = "INDEPENDENT_REVIEW_MISSING";
    throw error;
  }
  const item = readJson(reviewFile);
  const packet = readJson(path.join(record.directory, "packet.json"));
  const evidence = reviewEvidence(record, item.childId, bytes, item.review);
  assertCurrentEditorialProfile(evidence);
  const result = editorial.verifyEditorialReview(record.state.task, item.review, { requestId: record.state.requestId,
    artifactBytes: bytes, packet, readingMap: packet.readerPlan, reviewerEvidence: evidence });
  if (result.state !== "independent-review-passed") throw new Error(`Editor requires correction: ${result.state}`);
  return result;
}
function deliveryAcknowledgement(finalMessage, artifacts, root) {
  if (typeof finalMessage !== "string" || !artifacts.length) return false;
  // Keep this to a completion marker plus one neutral link. Claims in labels,
  // suffixes, or surrounding prose stay on the normal grounded-writing path.
  const text = finalMessage.trimEnd();
  if (/[\r\n]/u.test(text)) return false;
  const match = text.match(/^(?:Готово|Сохранено|Done|Saved)(?::|\.)[ \t]+\[([^\[\]\r\n]+)\]\(/iu);
  if (!match) return false;
  let remainder = text.slice(match[0].length);
  let rawTarget;
  if (remainder.startsWith("<")) {
    const close = remainder.indexOf(">");
    if (close < 0 || remainder.slice(1, close).includes("<") || remainder.slice(close + 1).includes(">") || /[\r\n]/u.test(remainder.slice(1, close))) return false;
    rawTarget = remainder.slice(1, close);
    remainder = remainder.slice(close + 1);
    if (!remainder.startsWith(")")) return false;
    remainder = remainder.slice(1);
  } else {
    let depth = 0;
    let close = -1;
    for (let i = 0; i < remainder.length; i++) {
      const char = remainder[i];
      if (/[<>\[\]\s]/u.test(char)) return false;
      if (char === "(") depth++;
      else if (char === ")") {
        if (depth === 0) { close = i; break; }
        depth--;
      }
    }
    if (close < 1 || depth !== 0) return false;
    rawTarget = remainder.slice(0, close);
    remainder = remainder.slice(close + 1);
  }
  if (!rawTarget) return false;
  if (remainder !== "" && remainder !== "." && remainder !== "!") return false;
  let target;
  try { target = decodeURIComponent(rawTarget).replace(/\\/gu, "/"); } catch { return false; }
  const label = match[1].trim();
  const neutralLabels = new Set(["файл", "документ", "письмо", "отчёт", "отчет", "file", "document", "letter", "report"]);
  return artifacts.some(({ artifact }) => {
    const absolute = path.resolve(artifact).replace(/\\/gu, "/");
    const relative = path.relative(root, artifact).replace(/\\/gu, "/");
    const basename = path.basename(artifact);
    const acceptedTargets = new Set([relative, absolute]);
    if (/^[a-z]:\//iu.test(absolute)) acceptedTargets.add(`/${absolute}`);
    const acceptedLabel = label === basename || neutralLabels.has(label.toLocaleLowerCase("ru-RU"));
    return acceptedLabel && acceptedTargets.has(target);
  });
}
function application(root, file, artifact, notes, target = "final") {
  const record = loadState(root, file);
  const bytes = fs.readFileSync(localFile(root, artifact));
  const packet = groundRequest(record);
  const principles = readJson(localFile(root, notes));
  const value = { requestId: record.state.requestId, packetId: packet.packetId, artifactSha256: sha256(bytes),
    principles: Array.isArray(principles) ? principles : principles.principles };
  verifyApplication(record.state.task, packet, value, bytes, { requestId: record.state.requestId, requestStartedAt: record.state.startedAt, kind: "nonfiction" });
  const item = { ...value, target, artifact: path.relative(root, localFile(root, artifact)), recordedAt: new Date().toISOString() };
  const destination = target === "final" ? "application.json" : `file-${sha256(item.artifact)}.json`;
  writeJson(path.join(record.directory, destination), item);
  return { state: "application-recorded", target, artifactSha256: value.artifactSha256, semanticReview: "required; notes are not proof of comprehension" };
}
function nonempty(value, max = 2000) { return typeof value === "string" && value.trim().length > 0 && value.length <= max; }
function stringList(value, label) {
  if (!Array.isArray(value) || !value.length || value.some(item => !nonempty(item, 500))) throw new Error(`External evidence requires nonempty ${label}`);
  return value.map(item => item.trim());
}
function boundedFile(root, reference, label, limit = 2 * 1024 * 1024) {
  if (!nonempty(reference, 1000)) throw new Error(`External evidence requires ${label} reference`);
  const file = localFile(root, reference);
  const bytes = fs.readFileSync(file);
  if (bytes.length > limit) throw new Error(`External evidence ${label} exceeds ${limit} bytes`);
  return { file, relative: path.relative(root, file), bytes, sha256: sha256(bytes) };
}
function boundedJson(root, reference, label) {
  const item = boundedFile(root, reference, label, EXTERNAL_EVIDENCE_LIMIT);
  const bytes = item.bytes;
  const value = JSON.parse(bytes.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`External evidence ${label} must be a JSON object`);
  return { ...item, value };
}
function validateExternalExecution(record, evidenceReference, snapshot = null) {
  const { state, directory } = record;
  const evidence = boundedJson(state.root, evidenceReference, "envelope");
  const value = evidence.value;
  if (value.schemaVersion !== 1 || value.requestId !== state.requestId) throw new Error("External evidence is not bound to the current request");
  for (const field of ["actualHost", "sessionRef", "fenceRef", "operation", "submissionRef", "completionRef", "outputRef", "parentIntegrationRef"]) {
    if (!nonempty(value[field], 2000)) throw new Error(`External evidence requires ${field}`);
  }
  if (!/^[a-f0-9]{64}$/u.test(value.outputSha256 || "")) throw new Error("External evidence requires a SHA-256 outputSha256");
  const assignment = { scope: stringList(value.assignment?.scope, "assignment.scope"), acceptance: stringList(value.assignment?.acceptance, "assignment.acceptance") };
  const refs = { envelope: evidence };
  for (const field of ["submissionRef", "completionRef", "parentIntegrationRef"]) refs[field] = boundedJson(state.root, value[field], field);
  refs.outputRef = boundedFile(state.root, value.outputRef, "output");
  const submission = refs.submissionRef.value;
  const completion = refs.completionRef.value;
  const integration = refs.parentIntegrationRef.value;
  for (const [label, item] of [["submission", submission], ["completion", completion], ["parent integration", integration]]) {
    if (item.requestId !== state.requestId) throw new Error(`External ${label} is not bound to the current request`);
  }
  const sameList = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const sameAssignment = item => item.assignment && sameList(item.assignment.scope, assignment.scope) && sameList(item.assignment.acceptance, assignment.acceptance);
  if (!sameAssignment(submission) || !sameAssignment(integration)) throw new Error("External submission or integration assignment does not match the recorded scope and acceptance");
  if (sha256(refs.outputRef.bytes) !== value.outputSha256) throw new Error("External output hash does not match outputSha256");
  if (completion.outputSha256 !== value.outputSha256 || integration.outputSha256 !== value.outputSha256) throw new Error("External completion or integration does not bind the exact output hash");
  if (!nonempty(integration.result, 4000)) throw new Error("External parent integration requires a concrete result");
  if (!nonempty(completion.rawHostResponseRef, 1000) || !/^[a-f0-9]{64}$/u.test(completion.rawHostResponseSha256 || "")) {
    throw new Error("External completion wrapper requires a local raw host-response reference and SHA-256");
  }
  refs.rawHostResponse = boundedFile(state.root, completion.rawHostResponseRef, "raw host response");
  if (refs.rawHostResponse.sha256 !== completion.rawHostResponseSha256) throw new Error("Raw host-response hash mismatch");
  if (completion.operation !== undefined && completion.operation !== value.operation) throw new Error("Observed host operation does not match the assigned operation");
  if (completion.fenceRef !== undefined && completion.fenceRef !== value.fenceRef) throw new Error("Observed host fence does not match the recorded fence");
  const status = completion.status;
  if (!["completed", "submitted", "pending"].includes(status)) throw new Error("External completion status must be completed, submitted, or pending");
  const limitations = stringList(value.limitations, "limitations");
  const files = Object.fromEntries(Object.entries(refs).map(([key, item]) => [key, { path: item.relative, sha256: item.sha256 }]));
  if (snapshot && (snapshot.requestId !== state.requestId || snapshot.evidenceSha256 !== evidence.sha256 || JSON.stringify(snapshot.files) !== JSON.stringify(files))) {
    throw new Error("External evidence or a referenced file changed after it was recorded");
  }
  return { requestId: state.requestId, actualHost: value.actualHost.trim(), sessionRef: value.sessionRef.trim(), fenceRef: value.fenceRef.trim(),
    operation: value.operation.trim(), assignment, files, outputSha256: value.outputSha256, completionStatus: status, limitations,
    providerVerification: "parent-inspected-host-response-claims", verifiedLuna: false, effectiveModel: null,
    completedWorkCredit: status === "completed", state: status === "completed" ? "reported-completed-integrated" : status === "pending" ? "unverified" : "submitted" };
}
function inspectExternalExecution(record) {
  const file = path.join(record.directory, "external-execution.json");
  if (!fs.existsSync(file)) return { state: "unverified", requestId: record.state.requestId, completedWorkCredit: false, reason: "external-execution-not-recorded" };
  try {
    const fallbackFile = path.join(record.directory, "fallback.json");
    if (!fs.existsSync(fallbackFile)) throw new Error("external-host fallback binding is missing");
    const fallback = readJson(fallbackFile);
    if (fallback.category !== "external-host" || fallback.requestId !== record.state.requestId) throw new Error("external-host fallback belongs to another category or request");
    const snapshot = readJson(file);
    return validateExternalExecution(record, snapshot.files.envelope.path, snapshot);
  } catch (error) {
    return { state: "unverified", requestId: record.state.requestId, completedWorkCredit: false, verifiedLuna: false,
      providerVerification: "parent-inspected-host-response-claims", reason: error.message };
  }
}
function fallback(root, file, category, reason, evidenceReference) {
  const record = loadState(root, file);
  if (!FALLBACK_CATEGORIES.has(category) || String(reason || "").trim().length < 40) {
    throw new Error("A concrete fallback category and reason (at least 40 characters) are required");
  }
  if (category === "external-host") {
    if (!evidenceReference) throw new Error("external-host fallback requires --evidence with bounded request-bound references");
    const external = validateExternalExecution(record, evidenceReference);
    const evidence = boundedJson(record.state.root, evidenceReference, "envelope");
    writeJson(path.join(record.directory, "external-execution.json"), { ...external, evidenceSha256: evidence.sha256 });
  } else if (evidenceReference) throw new Error("--evidence is only valid for external-host fallback");
  writeJson(path.join(record.directory, "fallback.json"), { category, reason, requestId: record.state.requestId });
  return { state: "delegation-exception", category, reason, verifiedLuna: false,
    ...(category === "external-host" ? { externalExecution: inspectExternalExecution(record) } : {}) };
}
function childEvent(record, input) {
  if (!input.agent_id) throw new Error("Native agent_id required");
  const file = path.join(record.directory, "children", sha256(input.agent_id) + ".json");
  if (input.hook_event_name === "SubagentStop" && !fs.existsSync(file)) throw new Error("Child completion has no start in this logical request");
  const value = fs.existsSync(file) ? readJson(file) : { id: input.agent_id, type: input.agent_type, startedAt: new Date().toISOString() };
  value.lastEvent = input.hook_event_name;
  if (input.hook_event_name === "SubagentStop") {
    value.completedAt = new Date().toISOString(); value.resultSha256 = sha256(String(input.last_assistant_message || ""));
    try { value.resultJson = JSON.parse(input.last_assistant_message); } catch { delete value.resultJson; }
  }
  // Events establish dispatch. Effective model/effort is correlated separately.
  writeJson(file, value);
  // Native child tools carry the parent session ID and their own turn ID.
  // Bind observed child turns to the original request instead of relying on
  // the session's current pointer (which can move after user steering).
  if (input.turn_id) writeJson(path.join(sessionRoot(record.state.root, record.state.sessionId), "turns", sha256(input.turn_id) + ".json"), { file: record.file, childId: input.agent_id });
  return value;
}
function childRecord(root, input) {
  const current = findState(root, input);
  if (input.hook_event_name !== "SubagentStop" || fs.existsSync(path.join(current.directory, "children", sha256(input.agent_id) + ".json"))) return current;
  // Steering can start another request while an earlier worker is still active.
  // Complete its original ledger; never import that worker into the new task.
  const requests = path.join(sessionRoot(root, input.session_id), "requests");
  for (const id of fs.readdirSync(requests)) {
    const file = path.join(requests, id, "request.json");
    if (fs.existsSync(path.join(requests, id, "children", sha256(input.agent_id) + ".json"))) return loadState(root, file);
  }
  throw new Error("Native child completion is not linked to a recorded request start");
}
function observeProfile(child, state) {
  try {
    const { DatabaseSync } = require("node:sqlite");
    const codexHome = process.env.CODEX_HOME || path.join(require("os").homedir(), ".codex");
    const db = new DatabaseSync(path.join(codexHome, "state_5.sqlite"), { readOnly: true });
    let row;
    try { row = db.prepare("select model,reasoning_effort,rollout_path from threads where id=?").get(child.id); } finally { db.close(); }
    if (!row) return { status: "model-unverified" };
    const fd = fs.openSync(row.rollout_path, "r");
    const buffer = Buffer.alloc(131072);
    let size;
    try { size = fs.readSync(fd, buffer, 0, buffer.length, 0); } finally { fs.closeSync(fd); }
    const meta = buffer.subarray(0, size).toString("utf8").split("\n").find(line => line.includes('"session_meta"'));
    const payload = meta && JSON.parse(meta).payload;
    const parent = payload?.source?.subagent?.thread_spawn?.parent_thread_id;
    if (parent !== state.sessionId || payload?.id !== child.id) return { status: "parent-link-unverified" };
    return { status: "runtime-correlated", model: row.model, effort: row.reasoning_effort };
  } catch { return { status: "model-unverified" }; }
}
function checkRequest(record, finalMessage) {
  const { state, directory } = record;
  const issues = [];
  if (typeof finalMessage !== "string") issues.push("final-message-unavailable: native final message bytes are required");
  const children = fs.existsSync(path.join(directory, "children")) ? fs.readdirSync(path.join(directory, "children")).filter(f => f.endsWith(".json")).map(f => readJson(path.join(directory, "children", f))) : [];
  const observed = children.map(child => ({ ...child, profile: observeProfile(child, state), durationMs: child.completedAt ? Date.parse(child.completedAt) - Date.parse(child.startedAt) : null }));
  const candidateException = fs.existsSync(path.join(directory, "fallback.json")) ? readJson(path.join(directory, "fallback.json")) : null;
  const exception = candidateException?.requestId === state.requestId && FALLBACK_CATEGORIES.has(candidateException.category) ? candidateException : null;
  const integrated = child => {
    const file = path.join(directory, `integration-${sha256(child.id)}.json`);
    if (!fs.existsSync(file)) return false;
    const item = readJson(file);
    return item.requestId === state.requestId && item.childId === child.id && item.assignment?.scope?.length && item.assignment?.acceptance?.length && item.result?.length >= 20;
  };
  const snapshot = state.preferredWorkerProfile;
  const validSnapshot = snapshot && typeof snapshot === "object" && MODEL_CAPABILITIES[snapshot.model]?.efforts.includes(snapshot.effort);
  const preferred = validSnapshot ? snapshot : getAgentProfile("implementer");
  const preferredProfileSource = validSnapshot ? "request-snapshot" : "current-policy-fallback-snapshot-unavailable";
  if (state.delegation.required && !exception && !observed.some(child => child.completedAt && child.profile.model === preferred.model && child.profile.effort === preferred.effort && integrated(child))) issues.push(`delegation-missing: complete bounded ${preferred.model} ${preferred.effort} work and record assignment/result integration, or record a concrete fallback (${preferredProfileSource})`);
  const registeredArtifacts = [];
  for (const name of fs.readdirSync(directory).filter(f => /^file-.*\.json$/u.test(f))) {
    try {
      const app = readJson(path.join(directory, name));
      const artifact = localFile(state.root, app.artifact);
      const bytes = fs.readFileSync(artifact);
      verifyApplication(state.task, readJson(path.join(directory, "packet.json")), app, bytes, { requestId: state.requestId, requestStartedAt: state.startedAt, kind: "nonfiction" });
      checkEditorial(record, bytes);
      registeredArtifacts.push({ app, artifact, bytes });
    } catch (error) {
      if (error.code === "EDITORIAL_PROFILE_MISMATCH") issues.push(`editorial-profile-mismatch: ${error.message}`);
      else if (error.code === "INDEPENDENT_REVIEW_MISSING") issues.push(`independent-review-missing: ${error.message}`);
      else issues.push(`changed-file-artifact: ${error.message}`);
    }
  }
  const verifiedDeliveryAcknowledgement = registeredArtifacts.length > 0 &&
    !issues.some(issue => issue.startsWith("changed-file-artifact:")) && deliveryAcknowledgement(finalMessage, registeredArtifacts, state.root);
  if (!state.writingExempt && !verifiedDeliveryAcknowledgement &&
      (substantive(finalMessage) || (state.writingRequested && !state.direct && String(finalMessage || "").replace(/```[\s\S]*?```/gu, "").trim().length > 0))) {
    try {
      if (typeof finalMessage !== "string") throw new Error("final message bytes unavailable");
      const packet = readJson(path.join(directory, "packet.json"));
      if (!packet.readerPlan) throw new Error("Mapped current-task reading is required; refresh the legacy packet");
      const app = readJson(path.join(directory, "application.json"));
      verifyApplication(state.task, packet, app, Buffer.from(finalMessage, "utf8"), { requestId: state.requestId, requestStartedAt: state.startedAt, kind: "nonfiction" });
      try { checkEditorial(record, Buffer.from(finalMessage, "utf8")); }
      catch (error) {
        if (error.code === "EDITORIAL_PROFILE_MISMATCH") issues.push(`editorial-profile-mismatch: ${error.message}`);
        else if (error.code === "INDEPENDENT_REVIEW_MISSING") issues.push(`independent-review-missing: ${error.message}`);
        else issues.push(`independent-review-invalid: ${error.message}`);
      }
    } catch (error) { issues.push(`writing-application-missing: ${error.code === "ENOENT" ? "read current primary packet and record its application to exact final text" : error.message}`); }
  }
  const result = { state: issues.length ? "unresolved" : "passed", requestId: state.requestId, repairCount: state.repairs, issues, children: observed, exception, editorial: state.editorial, preferredProfileSource,
    evidenceLimits: "Native events and correlated profiles establish execution; usefulness and semantic application require review. Durations are observed, not comparative savings." };
  writeJson(path.join(directory, "result.json"), result);
  return result;
}
function continuation(record, issues) {
  const { state, file } = record;
  if (state.repairs >= MAX_REPAIRS) return { continue: false, stopReason: "Template workflow gate unresolved after bounded repair", systemMessage: issues.join("; ") };
  state.repairs += 1;
  writeJson(file, state);
  const reason = `Template workflow repair ${crypto.randomUUID()}: ${issues.join("; ")}. Keep the original task and evidence. Ledger: ${file}. Follow scripts/codex-turn.js help; do not claim completion until the gate passes.`;
  writeJson(path.join(sessionRoot(state.root, state.sessionId), "pending.json"), { file, reason, reasonSha256: sha256(reason) });
  return { decision: "block", reason };
}

module.exports = { localFile, readJson, writeJson, loadState, findState, startRequest, groundRequest, application, fallback, inspectExternalExecution,
  childEvent, childRecord, checkRequest, continuation, substantive, sessionRoot, editorialAssignment, acceptEditorialReview, assertCurrentEditorialProfile,
  deliveryAcknowledgement, observeProfile };
