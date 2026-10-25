"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { sha256 } = require("./lib/writing-library-store.js");
const policy = require("./lib/codex-turn-policy.js");
const outcomes = require("./lib/outcome-acceptance.js");
const { run } = require("./codex-turn.js");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-acceptance-"));
function write(relative, contents) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  return file;
}
function digest(relative) { return sha256(fs.readFileSync(path.join(root, relative))); }
function makeEvidence(requestId, task, extra = {}) {
  return {
    schemaVersion: 1,
    requestId,
    originalScenario: { taskSha256: sha256(task), description: "A new visitor needs to confirm the requested service." },
    expectedOutcome: "The visitor sees the promised, confirmed result on the selected surface.",
    factSources: [{ ref: "facts/product.md", sha256: digest("facts/product.md") }],
    target: { surface: "served booking page", environment: "staging desktop browser 1440x900" },
    artifacts: [
      { role: "source", path: "src/page.js", sha256: digest("src/page.js") },
      { role: "built", path: "dist/page.js", sha256: digest("dist/page.js") },
    ],
    evidence: [],
    gaps: [],
    ...extra,
  };
}
function request() {
  const task = "Improve the booking page for new visitors and verify the confirmed result.";
  const started = policy.startRequest(root, { session_id: "outcome-session", turn_id: `outcome-turn-${cryptoId++}`, prompt: task }, {
    workflowDepth: "routed", delegationDecision: { required: false, state: "skip", reason: "outcome-test" },
  });
  return { task, ...started };
}
let cryptoId = 0;

