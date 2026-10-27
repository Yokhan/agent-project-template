#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const policy = require("./lib/codex-turn-policy.js");
const { getAgentProfile } = require("./codex-agent-policy.js");
const { sha256 } = require("./lib/writing-library-store.js");

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!["--session", "--limit"].includes(key) || argv[i + 1] === undefined || options[key] !== undefined) {
      throw new Error("Usage: node scripts/codex-delegation-report.js --session <native-session-id> [--limit 20]");
    }
    options[key] = argv[i + 1];
  }
  if (!options["--session"]) throw new Error("--session is required");
  const limit = options["--limit"] === undefined ? 20 : Number(options["--limit"]);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("--limit must be an integer from 1 to 100");
  return { sessionId: options["--session"], limit };
}

function summarize(records, options = {}) {
  const limit = options.limit === undefined ? 20 : options.limit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("limit must be an integer from 1 to 100");
  const observe = options.observeProfile;
  if (typeof observe !== "function") throw new Error("A runtime profile observer is required");
  const inspectExternal = options.inspectExternalExecution || policy.inspectExternalExecution;
  if (typeof inspectExternal !== "function") throw new Error("An external execution inspector is required");
  const preferredProfile = getAgentProfile("implementer");
  const ordered = records.slice().sort((a, b) => Date.parse(b.state?.startedAt || "") - Date.parse(a.state?.startedAt || ""));
  const selected = ordered.slice(0, limit);
  const counts = {
    requests: { totalInLedger: options.totalInLedger ?? records.length, analyzed: options.analyzedCount ?? selected.length, validAnalyzed: selected.length },
    eligibleTasks: 0, eligibleTerraTasks: 0, eligibleLegacyLunaTasks: 0, eligibilityUnverifiedTasks: 0, terraCalledRequests: 0, completedIntegratedUsefulTerraRequests: 0,
    eligibleTerraCalledTasks: 0, eligibleCompletedIntegratedUsefulTerraTasks: 0,
    pendingRequests: 0, unfinishedTerraCalls: 0,
    lunaCalledRequests: 0, completedIntegratedUsefulLunaRequests: 0,
    eligibleLunaCalledTasks: 0, eligibleCompletedIntegratedUsefulLunaTasks: 0, unfinishedLunaCalls: 0,
    eligiblePreferredTasks: 0, eligiblePreferredNativeCorrelatedTasks: 0, eligiblePreferredNativeCompletedIntegratedUsefulTasks: 0,
    eligibleExternalHostObservedTasks: 0, eligibleExternalHostSubmittedTasks: 0, eligibleExternalHostUnverifiedTasks: 0,
    eligibleOffloadedWorkTasks: 0, eligibleOffloadUnverifiedTasks: 0,
    exclusions: { parentOwned: 0, skip: 0, other: 0 },
    fallbackRequests: 0, runtimeUnverifiedRequests: 0
  };
  const errors = [...(options.errors || [])];
  for (const record of selected) {
    const { state, directory } = record;
    if (!state || !directory) { errors.push("invalid-request-record"); continue; }
    const delegation = state.delegation || {};
    const cohort = state.preferredWorkerProfile?.model;
    const preferredEffort = state.preferredWorkerProfile?.effort;
    const terraEligible = delegation.required === true && cohort === "gpt-6.1-terra";
    const preferredEligible = delegation.required === true && cohort === preferredProfile?.model && preferredEffort === preferredProfile?.effort;
    if (delegation.required === true) {
      counts.eligibleTasks++;
      if (terraEligible) counts.eligibleTerraTasks++;
      else if (cohort === "gpt-6-luna") {
        counts.eligibleLegacyLunaTasks++;
        if (cohort === preferredProfile?.model && preferredEffort !== preferredProfile?.effort) {
          counts.eligibilityUnverifiedTasks++;
        }
      }
      else counts.eligibilityUnverifiedTasks++;
      if (preferredEligible) counts.eligiblePreferredTasks++;
    }
    else {
      if (delegation.state === "parent-owned") counts.exclusions.parentOwned++;
      else if (delegation.state === "skip") counts.exclusions.skip++;
      else counts.exclusions.other++;
    }
    let children = [];
    try {
      const childDir = policy.localFile(state.root, path.join(directory, "children"));
      if (fs.existsSync(childDir)) children = fs.readdirSync(childDir).filter(name => name.endsWith(".json")).map(name => policy.readJson(policy.localFile(state.root, path.join(childDir, name))));
    } catch { errors.push("invalid-child-ledger"); }
    let terra = false;
    let legacyLuna = false;
    let useful = false;
    let usefulLuna = false;
    let preferredNativeCorrelated = false;
    let preferredNativeUseful = false;
    let unverified = false;
    for (const child of children) {
      let profile = { status: "model-unverified" };
      try { profile = observe(child, state) || profile; } catch { /* keep unknown runtime unverified */ }
      if (profile.status !== "runtime-correlated") {
        unverified = true;
        continue;
      }
      const model = String(profile.model || "").trim().toLowerCase();
      if (!model) { unverified = true; continue; }
      const isLuna = model === "gpt-6-luna";
      const isTerra = model === "gpt-6.1-terra";
      if (!isLuna && !isTerra) continue;
      if (isTerra && !["none", "low", "medium", "high", "xhigh", "max"].includes(profile.effort)) { unverified = true; continue; }
      const preferredNativeProfile = isLuna && preferredEligible && profile.effort === preferredProfile.effort;
      if (isLuna && preferredEligible && !preferredNativeProfile) unverified = true;
      if (preferredNativeProfile) preferredNativeCorrelated = true;
      if (isLuna) { legacyLuna = true; if (!child.completedAt) counts.unfinishedLunaCalls++; }
      if (isTerra) { terra = true; if (!child.completedAt) counts.unfinishedTerraCalls++; }
      const integrationFile = policy.localFile(state.root, path.join(directory, `integration-${sha256(child.id)}.json`));
      let item = null;
      try { if (fs.existsSync(integrationFile)) item = policy.readJson(integrationFile); }
      catch { errors.push("invalid-integration-evidence"); }
      const assignment = item?.assignment;
      if (child.completedAt && item?.requestId === state.requestId && item?.childId === child.id &&
          Array.isArray(assignment?.scope) && assignment.scope.length > 0 && assignment.scope.every(x => typeof x === "string" && x.trim()) &&
          Array.isArray(assignment?.acceptance) && assignment.acceptance.length > 0 && assignment.acceptance.every(x => typeof x === "string" && x.trim()) &&
          typeof item.result === "string" && item.result.trim().length >= 20) {
        if (isTerra) useful = true;
        if (isLuna) {
          usefulLuna = true;
          if (preferredNativeProfile) preferredNativeUseful = true;
        }
      }
    }
    let external = { state: "unverified", requestId: state.requestId, completedWorkCredit: false };
    try { external = inspectExternal({ state, file: record.file || path.join(directory, "request.json"), directory }) || external; }
    catch { errors.push("invalid-external-execution-evidence"); }
    const fallbackFile = policy.localFile(state.root, path.join(directory, "fallback.json"));
    let externalHostFallback = false;
    try {
      if (fs.existsSync(fallbackFile)) {
        const fallback = policy.readJson(fallbackFile);
        externalHostFallback = fallback.requestId === state.requestId && fallback.category === "external-host";
      }
    } catch { errors.push("invalid-fallback-evidence"); }
    const externalObserved = externalHostFallback && external.requestId === state.requestId && external.completedWorkCredit === true &&
      external.state === "reported-completed-integrated" && external.providerVerification === "parent-inspected-host-response-claims" &&
      external.verifiedLuna === false && external.effectiveModel === null;
    const externalSubmitted = externalHostFallback && external.state === "submitted";
    const externalUnverified = externalHostFallback && !externalObserved && !externalSubmitted;
    if (legacyLuna) counts.lunaCalledRequests++;
    if (usefulLuna) counts.completedIntegratedUsefulLunaRequests++;
    if (delegation.required === true && legacyLuna) counts.eligibleLunaCalledTasks++;
    if (delegation.required === true && usefulLuna) counts.eligibleCompletedIntegratedUsefulLunaTasks++;
    if (terra) counts.terraCalledRequests++;
    if (useful) counts.completedIntegratedUsefulTerraRequests++;
    if (terraEligible && terra) counts.eligibleTerraCalledTasks++;
    if (terraEligible && useful) counts.eligibleCompletedIntegratedUsefulTerraTasks++;
    if (preferredEligible) {
      if (preferredNativeCorrelated) counts.eligiblePreferredNativeCorrelatedTasks++;
      if (preferredNativeUseful) counts.eligiblePreferredNativeCompletedIntegratedUsefulTasks++;
      if (externalObserved) counts.eligibleExternalHostObservedTasks++;
      if (externalSubmitted) counts.eligibleExternalHostSubmittedTasks++;
      if (externalUnverified) counts.eligibleExternalHostUnverifiedTasks++;
      if (preferredNativeUseful || externalObserved) counts.eligibleOffloadedWorkTasks++;
      else if (unverified || externalSubmitted || externalUnverified) counts.eligibleOffloadUnverifiedTasks++;
    }
    if (unverified) counts.runtimeUnverifiedRequests++;
    if (!fs.existsSync(policy.localFile(state.root, path.join(directory, "result.json")))) counts.pendingRequests++;
    try {
      if (fs.existsSync(fallbackFile) && policy.readJson(fallbackFile).requestId === state.requestId) counts.fallbackRequests++;
    } catch { /* fallback errors were already recorded above */ }
  }
  const eligible = counts.eligibleTasks;
  const eligibleTerra = counts.eligibleTerraTasks;
  const analyzed = counts.requests.analyzed;
  const eligibleTerraRate = eligibleTerra ? counts.eligibleTerraCalledTasks / eligibleTerra : null;
  const eligibleUsefulRate = eligibleTerra ? counts.eligibleCompletedIntegratedUsefulTerraTasks / eligibleTerra : null;
  const allTerraShare = analyzed ? counts.terraCalledRequests / analyzed : null;
  const allUsefulShare = analyzed ? counts.completedIntegratedUsefulTerraRequests / analyzed : null;
  const preferredUsefulRate = counts.eligiblePreferredTasks ? counts.eligibleOffloadedWorkTasks / counts.eligiblePreferredTasks : null;
  const preferredNativeUsefulRate = counts.eligiblePreferredTasks ? counts.eligiblePreferredNativeCompletedIntegratedUsefulTasks / counts.eligiblePreferredTasks : null;
  const terraStatus = errors.length || counts.eligibilityUnverifiedTasks ? "incomplete" : (!eligibleTerra ? "no-data" : (eligibleUsefulRate >= 0.5 ? "pass" : "under-target"));
  return {
    schemaVersion: 2,
    status: errors.length || counts.eligibilityUnverifiedTasks ? "incomplete" : (!counts.eligiblePreferredTasks ? "no-data" : (preferredUsefulRate >= 0.5 ? "pass" : "under-target")),
    target: { metric: "completed integrated useful native or externally offloaded work per current-preferred task", minimumRate: 0.5 },
    historicalTargets: { terra: { metric: "completed integrated useful Terra work per Terra-preferred task", minimumRate: 0.5 } },
    terraStatus,
    preferredProfile: { source: "current getAgentProfile(implementer)", model: preferredProfile.model, effort: preferredProfile.effort },
    cohort: { source: "request-start preferredWorkerProfile.model", unknownEligibility: "required requests without a recognized preferred profile make status incomplete", legacyLunaExcludedFromTerraTarget: true,
      currentPreferredSource: "current getAgentProfile(implementer) model and effort; request-start profile must match both" },
    window: { newestRequestsLimit: limit, analyzed, totalInLedger: counts.requests.totalInLedger },
    counts,
    coverage: {
      eligibleLunaCalled: { numerator: counts.eligibleLunaCalledTasks, denominator: eligible, rate: eligible ? counts.eligibleLunaCalledTasks / eligible : null },
      eligibleCompletedIntegratedUsefulLuna: { numerator: counts.eligibleCompletedIntegratedUsefulLunaTasks, denominator: eligible, rate: eligible ? counts.eligibleCompletedIntegratedUsefulLunaTasks / eligible : null },
      eligibleTerraCalled: { numerator: counts.eligibleTerraCalledTasks, denominator: eligibleTerra, rate: eligibleTerraRate },
      eligibleCompletedIntegratedUsefulTerra: { numerator: counts.eligibleCompletedIntegratedUsefulTerraTasks, denominator: eligibleTerra, rate: eligibleUsefulRate },
      eligiblePreferredNativeCorrelated: { numerator: counts.eligiblePreferredNativeCorrelatedTasks, denominator: counts.eligiblePreferredTasks, rate: counts.eligiblePreferredTasks ? counts.eligiblePreferredNativeCorrelatedTasks / counts.eligiblePreferredTasks : null },
      eligiblePreferredNativeCompletedIntegratedUseful: { numerator: counts.eligiblePreferredNativeCompletedIntegratedUsefulTasks, denominator: counts.eligiblePreferredTasks, rate: preferredNativeUsefulRate },
      eligibleExternalHostObserved: { numerator: counts.eligibleExternalHostObservedTasks, denominator: counts.eligiblePreferredTasks, rate: counts.eligiblePreferredTasks ? counts.eligibleExternalHostObservedTasks / counts.eligiblePreferredTasks : null },
      eligibleExternalHostSubmitted: { numerator: counts.eligibleExternalHostSubmittedTasks, denominator: counts.eligiblePreferredTasks, rate: counts.eligiblePreferredTasks ? counts.eligibleExternalHostSubmittedTasks / counts.eligiblePreferredTasks : null },
      eligibleExternalHostUnverified: { numerator: counts.eligibleExternalHostUnverifiedTasks, denominator: counts.eligiblePreferredTasks, rate: counts.eligiblePreferredTasks ? counts.eligibleExternalHostUnverifiedTasks / counts.eligiblePreferredTasks : null },
      eligibleOffloadUnverified: { numerator: counts.eligibleOffloadUnverifiedTasks, denominator: counts.eligiblePreferredTasks, rate: counts.eligiblePreferredTasks ? counts.eligibleOffloadUnverifiedTasks / counts.eligiblePreferredTasks : null },
      eligibleOffloadedWork: { numerator: counts.eligibleOffloadedWorkTasks, denominator: counts.eligiblePreferredTasks, rate: preferredUsefulRate },
      allRequestShare: {
        denominatorMeaning: "All request entries in the analyzed window, including selected entries with malformed or missing state; rates are conservative observed shares.",
        lunaCalled: { numerator: counts.lunaCalledRequests, denominator: analyzed, rate: analyzed ? counts.lunaCalledRequests / analyzed : null },
        completedIntegratedUsefulLuna: { numerator: counts.completedIntegratedUsefulLunaRequests, denominator: analyzed, rate: analyzed ? counts.completedIntegratedUsefulLunaRequests / analyzed : null },
        terraCalled: { numerator: counts.terraCalledRequests, denominator: analyzed, rate: allTerraShare },
        completedIntegratedUsefulTerra: { numerator: counts.completedIntegratedUsefulTerraRequests, denominator: analyzed, rate: allUsefulShare }
      }
    },
    errors: { count: errors.length, types: [...new Set(errors)] },
    evidenceLimits: "Historical Luna and Terra fields retain their prior counts and cohort gates. Current preferred native coverage requires a runtime-correlated Luna child at the current implementer effort. External-host coverage means the request-bound host response, exact output and parent integration were inspected locally; provider and effective model remain unverified, and this never earns Luna credit. Useful-work coverage counts each eligible request once and does not establish semantic quality or parent outcome acceptance."
  };
}

