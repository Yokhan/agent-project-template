"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const policy = require("./codex-turn-policy.js");
const { sha256 } = require("./writing-library-store.js");

const MAX_INPUT_BYTES = 64 * 1024;
const MAX_REFERENCED_BYTES = 64 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/iu;
const OUTCOME_FILE = "outcome.json";

function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value;
}
function text(value, name, max = 1000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${name} must be nonempty text up to ${max} characters`);
  return value.trim();
}
function hash(value, name) {
  if (typeof value !== "string" || !HASH.test(value)) throw new Error(`${name} must be a SHA-256 hex digest`);
  return value.toLowerCase();
}
function keys(value, allowed, name) {
  const unexpected = Object.keys(value).filter(key => !allowed.includes(key));
  if (unexpected.length) throw new Error(`${name} has unsupported fields: ${unexpected.join(", ")}`);
}
function projectPath(root, value, name) {
  const relative = text(value, name, 500);
  if (path.isAbsolute(relative) || /^[a-z][a-z0-9+.-]*:/iu.test(relative)) throw new Error(`${name} must be a project-relative local path`);
  const absolute = policy.localFile(root, relative);
  return path.relative(root, absolute).split(path.sep).join("/");
}
function fileFingerprint(root, relative) {
  const absolute = policy.localFile(root, relative);
  if (!fs.existsSync(absolute)) return { status: "missing", actualSha256: null };
  const stat = fs.statSync(absolute);
  if (!stat.isFile()) return { status: "not-a-file", actualSha256: null };
  if (stat.size > MAX_REFERENCED_BYTES) return { status: "too-large", actualSha256: null };
  const digest = crypto.createHash("sha256");
  const fd = fs.openSync(absolute, "r");
  try {
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let bytes;
    while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) digest.update(buffer.subarray(0, bytes));
  } finally { fs.closeSync(fd); }
  return { status: "current", actualSha256: digest.digest("hex") };
}
function readInput(root, file) {
  const absolute = policy.localFile(root, file);
  const stat = fs.statSync(absolute);
  if (!stat.isFile() || stat.size > MAX_INPUT_BYTES) throw new Error("Outcome evidence JSON must be a local file up to 64 KiB");
  return policy.readJson(absolute);
}
function normalize(root, state, value) {
  object(value, "Outcome evidence");
  keys(value, ["schemaVersion", "requestId", "originalScenario", "expectedOutcome", "factSources", "target", "artifacts", "evidence", "gaps"], "Outcome evidence");
  if (value.schemaVersion !== 1) throw new Error("Outcome evidence schemaVersion must be 1");
  if (value.requestId !== state.requestId) throw new Error("Outcome evidence requestId does not match the native request ledger");
  const scenario = object(value.originalScenario, "originalScenario");
  keys(scenario, ["taskSha256", "description"], "originalScenario");
  const expectedTaskHash = sha256(state.task || "");
  if (hash(scenario.taskSha256, "originalScenario.taskSha256") !== expectedTaskHash) throw new Error("Outcome evidence is not bound to this original request scenario");
  const target = object(value.target, "target");
  keys(target, ["surface", "environment", "modality"], "target");
  const modality = target.modality === undefined ? "ui" : text(target.modality, "target.modality", 40);
  if (!["ui", "artifact", "native-script", "interpreted"].includes(modality)) throw new Error("target.modality must be ui, artifact, native-script or interpreted");
  const facts = Array.isArray(value.factSources) ? value.factSources : [];
  if (facts.length > 20) throw new Error("factSources may contain at most 20 entries");
  const factSources = facts.map((fact, index) => {
    object(fact, `factSources[${index}]`);
    keys(fact, ["ref", "sha256"], `factSources[${index}]`);
    const ref = text(fact.ref, `factSources[${index}].ref`, 500);
    if (/^https:\/\//iu.test(ref)) return { ref, sha256: fact.sha256 === undefined || fact.sha256 === null ? null : hash(fact.sha256, `factSources[${index}].sha256`) };
    const relative = projectPath(root, ref, `factSources[${index}].ref`);
    return { ref: relative, sha256: hash(fact.sha256, `factSources[${index}].sha256`) };
  });
  const artifacts = Array.isArray(value.artifacts) ? value.artifacts : [];
  if (artifacts.length > 8) throw new Error("artifacts may contain at most 8 entries");
  const roles = new Set();
  const normalizedArtifacts = artifacts.map((artifact, index) => {
    object(artifact, `artifacts[${index}]`);
    keys(artifact, ["role", "path", "sha256"], `artifacts[${index}]`);
    if (!["source", "built"].includes(artifact.role) || roles.has(artifact.role)) throw new Error("artifacts must have at most one source and one built file");
    roles.add(artifact.role);
    return { role: artifact.role, path: projectPath(root, artifact.path, `artifacts[${index}].path`), sha256: hash(artifact.sha256, `artifacts[${index}].sha256`) };
  });
  const buildNotApplicable = ["native-script", "interpreted"].includes(modality);
  if (!roles.has("source")) throw new Error("artifacts must include one source file");
  if (roles.has("built") === buildNotApplicable) {
    throw new Error(buildNotApplicable ? "interpreted targets must omit a built artifact" : "ui and artifact targets must include a built artifact");
  }
  const evidence = Array.isArray(value.evidence) ? value.evidence : [];
  if (evidence.length > 24) throw new Error("evidence may contain at most 24 entries");
  const normalizedEvidence = evidence.map((item, index) => {
    object(item, `evidence[${index}]`);
    keys(item, ["kind", "ref", "sha256", "surface", "environment", "sourceSha256", "builtSha256", "provider", "tag", "commit", "url"], `evidence[${index}]`);
    if (!["publication-receipt", "render-observation", "installation-observation", "active-observation"].includes(item.kind)) throw new Error(`evidence[${index}].kind is unsupported`);
    if (item.kind === "render-observation" && modality !== "ui") throw new Error(`evidence[${index}] render-observation requires a ui target`);
    const normalizedItem = {
      kind: item.kind,
      ref: projectPath(root, item.ref, `evidence[${index}].ref`),
      sha256: hash(item.sha256, `evidence[${index}].sha256`),
      surface: text(item.surface, `evidence[${index}].surface`, 300),
      environment: text(item.environment, `evidence[${index}].environment`, 300),
      sourceSha256: hash(item.sourceSha256, `evidence[${index}].sourceSha256`),
      builtSha256: buildNotApplicable ? null : hash(item.builtSha256, `evidence[${index}].builtSha256`),
    };
    if (buildNotApplicable && item.builtSha256 !== null) throw new Error(`evidence[${index}].builtSha256 must be null when the target has no build step`);
    if (item.kind === "publication-receipt") {
      normalizedItem.provider = text(item.provider, `evidence[${index}].provider`, 120);
      for (const field of ["tag", "commit", "url"]) {
        normalizedItem[field] = item[field] === undefined || item[field] === null || item[field] === "" ? null : text(item[field], `evidence[${index}].${field}`, 500);
      }
      if (!normalizedItem.tag && !normalizedItem.commit && !normalizedItem.url) throw new Error(`evidence[${index}] publication receipt needs a tag, commit or URL`);
    } else if (["provider", "tag", "commit", "url"].some(field => item[field] !== undefined)) {
      throw new Error(`evidence[${index}] publication fields require kind publication-receipt`);
    }
    return normalizedItem;
  });
  const gaps = Array.isArray(value.gaps) ? value.gaps : [];
  if (gaps.length > 20) throw new Error("gaps may contain at most 20 entries");
  return {
    schemaVersion: 1,
    requestId: state.requestId,
    originalScenario: { taskSha256: expectedTaskHash, description: text(scenario.description, "originalScenario.description", 1200) },
    expectedOutcome: text(value.expectedOutcome, "expectedOutcome", 1200),
    factSources,
    target: { surface: text(target.surface, "target.surface", 300), environment: text(target.environment, "target.environment", 300), modality },
    artifacts: normalizedArtifacts,
    evidence: normalizedEvidence,
    gaps: gaps.map((gap, index) => text(gap, `gaps[${index}]`, 300)),
  };
}
function evaluate(root, evidence) {
  const gaps = evidence.gaps.map(detail => ({ code: "declared-gap", detail }));
  const addGap = (code, detail) => { if (!gaps.some(item => item.code === code && item.detail === detail)) gaps.push({ code, detail }); };
  const facts = evidence.factSources.map(item => {
    if (/^https:\/\//iu.test(item.ref)) {
      addGap("external-fact-reference-unverified", item.ref);
      return { ref: item.ref, status: "reference-only" };
    }
    const current = fileFingerprint(root, item.ref);
    const status = current.status !== "current" ? current.status : (current.actualSha256 !== item.sha256 ? "stale" : "current");
    if (status !== "current") addGap(status === "stale" ? "fact-source-fingerprint-stale" : "fact-source-unavailable", item.ref);
    return { ref: item.ref, status, sha256: current.actualSha256 };
  });
  if (!facts.length) addGap("product-fact-sources-missing", "No product fact sources were referenced.");
  const artifacts = Object.fromEntries(["source", "built"].map(role => {
    const item = evidence.artifacts.find(candidate => candidate.role === role);
    if (!item && role === "built" && ["native-script", "interpreted"].includes(evidence.target.modality)) {
      return [role, { status: "not-applicable", path: null, sha256: null }];
    }
    if (!item) { addGap(`${role}-artifact-missing`, `No ${role} artifact fingerprint was recorded.`); return [role, { status: "unknown", path: null, sha256: null }]; }
    const current = fileFingerprint(root, item.path);
    const status = current.status !== "current" ? current.status : (current.actualSha256 === item.sha256 ? "current" : "stale");
    if (status !== "current") addGap(`${role}-artifact-${status}`, item.path);
    return [role, { status, path: item.path, expectedSha256: item.sha256, actualSha256: current.actualSha256 }];
  }));
  const classifications = {
    published: "publication-receipt",
    rendered: "render-observation",
    installed: "installation-observation",
    active: "active-observation",
  };
  const statuses = { facts, source: artifacts.source, built: artifacts.built };
  for (const [statusName, requiredKind] of Object.entries(classifications)) {
    const candidates = evidence.evidence.filter(item => item.kind === requiredKind);
    let accepted = false;
    let stale = false;
    const acceptedRefs = [];
    for (const item of evidence.evidence) {
      const ref = fileFingerprint(root, item.ref);
      if (ref.status !== "current" || ref.actualSha256 !== item.sha256) {
        stale = true;
        addGap("evidence-reference-stale-or-missing", item.ref);
        continue;
      }
      if (item.surface !== evidence.target.surface || item.environment !== evidence.target.environment) {
        addGap("evidence-target-mismatch", `${item.ref} does not match ${evidence.target.surface} in ${evidence.target.environment}.`);
        continue;
      }
      if (item.sourceSha256 !== artifacts.source.expectedSha256 || item.builtSha256 !== (evidence.target.modality === "native-script" || evidence.target.modality === "interpreted" ? null : artifacts.built.expectedSha256)) {
        stale = true;
        addGap("evidence-artifact-fingerprint-mismatch", item.ref);
        continue;
      }
      if (artifacts.source.status !== "current" || (artifacts.built.status !== "current" && artifacts.built.status !== "not-applicable")) {
        stale = true;
        continue;
      }
      if (item.kind === requiredKind && (statusName !== "rendered" || evidence.target.modality === "ui")) { accepted = true; acceptedRefs.push(item.ref); }
    }
    statuses[statusName] = { status: accepted ? "evidence-recorded" : (stale && candidates.length ? "stale" : "unknown"), evidenceRefs: acceptedRefs };
    if (!accepted && candidates.length === 0) {
      const code = statusName === "published" ? "publication-receipt-missing" : `${statusName}-observation-missing`;
      addGap(code, statusName === "published" ? "No matching local publication receipt was recorded." : `No matching ${statusName} observation was recorded.`);
    } else if (!accepted && candidates.length) addGap(`${statusName}-evidence-not-current`, `Recorded ${statusName} evidence is stale or does not match the exact target.`);
  }
  const summary = "Evidence status is scoped to the recorded request, target and fingerprints; it does not establish semantic quality or independently verify remote publication.";
  return { summary, statuses, gaps };
}
function recordOutcome(root, stateFile, inputFile) {
  const record = policy.loadState(root, stateFile);
  const evidence = normalize(root, record.state, readInput(root, inputFile));
  const file = policy.localFile(root, path.join(record.directory, OUTCOME_FILE));
  policy.writeJson(file, { recordedAt: new Date().toISOString(), ...evidence });
  return evaluate(root, evidence);
}
function outcomeStatus(root, stateFile) {
  const record = policy.loadState(root, stateFile);
  const file = policy.localFile(root, path.join(record.directory, OUTCOME_FILE));
  if (!fs.existsSync(file)) return {
    summary: "No optional outcome evidence has been recorded for this request.",
    statuses: Object.fromEntries(["facts", "source", "built", "published", "rendered", "installed", "active"].map(key => [key, { status: "unknown" }])),
    gaps: [{ code: "outcome-not-recorded", detail: "Outcome evidence is optional; no release or semantic acceptance is inferred." }],
  };
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > MAX_INPUT_BYTES) throw new Error("Stored outcome evidence exceeds the 64 KiB limit");
  const stored = policy.readJson(file);
  if (stored.schemaVersion !== 1 || stored.requestId !== record.state.requestId || stored.originalScenario?.taskSha256 !== sha256(record.state.task || "")) {
    throw new Error("Stored outcome evidence is not bound to this native request");
  }
  const { recordedAt, ...storedEvidence } = stored;
  if (typeof recordedAt !== "string") throw new Error("Stored outcome evidence has no recording timestamp");
  const normalized = normalize(root, record.state, storedEvidence);
  return evaluate(root, normalized);
}

module.exports = { recordOutcome, outcomeStatus, evaluate };
