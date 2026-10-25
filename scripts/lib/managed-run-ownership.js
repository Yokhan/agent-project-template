"use strict";

const fs = require("fs");
const path = require("path");
const policy = require("./codex-turn-policy.js");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SOURCES = new Set(["request-state", "inherited-binding", "host-env"]);
const CONFIDENCES = new Set(["exact", "observed"]);

function validRequestId(value) { return typeof value === "string" && UUID.test(value); }
function validNativeId(value) { return typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/u.test(value); }
function samePath(first, second) { return path.resolve(first) === path.resolve(second); }

function normalizeOwnership(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !validNativeId(value.sessionId) || !SOURCES.has(value.source) || !CONFIDENCES.has(value.confidence)) return null;
  if (value.confidence === "exact" && (!validRequestId(value.requestId) || !validNativeId(value.rootTurnId) || value.source === "host-env")) return null;
  if (value.confidence === "observed" && (value.requestId != null || value.rootTurnId != null)) return null;
  return Object.freeze({
    sessionId: value.sessionId,
    requestId: value.requestId == null ? null : value.requestId.toLowerCase(),
    rootTurnId: value.rootTurnId == null ? null : value.rootTurnId,
    source: value.source,
    confidence: value.confidence,
  });
}

function observedSession(sessionId) {
  if (!validNativeId(sessionId)) return null;
  return normalizeOwnership({ sessionId, requestId: null, rootTurnId: null, source: "host-env", confidence: "observed" });
}

function readRequestState(file, { projectRoot, observedSessionId } = {}) {
  if (typeof file !== "string" || !file) throw new TypeError("request-state path is required");
  if (!validNativeId(observedSessionId)) throw new Error("A valid observed CODEX_SESSION_ID is required for exact request ownership");
  const project = fs.realpathSync.native(projectRoot);
  const loaded = policy.loadState(project, path.resolve(project, file));
  const state = loaded.state;
  if (state.root !== project || !validNativeId(state.sessionId) || !validRequestId(state.requestId) || !validNativeId(state.rootTurnId)) {
    throw new Error("Request-state ledger is missing canonical ownership fields");
  }
  const expected = path.join(policy.sessionRoot(project, state.sessionId), "requests", state.requestId, "request.json");
  if (!samePath(loaded.file, expected)) throw new Error("Request-state path is not the canonical session request ledger");
  if (state.sessionId !== observedSessionId) throw new Error("Request-state ledger belongs to another observed session");
  return normalizeOwnership({ sessionId: state.sessionId, requestId: state.requestId, rootTurnId: state.rootTurnId, source: "request-state", confidence: "exact" });
}

function bindingForRun({ runId, runRoot, projectRoot, projectHash, ownership }) {
  if (!validRequestId(runId) || typeof runRoot !== "string" || typeof projectRoot !== "string" || typeof projectHash !== "string") {
    throw new TypeError("Managed-run binding metadata is invalid");
  }
  const scope = normalizeOwnership(ownership);
  return JSON.stringify({ version: 1, runId, runRoot: path.resolve(runRoot), projectRoot, projectHash, ownership: scope });
}

function readInheritedBinding(serialized, { parentRunRoot, parentOwner, observedSessionId } = {}) {
  if (typeof parentRunRoot !== "string" || !parentOwner || !validRequestId(parentOwner.id)) throw new Error("Inherited managed-run parent is not validated");
  // Older callers may pass only the validated lease path. Keep them explicitly
  // session-observed; only the immutable binding can inherit exact request scope.
  if (serialized == null || serialized === "") return observedSession(observedSessionId);
  if (typeof serialized !== "string" || serialized.length > 8192) throw new Error("Inherited managed-run binding is oversized");
  let binding;
  try { binding = JSON.parse(serialized); } catch { throw new Error("Inherited managed-run binding is invalid JSON"); }
  if (!binding || binding.version !== 1 || !parentOwner || !validRequestId(parentOwner.id) ||
      !samePath(binding.runRoot, parentRunRoot) || !samePath(binding.runRoot, path.resolve(parentRunRoot)) ||
      binding.runId !== parentOwner.id || binding.projectRoot !== parentOwner.root ||
      binding.projectHash !== parentOwner.projectHash) throw new Error("Inherited managed-run binding does not match its validated parent owner");
  const marked = normalizeOwnership(parentOwner.ownership);
  const bound = normalizeOwnership(binding.ownership);
  if (Boolean(marked) !== Boolean(bound) || marked && (marked.sessionId !== bound.sessionId || marked.requestId !== bound.requestId ||
      marked.rootTurnId !== bound.rootTurnId || marked.confidence !== bound.confidence)) {
    throw new Error("Inherited ownership does not match its validated parent owner");
  }
  if (observedSessionId && !validNativeId(observedSessionId)) throw new Error("Observed session ID is invalid");
  if (marked && observedSessionId && marked.sessionId !== observedSessionId) throw new Error("Inherited owner belongs to another observed session");
  if (marked) return normalizeOwnership({ ...marked, source: "inherited-binding" });
  return observedSession(observedSessionId);
}

function classifyOwnership(ownership, { sessionId, requestId, rootTurnId } = {}) {
  const owner = normalizeOwnership(ownership);
  if (!owner || !validNativeId(sessionId)) return "unknown";
  const currentSession = sessionId;
  if (owner.sessionId !== currentSession) return "other";
  if (!validRequestId(requestId) || owner.confidence !== "exact" || !validRequestId(owner.requestId)) return "unknown";
  if (owner.requestId !== requestId.toLowerCase()) return "other";
  if (rootTurnId && validNativeId(rootTurnId) && owner.rootTurnId && owner.rootTurnId !== rootTurnId) return "other";
  return "current";
}

module.exports = { normalizeOwnership, observedSession, readRequestState, bindingForRun, readInheritedBinding, classifyOwnership };
