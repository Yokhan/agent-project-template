"use strict";

const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");

const MAX_TAIL_BYTES = 2 * 1024 * 1024;
const MAX_FINAL_TAIL_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_CHARS = 64 * 1024;
const MAX_PROMPT_CHARS = 48 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function blocked(reason, sessionId, turnId) {
  return { status: "blocked", reason, sessionId: sessionId || null, turnId: turnId || null };
}

function authoritativeTranscriptPath(sessionId, options) {
  if (options.lookupTranscriptPath) return options.lookupTranscriptPath(sessionId);
  const { DatabaseSync } = require("node:sqlite");
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const stateDb = options.stateDbPath || path.join(codexHome, "state_5.sqlite");
  const db = new DatabaseSync(stateDb, { readOnly: true });
  try {
    const row = db.prepare("SELECT id, rollout_path FROM threads WHERE id = ?").get(sessionId);
    return row && row.id === sessionId ? row.rollout_path : null;
  } finally {
    db.close();
  }
}

function transcriptRealPath(filePath) {
  // SQLite can retain Win32 extended-length paths from older sessions. Node's
  // realpathSync can fail on their drive root; ordinary DOS/UNC aliases name
  // the same file and allow the usual canonical identity check to run.
  let candidate = filePath;
  if (process.platform === "win32" && candidate.startsWith("\\\\?\\")) {
    const ordinary = candidate.slice(4);
    if (/^[a-z]:\\/iu.test(ordinary)) candidate = ordinary;
    else if (ordinary.startsWith("UNC\\")) candidate = "\\\\" + ordinary.slice(4);
  }
  return fs.realpathSync(candidate);
}

function readTail(filePath, maxBytes) {
  const fd = fs.openSync(filePath, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - maxBytes);
    const buffer = Buffer.alloc(size - start);
    if (buffer.length) fs.readSync(fd, buffer, 0, buffer.length, start);
    let text = buffer.toString("utf8");
    if (start > 0) {
      const lineBreak = text.indexOf("\n");
      if (lineBreak < 0) return "";
      text = text.slice(lineBreak + 1);
    }
    return text;
  } finally {
    fs.closeSync(fd);
  }
}

function exactDelegationWrapper(output) {
  if (typeof output !== "string" || output.length > MAX_OUTPUT_CHARS) return null;
  const match = /^\s*<codex_delegation>\s*<source_thread_id>([0-9a-f-]{36})<\/source_thread_id>\s*<input>([\s\S]*?)<\/input>\s*<\/codex_delegation>\s*$/u.exec(output);
  if (!match || !UUID.test(match[1])) return null;
  const prompt = match[2];
  if (!prompt.trim() || prompt.length > MAX_PROMPT_CHARS || /<\/?(?:codex_delegation|source_thread_id|input)>/iu.test(prompt)) return null;
  return { sourceThreadId: match[1], prompt };
}

function userBoundary(event) {
  if (event?.type === "user_message" || event?.type === "user_input") return true;
  if (event?.type !== "response_item") return false;
  const item = event.payload;
  return item?.type === "message" && item.role === "user";
}

function extractCurrentTurn(text, turnId) {
  const lines = text.split(/\r?\n/u).filter(Boolean);
  let contexts = 0;
  let current = false;
  let userInput = false;
  const outputs = [];

  for (const line of lines) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === "turn_context") {
      current = event.payload?.turn_id === turnId;
      if (current) contexts += 1;
      continue;
    }
    if (!current) continue;
    if (userBoundary(event)) userInput = true;
    if (event.type !== "response_item") continue;
    const item = event.payload;
    if (item?.type === "function_call_output" && item.name === "create_thread" && item.namespace === "codex_app") {
      outputs.push(item.output);
    }
  }

  if (contexts !== 1) return { reason: contexts ? "Current turn context is ambiguous" : "Current turn context is absent from bounded transcript tail" };
  if (userInput) return { reason: "Current turn contains a genuine user-input boundary" };
  if (outputs.length !== 1) return { reason: outputs.length ? "Current turn contains multiple native delegation outputs" : "No typed native create_thread output exists in the current turn" };
  const wrapper = exactDelegationWrapper(outputs[0]);
  if (!wrapper) return { reason: "Native create_thread output does not contain one valid anchored delegation wrapper" };
  return wrapper;
}

