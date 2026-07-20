#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { buildPlan, stableJson } = require("./lib/sync-template-core.js");
const { applyPlan } = require("./lib/sync-template-apply.js");

function parseArgs(argv) {
  const options = { apply: false, bootstrap: false, canary: false, fromGit: false, overwriteConflicts: false, projectRoot: process.cwd() };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--dry-run" || arg === "--preview") options.apply = false;
    else if (arg === "--bootstrap") options.bootstrap = true;
    else if (arg === "--canary") options.canary = true;
    else if (arg === "--from-git") options.fromGit = true;
    else if (arg === "--overwrite-conflicts") options.overwriteConflicts = true;
    else if (arg === "--force") throw new Error("--force is retired; use --overwrite-conflicts explicitly and keep transactional rollback enabled");
    else if (["--ref", "--template-ref", "--project-dir", "--plan-file"].includes(arg)) {
      const value = argv[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      if (arg === "--ref" || arg === "--template-ref") options.ref = value;
      else if (arg === "--project-dir") options.projectRoot = value;
      else options.planFile = value;
    } else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else positional.push(arg);
  }
  if (positional.length > 2) throw new Error("Too many positional paths");
  if (positional[0]) options.templateRoot = positional[0];
  if (positional[1]) options.projectRoot = positional[1];
  return options;
}

function help() {
  console.log(`Usage:
  node scripts/sync-template.js TEMPLATE PROJECT --plan-file PLAN.json
  node scripts/sync-template.js TEMPLATE PROJECT --plan-file PLAN.json --apply
  node scripts/sync-template.js --from-git --ref vX.Y.Z --project-dir PROJECT --plan-file PLAN.json [--apply]

Preview is the default and never writes into PROJECT. Apply requires the exact preview plan.
Options:
  --overwrite-conflicts  Plan explicit replacement of locally modified template files
  --bootstrap            Create the first manifest transactionally
  --canary               Allow a non-release git ref
  --force                Retired; backup/rollback can no longer be disabled`);
}

function command(commandName, args, options = {}) {
  return execFileSync(commandName, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
}

function assertRealDirectoryPath(directoryPath, label) {
  const resolved = path.resolve(directoryPath);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  const parts = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const part of parts) {
    current = path.join(current, part);
    const info = fs.lstatSync(current);
    if (info.isSymbolicLink()) throw new Error(`${label} may not traverse a symlink/reparse parent`);
    if (!info.isDirectory()) throw new Error(`${label} parent must be a real directory`);
  }
  return resolved;
}

function readManifestRemote(projectRoot) {
  const file = path.join(path.resolve(projectRoot), ".template-manifest.json");
  if (!fs.existsSync(file)) return "";
  const info = fs.lstatSync(file);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error("Manifest must be a regular file, not a symlink/reparse point");
  return String(JSON.parse(fs.readFileSync(file, "utf8")).template_remote || "");
}

function configuredRemote(projectRoot) {
  try { return command("git", ["-C", path.resolve(projectRoot), "remote", "get-url", "template"]); } catch { return ""; }
}

