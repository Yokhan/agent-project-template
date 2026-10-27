"use strict";

const { sha256 } = require("./writing-library-store.js");

const REPLY_OPEN = "<send_user_message_question_reply>";
const REPLY_CLOSE = "</send_user_message_question_reply>";
const CONTINUATIONS = new Set(["делай", "давай", "делай дальше", "сделай пожалуйста", "освободилось, сделай пожалуйста", "перегенери", "перегенерируй", "го", "погнали"]);

function parseAnswerEnvelope(body) {
  let entries;
  try { entries = JSON.parse(body); } catch { return null; }
  if (!Array.isArray(entries) || entries.length === 0 || entries.some(item => !item || typeof item !== "object" || Array.isArray(item) || typeof item.answer !== "string" || !item.answer.trim())) return null;
  return entries.map(item => item.answer.trim()).join("\n");
}

function parseRealtimeDelegationEnvelope(prompt) {
  const match = /^\s*<realtime_delegation>\s*<input>([\s\S]*?)<\/input>\s*<transcript_delta>([\s\S]*?)<\/transcript_delta>\s*<\/realtime_delegation>\s*$/u.exec(prompt);
  if (!match || !match[1].trim() || /<\/?(?:realtime_delegation|input|transcript_delta)>/iu.test(match[1])) return null;
  return { input: match[1].trim() };
}

function isContinuation(text) {
  const normalized = text.toLocaleLowerCase("ru-RU").replace(/[.!?]+$/u, "").replace(/\s+/gu, " ").trim();
  if (CONTINUATIONS.has(normalized)) return true;
  return isContextualContinuation(normalized);
}

function isContextualContinuation(text) {
  const normalized = text.toLocaleLowerCase("ru-RU").replace(/[.!?]+$/u, "").replace(/\s+/gu, " ").trim();
  return /^(?:ну\s+)?(?:вот\s+)?сделай\s+(?:всё|все),?\s+что\s+мы\s+обсудили(?:,?\s+пожалуйста)?$/iu.test(normalized);
}

function isOrchestrationNotice(prompt) {
  return /^You have [1-9]\d* orchestration messages?\. Run `orca orchestration check`\.$/u.test(prompt);
}

function resolveRequestContext(prompt, previousRecord = null, acceptedRecord = undefined) {
  if (typeof prompt !== "string") throw new Error("Native prompt must be text");
  const rawPromptSha256 = sha256(prompt);
  const realtime = parseRealtimeDelegationEnvelope(prompt);
  if (realtime) {
    const resolvedInput = resolveRequestContext(realtime.input, previousRecord, acceptedRecord);
    return { ...resolvedInput, rawPromptSha256,
      kind: resolvedInput.kind === "user-prompt" ? "realtime-delegation-input" : resolvedInput.kind };
  }
  if (/<\/?realtime_delegation(?:\s|>)/iu.test(prompt)) {
    return { task: prompt, routeTask: "", classificationTask: "", rawPromptSha256,
      kind: "unresolved-realtime-delegation", removedAmbientContext: false };
  }
  let normalized = prompt.replace(/^\s*<in-app-browser-context\s+source="ambient-ui-state">[\s\S]*?<\/in-app-browser-context>\s*/u, "");
  let removedAmbientContext = normalized !== prompt;
  const attachmentPrefix = /^\s*# Files mentioned by the user:[ \t]*\r?\n[\s\S]*?\r?\n## My request:[ \t]*\r?\n/u.exec(normalized);
  if (attachmentPrefix) {
    normalized = normalized.slice(attachmentPrefix[0].length).trim();
  } else if (normalized.includes("# Files mentioned by the user:")) {
    if (/^\s*# Files mentioned by the user:/u.test(normalized)) {
      return { task: prompt, routeTask: "", classificationTask: "", rawPromptSha256, kind: "unresolved-attachment-preamble", removedAmbientContext };
    }
  }
  const requestHeading = /^## My request:[ \t]*\r?\n/u.exec(normalized);
  if (requestHeading) normalized = normalized.slice(requestHeading[0].length).trim();
  const trimmed = normalized.trim();
  if (trimmed.startsWith(REPLY_OPEN) || trimmed.endsWith(REPLY_CLOSE)) {
    if (!trimmed.startsWith(REPLY_OPEN) || !trimmed.endsWith(REPLY_CLOSE)) {
      return { task: prompt, routeTask: "", classificationTask: "", rawPromptSha256, kind: "malformed-question-reply", removedAmbientContext };
    }
    const answer = parseAnswerEnvelope(trimmed.slice(REPLY_OPEN.length, -REPLY_CLOSE.length).trim());
    if (answer === null) return { task: prompt, routeTask: "", classificationTask: "", rawPromptSha256, kind: "malformed-question-reply", removedAmbientContext };
    const normalizedAnswer = answer.toLocaleLowerCase("ru-RU").replace(/[.!?]+$/u, "").trim();
    const shorthand = CONTINUATIONS.has(normalizedAnswer) || /^(?:да|нет|угу|неа|ок(?:ей)?|yes|no|yep|nope|\d+(?:[.,]\d+)?\s*%?)$/iu.test(normalizedAnswer);
    return { task: answer, routeTask: shorthand ? "" : answer, classificationTask: answer, rawPromptSha256, kind: "question-reply", removedAmbientContext };
  }

  const state = (acceptedRecord === undefined ? previousRecord : acceptedRecord)?.state;
  if (isContinuation(trimmed) && state?.delegation?.required === true && state.direct !== true &&
      typeof state.task === "string" && state.task.trim().length >= 40) {
    return {
      task: state.task,
      routeTask: state.task,
      classificationTask: state.task,
      rawPromptSha256,
      kind: "accepted-task-continuation",
      continuationOf: state.requestId,
      removedAmbientContext,
    };
  }
  if (isContinuation(trimmed)) {
    if (isContextualContinuation(trimmed)) {
      return { task: normalized, routeTask: normalized, classificationTask: normalized, rawPromptSha256,
        kind: "unlinked-contextual-continuation", removedAmbientContext };
    }
    return { task: normalized, routeTask: "", classificationTask: "", rawPromptSha256, kind: "unlinked-continuation", removedAmbientContext };
  }
  return { task: normalized, routeTask: normalized, classificationTask: normalized, rawPromptSha256, kind: "user-prompt", removedAmbientContext };
}

module.exports = { isOrchestrationNotice, resolveRequestContext, parseAnswerEnvelope, parseRealtimeDelegationEnvelope, isContinuation, isContextualContinuation };
