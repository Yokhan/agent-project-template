"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const report = require("./codex-delegation-report.js");
const policy = require("./lib/codex-turn-policy.js");
const { sha256 } = require("./lib/writing-library-store.js");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-delegation-report-"));
function record(id, { required = true, delegationState = "required", reason = "bounded-contract", startedAt, child, profile, integration, fallback, result } = {}) {
  const directory = path.join(root, id);
  fs.mkdirSync(directory, { recursive: true });
  const state = { root: fs.realpathSync(root), sessionId: "native-session", requestId: id, startedAt: startedAt || "2026-10-24T10:00:00.000Z",
    task: "PRIVATE TASK PROMPT MUST NEVER APPEAR", delegation: { required, state: delegationState, reason } };
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

  const started = record("started", { child: { id: "child-started", startedAt: "now" }, profile: { status: "runtime-correlated", model: "gpt-6-luna", effort: "high" } });
  const usefulChild = { id: "child-useful", startedAt: "then", completedAt: "later" };
  const useful = record("useful", { startedAt: "2026-10-24T09:00:00.000Z", child: usefulChild,
    profile: { status: "runtime-correlated", model: "gpt-6-luna", effort: "high" },
    integration: { requestId: "useful", childId: usefulChild.id, assignment: { scope: ["one bounded file"], acceptance: ["result passes criterion"] }, result: "Integrated the child's result against the stated acceptance criterion." }, result: true });
  const mismatchedChild = { id: "child-mismatch", completedAt: "later" };
  const incompatible = record("incompatible", { startedAt: "2026-10-24T08:00:00.000Z", child: mismatchedChild,
    profile: { status: "runtime-correlated", model: "gpt-6-luna", effort: "high" },
    integration: { requestId: "another-request", childId: mismatchedChild.id, assignment: { scope: ["x"], acceptance: ["y"] }, result: "A sufficiently long result string that must not count." }, result: true });
  const fallback = record("fallback", { startedAt: "2026-10-24T07:00:00.000Z", fallback: { requestId: "fallback" } });
  const unknown = record("unknown", { startedAt: "2026-10-24T06:00:00.000Z", child: { id: "child-unknown" }, profile: { status: "model-unverified" } });
  const parent = record("parent", { required: false, delegationState: "parent-owned", reason: "unrelated-reason", startedAt: "2026-10-24T05:00:00.000Z", result: true });
  const skippedChild = { id: "child-skip", completedAt: "later" };
  const skipped = record("skip", { required: false, delegationState: "skip", reason: "unrelated-reason", startedAt: "2026-10-24T04:00:00.000Z", child: skippedChild,
    profile: { status: "runtime-correlated", model: "gpt-6-luna", effort: "high" },
    integration: { requestId: "skip", childId: skippedChild.id, assignment: { scope: ["bounded skipped work"], acceptance: ["valid evidence"] }, result: "This integrated result belongs to a skipped, ineligible task." }, result: true });
  const records = [started, useful, incompatible, fallback, unknown, parent, skipped];
  const observers = new Map(records.filter(x => x.profile).flatMap(x => {
    const childId = fs.existsSync(path.join(x.directory, "children")) ? fs.readdirSync(path.join(x.directory, "children")).map(file => policy.readJson(path.join(x.directory, "children", file)).id)[0] : null;
    return childId ? [[childId, x.profile]] : [];
  }));
  const snapshot = records.map(x => [x.directory, fs.readdirSync(x.directory).sort().join(","), fs.statSync(x.directory).mtimeMs]);
  const output = report.summarize(records.map(({ state, directory }) => ({ state, directory })), { limit: 20, totalInLedger: 7,
    observeProfile: child => observers.get(child.id) || { status: "model-unverified" } });
  assert.equal(output.status, "pass");
  assert.equal(output.counts.requests.totalInLedger, 7);
  assert.equal(output.counts.eligibleTasks, 5, "fallback stays in the eligible denominator");
  assert.equal(output.counts.lunaCalledRequests, 4, "started runtime-correlated Luna call counts as dispatch");
  assert.equal(output.counts.completedIntegratedUsefulLunaRequests, 2, "exact integration is counted even for ineligible work");
  assert.equal(output.counts.eligibleLunaCalledTasks, 3, "skipped request must not inflate eligible coverage");
  assert.equal(output.counts.eligibleCompletedIntegratedUsefulLunaTasks, 1);
  assert.deepEqual(output.coverage.eligibleLunaCalled, { numerator: 3, denominator: 5, rate: 0.6 });
  assert.deepEqual(output.coverage.allRequestShare.lunaCalled, { numerator: 4, denominator: 7, rate: 4 / 7 });
  assert.deepEqual(output.coverage.allRequestShare.completedIntegratedUsefulLuna, { numerator: 2, denominator: 7, rate: 2 / 7 });
  assert.equal(output.counts.pendingRequests, 3);
  assert.equal(output.counts.unfinishedLunaCalls, 1);
  assert.equal(output.counts.fallbackRequests, 1);
  assert.equal(output.counts.runtimeUnverifiedRequests, 1);
  assert.equal(output.counts.exclusions.parentOwned, 1);
  assert.equal(output.counts.exclusions.skip, 1);
  assert.deepEqual(snapshot, records.map(x => [x.directory, fs.readdirSync(x.directory).sort().join(","), fs.statSync(x.directory).mtimeMs]), "report must not modify ledger files");
  assert(!JSON.stringify(output).includes("PRIVATE TASK PROMPT"), "private task prompt must not appear in report");
  assert.equal(report.summarize([], { limit: 20, observeProfile: () => ({ status: "model-unverified" }) }).status, "no-data");
  const noEligible = report.summarize([{ state: skipped.state, directory: skipped.directory }], { limit: 20, observeProfile: child => observers.get(child.id) });
  assert.equal(noEligible.status, "no-data", "Luna calls on skipped requests cannot create eligible work");
  assert.equal(noEligible.coverage.allRequestShare.lunaCalled.rate, 1);
  const corruptWindowShare = report.summarize([{ state: useful.state, directory: useful.directory }], { limit: 20, analyzedCount: 2,
    errors: ["invalid-or-missing-request-state"], observeProfile: child => observers.get(child.id) });
  assert.deepEqual(corruptWindowShare.coverage.allRequestShare.lunaCalled, { numerator: 1, denominator: 2, rate: 0.5 },
    "malformed selected requests remain in the all-request share denominator");
  assert.equal(corruptWindowShare.status, "incomplete");
  const noModelChild = { id: "child-no-model", completedAt: "later" };
  const noModel = record("no-model", { child: noModelChild });
  const noModelReport = report.summarize([{ state: noModel.state, directory: noModel.directory }], { limit: 20,
    observeProfile: () => ({ status: "runtime-correlated", model: "" }) });
  assert.equal(noModelReport.counts.lunaCalledRequests, 0, "empty model metadata cannot receive Luna credit");
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
  console.log("Codex Luna delegation report: bounded counts, runtime-only dispatch, exact integration, fallback denominator, pending and unverified states, privacy, and read-only behavior passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
