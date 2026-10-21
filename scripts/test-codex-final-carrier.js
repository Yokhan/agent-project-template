#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { reconcileNativeFinal } = require("./lib/codex-request-recovery.js");

const sessionId = "01a15512-9da3-7810-84cb-1603375f8bb1";
const turnId = "01a15512-a2c2-7b43-8bf1-bf59b6eac3b4";
const rootTurnId = "01a1552c-100e-7c10-aa9c-44207b5c9a24";
const prefix = "Verified response.\n\n";
const footer = "<oai-mem-citation>\n<citation_entries>\nMEMORY.md:1-2|note=[test]\n</citation_entries>\n<rollout_ids>\n</rollout_ids>\n</oai-mem-citation>";
const artifactText = prefix + footer;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-final-carrier-"));
const transcriptPath = path.join(tmp, "rollout.jsonl");
const input = {
  hook_event_name: "Stop",
  session_id: sessionId,
  turn_id: turnId,
  last_assistant_message: prefix,
};

function row(type, payload) { return JSON.stringify({ type, payload }); }
function context(turn = turnId, root = null) {
  return row("turn_context", { turn_id: turn, ...(root ? { root_turn_id: root } : {}) });
}
function compacted(root = rootTurnId, turn = turnId) {
  return row("compacted", { message: "<compacted context omitted>", replacement_history: [], retained_context: [], window_number: 1,
    resume_metadata: { last_started_turn_id: turn, turn_attribution: {
      turn_id: turn, root_turn_id: root, turn_trigger: "composer", parent_turn_id: null, initiating_agent_path: null,
    } } });
}
function worldState() { return row("world_state", {}); }
function final(text) {
  return row("response_item", {
    type: "message",
    role: "assistant",
    phase: "final_answer",
    content: [{ type: "output_text", text }],
  });
}
function eventTraffic(bytes) {
  const payloadBytes = 8 * 1024;
  const item = row("response_item", { type: "function_call_output", name: "exec_command", output: "x".repeat(payloadBytes) });
  const events = [];
  let total = 0;
  while (total < bytes) {
    events.push(item);
    total += Buffer.byteLength(item, "utf8") + 1;
  }
  return events;
}
function fixture(lines) {
  fs.writeFileSync(transcriptPath, lines.join("\n") + "\n", "utf8");
  return { lookupTranscriptPath: id => id === sessionId ? transcriptPath : null };
}
function reconcile(lines, hook = input, options = {}) {
  return reconcileNativeFinal(hook, artifactText, { ...fixture(lines), ...options });
}