function resolveSource(options) {
  if (!options.fromGit) {
    if (!options.templateRoot) throw new Error("Template path is required unless --from-git is used");
    const templateRoot = fs.realpathSync.native(path.resolve(options.templateRoot));
    let commit = null;
    try { commit = command("git", ["-C", templateRoot, "rev-parse", "HEAD"]); } catch { /* synthetic fixture */ }
    return { templateRoot, commit, ref: options.ref || null, remote: null, cleanup() {} };
  }

  if (!options.ref && !options.canary) throw new Error("Normal git updates require --ref vX.Y.Z");
  if (options.ref && !/^v[0-9]+\.[0-9]+\.[0-9]+$/u.test(options.ref) && !options.canary) {
    throw new Error(`Non-release ref requires --canary: ${options.ref}`);
  }
  const manifestRemote = readManifestRemote(options.projectRoot);
  const gitRemote = configuredRemote(options.projectRoot);
  if (manifestRemote && gitRemote && manifestRemote !== gitRemote) throw new Error("Template remote conflicts with manifest; no target state was changed");
  const remote = gitRemote || manifestRemote;
  if (!remote) throw new Error("No template remote configured in git or manifest");

  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "template-fetch-"));
  try {
    command("git", ["-C", fixture, "init", "-q"]);
    const fetchRef = options.ref && /^v[0-9]+\.[0-9]+\.[0-9]+$/u.test(options.ref) ? `refs/tags/${options.ref}` : (options.ref || "HEAD");
    command("git", ["-C", fixture, "fetch", "--depth", "1", remote, fetchRef]);
    command("git", ["-C", fixture, "checkout", "--detach", "--quiet", "FETCH_HEAD"]);
    const commit = command("git", ["-C", fixture, "rev-parse", "HEAD"]);
    return { templateRoot: fixture, commit, ref: options.ref || null, remote, cleanup: () => fs.rmSync(fixture, { recursive: true, force: true }) };
  } catch (error) {
    fs.rmSync(fixture, { recursive: true, force: true });
    throw error;
  }
}

function summarize(plan) {
  const counts = {};
  for (const action of plan.actions) counts[action.type] = (counts[action.type] || 0) + 1;
  console.log(`Template ${plan.source.version}; commit ${plan.source.commit || "local"}`);
  console.log(`Plan ${plan.digest}`);
  console.log(Object.entries(counts).map(([key, value]) => `${key}=${value}`).join("; "));
  for (const conflict of plan.conflicts) console.log(`CONFLICT ${conflict.path}`);
}

function readSavedPlan(planFile) {
  const resolved = path.resolve(planFile);
  assertRealDirectoryPath(path.dirname(resolved), "Plan path");
  const info = fs.lstatSync(resolved);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error("Plan must be a regular file, not a symlink/reparse point");
  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!parsed || parsed.schema !== 1 || typeof parsed.digest !== "string") throw new Error("Invalid sync plan file");
  return parsed;
}

function writePlan(planFile, projectRoot, plan) {
  const resolved = path.resolve(planFile);
  const project = fs.realpathSync.native(path.resolve(projectRoot));
  const relation = path.relative(project, resolved);
  if (relation === "" || (!relation.startsWith(`..${path.sep}`) && relation !== ".." && !path.isAbsolute(relation))) {
    throw new Error("Plan file must be outside the target project so preview remains read-only");
  }
  const parent = assertRealDirectoryPath(path.dirname(resolved), "Plan path");
  const current = (() => { try { return fs.lstatSync(resolved); } catch (error) { if (error.code === "ENOENT") return null; throw error; } })();
  if (current?.isSymbolicLink() || (current && !current.isFile())) throw new Error("Plan target must be a regular file, not a symlink/reparse point");
  const temporary = path.join(parent, `.${path.basename(resolved)}.tmp-${process.pid}`);
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, resolved);
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
  if (options.help) return help();
  if (!options.planFile) throw new Error("--plan-file is required so apply can be bound to an accepted preview");
  if (options.apply && !fs.existsSync(path.resolve(options.planFile))) throw new Error("Apply requires an existing preview plan file");

  const saved = options.apply ? readSavedPlan(options.planFile) : null;
  const source = resolveSource(options);
  try {
    const result = buildPlan({ ...options, ...source, planDate: saved?.date, projectRoot: options.projectRoot });
    summarize(result.plan);
    if (options.apply) {
      if (stableJson(saved) !== stableJson(result.plan)) throw new Error("Preview plan no longer matches source or target; run preview again");
      const report = applyPlan(result);
      console.log(`APPLIED transactionally; writes=${report.writes}`);
    } else {
      writePlan(options.planFile, options.projectRoot, result.plan);
      console.log(`PREVIEW saved to ${path.resolve(options.planFile)}; target was not modified`);
      if (result.plan.conflicts.length) process.exitCode = 2;
    }
  } finally { source.cleanup(); }
}

try { main(); } catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
