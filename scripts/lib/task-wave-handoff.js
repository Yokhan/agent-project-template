"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_HANDOFF_BYTES = 1024 * 1024;
const MAX_ARTIFACT_BYTES = 256 * 1024;
const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;
const MAX_REFERENCE_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_REFERENCE_COUNT = 64;
const HANDOFF_FILE = "task-wave-handoff.json";

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function issue(code, field, message) { return { code: `task-handoff-${code}`, field, message }; }

function receiptReadFailure(error) {
  const recovery = "preserve it and request owner recovery; re-recording refuses to overwrite it";
  if (error instanceof SyntaxError) return `existing handoff receipt is invalid JSON; ${recovery}`;
  if (/exceeds \d+ byte limit/iu.test(String(error?.message || ""))) return `existing handoff receipt exceeds the ${MAX_HANDOFF_BYTES} byte limit; ${recovery}`;
  const code = /^[A-Z0-9_]{1,24}$/u.test(String(error?.code || "")) ? ` (${error.code})` : "";
  return `existing handoff receipt is unreadable${code}; ${recovery}`;
}

function safeFile(root, value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("path is required");
  const base = path.resolve(root);
  const target = path.resolve(base, value);
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error("path escapes project root");
  for (let current = target; current !== path.dirname(base); current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error("symlink path is not allowed");
    if (current === base) break;
  }
  return target;
}

function readBounded(file, limit) {
  const beforeOpen = fs.lstatSync(file);
  if (!beforeOpen.isFile()) throw new Error("path is not a regular file");
  let flags = fs.constants.O_RDONLY;
  if (typeof fs.constants.O_NONBLOCK === "number") flags |= fs.constants.O_NONBLOCK;
  if (process.platform !== "win32" && typeof fs.constants.O_NOFOLLOW === "number") flags |= fs.constants.O_NOFOLLOW;
  const descriptor = fs.openSync(file, flags);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > limit) throw new Error(`file exceeds ${limit} byte limit or is not a file`);
    const chunks = [];
    let total = 0;
    let position = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, limit + 1 - total));
      const count = fs.readSync(descriptor, chunk, 0, chunk.length, position);
      if (!count) break;
      total += count;
      if (total > limit) throw new Error(`file exceeds ${limit} byte limit`);
      chunks.push(chunk.subarray(0, count));
      position += count;
    }
    return Buffer.concat(chunks, total);
  } finally { fs.closeSync(descriptor); }
}

function loadSchema(root) {
  const file = safeFile(root, ".claude/library/process/task-wave-handoff.schema.json");
  const bytes = readBounded(file, 128 * 1024);
  return JSON.parse(bytes.toString("utf8"));
}

function resolveRef(schema, ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/$defs/")) throw new Error("Unsupported handoff schema reference");
  return schema.$defs[ref.slice("#/$defs/".length)];
}

function validateShape(value, schema, field, issues) {
  if (schema.$ref) return validateShape(value, resolveRef(validateShape.rootSchema, schema.$ref), field, issues);
  if (schema.const !== undefined && value !== schema.const) issues.push(issue("schema", field, `must equal ${JSON.stringify(schema.const)}`));
  if (schema.enum && !schema.enum.includes(value)) issues.push(issue("schema", field, `must be one of ${schema.enum.join(", ")}`));
  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) { issues.push(issue("schema", field, "must be an object")); return; }
    for (const required of schema.required || []) if (!Object.hasOwn(value, required)) issues.push(issue("schema", `${field}.${required}`, "is required"));
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties || {}, key)) issues.push(issue("schema", `${field}.${key}`, "is not allowed"));
    for (const [key, child] of Object.entries(schema.properties || {})) if (Object.hasOwn(value, key)) validateShape(value[key], child, `${field}.${key}`, issues);
    return;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) { issues.push(issue("schema", field, "must be an array")); return; }
    if (schema.minItems !== undefined && value.length < schema.minItems) issues.push(issue("schema", field, `must contain at least ${schema.minItems} item(s)`));
    if (schema.maxItems !== undefined && value.length > schema.maxItems) issues.push(issue("schema", field, `must contain at most ${schema.maxItems} item(s)`));
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) issues.push(issue("schema", field, "items must be unique"));
    value.forEach((item, index) => validateShape(item, schema.items, `${field}[${index}]`, issues));
    return;
  }
  if (schema.type === "string") {
    if (typeof value !== "string") { issues.push(issue("schema", field, "must be a string")); return; }
    if (schema.minLength !== undefined && value.length < schema.minLength) issues.push(issue("schema", field, `must contain at least ${schema.minLength} character(s)`));
    if (schema.maxLength !== undefined && value.length > schema.maxLength) issues.push(issue("schema", field, `must contain at most ${schema.maxLength} character(s)`));
    if (schema.pattern && !(new RegExp(schema.pattern, "u")).test(value)) issues.push(issue("schema", field, "has an invalid format"));
    return;
  }
  if (schema.type === "number" || schema.type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value)) { issues.push(issue("schema", field, "must be a finite number")); return; }
    if (schema.type === "integer" && !Number.isInteger(value)) issues.push(issue("schema", field, "must be an integer"));
    if (schema.minimum !== undefined && value < schema.minimum) issues.push(issue("schema", field, `must be at least ${schema.minimum}`));
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) issues.push(issue("schema", field, `must be greater than ${schema.exclusiveMinimum}`));
    if (schema.maximum !== undefined && value > schema.maximum) issues.push(issue("schema", field, `must be at most ${schema.maximum}`));
  }
}