try {
  const exact = reconcile([context(), final(artifactText)]);
  assert.deepEqual(exact && exact.message, artifactText, "literal artifact and exact hook prefix reconcile");
  assert.equal(exact.evidence.kind, "state-db-rollout-current-turn-final-carrier");
  assert.equal(exact.evidence.finalAnswerCount, 1);
  if (process.platform === "win32") {
    const namespaced = path.toNamespacedPath(transcriptPath);
    assert.equal(reconcile([context(), final(artifactText)], { ...input, transcript_path: transcriptPath },
      { lookupTranscriptPath: () => namespaced }).message, artifactText,
      "a native namespaced SQLite path canonicalizes to the same ordinary Windows transcript");
    assert.equal(reconcile([context(), final(artifactText)], { ...input, transcript_path: namespaced }).message, artifactText,
      "the native hook's namespaced path also canonicalizes before identity comparison");
  }
  assert.equal(JSON.stringify(exact.evidence).includes(artifactText), false, "evidence contains no raw response text");
  assert.equal(JSON.stringify(exact.evidence).includes(footer), false, "evidence contains no citation text");

  assert.equal(reconcile([context(), final(artifactText)], { ...input, last_assistant_message: prefix.slice(0, -1) }), null,
    "a changed separator newline in the hook prefix is rejected");
  const changedArtifact = prefix.replace("\n\n", "\n") + footer;
  assert.equal(reconcileNativeFinal(input, changedArtifact, fixture([context(), final(artifactText)])), null,
    "a changed separator newline in the artifact is rejected");
  const alteredFooter = prefix + footer.replace("MEMORY.md:1-2", "MEMORY.md:1-3");
  assert.equal(reconcileNativeFinal(input, alteredFooter, fixture([context(), final(artifactText)])), null,
    "an altered raw citation footer is rejected");
  assert.equal(reconcile([context(), final(artifactText)], { ...input, hook_event_name: "PreToolUse" }), null,
    "only Stop is eligible");
  assert.equal(reconcile([context(), final(artifactText)], { ...input, turn_id: "not-a-native-uuid" }), null,
    "non-native turn identifiers are rejected");
  assert.equal(reconcile([context(turnId + "-stale"), final(artifactText)]), null,
    "a stale turn context cannot establish the current turn");
  assert.equal(reconcile([context(), final(artifactText), context(sessionId)]), null,
    "a matching artifact cannot be carried after a newer turn context appears");
  assert.equal(reconcile([context(), final(artifactText)], { ...input, transcript_path: path.join(tmp, "wrong.jsonl") }), null,
    "hook transcript path must match the authoritative lookup");
  assert.equal(reconcile([context(), final(artifactText)], input, { lookupTranscriptPath: () => null }), null,
    "missing authoritative transcript evidence fails closed");
  assert.equal(reconcile([context(), row("document", { body: artifactText })]), null,
    "body-only text is not an explicit final answer");
  assert.equal(reconcile([context(), final(artifactText), context(), final(artifactText)]), null,
    "multiple matching current-turn contexts are ambiguous");
  const resumed = reconcile([context(turnId, rootTurnId), final(prefix + "pre-compaction"), compacted(), worldState(),
    context(turnId, rootTurnId), final(artifactText)]);
  assert.equal(resumed && resumed.message, artifactText,
    "the same native turn context resumes only across compacted, optional world_state, and matching root_turn_id");
  assert.equal(resumed.evidence.finalAnswerCount, 1, "recognized resume discards every pre-compaction final candidate");
  assert.equal(reconcile([context(turnId, rootTurnId), compacted(), context(turnId, rootTurnId), final(artifactText)]).message, artifactText,
    "world_state is optional in the explicit native compaction boundary");
  assert.equal(reconcile([context(turnId, rootTurnId), compacted(rootTurnId), context(turnId, "01a1552c-100e-7c10-aa9c-44207b5c9a25"),
    final(artifactText)]), null, "a mismatched root_turn_id cannot authorize a repeated context");
  assert.equal(reconcile([context(turnId, "malformed-root-id"), compacted(), worldState(), context(turnId, rootTurnId),
    final(artifactText)]), null, "a malformed initial root_turn_id cannot be treated as a missing root id");
  assert.equal(reconcile([context(turnId, rootTurnId), final(artifactText), compacted(), worldState(), context(turnId, rootTurnId)]), null,
    "a matching final from before compaction cannot carry a resumed context");
  assert.equal(reconcile([context(turnId, rootTurnId), final(artifactText), compacted(), context(turnId, rootTurnId),
    row("response_item", { type: "message", role: "assistant", phase: "final_answer",
      content: [{ type: "output_text", text: prefix }, { type: "output_text", text: footer }] })]), null,
  "an unsupported latest final after resume cannot fall back to a pre-compaction artifact");
  assert.equal(reconcile([context(turnId, rootTurnId), compacted(), worldState(), context(turnId, rootTurnId), final(artifactText)],
    { ...input, last_assistant_message: prefix.slice(0, -1) }), null,
  "compaction does not weaken exact hook-prefix validation");
  assert.equal(reconcile([context(), final(artifactText), final(prefix + "later")]), null,
    "the latest explicit final answer must equal the artifact exactly");
  assert.equal(reconcile([context(), final(prefix + "earlier"), final(artifactText)]).message, artifactText,
    "the latest final answer is selected when earlier finals differ");
  assert.equal(reconcile([context(), final(artifactText), row("response_item", {
    type: "message", role: "assistant", phase: "final_answer",
    content: [{ type: "output_text", text: prefix }, { type: "output_text", text: footer.replace("1-2", "1-3") }],
  })]), null, "an unsupported latest multipart final must not fall back to an earlier matching artifact");
  assert.equal(reconcile([context(), final(prefix + "without citation")]), null,
    "a body-only artifact cannot be reconciled");

  const longTurn = reconcile([context(), ...eventTraffic(2.5 * 1024 * 1024), final(artifactText)]);
  assert.equal(longTurn && longTurn.message, artifactText,
    "a legitimate current turn is found after more than the initial 2 MiB of event traffic");
  assert(longTurn.evidence.transcriptTailBytes > 2 * 1024 * 1024 &&
    longTurn.evidence.transcriptTailBytes <= 4 * 1024 * 1024,
  "tail expands only to the next bounded 4 MiB step when its current-turn context was truncated");

  const beyondCap = reconcile([context(), ...eventTraffic(5 * 1024 * 1024), final(artifactText)], input,
    { maxFinalTailBytes: 4 * 1024 * 1024 });
  assert.equal(beyondCap, null,
    "a transcript whose current-turn context is beyond the configured finite cap fails closed");

  console.log("Codex native final carrier: exact prefix, adaptive bounded tail, current-turn finals, explicit compaction resume, footer integrity and fail-closed cases passed");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