try {
  write("facts/product.md", "The booking is confirmed only after a time is assigned.");
  write("src/page.js", "source-v1");
  write("dist/page.js", "built-v1");
  write("evidence/deploy.json", JSON.stringify({ provider: "release-host", tag: "v1.2.3", commit: "abc123", url: "https://example.test/releases/v1.2.3" }));
  write("evidence/render.png", Buffer.from([1, 2, 3, 4]));
  write("evidence/install.json", "installation observation");
  write("evidence/active.json", "active runtime observation");

  const record = request();
  const receiptOnly = makeEvidence(record.state.requestId, record.task, {
    evidence: [{ kind: "publication-receipt", ref: "evidence/deploy.json", sha256: digest("evidence/deploy.json"), provider: "release-host",
      tag: "v1.2.3", commit: "abc123", url: "https://example.test/releases/v1.2.3",
      surface: "served booking page", environment: "staging desktop browser 1440x900",
      sourceSha256: digest("src/page.js"), builtSha256: digest("dist/page.js") }],
  });
  const inputFile = write("receipt-only.json", JSON.stringify(receiptOnly));
  const recorded = run(["record-outcome", "--state", record.file, "--result", inputFile], root);
  assert.equal(recorded.statuses.source.status, "current");
  assert.equal(recorded.statuses.built.status, "current");
  assert.equal(recorded.statuses.published.status, "evidence-recorded", "a matching local receipt records publication evidence without proving remote publication");
  assert.equal(recorded.statuses.rendered.status, "unknown", "publication evidence does not prove the target rendered");
  assert(recorded.gaps.some(item => item.code === "rendered-observation-missing"));
  assert.match(recorded.summary, /does not establish semantic quality/u);
  assert.deepEqual(run(["outcome-status", "--state", record.file], root), recorded, "status rereads the request-bound record without changing its meaning");

  const wrongRecord = policy.startRequest(root, { session_id: "outcome-session", turn_id: "wrong-target", prompt: record.task }, {
    workflowDepth: "routed", delegationDecision: { required: false, state: "skip", reason: "outcome-test" },
  });
  const wrongSurface = makeEvidence(wrongRecord.state.requestId, record.task, {
    evidence: [{ kind: "render-observation", ref: "evidence/render.png", sha256: digest("evidence/render.png"),
      surface: "Storybook component", environment: "Storybook local desktop",
      sourceSha256: digest("src/page.js"), builtSha256: digest("dist/page.js") }],
  });
  const wrongResult = outcomes.recordOutcome(root, wrongRecord.file, write("wrong-surface.json", JSON.stringify(wrongSurface)));
  assert.equal(wrongResult.statuses.rendered.status, "unknown");
  assert(wrongResult.gaps.some(item => item.code === "evidence-target-mismatch"));

  const storybookRecord = policy.startRequest(root, { session_id: "outcome-session", turn_id: "storybook-target", prompt: record.task }, {
    workflowDepth: "routed", delegationDecision: { required: false, state: "skip", reason: "outcome-test" },
  });
  const storybookEvidence = makeEvidence(storybookRecord.state.requestId, record.task, {
    target: { surface: "Storybook component", environment: "Storybook local desktop", modality: "ui" },
    evidence: [{ kind: "render-observation", ref: "evidence/render.png", sha256: digest("evidence/render.png"),
      surface: "Storybook component", environment: "Storybook local desktop",
      sourceSha256: digest("src/page.js"), builtSha256: digest("dist/page.js") }],
  });
  const storybookResult = outcomes.recordOutcome(root, storybookRecord.file, write("storybook.json", JSON.stringify(storybookEvidence)));
  assert.equal(storybookResult.statuses.rendered.status, "evidence-recorded");
  assert.equal(storybookResult.statuses.published.status, "unknown", "a Storybook render cannot establish publication");

  const missingFacts = makeEvidence(record.state.requestId, record.task, { factSources: [] });
  const missingFactResult = outcomes.recordOutcome(root, record.file, write("missing-facts.json", JSON.stringify(missingFacts)));
  assert(missingFactResult.gaps.some(item => item.code === "product-fact-sources-missing"));

  const activeEvidence = makeEvidence(record.state.requestId, record.task, {
    evidence: [
      { kind: "render-observation", ref: "evidence/render.png", sha256: digest("evidence/render.png"), surface: "served booking page",
        environment: "staging desktop browser 1440x900", sourceSha256: digest("src/page.js"), builtSha256: digest("dist/page.js") },
      { kind: "installation-observation", ref: "evidence/install.json", sha256: digest("evidence/install.json"), surface: "served booking page",
        environment: "staging desktop browser 1440x900", sourceSha256: digest("src/page.js"), builtSha256: digest("dist/page.js") },
      { kind: "active-observation", ref: "evidence/active.json", sha256: digest("evidence/active.json"), surface: "served booking page",
        environment: "staging desktop browser 1440x900", sourceSha256: digest("src/page.js"), builtSha256: digest("dist/page.js") },
    ],
  });
  outcomes.recordOutcome(root, record.file, write("active-evidence.json", JSON.stringify(activeEvidence)));
  assert.equal(outcomes.outcomeStatus(root, record.file).statuses.active.status, "evidence-recorded");
  write("src/page.js", "source-v2");
  const stale = outcomes.outcomeStatus(root, record.file);
  assert.equal(stale.statuses.source.status, "stale");
  assert.equal(stale.statuses.active.status, "stale", "a changed source fingerprint invalidates its linked activation evidence");
  assert(stale.gaps.some(item => item.code === "source-artifact-stale"));

  const staleActivation = makeEvidence(record.state.requestId, record.task, {
    evidence: [{ kind: "active-observation", ref: "evidence/active.json", sha256: digest("evidence/active.json"),
      surface: "served booking page", environment: "staging desktop browser 1440x900",
      sourceSha256: digest("src/page.js"), builtSha256: "0".repeat(64) }],
  });
  const staleActivationResult = outcomes.recordOutcome(root, record.file, write("stale-activation.json", JSON.stringify(staleActivation)));
  assert.equal(staleActivationResult.statuses.active.status, "stale", "an activation receipt tied to an obsolete build hash is not current");

  write("scripts/task.js", "console.log('hello')");
  write("evidence/native.json", "native script was activated");
  const nativeRecord = policy.startRequest(root, { session_id: "outcome-session", turn_id: "native-script", prompt: record.task }, {
    workflowDepth: "routed", delegationDecision: { required: false, state: "skip", reason: "outcome-test" },
  });
  const nativeEvidence = makeEvidence(nativeRecord.state.requestId, record.task, {
    target: { surface: "native maintenance script", environment: "Windows PowerShell", modality: "native-script" },
    artifacts: [{ role: "source", path: "scripts/task.js", sha256: digest("scripts/task.js") }],
    evidence: [{ kind: "active-observation", ref: "evidence/native.json", sha256: digest("evidence/native.json"),
      surface: "native maintenance script", environment: "Windows PowerShell",
      sourceSha256: digest("scripts/task.js"), builtSha256: null }],
  });
  const nativeResult = outcomes.recordOutcome(root, nativeRecord.file, write("native-script.json", JSON.stringify(nativeEvidence)));
  assert.equal(nativeResult.statuses.built.status, "not-applicable");
  assert.equal(nativeResult.statuses.active.status, "evidence-recorded", "native script evidence does not need a fabricated build hash");

  assert.throws(() => outcomes.recordOutcome(root, record.file, write("wrong-request.json", JSON.stringify({ ...receiptOnly, requestId: "another-request" }))), /requestId/u);
  assert.throws(() => outcomes.recordOutcome(root, record.file, write("escape.json", JSON.stringify({ ...receiptOnly, artifacts: [{ role: "source", path: "../outside", sha256: digest("src/page.js") }] }))), /escapes project/u);
  console.log("Outcome acceptance: request binding, publication/render separation, Storybook target matching, interpreted no-build evidence, stale fingerprints, fact gaps, and optional status passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