function recoverNativeDelegation(input, options = {}) {
  const eventName = input?.hook_event_name;
  if (eventName !== "PreToolUse" && eventName !== "Stop") return null;
  const sessionId = input?.session_id;
  const turnId = input?.turn_id;
  if (options.ledgerAbsent !== true) return blocked("Recovery requires explicit evidence that the request ledger is absent", sessionId, turnId);
  if (!UUID.test(String(sessionId || "")) || !UUID.test(String(turnId || ""))) return blocked("Native session_id and turn_id are required", sessionId, turnId);

  try {
    const resolved = authoritativeTranscriptPath(sessionId, options);
    if (typeof resolved !== "string" || !path.isAbsolute(resolved) || !fs.existsSync(resolved)) {
      return blocked("Authoritative state database has no readable transcript for this session", sessionId, turnId);
    }
    const authoritativePath = transcriptRealPath(resolved);
    if (input.transcript_path != null) {
      if (typeof input.transcript_path !== "string" || !path.isAbsolute(input.transcript_path) ||
        transcriptRealPath(input.transcript_path) !== authoritativePath) {
        return blocked("Hook transcript_path does not match the state database transcript", sessionId, turnId);
      }
    }
    const requestedTail = Number.isSafeInteger(options.maxTailBytes) && options.maxTailBytes > 0
      ? options.maxTailBytes
      : MAX_TAIL_BYTES;
    const tail = readTail(authoritativePath, Math.min(requestedTail, MAX_TAIL_BYTES));
    if (!tail) return blocked("Transcript tail is empty or cannot establish a complete current-turn record", sessionId, turnId);
    const result = extractCurrentTurn(tail, turnId);
    if (result.reason) return blocked(result.reason, sessionId, turnId);
    return {
      prompt: result.prompt,
      sourceThreadId: result.sourceThreadId,
      origin: "native-app-create-thread",
      turnId,
      sessionId,
      evidence: {
        kind: "state-db-rollout-current-turn",
        transcriptPath: authoritativePath,
        hookEventName: eventName,
        source: "typed response_item/function_call_output (codex_app.create_thread)",
      },
    };
  } catch (error) {
    return blocked(`Recovery evidence unavailable: ${error.code || error.name || "read-error"}`, sessionId, turnId);
  }
}

