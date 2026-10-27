"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const report = require("./codex-delegation-report.js");
const policy = require("./lib/codex-turn-policy.js");
const { sha256 } = require("./lib/writing-library-store.js");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-delegation-report-"));
function record(id, { required = true, delegationState = "required", reason = "bounded-contract", startedAt, child, profile, integration, fallback, result, preferredProfile = { model: "gpt-6.1-terra", effort: "medium" } } = {}) {
  const directory = path.join(root, id);
  fs.mkdirSync(directory, { recursive: true });
  const state = { root: fs.realpathSync(root), sessionId: "native-session", requestId: id, startedAt: startedAt || "2026-10-24T10:00:00.000Z",
    task: "PRIVATE TASK PROMPT MUST NEVER APPEAR", preferredWorkerProfile: preferredProfile, delegation: { required, state: delegationState, reason } };
  const children = child ? [child] : [];
  if (children.length) {
    fs.mkdirSync(path.join(directory, "children"), { recursive: true });
    for (const item of children) fs.writeFileSync(path.join(directory, "children", `${sha256(item.id)}.json`), JSON.stringify(item));
  }
  if (integration) fs.writeFileSync(path.join(directory, `integration-${sha256(child.id)}.json`), JSON.stringify(integration));
  if (fallback) fs.writeFileSync(path.join(directory, "fallback.json"), JSON.stringify(fallback));
  if (result) fs.writeFileSync(path.join(directory, "result.json"), JSON.stringify({ state: "passed" }));
  return { state, directory, profile };
}

