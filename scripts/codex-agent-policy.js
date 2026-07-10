"use strict";

const path = require("path");

const EFFORT_LEVELS = Object.freeze(["low", "medium", "high", "xhigh"]);

const AGENT_POLICY = Object.freeze({
  version: "4.6.0",
  parent: Object.freeze({
    modelSource: "user-or-ide",
    recommendedModel: "gpt-5.6-sol",
    baselineEffort: "medium",
    effortCeiling: "xhigh",
  }),
  fanout: Object.freeze({
    maxChildren: 3,
    maxDepth: 1,
    notifyUser: true,
    readOnlyFirst: true,
    writePolicy: "exact-non-overlapping-files-only",
  }),
  profiles: Object.freeze({
    pr_explorer: Object.freeze({
      file: "pr-explorer.toml",
      model: "gpt-5.6-terra",
      effort: "medium",
      sandboxMode: "read-only",
    }),
    docs_researcher: Object.freeze({
      file: "docs-researcher.toml",
      model: "gpt-5.6-terra",
      effort: "medium",
      sandboxMode: "read-only",
    }),
    tester: Object.freeze({
      file: "tester.toml",
      model: "gpt-5.6-terra",
      effort: "medium",
      sandboxMode: "read-only",
    }),
    implementer: Object.freeze({
      file: "implementer.toml",
      model: "gpt-5.6-terra",
      effort: "high",
      sandboxMode: "workspace-write",
    }),
    reviewer: Object.freeze({
      file: "reviewer.toml",
      model: "gpt-5.6-sol",
      effort: "high",
      sandboxMode: "read-only",
    }),
    design_reviewer: Object.freeze({
      file: "design-reviewer.toml",
      model: "gpt-5.6-sol",
      effort: "high",
      sandboxMode: "read-only",
    }),
    product_reviewer: Object.freeze({
      file: "product-reviewer.toml",
      model: "gpt-5.6-sol",
      effort: "high",
      sandboxMode: "read-only",
    }),
    security_reviewer: Object.freeze({
      file: "security-reviewer.toml",
      model: "gpt-5.6-sol",
      effort: "xhigh",
      sandboxMode: "read-only",
    }),
    systems_reviewer: Object.freeze({
      file: "systems-reviewer.toml",
      model: "gpt-5.6-sol",
      effort: "xhigh",
      sandboxMode: "read-only",
    }),
  }),
});

const OPT_OUT_PATTERN =
  /(?:\b(?:do not|don't|dont|never)\s+(?:(?:use|spawn|run|call)\s+)?(?:any\s+)?(?:sub-?agents?|delegation|fan-?out)\b|\b(?:do not|don't|dont|never)\s+delegate\b|\bwithout\s+(?:(?:using|any)\s+)?(?:sub-?agents?|delegation|fan-?out)\b|\bno\s+(?:sub-?agents?|delegation|fan-?out)\b|(?:без|не\s+(?:используй|запускай|вызывай|делегируй))\s+(?:любых\s+)?(?:субагент|сабагент|делегац|фан-?аут)|не\s+делегируй)/iu;
const ACTION_PATTERN =
  /\b(?:build|change|create|deploy|fix|harden|implement|migrate|patch|publish|release|remediate|review|tag|update)\b|аудит|выпусти|исправ|измен|мигрир|обнов|опубликуй|проверь|реализ|релизь|созда|тегир|выкат/iu;
const SIMPLE_QUESTION_PATTERN =
  /^(?:what|when|where|who|why|how|is|are|can|does|do|что|когда|где|кто|почему|как|можно|есть|выпущен)(?:\s|$)/iu;

function getAgentProfile(name) {
  return AGENT_POLICY.profiles[name] || null;
}

function getAgentProfiles() {
  return Object.entries(AGENT_POLICY.profiles).map(([name, profile]) => ({
    name,
    ...profile,
  }));
}

function isLikelySmallQuestion(task) {
  const trimmed = task.trim();
  return trimmed.length < 120 && SIMPLE_QUESTION_PATTERN.test(trimmed);
}

