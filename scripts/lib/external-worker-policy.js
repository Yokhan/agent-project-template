"use strict";

const MAX_OBSERVATION_AGE_MS = 15 * 60 * 1000;
const FLASH_MODELS = new Set(["deepseek-flash", "deepseek-v4-flash", "deepseek-v4-flash-vision-exp"]);
const OBSERVED_ORCA_FLASH_ALIAS = "opencode-go/deepseek-v4.1-flash";
const EXECUTION_ROLES = new Set(["implementer", "tester", "docs_researcher", "scout", "log_analyst", "summarizer", "pr_explorer"]);

function fallback(reason) {
  return { state: "native-luna-fallback", selectedModel: null, reason, fallbackReason: `Use the current native Luna route: ${reason}` };
}

function getFastWorkerDecision(input = {}, now = Date.now()) {
  if (input.needSpeed !== true) return fallback("faster execution was not requested");
  const assignment = input.assignment;
  if (!assignment || !Array.isArray(assignment.scope) || !assignment.scope.length ||
      !assignment.scope.every(item => typeof item === "string" && item.trim()) ||
      !Array.isArray(assignment.acceptance) || !assignment.acceptance.length ||
      !assignment.acceptance.every(item => typeof item === "string" && item.trim()) || assignment.uncertainty !== "low") {
    return fallback("assignment must have bounded scope, acceptance, and explicitly low uncertainty");
  }
  const role = input.role || "implementer";
  if (!EXECUTION_ROLES.has(role) || input.judgment === true || input.integration === true || input.strategy === true ||
      input.security === true || input.editorial === true || ["HIGH", "CRITICAL"].includes(String(input.risk || "").toUpperCase())) {
    return fallback("judgment, integration, security, editorial, or high-risk work stays with its required native reviewer/orchestrator");
  }
  const host = input.observedHost;
  if (!host || host.available !== true || host.authorized !== true || !host.transport || !host.observedAt) {
    return fallback("no authorized external host transport is currently observed");
  }
  const observedAt = Date.parse(host.observedAt);
  if (!Number.isFinite(observedAt) || observedAt > now || now - observedAt > MAX_OBSERVATION_AGE_MS) {
    return fallback("external host availability evidence is stale or has an invalid timestamp");
  }
  const transport = String(host.transport).toLocaleLowerCase("en-US");
  const officialApiModel = FLASH_MODELS.has(host.selectedModel) && /\bapi\b/u.test(transport);
  const observedOrcaAlias = host.selectedModel === OBSERVED_ORCA_FLASH_ALIAS && /(?:orca|opencode)/u.test(transport);
  if (!officialApiModel && !observedOrcaAlias) return fallback("selected external model is not an allowed Flash ID for the observed transport");
  const required = input.requiredCapabilities;
  const available = host.toolCapabilities;
  if (!Array.isArray(required) || !required.length || !required.every(value => typeof value === "string" && value.trim()) ||
      !Array.isArray(available) || required.some(capability => !available.includes(capability))) {
    return fallback("observed host tools do not cover every required operation capability");
  }
  return { state: "external-fast-ready", selectedModel: host.selectedModel, reason: "authorized-current-host-and-tools-cover-bounded-low-uncertainty-assignment",
    observedModelId: host.selectedModel, hostTransport: host.transport, observedAt: new Date(observedAt).toISOString(),
    assignment: { scope: [...assignment.scope], acceptance: [...assignment.acceptance], uncertainty: "low", operation: assignment.operation || null },
    providerRuntimeStatus: "host-observation-only", effectiveModel: null,
    ...(observedOrcaAlias ? { aliasSource: "observed-Orca-session-readback20261027", aliasIsOfficialApiId: false } : {}) };
}

module.exports = { getFastWorkerDecision, MAX_OBSERVATION_AGE_MS, FLASH_MODELS, OBSERVED_ORCA_FLASH_ALIAS };