try {
  assert.deepEqual(report.parseArgs(["--session", "s", "--limit", "3"]), { sessionId: "s", limit: 3 });
  for (const args of [["--session", "s", "--limit", "0"], ["--session", "s", "--limit", "101"], ["--session", "s", "--limit", "1.5"], ["--session", "s", "--limit", "x"], ["--session", "s", "--session", "x"]]) {
    assert.throws(() => report.parseArgs(args));
  }

  const started = record("started", { child: { id: "child-started", startedAt: "now" }, profile: { status: "runtime-correlated", model: "gpt-6.1-terra", effort: "medium" } });
  const usefulChild = { id: "child-useful", startedAt: "then", completedAt: "later" };
  const useful = record("useful", { startedAt: "2026-10-24T09:00:00.000Z", child: usefulChild,
    profile: { status: "runtime-correlated", model: "gpt-6.1-terra", effort: "medium" },
    integration: { requestId: "useful", childId: usefulChild.id, assignment: { scope: ["one bounded file"], acceptance: ["result passes criterion"] }, result: "Integrated the child's result against the stated acceptance criterion." }, result: true });
  const mismatchedChild = { id: "child-mismatch", completedAt: "later" };
  const incompatible = record("incompatible", { startedAt: "2026-10-24T08:00:00.000Z", child: mismatchedChild,
    profile: { status: "runtime-correlated", model: "gpt-6.1-terra", effort: "medium" },
    integration: { requestId: "another-request", childId: mismatchedChild.id, assignment: { scope: ["x"], acceptance: ["y"] }, result: "A sufficiently long result string that must not count." }, result: true });
  const fallback = record("fallback", { startedAt: "2026-10-24T07:00:00.000Z", fallback: { requestId: "fallback" } });
  const unknown = record("unknown", { startedAt: "2026-10-24T06:00:00.000Z", child: { id: "child-unknown" }, profile: { status: "model-unverified" } });
  const parent = record("parent", { required: false, delegationState: "parent-owned", reason: "unrelated-reason", startedAt: "2026-10-24T05:00:00.000Z", result: true });
  const skippedChild = { id: "child-skip", completedAt: "later" };
  const skipped = record("skip", { required: false, delegationState: "skip", reason: "unrelated-reason", startedAt: "2026-10-24T04:00:00.000Z", child: skippedChild,
    profile: { status: "runtime-correlated", model: "gpt-6.1-terra", effort: "medium" },
    integration: { requestId: "skip", childId: skippedChild.id, assignment: { scope: ["bounded skipped work"], acceptance: ["valid evidence"] }, result: "This integrated result belongs to a skipped, ineligible task." }, result: true });
  const records = [started, useful, incompatible, fallback, unknown, parent, skipped];
  const observers = new Map(records.filter(x => x.profile).flatMap(x => {
    const childId = fs.existsSync(path.join(x.directory, "children")) ? fs.readdirSync(path.join(x.directory, "children")).map(file => policy.readJson(path.join(x.directory, "children", file)).id)[0] : null;
    return childId ? [[childId, x.profile]] : [];
  }));
  const snapshot = records.map(x => [x.directory, fs.readdirSync(x.directory).sort().join(","), fs.statSync(x.directory).mtimeMs]);
  const output = report.summarize(records.map(({ state, directory }) => ({ state, directory })), { limit: 20, totalInLedger: 7,
    observeProfile: child => observers.get(child.id) || { status: "model-unverified" } });
  assert.equal(output.status, "no-data", "historical Terra requests are outside the current preferred cohort");
  assert.equal(output.terraStatus, "under-target", "calls alone must not make the historical Terra target pass");
  assert.deepEqual(output.target, { metric: "completed integrated useful native or externally offloaded work per current-preferred task", minimumRate: 0.5 });
  assert.deepEqual(output.historicalTargets.terra, { metric: "completed integrated useful Terra work per Terra-preferred task", minimumRate: 0.5 });
  assert.equal(output.counts.requests.totalInLedger, 7);
  assert.equal(output.counts.eligibleTasks, 5, "fallback stays in the eligible denominator");
  assert.equal(output.counts.terraCalledRequests, 4, "started runtime-correlated Terra call counts as dispatch");
  assert.equal(output.counts.completedIntegratedUsefulTerraRequests, 2, "exact integration is counted even for ineligible work");
  assert.equal(output.counts.eligibleTerraCalledTasks, 3, "skipped request must not inflate eligible coverage");
  assert.equal(output.counts.eligibleCompletedIntegratedUsefulTerraTasks, 1);
  assert.deepEqual(output.coverage.eligibleTerraCalled, { numerator: 3, denominator: 5, rate: 0.6 });
  assert.deepEqual(output.coverage.allRequestShare.terraCalled, { numerator: 4, denominator: 7, rate: 4 / 7 });
  assert.deepEqual(output.coverage.allRequestShare.completedIntegratedUsefulTerra, { numerator: 2, denominator: 7, rate: 2 / 7 });
  assert.equal(output.counts.pendingRequests, 3);
  assert.equal(output.counts.unfinishedTerraCalls, 1);
  assert.equal(output.counts.fallbackRequests, 1);
  assert.equal(output.counts.runtimeUnverifiedRequests, 1);
  assert.equal(output.counts.exclusions.parentOwned, 1);
  assert.equal(output.counts.exclusions.skip, 1);
  const startedOnly = report.summarize([{ state: started.state, directory: started.directory }], { limit: 20,
    observeProfile: child => observers.get(child.id) });
  assert.equal(startedOnly.status, "no-data");
  assert.equal(startedOnly.terraStatus, "under-target");
  assert.equal(startedOnly.counts.eligibleTerraCalledTasks, 1, "a correlated start remains visible as a call");
  assert.equal(startedOnly.counts.eligibleCompletedIntegratedUsefulTerraTasks, 0);
  const completedWithoutIntegrationChild = { id: "child-completed-without-integration", completedAt: "later" };
  const completedWithoutIntegration = record("completed-without-integration", { child: completedWithoutIntegrationChild });
  const completedOnly = report.summarize([{ state: completedWithoutIntegration.state, directory: completedWithoutIntegration.directory }], { limit: 20,
    observeProfile: () => ({ status: "runtime-correlated", model: "gpt-6.1-terra", effort: "medium" }) });
  assert.equal(completedOnly.counts.eligibleTerraCalledTasks, 1);
  assert.equal(completedOnly.counts.eligibleCompletedIntegratedUsefulTerraTasks, 0,
    "completion without exact integration evidence cannot pass the useful-work target");
  assert.equal(completedOnly.status, "no-data");
  assert.equal(completedOnly.terraStatus, "under-target");
  const acceptedEvidence = report.summarize([{ state: useful.state, directory: useful.directory }], { limit: 20,
    observeProfile: child => observers.get(child.id) });
  assert.equal(acceptedEvidence.status, "no-data");
  assert.equal(acceptedEvidence.terraStatus, "pass", "a correlated completed child with exact integration evidence passes the historical Terra target");
  assert.equal(acceptedEvidence.counts.eligibleTerraCalledTasks, 1);
  assert.equal(acceptedEvidence.counts.eligibleCompletedIntegratedUsefulTerraTasks, 1);
  assert.deepEqual(snapshot, records.map(x => [x.directory, fs.readdirSync(x.directory).sort().join(","), fs.statSync(x.directory).mtimeMs]), "report must not modify ledger files");
  assert(!JSON.stringify(output).includes("PRIVATE TASK PROMPT"), "private task prompt must not appear in report");
  assert.equal(report.summarize([], { limit: 20, observeProfile: () => ({ status: "model-unverified" }) }).status, "no-data");
  const noEligible = report.summarize([{ state: skipped.state, directory: skipped.directory }], { limit: 20, observeProfile: child => observers.get(child.id) });
  assert.equal(noEligible.status, "no-data", "Terra calls on skipped requests cannot create eligible work");
  assert.equal(noEligible.coverage.allRequestShare.terraCalled.rate, 1);
  const corruptWindowShare = report.summarize([{ state: useful.state, directory: useful.directory }], { limit: 20, analyzedCount: 2,
    errors: ["invalid-or-missing-request-state"], observeProfile: child => observers.get(child.id) });
  assert.deepEqual(corruptWindowShare.coverage.allRequestShare.terraCalled, { numerator: 1, denominator: 2, rate: 0.5 },
    "malformed selected requests remain in the all-request share denominator");
  assert.equal(corruptWindowShare.status, "incomplete");
  const noModelChild = { id: "child-no-model", completedAt: "later" };
  const noModel = record("no-model", { child: noModelChild });
  const noModelReport = report.summarize([{ state: noModel.state, directory: noModel.directory }], { limit: 20,
    observeProfile: () => ({ status: "runtime-correlated", model: "" }) });
  assert.equal(noModelReport.counts.terraCalledRequests, 0, "empty model metadata cannot receive Terra credit");
  const legacy = report.summarize([{ state: useful.state, directory: useful.directory }], { limit: 20, observeProfile: () => ({ status: "runtime-correlated", model: "gpt-6-luna", effort: "high" }) });
  assert.equal(legacy.counts.lunaCalledRequests, 1);
  assert.equal(legacy.counts.terraCalledRequests, 0, "historical Luna is not Terra coverage");
  const missingEffort = report.summarize([{ state: useful.state, directory: useful.directory }], { limit: 20, observeProfile: () => ({ status: "runtime-correlated", model: "gpt-6.1-terra" }) });
  assert.equal(missingEffort.counts.terraCalledRequests, 0);
  assert.equal(missingEffort.counts.runtimeUnverifiedRequests, 1);
  for (const effort of ["unverified", "invalid", "", null]) {
    const invalid = report.summarize([{ state: useful.state, directory: useful.directory }], { limit: 20, observeProfile: () => ({ status: "runtime-correlated", model: "gpt-6.1-terra", effort }) });
    assert.equal(invalid.counts.terraCalledRequests, 0);
    assert.equal(invalid.counts.runtimeUnverifiedRequests, 1);
  }
  const mixed = report.summarize([{ state: useful.state, directory: useful.directory }, { state: started.state, directory: started.directory }], { limit: 20, observeProfile: child => child.id === usefulChild.id ? { status: "runtime-correlated", model: "gpt-6-luna", effort: "high" } : observers.get(child.id) });
  assert.equal(mixed.schemaVersion, 2);
  assert.equal(mixed.counts.lunaCalledRequests, 1);
  assert.equal(mixed.counts.completedIntegratedUsefulLunaRequests, 1);
  assert.equal(mixed.counts.eligibleLunaCalledTasks, 1);
  assert.equal(mixed.counts.eligibleCompletedIntegratedUsefulLunaTasks, 1);
  assert.equal(mixed.counts.terraCalledRequests, 1);
  assert.equal(mixed.counts.completedIntegratedUsefulTerraRequests, 0);
  assert.deepEqual(mixed.coverage.eligibleLunaCalled, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.equal(mixed.coverage.allRequestShare.completedIntegratedUsefulLuna.rate, 0.5);
  const unfinishedLegacy = report.summarize([{ state: started.state, directory: started.directory }], { limit: 20, observeProfile: () => ({ status: "runtime-correlated", model: "gpt-6-luna", effort: "high" }) });
  assert.equal(unfinishedLegacy.counts.unfinishedLunaCalls, 1);
  const legacyState = { ...useful.state, preferredWorkerProfile: { model: "gpt-6-luna", effort: "high" } };
  const oldAndNew = report.summarize([{ state: legacyState, directory: useful.directory }, { state: started.state, directory: started.directory }], { limit: 20, observeProfile: () => ({ status: "runtime-correlated", model: "gpt-6-luna", effort: "high" }) });
  assert.equal(oldAndNew.counts.eligibleTasks, 2);
  assert.equal(oldAndNew.counts.eligibleLegacyLunaTasks, 1);
  assert.equal(oldAndNew.counts.eligibleTerraTasks, 1);
  assert.equal(oldAndNew.coverage.eligibleTerraCalled.denominator, 1);
  assert.equal(oldAndNew.status, "pass", "current-preferred Luna work uses its own denominator");
  assert.equal(oldAndNew.terraStatus, "under-target", "Terra history remains gated by Terra-preferred request snapshots");
  const oldOnly = report.summarize([{ state: legacyState, directory: useful.directory }], { limit: 20, observeProfile: () => ({ status: "runtime-correlated", model: "gpt-6-luna", effort: "high" }) });
  assert.equal(oldOnly.status, "pass");
  assert.equal(oldOnly.counts.completedIntegratedUsefulLunaRequests, 1);
  assert.equal(oldOnly.counts.eligiblePreferredNativeCompletedIntegratedUsefulTasks, 1);
  assert.equal(oldOnly.counts.eligibleOffloadedWorkTasks, 1);

  const externalCompleted = record("external-completed", { preferredProfile: { model: "gpt-6-luna", effort: "high" },
    fallback: { requestId: "external-completed", category: "external-host" } });
  const externalSubmitted = record("external-submitted", { preferredProfile: { model: "gpt-6-luna", effort: "high" },
    fallback: { requestId: "external-submitted", category: "external-host" } });
  const externalUnverified = record("external-unverified", { preferredProfile: { model: "gpt-6-luna", effort: "high" },
    fallback: { requestId: "external-unverified", category: "external-host" } });
  const externalEvidence = new Map([
    ["external-completed", { requestId: "external-completed", state: "reported-completed-integrated", completedWorkCredit: true, providerVerification: "parent-inspected-host-response-claims", verifiedLuna: false, effectiveModel: null }],
    ["external-submitted", { requestId: "external-submitted", state: "submitted", completedWorkCredit: false, verifiedLuna: false, effectiveModel: null }],
    ["external-unverified", { requestId: "external-unverified", state: "unverified", completedWorkCredit: false, verifiedLuna: false, effectiveModel: null }],
  ]);
  const externalInspector = ({ state }) => externalEvidence.get(state.requestId);
  const externalAccepted = report.summarize([{ state: externalCompleted.state, directory: externalCompleted.directory }], {
    limit: 20, observeProfile: () => ({ status: "model-unverified" }), inspectExternalExecution: externalInspector,
  });
  assert.equal(externalAccepted.status, "pass", "inspected external completion can satisfy the current preferred-work target without filler Luna execution");
  assert.equal(externalAccepted.counts.eligibleExternalHostObservedTasks, 1);
  assert.equal(externalAccepted.counts.eligiblePreferredNativeCorrelatedTasks, 0);
  assert.equal(externalAccepted.counts.eligiblePreferredNativeCompletedIntegratedUsefulTasks, 0);
  assert.equal(externalAccepted.counts.eligibleOffloadedWorkTasks, 1, "a completed request receives one union credit");
  assert.equal(externalAccepted.counts.lunaCalledRequests, 0, "external execution never receives Luna credit");
  const dual = record("external-and-native", { preferredProfile: { model: "gpt-6-luna", effort: "high" },
    child: { id: "external-and-native-child", completedAt: "later" },
    integration: { requestId: "external-and-native", childId: "external-and-native-child", assignment: { scope: ["one bounded file"], acceptance: ["result passes criterion"] }, result: "Integrated the native child result against its exact assignment and acceptance." },
    fallback: { requestId: "external-and-native", category: "external-host" } });
  const dualEvidence = new Map(externalEvidence);
  dualEvidence.set("external-and-native", { requestId: "external-and-native", state: "reported-completed-integrated", completedWorkCredit: true, providerVerification: "parent-inspected-host-response-claims", verifiedLuna: false, effectiveModel: null });
  const dualReport = report.summarize([{ state: dual.state, directory: dual.directory }], {
    limit: 20, observeProfile: () => ({ status: "runtime-correlated", model: "gpt-6-luna", effort: "high" }),
    inspectExternalExecution: ({ state }) => dualEvidence.get(state.requestId),
  });
  assert.equal(dualReport.counts.eligiblePreferredNativeCompletedIntegratedUsefulTasks, 1);
  assert.equal(dualReport.counts.eligibleExternalHostObservedTasks, 1);
  assert.equal(dualReport.counts.eligibleOffloadedWorkTasks, 1, "native and external success on one request must not double-count the target");
  const externalPending = report.summarize([{ state: externalSubmitted.state, directory: externalSubmitted.directory }], {
    limit: 20, observeProfile: () => ({ status: "model-unverified" }), inspectExternalExecution: externalInspector,
  });
  assert.equal(externalPending.status, "under-target", "submission without completed integration receives no work credit");
  assert.equal(externalPending.counts.eligibleExternalHostSubmittedTasks, 1);
  assert.equal(externalPending.counts.eligibleOffloadedWorkTasks, 0);
  const externalUnknown = report.summarize([{ state: externalUnverified.state, directory: externalUnverified.directory }], {
    limit: 20, observeProfile: () => ({ status: "model-unverified" }), inspectExternalExecution: externalInspector,
  });
  assert.equal(externalUnknown.counts.eligibleExternalHostUnverifiedTasks, 1);
  assert.equal(externalUnknown.counts.eligibleOffloadUnverifiedTasks, 1);
  assert.equal(externalUnknown.counts.eligibleOffloadedWorkTasks, 0);
  assert.equal(externalUnknown.counts.runtimeUnverifiedRequests, 0, "unknown external provider evidence is not mislabeled as native runtime evidence");

  const invalidLuna = report.summarize([{ state: legacyState, directory: useful.directory }], { limit: 20,
    observeProfile: () => ({ status: "runtime-correlated", model: "gpt-6-luna", effort: "medium" }) });
  assert.equal(invalidLuna.counts.lunaCalledRequests, 1, "historical Luna call totals retain their serialized behavior");
  assert.equal(invalidLuna.counts.eligiblePreferredNativeCorrelatedTasks, 0, "a mismatched current Luna effort is rejected for preferred credit");
  assert.equal(invalidLuna.counts.eligiblePreferredNativeCompletedIntegratedUsefulTasks, 0);
  assert.equal(invalidLuna.counts.eligibleOffloadUnverifiedTasks, 1);
  const missingPreferredEffortState = { ...legacyState, preferredWorkerProfile: { model: "gpt-6-luna" } };
  const missingPreferredEffort = report.summarize([{ state: missingPreferredEffortState, directory: useful.directory }], { limit: 20,
    observeProfile: () => ({ status: "runtime-correlated", model: "gpt-6-luna", effort: "high" }) });
  assert.equal(missingPreferredEffort.status, "incomplete", "missing effort for the current preferred model is an unknown eligibility cohort");
  assert.equal(missingPreferredEffort.counts.eligibilityUnverifiedTasks, 1);
  assert.equal(missingPreferredEffort.counts.eligiblePreferredTasks, 0);
  assert.equal(missingPreferredEffort.counts.eligibleLegacyLunaTasks, 1, "the historical Luna cohort count remains intact");
  const unknownState = { ...useful.state };
  delete unknownState.preferredWorkerProfile;
  const unknownCohort = report.summarize([{ state: unknownState, directory: useful.directory }], { limit: 20, observeProfile: child => observers.get(child.id) });
  assert.equal(unknownCohort.status, "incomplete");
  assert.equal(unknownCohort.counts.eligibilityUnverifiedTasks, 1);
  assert.equal(unknownCohort.counts.eligibleTerraTasks, 0);
  assert.equal(noModelReport.counts.runtimeUnverifiedRequests, 1, "empty model metadata is surfaced as unverified");
  assert.equal(report.summarize([{ state: useful.state, directory: useful.directory }], { limit: 20, errors: ["invalid-or-missing-request-state"],
    observeProfile: child => observers.get(child.id) }).status, "incomplete", "errors prevent a clean pass");
  assert.equal(report.summarize(records.map(({ state, directory }) => ({ state, directory })), { limit: 1, observeProfile: () => ({ status: "model-unverified" }) }).counts.requests.analyzed, 1);
  const missingLedgerSession = policy.sessionRoot(root, "missing-ledger-session");
  fs.mkdirSync(missingLedgerSession, { recursive: true });
  const missingLedger = report.collect(root, "missing-ledger-session", 20, () => ({ status: "model-unverified" }));
  assert.equal(missingLedger.status, "incomplete");
  assert(missingLedger.errors.types.includes("request-ledger-missing"), "missing request ledger must be visible");

  const boundedSession = policy.sessionRoot(root, "bounded-session");
  const boundedRequests = path.join(boundedSession, "requests");
  const oldDir = path.join(boundedRequests, "old");
  const newDir = path.join(boundedRequests, "new");
  fs.mkdirSync(oldDir, { recursive: true });
  fs.mkdirSync(newDir, { recursive: true });
  fs.writeFileSync(path.join(oldDir, "request.json"), JSON.stringify(useful.state));
  // The older malformed record must not be loaded into a one-request window.
  fs.writeFileSync(path.join(newDir, "request.json"), "{ malformed");
  const boundedSnapshot = [oldDir, newDir].map(directory => ({
    entries: fs.readdirSync(directory).sort(),
    contents: fs.readdirSync(directory).sort().map(name => fs.readFileSync(path.join(directory, name), "utf8")),
    mtimeMs: fs.statSync(directory).mtimeMs
  }));
  const loaded = [];
  const bounded = report.collect(root, "bounded-session", 1, () => ({ status: "model-unverified" }), {
    statSync(file) { return { isDirectory: () => true, birthtimeMs: file === newDir ? 2 : 1, mtimeMs: 0 }; },
    loadState(...args) { loaded.push(args[1]); return policy.loadState(...args); }
  });
  assert.deepEqual(loaded, [path.join(newDir, "request.json")], "only the newest bounded request state is read");
  assert.equal(bounded.window.analyzed, 1);
  assert.equal(bounded.status, "incomplete", "selected malformed state remains visible");
  assert(bounded.errors.types.includes("invalid-or-missing-request-state"));
  assert.deepEqual(boundedSnapshot, [oldDir, newDir].map(directory => ({
    entries: fs.readdirSync(directory).sort(),
    contents: fs.readdirSync(directory).sort().map(name => fs.readFileSync(path.join(directory, name), "utf8")),
    mtimeMs: fs.statSync(directory).mtimeMs
  })), "bounded collection must remain read-only");
  console.log("Codex Terra delegation report: bounded counts, runtime-only dispatch, exact integration, fallback denominator, pending and unverified states, privacy, and read-only behavior passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