function localReferencePath(root, reference) {
  if (/^https?:\/\//iu.test(reference)) return null;
  if (reference.includes("\\") || reference.startsWith("/") || reference.split("/").includes("..")) throw new Error("reference must be project-relative");
  return safeFile(root, reference);
}

function verifyHashReference(root, evidence, field, issues, cache, budget) {
  try {
    const file = localReferencePath(root, evidence.ref);
    if (!file) throw new Error("counted evidence must use a local project-relative file reference with a SHA-256; external URLs are metadata only");
    if (cache.has(evidence.ref)) {
      if (cache.get(evidence.ref) !== evidence.sha256.toLowerCase()) {
        issues.push(issue("evidence-stale", `${field}.sha256`, `does not match ${evidence.ref}`));
        return false;
      }
      return true;
    }
    if (budget.references.size >= MAX_REFERENCE_COUNT) {
      issues.push(issue("reference-budget", `${field}.ref`, `handoff exceeds ${MAX_REFERENCE_COUNT} unique local references`));
      return false;
    }
    const size = fs.statSync(file).size;
    if (budget.bytes + size > MAX_REFERENCE_TOTAL_BYTES) {
      issues.push(issue("reference-budget", `${field}.ref`, `handoff exceeds ${MAX_REFERENCE_TOTAL_BYTES} aggregate reference bytes`));
      return false;
    }
    const bytes = readBounded(file, MAX_REFERENCE_BYTES);
    if (budget.bytes + bytes.length > MAX_REFERENCE_TOTAL_BYTES) {
      issues.push(issue("reference-budget", `${field}.ref`, `handoff exceeds ${MAX_REFERENCE_TOTAL_BYTES} aggregate reference bytes`));
      return false;
    }
    const actual = sha256(bytes);
    budget.references.add(evidence.ref);
    budget.bytes += bytes.length;
    cache.set(evidence.ref, actual);
    if (actual.toLowerCase() !== evidence.sha256.toLowerCase()) {
      issues.push(issue("evidence-stale", `${field}.sha256`, `does not match ${evidence.ref}`));
      return false;
    }
    return true;
  } catch (error) {
    issues.push(issue("evidence-reference", `${field}.ref`, error.message));
    return false;
  }
}

function verifyContentReference(root, evidence, field, issues, cache, budget) {
  return verifyHashReference(root, evidence, field, issues, cache, budget);
}

function verifyReleaseReceipt(root, shipped, field, issues, cache, budget) {
  try {
    const file = localReferencePath(root, shipped.releaseReceipt.ref);
    if (!file) throw new Error("release receipt must be a local project-relative JSON reference");
    return verifyHashReference(root, shipped.releaseReceipt, `${field}.releaseReceipt`, issues, cache, budget);
  } catch (error) {
    issues.push(issue("release-receipt", `${field}.releaseReceipt`, error.message));
    return false;
  }
}

function validateHandoff(value, context = {}) {
  const root = path.resolve(context.root || path.resolve(__dirname, "../.."));
  const issues = [];
  const evidenceHashes = new Map();
  const referenceBudget = { references: new Set(), bytes: 0 };
  let schema;
  try { schema = loadSchema(root); }
  catch (error) { return { valid: false, issues: [issue("schema-unavailable", "schema", error.message)], progress: null, evidenceHashes }; }
  validateShape.rootSchema = schema;
  validateShape(value, schema, "handoff", issues);
  validateShape.rootSchema = null;
  if (issues.length) return { valid: false, issues, progress: null, evidenceHashes };

  if (context.requireExecution && !value.execution) issues.push(issue("execution-required", "execution", "a wave contract requires the existing plan, wave and execution lanes"));
  let executionCounts = null;
  if (value.execution) {
    executionCounts = { plannedTotal: value.execution.lanes.length, ...(value.execution.requestedScale ? { requestedScale: value.execution.requestedScale } : {}), planned: 0, accepted: 0, live: 0, settled: 0, blocked: 0, unverified: 0 };
    const seenLanes = new Set();
    for (const key of ["planRef", "waveRef"]) {
      const ref = value.execution[key];
      try {
        if (!localReferencePath(root, ref.ref)) issues.push(issue("execution-reference-local", `execution.${key}`, "must refer to an existing local plan or graph"));
        else verifyHashReference(root, ref, `execution.${key}`, issues, evidenceHashes, referenceBudget);
      } catch (error) { issues.push(issue("execution-reference", `execution.${key}`, error.message)); }
    }
    for (const [index, lane] of value.execution.lanes.entries()) {
      const at = `execution.lanes[${index}]`;
      if (seenLanes.has(lane.id)) issues.push(issue("execution-duplicate-lane", `${at}.id`, "lane ID must be unique"));
      seenLanes.add(lane.id);
      executionCounts[lane.status]++;
      if (["accepted", "live", "settled"].includes(lane.status) && (!lane.handle || !lane.evidence)) issues.push(issue("execution-dispatch-evidence", at, "accepted, live and settled lanes require a handle and hash-bound dispatch evidence; otherwise use unverified"));
      if (lane.evidence) verifyHashReference(root, lane.evidence, `${at}.evidence`, issues, evidenceHashes, referenceBudget);
    }
    if (value.execution.requestedScale && value.execution.requestedScale > value.execution.lanes.length && !value.execution.placementReason) issues.push(issue("execution-placement", "execution.placementReason", "explain placement when fewer lanes are listed than requested"));
  }
  const outcomes = value.goal.baseline.outcomes;
  const outcomeById = new Map();
  outcomes.forEach((outcome, index) => {
    if (outcomeById.has(outcome.id)) issues.push(issue("duplicate-outcome", `goal.baseline.outcomes[${index}].id`, "is duplicated"));
    outcomeById.set(outcome.id, outcome);
    for (const dependency of outcome.dependencies || []) {
      if (!outcomeById.has(dependency) && !outcomes.some((candidate) => candidate.id === dependency)) issues.push(issue("unknown-dependency", `goal.baseline.outcomes[${index}].dependencies`, `references unknown outcome ${dependency}`));
      if (dependency === outcome.id) issues.push(issue("dependency-cycle", `goal.baseline.outcomes[${index}].dependencies`, "cannot depend on itself"));
    }
  });
  if (!outcomes.length && !value.goal.baseline.denominatorUnavailableReason) issues.push(issue("baseline-required", "goal.baseline.denominatorUnavailableReason", "explain why no meaningful outcome denominator is available"));
  if (outcomes.length && value.goal.baseline.denominatorUnavailableReason) issues.push(issue("baseline-conflict", "goal.baseline.denominatorUnavailableReason", "must be omitted when baseline outcomes are declared"));
  if (outcomes.length && !value.goal.baseline.source) issues.push(issue("baseline-source-required", "goal.baseline.source", "bind the declared denominator to an exact local source reference and SHA-256"));
  if (outcomes.length && value.goal.baseline.source) {
    try {
      if (!localReferencePath(root, value.goal.baseline.source.ref)) issues.push(issue("baseline-source-local", "goal.baseline.source.ref", "baseline denominator source must be a local project reference"));
      else verifyHashReference(root, value.goal.baseline.source, "goal.baseline.source", issues, evidenceHashes, referenceBudget);
    } catch (error) { issues.push(issue("baseline-source-reference", "goal.baseline.source.ref", error.message)); }
  }
  const weights = outcomes.map((item) => item.weight);
  if (weights.some((weight) => weight !== undefined) && weights.some((weight) => weight === undefined)) issues.push(issue("baseline-weights", "goal.baseline.outcomes", "weights must be present for every outcome or none"));
  if (new Set(value.goal.scopeOutcomeIds).size !== value.goal.scopeOutcomeIds.length) issues.push(issue("duplicate-scope", "goal.scopeOutcomeIds", "must not contain duplicate IDs"));
  for (const id of value.goal.scopeOutcomeIds) if (!outcomeById.has(id)) issues.push(issue("unknown-scope", "goal.scopeOutcomeIds", `references unknown outcome ${id}`));

  const acceptedById = new Map();
  for (const [index, accepted] of value.acceptedOutcomes.entries()) {
    if (!outcomeById.has(accepted.outcomeId)) issues.push(issue("unknown-accepted-outcome", `acceptedOutcomes[${index}].outcomeId`, `references unknown outcome ${accepted.outcomeId}`));
    if (acceptedById.has(accepted.outcomeId)) issues.push(issue("duplicate-accepted-outcome", `acceptedOutcomes[${index}].outcomeId`, "is duplicated"));
    const expected = outcomeById.get(accepted.outcomeId);
    let acceptedEvidenceValid = Boolean(expected) && !acceptedById.has(accepted.outcomeId);
    for (const [evidenceIndex, evidence] of accepted.evidence.entries()) {
      const at = `acceptedOutcomes[${index}].evidence[${evidenceIndex}]`;
      if (expected && (evidence.surface !== expected.surface || evidence.environment !== expected.environment)) {
        issues.push(issue("evidence-target", at, "surface and environment must match the predeclared outcome"));
        acceptedEvidenceValid = false;
      }
      const liveTarget = /live|production|served|active|installed|published/iu.test(`${expected?.surface || ""} ${expected?.environment || ""}`);
      if (liveTarget && !["functional-observation", "release-observation", "user-acceptance"].includes(evidence.kind)) {
        issues.push(issue("live-evidence", `${at}.kind`, "image, mockup, Storybook, test, or source evidence cannot establish a live outcome"));
        acceptedEvidenceValid = false;
      }
      if (!verifyContentReference(root, evidence, at, issues, evidenceHashes, referenceBudget)) acceptedEvidenceValid = false;
    }
    if (acceptedEvidenceValid) acceptedById.set(accepted.outcomeId, accepted);
  }

  const shippedByOutcome = new Map();
  const candidateByOutcome = new Map();
  const shippedIds = new Set();
  for (const [index, shipped] of value.shippedUnits.entries()) {
    const at = `shippedUnits[${index}]`;
    if (shippedIds.has(shipped.id)) issues.push(issue("duplicate-shipped-unit", `${at}.id`, "is duplicated"));
    shippedIds.add(shipped.id);
    let compatibleDependencies = true;
    for (const [dependencyIndex, dependency] of shipped.dependencies.entries()) {
      const dependencyAt = `${at}.dependencies[${dependencyIndex}]`;
      if (dependency.status !== "compatible") {
        issues.push(issue("shipped-dependency-incompatible", `${dependencyAt}.status`, `${dependency.kind} dependency ${dependency.id} is ${dependency.status}`));
        compatibleDependencies = false;
      }
      if (!verifyHashReference(root, dependency.evidence, `${dependencyAt}.evidence`, issues, evidenceHashes, referenceBudget)) compatibleDependencies = false;
    }
    const receiptValid = verifyReleaseReceipt(root, shipped, at, issues, evidenceHashes, referenceBudget) && compatibleDependencies;
    for (const outcomeId of shipped.outcomeIds) {
      if (!outcomeById.has(outcomeId)) issues.push(issue("unknown-shipped-outcome", `${at}.outcomeIds`, `references unknown outcome ${outcomeId}`));
      if (!acceptedById.has(outcomeId)) issues.push(issue("unaccepted-shipped-outcome", `${at}.outcomeIds`, `${outcomeId} has no current accepted outcome evidence`));
      if (candidateByOutcome.has(outcomeId)) issues.push(issue("duplicate-shipped-outcome", `${at}.outcomeIds`, `${outcomeId} is already assigned to a shipped unit`));
      candidateByOutcome.set(outcomeId, { shipped, receiptValid });
    }
  }
  const shippingState = new Map();
  function canShip(outcomeId, trail = new Set()) {
    if (shippingState.has(outcomeId)) return shippingState.get(outcomeId);
    const candidate = candidateByOutcome.get(outcomeId);
    if (!candidate || !candidate.receiptValid || !acceptedById.has(outcomeId) || trail.has(outcomeId)) return false;
    const nextTrail = new Set(trail);
    nextTrail.add(outcomeId);
    const dependencies = outcomeById.get(outcomeId)?.dependencies || [];
    const valid = dependencies.every((dependency) => canShip(dependency, nextTrail));
    shippingState.set(outcomeId, valid);
    return valid;
  }
  for (const [outcomeId, candidate] of candidateByOutcome.entries()) {
    if (!canShip(outcomeId)) {
      if (outcomeById.has(outcomeId) && (outcomeById.get(outcomeId).dependencies || []).some((dependency) => !canShip(dependency))) {
        issues.push(issue("dependency-unshipped", "shippedUnits", `${outcomeId} depends on an unshipped outcome`));
      }
      continue;
    }
    shippedByOutcome.set(outcomeId, candidate.shipped);
  }

  for (const [index, work] of value.workPerformed.entries()) for (const [evidenceIndex, evidence] of work.evidence.entries()) {
    verifyContentReference(root, evidence, `workPerformed[${index}].evidence[${evidenceIndex}]`, issues, evidenceHashes, referenceBudget);
  }

  const remainingById = new Map();
  for (const [index, item] of value.remaining.entries()) {
    if (outcomes.length && !outcomeById.has(item.outcomeId)) issues.push(issue("unknown-remaining-outcome", `remaining[${index}].outcomeId`, `references unknown outcome ${item.outcomeId}`));
    if (remainingById.has(item.outcomeId)) issues.push(issue("duplicate-remaining-outcome", `remaining[${index}].outcomeId`, "is duplicated"));
    remainingById.set(item.outcomeId, item);
    for (const [evidenceIndex, evidence] of item.evidence.entries()) verifyHashReference(root, evidence, `remaining[${index}].evidence[${evidenceIndex}]`, issues, evidenceHashes, referenceBudget);
  }
  for (const [index, item] of value.remaining.entries()) {
    for (const dependency of item.dependencies) {
      const known = outcomes.length ? outcomeById.has(dependency) : remainingById.has(dependency);
      if (!known) issues.push(issue("unknown-remaining-dependency", `remaining[${index}].dependencies`, `references unknown ${outcomes.length ? "baseline outcome" : "remaining item"} ${dependency}`));
    }
  }
  for (const outcome of outcomes) if (!shippedByOutcome.has(outcome.id) && !remainingById.has(outcome.id)) issues.push(issue("carryover-missing", "remaining", `unshipped outcome ${outcome.id} needs an owner and impact`));
  for (const id of shippedByOutcome.keys()) if (remainingById.has(id)) issues.push(issue("carryover-shipped", "remaining", `shipped outcome ${id} cannot also remain open`));

  const selected = new Set(value.nextWave.selected);
  const knownForNextWave = (id) => outcomeById.has(id) || (!outcomes.length && remainingById.has(id));
  const deferred = new Set();
  value.nextWave.deferred.forEach((item, index) => {
    if (!knownForNextWave(item.outcomeId)) issues.push(issue("unknown-deferred-outcome", `nextWave.deferred[${index}].outcomeId`, `references unknown ${outcomes.length ? "baseline outcome" : "remaining item"} ${item.outcomeId}`));
    if (deferred.has(item.outcomeId)) issues.push(issue("duplicate-deferred-outcome", `nextWave.deferred[${index}].outcomeId`, "is duplicated"));
    deferred.add(item.outcomeId);
  });
  for (const id of selected) if (deferred.has(id)) issues.push(issue("next-wave-state-conflict", "nextWave", `${id} cannot be both selected and deferred`));
  for (const id of selected) if (!knownForNextWave(id)) issues.push(issue("unknown-next-wave-outcome", "nextWave.selected", `references unknown ${outcomes.length ? "baseline outcome" : "remaining item"} ${id}`));
  const carryoverRefs = new Set();
  value.nextWave.carryoverRefs.forEach((item, index) => {
    if (!knownForNextWave(item.outcomeId)) issues.push(issue("unknown-carryover-ref", `nextWave.carryoverRefs[${index}].outcomeId`, `references unknown ${outcomes.length ? "baseline outcome" : "remaining item"} ${item.outcomeId}`));
    if (carryoverRefs.has(item.outcomeId)) issues.push(issue("duplicate-carryover-ref", `nextWave.carryoverRefs[${index}].outcomeId`, "is duplicated"));
    carryoverRefs.add(item.outcomeId);
    verifyHashReference(root, item.ref, `nextWave.carryoverRefs[${index}].ref`, issues, evidenceHashes, referenceBudget);
  });
  for (const id of remainingById.keys()) {
    if (!selected.has(id) && !deferred.has(id)) issues.push(issue("next-wave-drop", "nextWave", `remaining outcome ${id} must be selected or explicitly deferred`));
    if (!carryoverRefs.has(id)) issues.push(issue("carryover-ref-missing", "nextWave.carryoverRefs", `remaining outcome ${id} needs a carryover reference`));
  }
  for (const id of selected) if (!remainingById.has(id)) issues.push(issue("next-wave-not-remaining", "nextWave.selected", `${id} is not an outstanding outcome`));
  for (const id of deferred) if (!remainingById.has(id)) issues.push(issue("deferred-not-remaining", "nextWave.deferred", `${id} is not an outstanding outcome`));
  for (const id of carryoverRefs) if (!remainingById.has(id)) issues.push(issue("carryover-ref-not-remaining", "nextWave.carryoverRefs", `${id} is not outstanding`));

  const totalWeight = outcomes.reduce((sum, item) => sum + (item.weight || 0), 0);
  const denominatorAvailable = outcomes.length > 0;
  const acceptedIds = new Set([...acceptedById.keys()].filter((id) => outcomeById.has(id)));
  const shippedCount = shippedByOutcome.size;
  const allShipped = denominatorAvailable && shippedCount === outcomes.length;
  const scopeShipped = value.goal.scopeOutcomeIds.length > 0 && value.goal.scopeOutcomeIds.every((id) => shippedByOutcome.has(id));
  const weighted = weights.some((weight) => weight !== undefined);
  const acceptedWeight = outcomes.reduce((sum, item) => sum + (acceptedIds.has(item.id) ? (item.weight || 0) : 0), 0);
  const shippedWeight = outcomes.reduce((sum, item) => sum + (shippedByOutcome.has(item.id) ? (item.weight || 0) : 0), 0);
  if (value.status === "PARTIALLY_DELIVERED" && (!denominatorAvailable || shippedCount < 1 || allShipped)) issues.push(issue("status-inconsistent", "status", "PARTIALLY_DELIVERED requires at least one but fewer than all baseline outcomes shipped"));
  if (value.status === "CLOSED_WITH_CARRYOVER" && !remainingById.size) issues.push(issue("status-inconsistent", "status", "CLOSED_WITH_CARRYOVER requires at least one remaining outcome"));
  if (value.status === "SCOPED_RELEASE_ACCEPTED" && (!scopeShipped || value.goal.scopeOutcomeIds.some((id) => !acceptedById.has(id)))) issues.push(issue("status-inconsistent", "status", "SCOPED_RELEASE_ACCEPTED requires all predeclared scope outcomes accepted and shipped"));
  if (value.status === "PRODUCT_GOAL_ACHIEVED" && (!allShipped || outcomes.some((item) => !acceptedById.has(item.id)))) issues.push(issue("status-inconsistent", "status", "PRODUCT_GOAL_ACHIEVED requires every baseline outcome accepted and shipped"));
  if (!denominatorAvailable && !["ITERATION_CLOSED", "CLOSED_WITH_CARRYOVER"].includes(value.status)) issues.push(issue("status-denominator", "status", "without a declared denominator only ITERATION_CLOSED or CLOSED_WITH_CARRYOVER is available"));

  const progress = denominatorAvailable ? {
    available: true,
    accepted: acceptedIds.size,
    shipped: shippedCount,
    total: outcomes.length,
    basis: weighted ? "predeclared-weights" : "predeclared-outcome-count",
    baselineRevision: value.goal.baseline.revision,
    weighted,
    acceptedWeight: weighted ? acceptedWeight : null,
    shippedWeight: weighted ? shippedWeight : null,
    totalWeight: weighted ? totalWeight : null,
    acceptedPercent: weighted
      ? Number((acceptedWeight / totalWeight * 100).toFixed(2))
      : Number((acceptedIds.size / outcomes.length * 100).toFixed(2)),
    shippedPercent: weighted
      ? Number((shippedWeight / totalWeight * 100).toFixed(2))
      : Number((shippedCount / outcomes.length * 100).toFixed(2)),
  } : { available: false, accepted: null, shipped: null, total: null, basis: null, baselineRevision: value.goal.baseline.revision, acceptedPercent: null, shippedPercent: null, knownRemaining: remainingById.size, status: value.status };
  if (denominatorAvailable) {
    progress.knownRemaining = remainingById.size;
    progress.status = value.status;
  }

  if (executionCounts) progress.executionCounts = executionCounts;
  return { valid: issues.length === 0, issues, progress, evidenceHashes, executionCounts };
}

function formatProgress(result) {
  const counts = result?.executionCounts;
  const allocation = counts ? `\nLanes: planned total ${counts.plannedTotal}${counts.requestedScale ? `; requested ${counts.requestedScale}` : ""}; planned ${counts.planned}, accepted ${counts.accepted}, live ${counts.live}, settled ${counts.settled}, blocked ${counts.blocked}, unverified ${counts.unverified}. Statuses are recorded claims, not independently verified runtime activity.` : "";
  if (!result?.available) return `Progress unavailable: no meaningful outcome denominator was declared. Known remaining work: ${result?.knownRemaining ?? 0} item(s); status: ${result?.status || "unavailable"}.` + allocation;
  const bar = (percent) => {
    const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
    return `[${"#".repeat(filled)}${".".repeat(10 - filled)}]`;
  };
  const accepted = result.weighted ? `${result.accepted}/${result.total} outcomes; weight ${result.acceptedWeight}/${result.totalWeight} (${result.acceptedPercent}%)` : `${result.accepted}/${result.total} outcomes (${result.acceptedPercent}%)`;
  const shipped = result.weighted ? `${result.shipped}/${result.total} outcomes; weight ${result.shippedWeight}/${result.totalWeight} (${result.shippedPercent}%)` : `${result.shipped}/${result.total} outcomes (${result.shippedPercent}%)`;
  return `Accepted ${bar(result.acceptedPercent)} ${accepted}.\nShipped ${bar(result.shippedPercent)} ${shipped}.\nBasis: ${result.basis}; baseline revision: ${result.baselineRevision}.` + allocation;
}

function russianToken(text, stems) {
  const boundary = "(?<![\\p{L}\\p{N}_])(?:";
  const alternatives = stems.map((stem) => stem + "\\p{L}*").join("|");
  return new RegExp(boundary + alternatives + ")(?![\\p{L}\\p{N}_])", "iu").test(text);
}

const RUSSIAN_WORK = [
  "реализ",
  "исправ",
  "почин",
  "добав",
  "измен",
  "постав",
  "отгруз",
  "разработ",
  "созда",
  "улучш",
  "заверш",
  "внедр",
  "развер",
  "выкат",
  "выполн"
];
const RUSSIAN_LIFECYCLE = [
  "волн",
  "релиз",
  "постав",
  "отгруз",
  "развер",
  "выкат",
  "передач",
  "приемк",
  "приёмк",
  "закрыти"
];
const RUSSIAN_CLOSEOUT = [
  "исправ",
  "почин",
  "реализ",
  "внедр",
  "закрыл",
  "закрыт",
  "заверш",
  "готов",
  "выполн",
  "создал",
  "отгруз",
  "постав",
  "развернул"
];
const RUSSIAN_MAILBOX_MESSAGE = [
  "сообщени"
];
const RUSSIAN_MAILBOX_ORCHESTRATION = [
  "оркестрац"
];
const RUSSIAN_CONTINUATION = [
  "продолж",
  "возобнов"
];
const RUSSIAN_CURRENT = [
  "текущ",
  "согласован"
];
const RUSSIAN_TASK = [
  "задач",
  "работ",
  "запрос"
];
const RUSSIAN_OBJECTIVE = [
  "продукт",
  "функц",
  "цел",
  "передач"
];
const RUSSIAN_NOT = [
  "не"
];
const RUSSIAN_STILL = [
  "еще",
  "ещё"
];
const RUSSIAN_WORKING = [
  "работаю"
];
const RUSSIAN_IN = [
  "в"
];
const RUSSIAN_PROCESS = [
  "процессе"
];
function taskIsSubstantive(task) {
  const text = String(task || "").trim();
  if (!text || /^(?:thanks|thank you|ok(?:ay)?|got it|status(?:\?|$)|ping|are you there)[.!\s]*$/iu.test(text)) return false;
  const russianMailbox = russianToken(text, RUSSIAN_MAILBOX_MESSAGE) && russianToken(text, RUSSIAN_MAILBOX_ORCHESTRATION) && /\b\d+\b/u.test(text);
  if (/you have \d+ orchestration message[\s\S]*orca orchestration check/iu.test(text) || russianMailbox) return false;
  const directWorkVerb = /\b(?:implement|build|fix|change|add|remove|ship|deliver|release|migrate|create|design|improve|deploy|handoff|closeout)\b/iu.test(text) || russianToken(text, RUSSIAN_WORK);
  if (/^\s*(?:continue|resume)\b[\s\S]{0,120}\b(?:current|agreed)\b[\s\S]{0,60}\b(?:task|work|request)\b/iu.test(text) && !directWorkVerb) return false;
  const lowered = text.trimStart().toLocaleLowerCase("ru-RU");
  const russianContinuation = RUSSIAN_CONTINUATION.some((stem) => lowered.startsWith(stem)) && russianToken(text, RUSSIAN_CURRENT) && russianToken(text, RUSSIAN_TASK);
  if (russianContinuation && !directWorkVerb) return false;
  return directWorkVerb || /\b(?:complete|finish|product|feature|wave|workflow|goal)\b/iu.test(text) || russianToken(text, RUSSIAN_LIFECYCLE) || russianToken(text, RUSSIAN_OBJECTIVE);
}

function explicitLifecycleIntent(task, finalText) {
  const text = String(task) + " " + String(finalText);
  return /\b(?:wave|release|ship|deploy|handoff|closeout|final acceptance)\b/iu.test(text) || russianToken(text, RUSSIAN_LIFECYCLE);
}

function closesWork(finalText) {
  const text = String(finalText || "").trim();
  if (!text) return false;
  const clauses = text.split(/(?:;|\n|\bbut\b|\bhowever\b|\bthough\b)/iu);
  const englishPositive = /\b(?:completed|finished|implemented|delivered|shipped|released|deployed|fixed|created|closed|accepted|done)\b/iu;
  const englishNegation = /\b(?:not|never)\s+(?:yet\s+)?(?:completed|finished|implemented|delivered|shipped|released|deployed|fixed|created|closed|accepted|done)\b|\b(?:still working|in progress|no changes made|not finished)\b/iu;
  const russianCloseoutTerms = RUSSIAN_CLOSEOUT.map((stem) => stem + "\\p{L}*").join("|");
  const russianNegation = new RegExp(RUSSIAN_NOT[0] + "\\s+(?:" + russianCloseoutTerms + ")|(?:" + RUSSIAN_STILL.join("|") + ")\\s+" + RUSSIAN_WORKING[0] + "|" + RUSSIAN_IN[0] + "\\s+" + RUSSIAN_PROCESS[0] + "|" + RUSSIAN_CONTINUATION[0] + "\\p{L}*", "iu");
  return clauses.some((clause) => !englishNegation.test(clause) && !russianNegation.test(clause) && (englishPositive.test(clause) || russianToken(clause, RUSSIAN_CLOSEOUT)));
}

function checkHandoff(record, finalText) {
  const task = record?.state?.task || record?.task || "";
  const direct = record?.state?.direct === true;
  const applicable = taskIsSubstantive(task) && closesWork(finalText) && !(direct && !explicitLifecycleIntent(task, finalText));
  if (!applicable) return { applicable: false, state: "skipped", issues: [], repeated: false, progress: null };
  const root = record?.state?.root || record?.root;
  const requestId = record?.state?.requestId || record?.requestId;
  const directory = record?.directory || (record?.file ? path.dirname(record.file) : null);
  const issues = [];
  if (!root || !requestId || !directory) return { applicable: true, state: "invalid", issues: [issue("record-invalid", "request", "current logical request record is incomplete")], repeated: false, progress: null };
  let file;
  try { file = safeFile(root, path.join(directory, HANDOFF_FILE)); }
  catch (error) { return { applicable: true, state: "invalid", issues: [issue("record-path", "handoff", error.message)], repeated: false, progress: null }; }
  const finalString = String(finalText);
  const finalByteLength = Buffer.byteLength(finalString, "utf8");
  if (finalByteLength > MAX_ARTIFACT_BYTES) {
    return { applicable: true, state: "unresolved", issues: [issue("artifact-size", "binding.artifactSha256", `final artifact is ${finalByteLength} bytes; maximum is ${MAX_ARTIFACT_BYTES} bytes`)], repeated: false, progress: null };
  }
  let stored;
  try { stored = JSON.parse(readBounded(file, MAX_HANDOFF_BYTES).toString("utf8")); }
  catch (error) {
    if (error.code !== "ENOENT") {
      return { applicable: true, state: "unresolved", issues: [issue("record-unreadable", "handoff", receiptReadFailure(error))], repeated: false, progress: null };
    }
    const hint = `run node scripts/codex-turn.js handoff --state <request.json> --artifact <exact-final.txt> --result <handoff.json>`;
    return { applicable: true, state: "missing", issues: [issue("missing", "handoff", `record a request-bound handoff before closing; ${hint}`)], repeated: false, progress: null };
  }
  const artifactBytes = Buffer.from(finalString, "utf8");
  if (stored.schemaVersion !== 1) issues.push(issue("record-version", "binding.schemaVersion", "unsupported handoff record version"));
  if (stored.requestId !== requestId) issues.push(issue("request-mismatch", "binding.requestId", "handoff belongs to another logical request"));
  if (stored.requestTaskSha256 !== sha256(String(task))) issues.push(issue("task-mismatch", "binding.requestTaskSha256", "handoff belongs to a different original task"));
  if (stored.artifactSha256 !== sha256(artifactBytes)) issues.push(issue("artifact-mismatch", "binding.artifactSha256", "handoff is not bound to these exact final bytes"));
  if (stored.handoffCanonicalSha256 !== sha256(Buffer.from(JSON.stringify(stored.handoff), "utf8"))) issues.push(issue("handoff-record-changed", "binding.handoffCanonicalSha256", "stored handoff content changed after recording"));
  const validation = validateHandoff(stored.handoff, { root, requireExecution: record?.state?.waveHandoffContractVersion === 2 });
  issues.push(...validation.issues);
  for (const [reference, recordedHash] of Object.entries(stored.evidenceHashes || {})) {
    if (validation.evidenceHashes.get(reference) !== recordedHash) issues.push(issue("evidence-stale", `evidence.${reference}`, "changed after handoff was recorded"));
  }
  return { applicable: true, state: issues.length ? "unresolved" : "passed", issues, repeated: false, progress: validation.progress, executionCounts: validation.executionCounts };
}

function recordHandoff(root, requestPath, artifactPath, handoffPath) {
  const requestFile = safeFile(root, requestPath);
  const request = JSON.parse(readBounded(requestFile, 512 * 1024).toString("utf8"));
  const requestId = request.requestId;
  if (!requestId || !request.root || path.resolve(request.root) !== path.resolve(root)) throw new Error("Request ledger does not belong to this project root");
  const artifactFile = safeFile(root, artifactPath);
  const artifactBytes = readBounded(artifactFile, MAX_ARTIFACT_BYTES);
  const inputFile = safeFile(root, handoffPath);
  const inputBytes = readBounded(inputFile, MAX_HANDOFF_BYTES);
  const handoff = JSON.parse(inputBytes.toString("utf8"));
  const validation = validateHandoff(handoff, { root, requireExecution: request.waveHandoffContractVersion === 2 });
  if (!validation.valid) throw new Error(validation.issues.map((item) => `${item.code} ${item.field}: ${item.message}`).join("\n"));
  const directory = path.dirname(requestFile);
  const receiptPath = safeFile(root, path.join(directory, HANDOFF_FILE));
  let existing = null;
  try { existing = JSON.parse(readBounded(receiptPath, MAX_HANDOFF_BYTES).toString("utf8")); }
  catch (error) {
    if (error.code !== "ENOENT") throw new Error(`task-handoff-existing-receipt-unreadable: ${receiptReadFailure(error)}`);
  }
  const artifactSha256 = sha256(artifactBytes);
  const handoffSha256 = sha256(inputBytes);
  const repeated = existing?.requestId === requestId && existing?.artifactSha256 === artifactSha256 && existing?.handoffSha256 === handoffSha256;
  const baselineFingerprint = sha256(Buffer.from(JSON.stringify(handoff.goal.baseline), "utf8"));
  if (existing?.requestId === requestId && existing.baselineFingerprint && existing.baselineFingerprint !== baselineFingerprint) {
    throw new Error("task-handoff-baseline-changed: declared outcome IDs, weights, revision, or source changed during the same logical request; obtain an owner-approved new request/baseline before recording again");
  }
  const receipt = {
    schemaVersion: 1,
    requestId,
    requestTaskSha256: sha256(String(request.task || "")),
    baselineFingerprint,
    artifactSha256,
    handoffSha256,
    handoffCanonicalSha256: sha256(Buffer.from(JSON.stringify(handoff), "utf8")),
    repeatedRecord: repeated,
    recordedAt: new Date().toISOString(),
    handoff,
    evidenceHashes: Object.fromEntries(validation.evidenceHashes),
    progress: validation.progress,
    executionCounts: validation.executionCounts,
    structuralConsistencyOnly: true,
  };
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  const temporary = `${receiptPath}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  fs.renameSync(temporary, receiptPath);
  return { state: "recorded", requestId, artifactSha256, receipt: path.relative(root, receiptPath).split(path.sep).join("/"), repeated, progress: validation.progress, executionCounts: validation.executionCounts, note: "Structural consistency only; this record does not establish product quality or live acceptance." };
}

module.exports = { recordHandoff, checkHandoff, validateHandoff, formatProgress, taskIsSubstantive, closesWork, readBounded };