function collect(root, sessionId, limit, observeProfile = policy.observeProfile, dependencies = {}) {
  if (typeof observeProfile !== "function") throw new Error("policy.observeProfile must be exported for runtime correlation");
  const session = policy.sessionRoot(root, sessionId);
  const requestsPath = policy.localFile(root, path.join(session, "requests"));
  const errors = [];
  if (!fs.existsSync(requestsPath)) {
    if (fs.existsSync(session)) errors.push("request-ledger-missing");
    return summarize([], { limit, observeProfile, totalInLedger: 0, errors });
  }
  const statPath = dependencies.statSync || fs.statSync;
  const loadState = dependencies.loadState || policy.loadState;
  const dirs = [];
  for (const name of fs.readdirSync(requestsPath)) {
    try {
      const file = policy.localFile(root, path.join(requestsPath, name));
      const stat = statPath(file);
      if (stat.isDirectory()) dirs.push({ file, timestamp: stat.birthtimeMs || stat.mtimeMs });
    } catch { errors.push("unsafe-or-unreadable-request-entry"); }
  }
  dirs.sort((a, b) => b.timestamp - a.timestamp || a.file.localeCompare(b.file));
  const selectedDirs = dirs.slice(0, limit);
  const records = [];
  for (const { file: directory } of selectedDirs) {
    const file = policy.localFile(root, path.join(directory, "request.json"));
    try {
      const record = loadState(root, file);
      if (record.state.sessionId !== sessionId) throw new Error("session mismatch");
      records.push({ state: record.state, file: record.file, directory: record.directory });
    } catch { errors.push("invalid-or-missing-request-state"); }
  }
  return summarize(records, { limit, observeProfile, totalInLedger: dirs.length, analyzedCount: selectedDirs.length, errors });
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    process.stdout.write(JSON.stringify(collect(process.cwd(), args.sessionId, args.limit), null, 2) + "\n");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { parseArgs, summarize, collect };
