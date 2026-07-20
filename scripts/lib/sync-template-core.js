#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { getCategory, isPayloadPath, isSourceOnlyPath, normalizeRelative } = require("./template-payload-policy.js");

const BEGIN = "# BEGIN agent-project-template managed MCP";
const END = "# END agent-project-template managed MCP";
const MANAGED_MCP = ["context-router", "engram", "codebase-memory-mcp"];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function lstatIfPresent(filePath) {
  try { return fs.lstatSync(filePath); } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function relationInside(root, candidate) {
  const relation = path.relative(root, candidate);
  return relation === "" || (!relation.startsWith(`..${path.sep}`) && relation !== ".." && !path.isAbsolute(relation));
}

function inspectPath(root, rawPath, { allowMissing = true, requireFile = true } = {}) {
  const relativePath = normalizeRelative(rawPath);
  const parts = relativePath.split("/");
  const candidate = path.resolve(root, ...parts);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.resolve(current, part);
    if (!relationInside(root, current)) throw new Error(`Path escapes root: ${relativePath}`);
    const info = lstatIfPresent(current);
    if (!info && allowMissing) return { path: candidate, relativePath, info: null };
    if (!info) throw new Error(`Missing path: ${relativePath}`);
    if (info.isSymbolicLink()) throw new Error(`Symlink/reparse path is not allowed: ${relativePath}`);
    if (index < parts.length - 1 && !info.isDirectory()) {
      throw new Error(`Non-directory path component: ${relativePath}`);
    }
    if (index === parts.length - 1 && requireFile && !info.isFile()) {
      throw new Error(`Expected regular file: ${relativePath}`);
    }
    if (index === parts.length - 1 && !requireFile && !info.isDirectory()) {
      throw new Error(`Expected real directory: ${relativePath}`);
    }
    const real = fs.realpathSync.native(current);
    if (!relationInside(root, real)) throw new Error(`Path resolves outside root: ${relativePath}`);
  }
  return { path: current, relativePath, info: fs.lstatSync(current) };
}

function readFileState(root, relativePath) {
  const inspected = inspectPath(root, relativePath);
  if (!inspected.info) return { hash: null, size: null };
  const content = fs.readFileSync(inspected.path);
  return { hash: sha256(content), size: content.length };
}

function readTextIfPresent(root, relativePath) {
  const inspected = inspectPath(root, relativePath);
  return inspected.info ? fs.readFileSync(inspected.path, "utf8") : "";
}

function walkFiles(root, directory = "") {
  const absolute = directory ? path.join(root, ...directory.split("/")) : root;
  const results = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist" || entry.isSymbolicLink()) continue;
    const relativePath = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) results.push(...walkFiles(root, relativePath));
    else if (entry.isFile()) results.push(relativePath);
  }
  return results;
}

function listSourceFiles(templateRoot) {
  let files;
  try {
    files = execFileSync("git", ["-C", templateRoot, "ls-files", "-z"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\0").filter(Boolean);
  } catch {
    files = walkFiles(templateRoot);
  }
  return [...new Set(files.map(normalizeRelative).filter(isPayloadPath))].sort();
}

function findBlock(text, label) {
  const start = text.indexOf(BEGIN);
  const marker = text.indexOf(END);
  if (start < 0 && marker < 0) return null;
  if (start < 0 || marker < start) throw new Error(`${label}: malformed managed MCP markers`);
  if (text.indexOf(BEGIN, start + BEGIN.length) >= 0 || text.indexOf(END, marker + END.length) >= 0) {
    throw new Error(`${label}: duplicate managed MCP markers`);
  }
  return { start, end: marker + END.length, text: text.slice(start, marker + END.length) };
}

function mergeCodexConfig(configText, referenceText) {
  const reference = findBlock(referenceText, "reference");
  if (!reference) throw new Error("reference: managed MCP block is missing");
  const wanted = reference.text.replace(/^\uFEFF/u, "").replace(/\r\n/gu, "\n").trim();
  const current = findBlock(configText, ".codex/config.toml");
  const outside = current ? `${configText.slice(0, current.start)}\n${configText.slice(current.end)}` : configText;
  for (const name of MANAGED_MCP) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    if (new RegExp(`^\\s*\\[mcp_servers\\.(?:${escaped}|"${escaped}")\\]\\s*$`, "mu").test(outside)) {
      throw new Error(`.codex/config.toml: unmanaged [mcp_servers.${name}] conflicts with managed MCP`);
    }
  }
  const newline = configText.includes("\r\n") ? "\r\n" : "\n";
  const rendered = wanted.replace(/\n/gu, newline);
  if (current) return `${configText.slice(0, current.start)}${rendered}${configText.slice(current.end)}`;
  const prefix = configText ? `${configText.replace(/[\r\n]+$/u, "")}${newline}${newline}` : "";
  return `${prefix}${rendered}${newline}`;
}

function parseManifest(projectRoot, bootstrap) {
  const inspected = inspectPath(projectRoot, ".template-manifest.json");
  if (!inspected.info) {
    if (bootstrap) return { template_version: "unknown", template_remote: "", files: {} };
    throw new Error("Missing .template-manifest.json; run a preview with --bootstrap first");
  }
  const manifest = JSON.parse(fs.readFileSync(inspected.path, "utf8"));
  const files = {};
  for (const [rawPath, rawInfo] of Object.entries(manifest.files || {})) {
    const relativePath = normalizeRelative(rawPath);
    const category = String(rawInfo.category || "template");
    if (!['template', 'hybrid', 'project'].includes(category)) throw new Error(`Invalid manifest category: ${relativePath}`);
    inspectPath(projectRoot, relativePath);
    files[relativePath] = { category, hash: String(rawInfo.hash || "") };
  }
  return { ...manifest, files };
}

function templateVersion(templateRoot) {
  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    const match = readTextIfPresent(templateRoot, file).match(/Template Version:\s*([0-9]+\.[0-9]+\.[0-9]+)/u);
    if (match) return match[1];
  }
  throw new Error("Template version marker is missing");
}