function getFanoutDecision(options) {
  const task = options.task || "";
  const risk = options.risk || "LOW";
  const candidates = Array.from(new Set(options.candidates || []));
  const modes = Array.from(new Set(options.modes || []));
  const isStateChanging = options.isStateChanging ?? ACTION_PATTERN.test(task);

  if (OPT_OUT_PATTERN.test(task)) {
    return createDecision("skip", "explicit-user-opt-out", []);
  }
  if (candidates.length === 0) {
    return createDecision("skip", "no-specialist-candidates", []);
  }
  if (isLikelySmallQuestion(task)) {
    return createDecision("skip", "small-direct-question", []);
  }

  const ranked = rankCandidates(candidates, modes);
  const selected = ranked.slice(0, AGENT_POLICY.fanout.maxChildren);
  if ((risk === "HIGH" || risk === "CRITICAL") && isStateChanging) {
    return createDecision("required", "high-risk-independent-verification", selected, ranked);
  }
  if (selected.length >= 2) {
    return createDecision("recommended", "parallel-independent-lanes-available", selected, ranked);
  }
  return createDecision("conditional", "spawn-only-if-non-blocking-specialist-lane-exists", selected, ranked);
}

function rankCandidates(candidates, modes) {
  const priorityByMode = {
    security: ["security_reviewer"],
    openai: ["docs_researcher"],
    template: ["systems_reviewer", "tester"],
    migration: ["systems_reviewer", "tester"],
    release: ["security_reviewer", "tester", "reviewer"],
    strategy: ["systems_reviewer", "product_reviewer"],
    product: ["product_reviewer"],
    "product-ux": ["product_reviewer", "design_reviewer"],
    design: ["design_reviewer"],
    "design-system": ["design_reviewer"],
  };
  const orderedModes = Object.keys(priorityByMode).filter((mode) => modes.includes(mode));
  const preferred = orderedModes.flatMap((mode) => priorityByMode[mode]);
  return Array.from(new Set([...preferred, ...candidates])).filter((name) =>
    candidates.includes(name),
  );
}

function createDecision(status, reason, candidates, inventory = candidates) {
  return {
    status,
    reason,
    candidates: candidates.map((name) => ({
      name,
      profile: getAgentProfile(name),
    })),
    candidateInventory: inventory.map((name) => name),
    maxChildren: AGENT_POLICY.fanout.maxChildren,
    maxDepth: AGENT_POLICY.fanout.maxDepth,
    notifyUser: AGENT_POLICY.fanout.notifyUser,
    readOnlyFirst: AGENT_POLICY.fanout.readOnlyFirst,
    writePolicy: AGENT_POLICY.fanout.writePolicy,
    independenceGate:
      "spawn only when the lane is independent, useful, non-duplicative, and faster or safer in parallel",
  };
}

function formatAgentProfiles(candidates) {
  return candidates.map(({ name, profile }) => {
    if (!profile) return `${name}:project-defined`;
    return `${name}:${profile.model}@${profile.effort}`;
  });
}

function normalizeWriteScope(scope) {
  const normalized = String(scope || "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "");
  return normalized
    ? path.posix.normalize(normalized).replace(/\/$/, "").toLocaleLowerCase("en-US")
    : "";
}

function doScopesOverlap(left, right) {
  if (!left || !right) return false;
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function isUnsafeWriteScope(scope) {
  return scope === "." || scope === "/" || /^[a-z]:\/?$/iu.test(scope);
}

function validateWriteAssignments(assignments = []) {
  const normalized = assignments.map(({ agent, files = [] }) => ({
    agent,
    files: files.map(normalizeWriteScope).filter(Boolean),
  }));
  const missingScopes = normalized
    .filter(({ files }) => files.length === 0)
    .map(({ agent }) => agent);
  const invalidScopes = normalized.flatMap(({ agent, files }) =>
    files.filter(isUnsafeWriteScope).map((scope) => ({ agent, scope })),
  );
  const conflicts = [];
  for (let left = 0; left < normalized.length; left += 1) {
    for (let right = left + 1; right < normalized.length; right += 1) {
      collectWriteConflicts(normalized[left], normalized[right], conflicts);
    }
  }
  return {
    isValid:
      missingScopes.length === 0 && invalidScopes.length === 0 && conflicts.length === 0,
    missingScopes,
    invalidScopes,
    conflicts,
  };
}

function collectWriteConflicts(left, right, conflicts) {
  for (const leftScope of left.files) {
    for (const rightScope of right.files) {
      if (doScopesOverlap(leftScope, rightScope)) {
        conflicts.push({
          agents: [left.agent, right.agent],
          scopes: [leftScope, rightScope],
        });
      }
    }
  }
}

module.exports = {
  AGENT_POLICY,
  EFFORT_LEVELS,
  formatAgentProfiles,
  getAgentProfile,
  getAgentProfiles,
  getFanoutDecision,
  validateWriteAssignments,
};