function finalAnswerText(event) {
  if (event?.type !== "response_item") return null;
  const item = event.payload;
  if (item?.type !== "message" || item.role !== "assistant" || item.phase !== "final_answer" ||
      !Array.isArray(item.content) || item.content.length !== 1) return null;
  const output = item.content[0];
  return output?.type === "output_text" && typeof output.text === "string" ? output.text : null;
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function inspectCurrentFinal(tail, turnId, artifactText) {
  const lines = tail.split(/\r?\n/u).filter(Boolean);
  let current = false;
  let matchingContexts = 0;
  let ambiguousContext = false;
  let laterTurnContext = false;
  let currentRootTurnId = null;
  let currentRootTurnIdState = "missing";
  let compactionBoundary = null;
  const finalAnswers = [];
  for (const line of lines) {
    let event;
    try { event = JSON.parse(line); } catch {
      if (compactionBoundary) compactionBoundary = null;
      continue;
    }
    if (event?.type === "compacted") {
      const payload = event.payload;
      const attribution = payload?.resume_metadata?.turn_attribution;
      const rootTurnId = attribution?.root_turn_id;
      const compactedTurnId = attribution?.turn_id;
      const lastStartedTurnId = payload?.resume_metadata?.last_started_turn_id;
      const sameCurrentTurn = current && compactedTurnId === turnId &&
        lastStartedTurnId === turnId &&
        UUID.test(String(rootTurnId || "")) && currentRootTurnIdState === "valid" && currentRootTurnId === rootTurnId;
      current = false;
      finalAnswers.length = 0;
      compactionBoundary = sameCurrentTurn ? { rootTurnId, phase: "after-compacted" } : null;
      continue;
    }
    if (event?.type === "world_state") {
      if (compactionBoundary?.phase === "after-compacted") compactionBoundary.phase = "after-world-state";
      else if (compactionBoundary) compactionBoundary = null;
      continue;
    }
    if (event?.type === "turn_context") {
      const payload = event.payload;
      if (payload?.turn_id !== turnId) {
        if (matchingContexts > 0) laterTurnContext = true;
        current = false;
        compactionBoundary = null;
        continue;
      }
      const resumedRootTurnId = payload.root_turn_id;
      if (matchingContexts === 0) {
        matchingContexts = 1;
        current = true;
        currentRootTurnIdState = Object.hasOwn(payload, "root_turn_id")
          ? UUID.test(String(resumedRootTurnId || "")) ? "valid" : "invalid"
          : "missing";
        currentRootTurnId = currentRootTurnIdState === "valid" ? resumedRootTurnId : null;
        compactionBoundary = null;
        continue;
      }
      const recognizedResume = compactionBoundary && UUID.test(String(resumedRootTurnId || "")) &&
        compactionBoundary.rootTurnId === resumedRootTurnId &&
        currentRootTurnIdState === "valid" && currentRootTurnId === resumedRootTurnId;
      if (!recognizedResume) {
        ambiguousContext = true;
        current = true;
        compactionBoundary = null;
        continue;
      }
      // Compaction creates a new context for the same native turn. Discard
      // every pre-compaction final before accepting the resumed context.
      matchingContexts += 1;
      current = true;
      currentRootTurnId = resumedRootTurnId;
      currentRootTurnIdState = "valid";
      finalAnswers.length = 0;
      compactionBoundary = null;
      continue;
    }
    if (compactionBoundary) compactionBoundary = null;
    if (!current) continue;
    const item = event.payload;
    if (event.type === "response_item" && item?.type === "message" && item.role === "assistant" && item.phase === "final_answer") {
      // An unsupported latest final is still a boundary. Never fall back to
      // an earlier matching draft when the actual latest output is unknown.
      finalAnswers.push(finalAnswerText(event));
    }
  }

  if (matchingContexts === 0 || ambiguousContext) return { needsMoreHistory: true };
  if (laterTurnContext) return { matches: false, finalAnswerCount: finalAnswers.length };
  return { matches: finalAnswers.length > 0 && finalAnswers[finalAnswers.length - 1] === artifactText,
    finalAnswerCount: finalAnswers.length };
}

function reconcileNativeFinal(input, artifactText, options = {}) {
  const sessionId = input?.session_id;
  const turnId = input?.turn_id;
  if (input?.hook_event_name !== "Stop" || !UUID.test(String(sessionId || "")) ||
      !UUID.test(String(turnId || "")) || typeof artifactText !== "string" || artifactText.length > MAX_OUTPUT_CHARS ||
      typeof input.last_assistant_message !== "string") return null;

  const opening = "<oai-mem-citation>";
  const closing = "</oai-mem-citation>";
  const markerIndex = artifactText.indexOf(opening);
  if (markerIndex < 0 || markerIndex !== artifactText.lastIndexOf(opening) ||
      artifactText.indexOf(closing, markerIndex) < 0 || artifactText.indexOf(closing, markerIndex) !== artifactText.lastIndexOf(closing)) return null;
  const footerEnd = artifactText.indexOf(closing, markerIndex) + closing.length;
  if (footerEnd !== artifactText.length || input.last_assistant_message !== artifactText.slice(0, markerIndex)) return null;

  try {
    const resolved = authoritativeTranscriptPath(sessionId, options);
    if (typeof resolved !== "string" || !path.isAbsolute(resolved) || !fs.existsSync(resolved)) return null;
    const authoritativePath = transcriptRealPath(resolved);
    if (input.transcript_path != null && (typeof input.transcript_path !== "string" ||
        !path.isAbsolute(input.transcript_path) || transcriptRealPath(input.transcript_path) !== authoritativePath)) return null;

    const requestedTail = Number.isSafeInteger(options.maxTailBytes) && options.maxTailBytes > 0
      ? options.maxTailBytes
      : MAX_TAIL_BYTES;
    const maxTailBytes = Math.min(MAX_FINAL_TAIL_BYTES,
      Number.isSafeInteger(options.maxFinalTailBytes) && options.maxFinalTailBytes > 0
        ? options.maxFinalTailBytes
        : MAX_FINAL_TAIL_BYTES);
    let tailLimit = Math.min(requestedTail, MAX_TAIL_BYTES, maxTailBytes);
    let tail;
    let inspection;
    while (true) {
      tail = readTail(authoritativePath, tailLimit);
      if (!tail) return null;
      inspection = inspectCurrentFinal(tail, turnId, artifactText);
      if (!inspection.needsMoreHistory) break;
      if (tailLimit >= maxTailBytes) return null;
      tailLimit = Math.min(tailLimit * 2, maxTailBytes);
    }
    if (!inspection.matches) return null;

    return {
      message: artifactText,
      evidence: {
        kind: "state-db-rollout-current-turn-final-carrier",
        sessionId,
        turnId,
        transcriptSha256: sha256(tail),
        artifactSha256: sha256(artifactText),
        hookPrefixSha256: sha256(input.last_assistant_message),
        finalAnswerCount: inspection.finalAnswerCount,
        transcriptTailBytes: Buffer.byteLength(tail, "utf8"),
      },
    };
  } catch {
    return null;
  }
}

module.exports = { recoverNativeDelegation, exactDelegationWrapper, reconcileNativeFinal };
