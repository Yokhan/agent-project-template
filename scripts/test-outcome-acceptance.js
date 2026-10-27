"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { sha256 } = require("./lib/writing-library-store.js");
const policy = require("./lib/codex-turn-policy.js");
const outcomes = require("./lib/outcome-acceptance.js");
const handoffs = require("./lib/task-wave-handoff.js");
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

function runHandoffOnly({ boundaryOnly = false } = {}) {
  if (!boundaryOnly) runHandoffIntentOnly();
  write(".claude/library/process/task-wave-handoff.schema.json", fs.readFileSync(path.join(__dirname, "../.claude/library/process/task-wave-handoff.schema.json")));
  const baselineBytes = JSON.stringify({ revision: "goal-r4", outcomes: ["independent", "auth", "dependent", "accepted-unshipped"] });
  write("evidence/goal-baseline.json", baselineBytes);
  write("tasks/identity-gate.md", "Auth gate remains open pending identity owner evidence.");
  write("tasks/booking-flow.md", "Authenticated booking waits on the identity gate.");
  write("tasks/repeat-state.md", "Repeat visitor state is accepted but not shipped.");
  write("evidence/auth-api-compatibility.json", "Existing identity API contract is compatible with this release.");
  write("evidence/schema-blocker.json", "Booking schema v2 migration remains blocked.");
  const qaDiagnosticBytes = JSON.stringify({ kind: "qa-compiled-provenance-repair-integration-v1", focusedRun: { commandExitCode: 0, wrapperExitCode: 1, rawReceipt: "runs/focused.json" },
    fullPureAdmissionRegression: { commandExitCode: 0, wrapperExitCode: 1, actualValidatorCalled: "validate_owner_admission" },
    priorTestFailure: { commandExitCode: 1, wrapperExitCode: 1, cause: "test assertion mismatch" } });
  const qaDiagnostic = write("evidence/qa-diagnostic.json", qaDiagnosticBytes);
  assert.equal(fs.readFileSync(qaDiagnostic, "utf8"), qaDiagnosticBytes, "producer-owned nested diagnostic bytes are preserved without schema rewriting");
  assert.equal(JSON.parse(fs.readFileSync(qaDiagnostic, "utf8")).focusedRun.commandExitCode, 0);
  assert.equal(JSON.parse(fs.readFileSync(qaDiagnostic, "utf8")).focusedRun.wrapperExitCode, 1);
  const releaseBytes = JSON.stringify({ release: { acceptedCandidate: { version: "v1", target: "served booking page", urls: ["https://example.test/releases/v1"] }, receipt: "owner-attested release acceptance" },
    priorDiagnostics: { ref: "evidence/qa-diagnostic.json", sha256: sha256(qaDiagnosticBytes) } });
  const receipt = write("evidence/release.json", releaseBytes);
  const evidence = write("evidence/booking-observation.json", JSON.stringify({ result: "booking confirmed", surface: "served booking page" }));
  const evidenceHash = digest("evidence/booking-observation.json");
  const fixture = () => ({
    schemaVersion: 1,
    status: "CLOSED_WITH_CARRYOVER",
    goal: {
      original: "Visitors can complete the booking journey.", owner: "Booking team", scope: "Current booking wave",
      scopeOutcomeIds: ["independent"],
      baseline: { revision: "goal-r4", source: { ref: "evidence/goal-baseline.json", sha256: digest("evidence/goal-baseline.json") }, outcomes: [
        { id: "independent", description: "Show confirmed booking", surface: "served booking page", environment: "staging browser" },
        { id: "auth", description: "Authenticate safely", surface: "served booking page", environment: "staging browser" },
        { id: "dependent", description: "Complete authenticated booking", surface: "served booking page", environment: "staging browser", dependencies: ["auth"] },
        { id: "accepted-unshipped", description: "Preserve repeat visitor state", surface: "served booking page", environment: "staging browser" },
      ] },
    },
    workPerformed: [{ description: "Shipped independent confirmation UI and inspected the booking flow.", evidence: [{ ref: "evidence/qa-diagnostic.json", sha256: digest("evidence/qa-diagnostic.json"), kind: "test-result", surface: "template verification record", environment: "local QA report" }] }],
    acceptedOutcomes: [{ outcomeId: "independent", evidence: [{ ref: "evidence/booking-observation.json", sha256: evidenceHash, kind: "functional-observation", surface: "served booking page", environment: "staging browser" }] },
      { outcomeId: "accepted-unshipped", evidence: [{ ref: "evidence/booking-observation.json", sha256: evidenceHash, kind: "functional-observation", surface: "served booking page", environment: "staging browser" }] }],
    shippedUnits: [{ id: "booking-confirmation-v1", outcomeIds: ["independent"], target: "served booking page", urls: ["https://example.test/releases/v1"], version: "v1", releaseReceipt: { ref: "evidence/release.json", sha256: digest("evidence/release.json") }, dependencies: [{ kind: "auth", id: "existing-identity-api", status: "compatible", evidence: { ref: "evidence/auth-api-compatibility.json", sha256: digest("evidence/auth-api-compatibility.json") } }] }],
    remaining: [
      { outcomeId: "auth", owner: "Identity owner", impact: "Users cannot authenticate", severity: "critical", dependencies: [], evidence: [{ ref: "tasks/identity-gate.md", sha256: digest("tasks/identity-gate.md") }] },
      { outcomeId: "dependent", owner: "Booking team", impact: "Authenticated flow is unavailable", severity: "high", dependencies: ["auth"], evidence: [{ ref: "tasks/booking-flow.md", sha256: digest("tasks/booking-flow.md") }] },
      { outcomeId: "accepted-unshipped", owner: "Booking team", impact: "Repeat state is not in the release", severity: "medium", dependencies: [], evidence: [{ ref: "tasks/repeat-state.md", sha256: digest("tasks/repeat-state.md") }] },
    ],
    nextWave: {
      selected: ["auth", "dependent", "accepted-unshipped"], deferred: [],
      carryoverRefs: [
        { outcomeId: "auth", ref: { ref: "tasks/identity-gate.md", sha256: digest("tasks/identity-gate.md") } },
        { outcomeId: "dependent", ref: { ref: "tasks/booking-flow.md", sha256: digest("tasks/booking-flow.md") } },
        { outcomeId: "accepted-unshipped", ref: { ref: "tasks/repeat-state.md", sha256: digest("tasks/repeat-state.md") } },
      ],
      why: "Resolve the shared identity dependency before completing its dependent flow.",
      nextAction: { owner: "Identity owner", action: "Confirm auth contract and provide a staging observation." },
    },
  });
  const record = request();
  const good = fixture();
  const validated = handoffs.validateHandoff(good, { root });
  assert.equal(validated.valid, true, validated.issues.map((item) => `${item.code} ${item.field}`).join("; "));
  assert.deepEqual([validated.progress.accepted, validated.progress.shipped, validated.progress.total], [2, 1, 4]);
  assert.equal(good.goal.baseline.outcomes.some((item) => item.id === "existing-identity-api"), false, "an existing compatible auth dependency is evidenced without inflating the product denominator");
  assert.match(handoffs.formatProgress(validated.progress), /Accepted \[[#.]{10}\] 2\/4/u);

  assert(handoffs.validateHandoff(good, { root, requireExecution: true }).issues.some(item => item.code === "task-handoff-execution-required"));
  const wave = fixture();
  const planRef = { ref: "tasks/identity-gate.md", sha256: digest("tasks/identity-gate.md") };
  wave.execution = { planRef, waveRef: planRef, integrationOwner: "Parent", advisor: { availability: "available", reviewRef: planRef, disposition: "Parent assessed the bounded review." }, requestedScale: 3, placementReason: "Only two lanes currently placed", lanes: [
    { id: "a", owner: "Owner A", scope: "Owned source", status: "live", handle: "worker-a", evidence: planRef },
    { id: "b", owner: "Owner B", scope: "Independent review", status: "unverified" },
  ] };
  const waveResult = handoffs.validateHandoff(wave, { root, requireExecution: true });
  assert.equal(waveResult.valid, true, JSON.stringify(waveResult.issues));
  assert.deepEqual(waveResult.executionCounts, { plannedTotal: 2, requestedScale: 3, planned: 0, accepted: 0, live: 1, settled: 0, blocked: 0, unverified: 1 });
  assert.match(handoffs.formatProgress(waveResult.progress), /planned total 2; requested 3; planned 0, accepted 0, live 1, settled 0/);
  assert.doesNotMatch(handoffs.formatProgress(validated.progress), /Lanes:/);
  const missingAdvisor = structuredClone(wave); delete missingAdvisor.execution.advisor;
  assert(handoffs.validateHandoff(missingAdvisor, { root, requireExecution: true }).issues.some(item => item.code === "task-handoff-advisor-required"));
  assert(handoffs.validateHandoff(missingAdvisor, { root }).valid, "legacy handoff remains valid without advisor");
  const missingReview = structuredClone(wave); delete missingReview.execution.advisor.reviewRef;
  assert(handoffs.validateHandoff(missingReview, { root, requireExecution: true }).issues.some(item => item.code === "task-handoff-advisor-review-required"));
  const unknownAdvisor = structuredClone(wave); unknownAdvisor.execution.advisor = { availability: "unverified" };
  assert(handoffs.validateHandoff(unknownAdvisor, { root, requireExecution: true }).issues.some(item => item.code === "task-handoff-advisor-reason-required"));
  unknownAdvisor.execution.advisor.reason = "Host availability was not observable.";
  assert(handoffs.validateHandoff(unknownAdvisor, { root, requireExecution: true }).valid);
  const noDispatch = structuredClone(wave); delete noDispatch.execution.lanes[0].evidence;
  assert(handoffs.validateHandoff(noDispatch, { root }).issues.some(item => item.code === "task-handoff-execution-dispatch-evidence"));
  const duplicateLane = structuredClone(wave); duplicateLane.execution.lanes[1].id = "a";
  assert(handoffs.validateHandoff(duplicateLane, { root }).issues.some(item => item.code === "task-handoff-execution-duplicate-lane"));
  const noPlacement = structuredClone(wave); delete noPlacement.execution.placementReason;
  assert(handoffs.validateHandoff(noPlacement, { root }).issues.some(item => item.code === "task-handoff-execution-placement"));
  const stalePlan = structuredClone(wave); stalePlan.execution.planRef.sha256 = "0".repeat(64);
  assert(handoffs.validateHandoff(stalePlan, { root }).issues.some(item => item.code === "task-handoff-evidence-stale"));
  const fractional = structuredClone(wave); fractional.execution.requestedScale = 1.5;
  assert(handoffs.validateHandoff(fractional, { root }).issues.some(item => item.code === "task-handoff-schema"));
  const externalCountedProof = fixture();
  externalCountedProof.acceptedOutcomes[0].evidence[0].ref = "https://example.test/booking-observation.json";
  const externalCountedProofResult = handoffs.validateHandoff(externalCountedProof, { root });
  assert(externalCountedProofResult.issues.some((item) => item.code === "task-handoff-evidence-reference" && item.field === "acceptedOutcomes[0].evidence[0].ref"), "external URLs cannot be counted as hash-verified acceptance evidence");
  assert.equal(externalCountedProofResult.progress.accepted, 1, "unverified external proof is excluded from accepted outcome counts");

  const originalOpenSync = fs.openSync;
  let specialTypeOpenCalls = 0;
  fs.openSync = function (...args) { specialTypeOpenCalls++; return originalOpenSync.apply(this, args); };
  try {
    assert.throws(() => handoffs.readBounded(path.join(root, "tasks"), 1024), /regular file/u, "non-file reference is refused before opening");
    assert.equal(specialTypeOpenCalls, 0, "special filesystem types are rejected before open can block");
  } finally { fs.openSync = originalOpenSync; }

  if (boundaryOnly) {
    const record = request();
    const artifactFile = write("final-boundary.txt", "Implemented the bounded file-reference checks and stored handoff boundary.");
    const handoffFile = write("handoff-boundary.json", JSON.stringify(good));
    assert.equal(handoffs.checkHandoff(record, fs.readFileSync(artifactFile, "utf8")).state, "missing", "only an absent receipt offers the recording command");
    run(["handoff", "--state", record.file, "--artifact", artifactFile, "--result", handoffFile], root);
    const originalBufferFrom = Buffer.from;
    let artifactCopies = 0;
    Buffer.from = function (...args) { artifactCopies++; return originalBufferFrom.apply(this, args); };
    try {
      const oversized = handoffs.checkHandoff(record, `Implemented ${"x".repeat(256 * 1024 + 1)}`);
      assert.equal(oversized.state, "unresolved");
      assert(oversized.issues.some((item) => item.code === "task-handoff-artifact-size"), "oversized final text gets a bounded size diagnostic");
      assert.equal(artifactCopies, 0, "oversized final text is rejected before allocating a full artifact buffer");
    } finally { Buffer.from = originalBufferFrom; }
    const receiptPath = path.join(path.dirname(record.file), "task-wave-handoff.json");
    fs.writeFileSync(receiptPath, '{"private":"receipt-private-sentinel"', "utf8");
    const corruptReceipt = handoffs.checkHandoff(record, fs.readFileSync(artifactFile, "utf8"));
    assert.equal(corruptReceipt.state, "unresolved");
    assert(corruptReceipt.issues.some((item) => item.code === "task-handoff-record-unreadable"), "corrupt stored receipt is distinguished from a missing handoff");
    assert.match(corruptReceipt.issues[0].message, /owner recovery/u);
    assert.doesNotMatch(JSON.stringify(corruptReceipt.issues), /receipt-private-sentinel/u, "corrupt receipt contents are never copied into diagnostics");
    assert.throws(() => run(["handoff", "--state", record.file, "--artifact", artifactFile, "--result", handoffFile], root), /existing-receipt-unreadable/u, "recording refuses to overwrite a corrupt receipt and explains recovery");
    assert.equal(fs.readFileSync(receiptPath, "utf8"), '{"private":"receipt-private-sentinel"', "corrupt receipt bytes remain preserved for owner recovery");
    console.log("Task-wave boundary: external proof rejected, non-file refused before open, oversized artifact unallocated, corrupt receipt preserved");
    return;
  }

  const badDependency = fixture();
  badDependency.acceptedOutcomes.push({ outcomeId: "dependent", evidence: [{ ref: "evidence/booking-observation.json", sha256: evidenceHash, kind: "functional-observation", surface: "served booking page", environment: "staging browser" }] });
  badDependency.shippedUnits.push({ id: "unsafe-dependent", outcomeIds: ["dependent"], target: "served booking page", urls: ["https://example.test/releases/v1"], version: "v1", releaseReceipt: { ref: "evidence/release.json", sha256: digest("evidence/release.json") }, dependencies: [] });
  badDependency.remaining = badDependency.remaining.filter((item) => item.outcomeId !== "dependent");
  badDependency.nextWave.selected = badDependency.nextWave.selected.filter((id) => id !== "dependent");
  badDependency.nextWave.carryoverRefs = badDependency.nextWave.carryoverRefs.filter((item) => item.outcomeId !== "dependent");
  assert(handoffs.validateHandoff(badDependency, { root }).issues.some((item) => item.code === "task-handoff-dependency-unshipped"), "critical shared dependency blocks only its dependent shipment");

  const blockedSchema = fixture();
  blockedSchema.shippedUnits.push({ id: "schema-blocked-repeat-state", outcomeIds: ["accepted-unshipped"], target: "served booking page", urls: ["https://example.test/releases/v1"], version: "v1", releaseReceipt: { ref: "evidence/release.json", sha256: digest("evidence/release.json") }, dependencies: [{ kind: "schema", id: "booking-schema-v2", status: "blocked", evidence: { ref: "evidence/schema-blocker.json", sha256: digest("evidence/schema-blocker.json") } }] });
  const blockedSchemaResult = handoffs.validateHandoff(blockedSchema, { root });
  assert(blockedSchemaResult.issues.some((item) => item.code === "task-handoff-shipped-dependency-incompatible"), "an incompatible shared schema blocks its dependent shipment");
  assert.equal(blockedSchemaResult.progress.shipped, 1, "the unrelated shipped unit remains delivered despite the blocked schema unit");

  const staleMap = fixture();
  staleMap.acceptedOutcomes[0].evidence[0].ref = "evidence/persona-map.json";
  write("evidence/persona-map.json", "old acceptance map");
  staleMap.acceptedOutcomes[0].evidence[0].sha256 = digest("evidence/persona-map.json");
  write("evidence/persona-map.json", "changed stale acceptance map");
  assert(handoffs.validateHandoff(staleMap, { root }).issues.some((item) => item.code === "task-handoff-evidence-stale"), "stale map hash cannot support accepted outcome");

  const imageOnly = fixture();
  imageOnly.acceptedOutcomes[0].evidence[0].kind = "artifact";
  assert(handoffs.validateHandoff(imageOnly, { root }).issues.some((item) => item.code === "task-handoff-live-evidence"), "artifact image/mockup cannot certify a live surface");

  const falsePercent = fixture();
  falsePercent.goal.baseline.outcomes[0].weight = 99;
  assert(handoffs.validateHandoff(falsePercent, { root }).issues.some((item) => item.code === "task-handoff-baseline-weights"), "mixed weights cannot manufacture a percentage denominator");
  const weighted = fixture();
  for (const item of weighted.goal.baseline.outcomes) item.weight = 1;
  const weightedBaseline = JSON.stringify({ revision: "goal-r4", outcomes: weighted.goal.baseline.outcomes.map((item) => ({ id: item.id, weight: item.weight })) });
  write("evidence/goal-baseline-weighted.json", weightedBaseline);
  weighted.goal.baseline.source = { ref: "evidence/goal-baseline-weighted.json", sha256: digest("evidence/goal-baseline-weighted.json") };
  const weightedProgress = handoffs.validateHandoff(weighted, { root }).progress;
  assert.match(handoffs.formatProgress(weightedProgress), /2\/4 outcomes; weight 2\/4/u, "weighted percentage names both outcome counts and weighted denominator");
  const noBaselineReason = fixture();
  noBaselineReason.goal.baseline.outcomes = [];
  noBaselineReason.goal.scopeOutcomeIds = [];
  assert(handoffs.validateHandoff(noBaselineReason, { root }).issues.some((item) => item.code === "task-handoff-baseline-required"), "missing denominator needs an explicit explanation");
  const noReceipt = fixture();
  delete noReceipt.shippedUnits[0].releaseReceipt.sha256;
  assert(handoffs.validateHandoff(noReceipt, { root }).issues.some((item) => item.code === "task-handoff-schema"), "a shipped claim needs a hash-bound release receipt reference");
  const duplicateNextAction = fixture();
  duplicateNextAction.nextWave.selected.push("auth");
  assert(handoffs.validateHandoff(duplicateNextAction, { root }).issues.some((item) => item.code === "task-handoff-schema"), "duplicate next-wave selections are rejected");
  const duplicateSelectedAndDeferred = fixture();
  duplicateSelectedAndDeferred.nextWave.deferred.push({ outcomeId: "auth", reason: "wait for identity contract" });
  assert(handoffs.validateHandoff(duplicateSelectedAndDeferred, { root }).issues.some((item) => item.code === "task-handoff-next-wave-state-conflict"), "one outcome cannot be both selected and deferred");
  const overBudget = fixture();
  for (let index = 0; index < 65; index++) {
    const ref = `evidence/ref-${index}.json`;
    write(ref, `bounded reference ${index}`);
    overBudget.acceptedOutcomes.push({ outcomeId: "independent", evidence: [{ ref, sha256: digest(ref), kind: "functional-observation", surface: "served booking page", environment: "staging browser" }] });
  }
  assert(handoffs.validateHandoff(overBudget, { root }).issues.some((item) => item.code === "task-handoff-reference-budget"), "validation refuses more than the bounded unique-reference budget");

  const noDenominator = fixture();
  noDenominator.status = "ITERATION_CLOSED";
  noDenominator.goal.baseline = { revision: "enabling-r1", outcomes: [], denominatorUnavailableReason: "This enabling checkpoint has no accepted user outcome denominator." };
  noDenominator.goal.scopeOutcomeIds = [];
  noDenominator.acceptedOutcomes = [];
  noDenominator.shippedUnits = [];
  noDenominator.remaining = [];
  noDenominator.nextWave.selected = [];
  noDenominator.nextWave.carryoverRefs = [];
  assert.equal(handoffs.validateHandoff(noDenominator, { root }).progress.available, false);
  assert.match(handoffs.formatProgress(handoffs.validateHandoff(noDenominator, { root }).progress), /unavailable/u);

  const artifactFile = write("final.txt", "Implemented independent booking confirmation; focused browser evidence and exact release receipt are recorded.");
  const handoffFile = write("handoff.json", JSON.stringify(good));
  const missing = handoffs.checkHandoff(record, fs.readFileSync(artifactFile, "utf8"));
  assert.equal(missing.state, "missing");
  assert.match(missing.issues[0].message, /codex-turn\.js handoff/u, "missing handoff diagnostic includes the repair command");
  const first = run(["handoff", "--state", record.file, "--artifact", artifactFile, "--result", handoffFile], root);
  assert.equal(first.repeated, false);
  const firstCheck = handoffs.checkHandoff(record, fs.readFileSync(artifactFile, "utf8"));
  assert.equal(firstCheck.state, "passed", firstCheck.issues.map((item) => `${item.code} ${item.field}`).join("; "));
  assert.equal(firstCheck.repeated, false);
  const second = run(["handoff", "--state", record.file, "--artifact", artifactFile, "--result", handoffFile], root);
  assert.equal(second.repeated, true, "same logical request and exact artifact are idempotent");
  assert.equal(handoffs.checkHandoff(record, fs.readFileSync(artifactFile, "utf8")).repeated, false, "hook evaluation deduplication belongs to the lifecycle owner");
  const changedBaseline = fixture();
  for (const item of changedBaseline.goal.baseline.outcomes) item.weight = 1;
  const changedBaselineBytes = JSON.stringify({ revision: "goal-r4", outcomes: changedBaseline.goal.baseline.outcomes.map((item) => ({ id: item.id, weight: item.weight })) });
  write("evidence/goal-baseline-reweighted.json", changedBaselineBytes);
  changedBaseline.goal.baseline.source = { ref: "evidence/goal-baseline-reweighted.json", sha256: digest("evidence/goal-baseline-reweighted.json") };
  const changedBaselineFile = write("changed-baseline.json", JSON.stringify(changedBaseline));
  assert.throws(() => run(["handoff", "--state", record.file, "--artifact", artifactFile, "--result", changedBaselineFile], root), /task-handoff-baseline-changed/u, "weights cannot silently move within the same logical request");
  write("evidence/booking-observation.json", "changed after acceptance record");
  assert(handoffs.checkHandoff(record, fs.readFileSync(artifactFile, "utf8")).issues.some((item) => item.code === "task-handoff-evidence-stale"), "changed proof invalidates the saved handoff");
  const changedArtifact = handoffs.checkHandoff(record, `${fs.readFileSync(artifactFile, "utf8")} changed`);
  assert.equal(changedArtifact.state, "unresolved", "different final bytes fail request/artifact binding");
  assert(changedArtifact.issues.some((item) => item.code === "task-handoff-artifact-mismatch"), "binding failure has a stable exact diagnostic");
  const originalBufferFrom = Buffer.from;
  let artifactCopies = 0;
  Buffer.from = function (...args) { artifactCopies++; return originalBufferFrom.apply(this, args); };
  try {
    const oversized = handoffs.checkHandoff(record, `Implemented ${"x".repeat(256 * 1024 + 1)}`);
    assert.equal(oversized.state, "unresolved");
    assert(oversized.issues.some((item) => item.code === "task-handoff-artifact-size"), "oversized final text gets a bounded size diagnostic");
    assert.equal(artifactCopies, 0, "oversized final text is rejected before allocating a full artifact buffer");
  } finally { Buffer.from = originalBufferFrom; }
  assert.equal(handoffs.checkHandoff({ state: { task: "status?" } }, "Implemented the substantive task and closed the change.").applicable, false, "mailbox/status pings skip lifecycle handoff");
  assert.equal(handoffs.checkHandoff({ state: { task: "You have 1 orchestration message. Run orca orchestration check" } }, "Completed a task.").applicable, false, "orchestration mailbox pings skip lifecycle handoff");
  assert.equal(handoffs.checkHandoff({ state: { task: "Fix a typo in a heading.", direct: true } }, "Fixed the typo in the heading.").applicable, false, "tiny direct fixes skip the full handoff schema");
  assert.equal(handoffs.checkHandoff({ state: { task: "Ship the approved product wave.", direct: true } }, "Released the approved wave with its owner-attested receipt.").applicable, true, "explicit wave/release closure remains applicable even on a direct route");
  const continuation = { state: { task: "Continue the current agreed task after a temporary capacity issue." } };
  assert.equal(handoffs.checkHandoff(continuation, "The task is still in progress; no closeout is claimed.").applicable, false, "continuation steering without closure does not require handoff");
  assert.equal(handoffs.checkHandoff(continuation, "Implemented the agreed feature, verified its release evidence, and closed the task.").applicable, false, "generic continuation without explicit substantive intent is skipped");
  const waveContinuation = { state: { task: "Continue and implement the booking feature in the current product wave." } };
  assert.equal(handoffs.checkHandoff(waveContinuation, "Implemented the product feature, verified its release evidence, and closed the wave.").applicable, true, "substantive continuation still requires a handoff when it claims completion");
  const receiptPath = path.join(path.dirname(record.file), "task-wave-handoff.json");
  write("evidence/booking-observation.json", JSON.stringify({ result: "booking confirmed", surface: "served booking page" }));
  fs.writeFileSync(receiptPath, '{"private":"receipt-private-sentinel"', "utf8");
  const corruptReceipt = handoffs.checkHandoff(record, fs.readFileSync(artifactFile, "utf8"));
  assert.equal(corruptReceipt.state, "unresolved");
  assert(corruptReceipt.issues.some((item) => item.code === "task-handoff-record-unreadable"), "corrupt stored receipt is distinguished from a missing handoff");
  assert.match(corruptReceipt.issues[0].message, /owner recovery/u);
  assert.doesNotMatch(JSON.stringify(corruptReceipt.issues), /receipt-private-sentinel/u, "corrupt receipt contents are never copied into diagnostics");
  assert.throws(() => run(["handoff", "--state", record.file, "--artifact", artifactFile, "--result", handoffFile], root), /existing-receipt-unreadable/u, "recording refuses to overwrite a corrupt receipt and explains recovery");
  assert.equal(fs.readFileSync(receiptPath, "utf8"), '{"private":"receipt-private-sentinel"', "corrupt receipt bytes remain preserved for owner recovery");
  console.log("Task-wave handoff: partial delivery, dependency-scoped shipment, accepted-but-unshipped carryover, evidence hash/target checks, truthful denominator/status, exact artifact binding, idempotence, and mailbox skip passed");
}

function runHandoffNoDenominatorOnly() {
  write(".claude/library/process/task-wave-handoff.schema.json", fs.readFileSync(path.join(__dirname, "../.claude/library/process/task-wave-handoff.schema.json")));
  const blockerBytes = "Source review found a preexisting defect at the private path; no product outcome denominator was declared.";
  write("evidence/source-ready-defect.md", blockerBytes);
  const blockerEvidence = { ref: "evidence/source-ready-defect.md", sha256: sha256(blockerBytes) };
  const carryover = write("tasks/source-defect-owner.md", "Owner: source maintainer. Impact: existing validation defect remains unresolved.");
  const carryoverEvidence = { ref: "tasks/source-defect-owner.md", sha256: digest("tasks/source-defect-owner.md") };
  const fixture = () => ({
    schemaVersion: 1,
    status: "CLOSED_WITH_CARRYOVER",
    goal: {
      original: "Preserve the actual source-ready target and disclose unresolved blockers.",
      owner: "Template maintainer",
      scope: "Source readiness review",
      scopeOutcomeIds: [],
      baseline: { revision: "source-ready-r1", outcomes: [], denominatorUnavailableReason: "This source-only closeout has no meaningful product outcome denominator." },
    },
    workPerformed: [{ description: "Reviewed source readiness and retained the known blocker with its owner.", evidence: [{ ...blockerEvidence, kind: "test-result", surface: "source review", environment: "local" }] }],
    acceptedOutcomes: [],
    shippedUnits: [],
    remaining: [{ outcomeId: "preexisting-source-defect", owner: "Source maintainer", impact: "The existing validator defect remains unresolved.", severity: "high", dependencies: [], evidence: [carryoverEvidence] }],
    nextWave: {
      selected: ["preexisting-source-defect"], deferred: [],
      carryoverRefs: [{ outcomeId: "preexisting-source-defect", ref: carryoverEvidence }],
      why: "Preserve the independently confirmed source blocker for its owner.",
      nextAction: { owner: "Source maintainer", action: "Repair the validator defect and provide current focused evidence." },
    },
  });
  const good = fixture();
  const result = handoffs.validateHandoff(good, { root });
  assert.equal(result.valid, true, result.issues.map((item) => `${item.code} ${item.field}`).join("; "));
  assert.equal(result.progress.available, false);
  assert.equal(result.progress.accepted, null);
  assert.equal(result.progress.shipped, null);
  assert.equal(result.progress.knownRemaining, 1);
  assert.equal(result.progress.status, "CLOSED_WITH_CARRYOVER");
  assert.match(handoffs.formatProgress(result.progress), /Known remaining work: 1 item\(s\); status: CLOSED_WITH_CARRYOVER/u);
  assert.doesNotMatch(handoffs.formatProgress(result.progress), /\d+(?:\.\d+)?%/u, "no denominator cannot yield percentage progress");

  const unknownSelection = fixture();
  unknownSelection.nextWave.selected = ["invented-outcome"];
  assert(handoffs.validateHandoff(unknownSelection, { root }).issues.some((item) => item.code === "task-handoff-unknown-next-wave-outcome"), "without a denominator next-wave IDs must be grounded in declared remaining work");
  const missingOwner = fixture();
  delete missingOwner.remaining[0].owner;
  assert(handoffs.validateHandoff(missingOwner, { root }).issues.some((item) => item.code === "task-handoff-schema"), "unknown-denominator carryover still requires an owner");
  const missingEvidence = fixture();
  missingEvidence.remaining[0].evidence = [];
  assert(handoffs.validateHandoff(missingEvidence, { root }).issues.some((item) => item.code === "task-handoff-schema"), "unknown-denominator carryover still requires local evidence");
  const missingCarryRef = fixture();
  missingCarryRef.nextWave.carryoverRefs = [];
  assert(handoffs.validateHandoff(missingCarryRef, { root }).issues.some((item) => item.code === "task-handoff-carryover-ref-missing"), "known remaining work cannot be dropped from explicit carryover references");
  const inventedAcceptance = fixture();
  inventedAcceptance.acceptedOutcomes = [{ outcomeId: "preexisting-source-defect", evidence: [{ ref: blockerEvidence.ref, sha256: blockerEvidence.sha256, kind: "functional-observation", surface: "source review", environment: "local" }] }];
  assert(handoffs.validateHandoff(inventedAcceptance, { root }).issues.some((item) => item.code === "task-handoff-unknown-accepted-outcome"), "no accepted outcome can be invented without a denominator");
  const releaseBytes = JSON.stringify({ release: { acceptedCandidate: { version: "source-r1", target: "local source package", urls: ["file:source-r1"] } } });
  write("evidence/source-release.json", releaseBytes);
  const inventedShipment = fixture();
  inventedShipment.shippedUnits = [{ id: "invented-shipment", outcomeIds: ["preexisting-source-defect"], target: "local source package", urls: ["file:source-r1"], version: "source-r1", releaseReceipt: { ref: "evidence/source-release.json", sha256: sha256(releaseBytes) }, dependencies: [] }];
  assert(handoffs.validateHandoff(inventedShipment, { root }).issues.some((item) => item.code === "task-handoff-unknown-shipped-outcome"), "no shipped outcome can be invented without a denominator");
  const fullGoalClaim = fixture();
  fullGoalClaim.status = "PRODUCT_GOAL_ACHIEVED";
  assert(handoffs.validateHandoff(fullGoalClaim, { root }).issues.some((item) => item.code === "task-handoff-status-denominator"), "a product goal claim remains invalid without a denominator");
  const partialClaim = fixture();
  partialClaim.status = "PARTIALLY_DELIVERED";
  assert(handoffs.validateHandoff(partialClaim, { root }).issues.some((item) => item.code === "task-handoff-status-denominator"), "partial delivery claims remain invalid without a denominator");
  const scopedReleaseClaim = fixture();
  scopedReleaseClaim.status = "SCOPED_RELEASE_ACCEPTED";
  assert(handoffs.validateHandoff(scopedReleaseClaim, { root }).issues.some((item) => item.code === "task-handoff-status-denominator"), "scoped release claims remain invalid without a denominator");
  console.log("Task-wave no-denominator carryover: owned local blocker accepted, progress unavailable with remaining count, ungrounded IDs and outcome/status claims rejected");
}

function runHandoffIntentOnly() {
  const cases = [
    { task: "Реализуй продуктовую волну.", final: "Реализовано и закрыто.", direct: false, expected: true, name: "Russian substantive product wave" },
    { task: "Выполни релиз волны.", final: "Релиз завершён, задача закрыта и готова.", direct: true, expected: true, name: "Russian direct release closeout" },
    { task: "Исправь опечатку.", final: "Исправил опечатку.", direct: true, expected: false, name: "Russian tiny direct fix" },
    { task: "Статус?", final: "Завершил работу.", direct: false, expected: false, name: "Russian status request" },
    { task: "Продолжай текущую задачу после ошибки.", final: "Продолжил работу.", direct: false, expected: false, name: "Russian continuation steering" },
    { task: "У вас 1 новое сообщение оркестрации. Выполните проверку.", final: "Завершил проверку.", direct: false, expected: false, name: "Russian orchestration mailbox ping" },
    { task: "Исправь дефект в продуктовой волне.", final: "Отгрузил девять результатов; последний результат ещё не завершён.", direct: false, expected: true, name: "Russian partial closeout with remaining outcome" },
    { task: "Fix the feature in this product wave.", final: "Shipped nine independent outcomes; the last outcome is not completed.", direct: false, expected: true, name: "English partial closeout with remaining outcome" },
    { task: "Исправь дефект в продуктовой волне.", final: "Работа ещё не завершена; продолжаю проверку.", direct: false, expected: false, name: "Russian pure noncompletion" },
    { task: "Fix the feature in this product wave.", final: "The work is not finished; still working.", direct: false, expected: false, name: "English pure noncompletion" }
  ];
  for (const item of cases) {
    const actual = handoffs.checkHandoff({ state: { task: item.task, direct: item.direct } }, item.final).applicable;
    assert.equal(actual, item.expected, item.name);
  }
  assert.equal(handoffs.taskIsSubstantive("У вас 1 новое сообщение оркестрации. Выполните проверку."), false, "Russian mailbox text is not classified as substantive work");
  console.log("Task-wave intent: Russian/English substantive closeout, tiny direct edit, mailbox/status/continuation skips, and partial closeout negation passed");
}

if (process.argv.includes("--handoff-intent-only")) {
  try { runHandoffIntentOnly(); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
  process.exit(0);
}

if (process.argv.includes("--handoff-only")) {
  try { runHandoffOnly(); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
  process.exit(0);
}

if (process.argv.includes("--handoff-boundary-only")) {
  try { runHandoffOnly({ boundaryOnly: true }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
  process.exit(0);
}

if (process.argv.includes("--handoff-no-denominator-only")) {
  try { runHandoffNoDenominatorOnly(); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
  process.exit(0);
}

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