function chooseAction({ relativePath, category, oldHash, local, source, overwriteConflicts }) {
  if (category === "project") {
    if (local.hash) return { type: "preserve", reason: "project-owned" };
    if (source) return { type: "write", reason: "missing-project-default" };
    return { type: "preserve", reason: "missing-project-owned" };
  }
  if (!source) return { type: "deprecated", reason: "removed-from-template" };
  if (!local.hash) return { type: "write", reason: "missing-locally" };
  if (local.hash === source.hash) return { type: "adopt", reason: "already-target" };
  if (source.hash === oldHash) return { type: "preserve", reason: "template-unchanged" };
  if (local.hash === oldHash) return { type: "write", reason: "clean-template-update" };
  if (overwriteConflicts) return { type: "write", reason: "explicit-conflict-overwrite" };
  return { type: "conflict", reason: "local-and-template-changed", relativePath };
}

function buildPlan(options) {
  const projectRoot = fs.realpathSync.native(path.resolve(options.projectRoot));
  const templateRoot = fs.realpathSync.native(path.resolve(options.templateRoot));
  const manifest = parseManifest(projectRoot, options.bootstrap);
  const sourceFiles = listSourceFiles(templateRoot);
  const sourceSet = new Set(sourceFiles);
  const allPaths = [...new Set([...Object.keys(manifest.files), ...sourceFiles])].sort();
  const actions = [];
  const conflicts = [];
  const contents = new Map();
  const nextFiles = {};

  for (const relativePath of allPaths) {
    if (isSourceOnlyPath(relativePath) || relativePath === ".claude/settings.local.json") continue;
    const previous = manifest.files[relativePath];
    let category = previous?.category || getCategory(relativePath);
    if (relativePath === ".codex/config.toml") category = "hybrid";
    const local = readFileState(projectRoot, relativePath);
    let source = sourceSet.has(relativePath) ? readFileState(templateRoot, relativePath) : null;
    let special = null;

    if (relativePath === ".codex/config.toml" && source) {
      const reference = readTextIfPresent(templateRoot, "_reference/codex-mcp-config.toml");
      const merged = Buffer.from(mergeCodexConfig(readTextIfPresent(projectRoot, relativePath), reference));
      source = { hash: sha256(merged), size: merged.length };
      contents.set(relativePath, merged);
      special = "managed-codex-merge";
    }

    let choice;
    if (special) choice = local.hash === source.hash ? { type: "adopt", reason: "managed-block-current" } : { type: "write", reason: "managed-block-update" };
    else if (!previous && local.hash && category === "project") choice = { type: "preserve", reason: "new-project-owned-path" };
    else choice = chooseAction({ relativePath, category, oldHash: previous?.hash || null, local, source, overwriteConflicts: options.overwriteConflicts });
    const action = { path: relativePath, category, before: local.hash, after: source?.hash || local.hash, type: choice.type, reason: choice.reason };
    if (special) action.special = special;
    actions.push(action);
    if (choice.type === "conflict") conflicts.push({ path: relativePath, before: local.hash, source: source.hash });
    if (choice.type === "deprecated" || choice.type === "conflict") continue;
    if (choice.type === "preserve" && category === "project") nextFiles[relativePath] = { category, hash: local.hash || source?.hash || previous?.hash || "" };
    else if (choice.type === "preserve") nextFiles[relativePath] = { category, hash: previous?.hash || source.hash };
    else nextFiles[relativePath] = { category, hash: source.hash };
  }

  const version = templateVersion(templateRoot);
  const planDate = options.planDate || new Date().toISOString().slice(0, 10);
  const nextManifest = {
    ...manifest,
    template_version: conflicts.length ? manifest.template_version : version,
    created: manifest.created || planDate,
    updated: planDate,
    files: Object.fromEntries(Object.entries(nextFiles).sort(([left], [right]) => left.localeCompare(right))),
  };
  if (options.remote) nextManifest.template_remote = options.remote;
  const manifestText = `${JSON.stringify(nextManifest, null, 2)}\n`;
  const sourceFingerprint = sha256(stableJson(sourceFiles.map((file) => [file, readFileState(templateRoot, file).hash])));
  const plan = {
    schema: 1,
    date: nextManifest.updated,
    source: { commit: options.commit || null, fingerprint: sourceFingerprint, ref: options.ref || null, remote: options.remote || null, version },
    target: { manifestBefore: readFileState(projectRoot, ".template-manifest.json").hash, root: projectRoot },
    policy: { bootstrap: Boolean(options.bootstrap), overwriteConflicts: Boolean(options.overwriteConflicts) },
    actions,
    conflicts,
    manifestAfter: sha256(manifestText),
  };
  plan.digest = sha256(stableJson(plan));
  return { contents, manifestText, plan, projectRoot, templateRoot };
}

module.exports = { buildPlan, inspectPath, readFileState, sha256, stableJson };
