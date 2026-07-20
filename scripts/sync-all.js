#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function parseArgs(argv) {
  const options = { apply: false, searchRoot: path.join(require("os").homedir(), "Documents") };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--dry-run" || arg === "--preview") options.apply = false;
    else if (arg === "--plan-dir") options.planDir = argv[++index];
    else if (arg === "--search-dir") options.searchRoot = argv[++index];
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else options.searchRoot = arg;
  }
  if (!options.planDir) throw new Error("--plan-dir is required; review this directory before a separate --apply run");
  return options;
}

function discover(directory, depth = 0) {
  if (depth > 3) return [];
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name === ".git" || entry.name === "node_modules" || entry.name === "_archive") continue;
    const child = path.join(directory, entry.name);
    if (fs.existsSync(path.join(child, ".template-manifest.json"))) results.push(child);
    else results.push(...discover(child, depth + 1));
  }
  return results;
}

function planName(project) {
  const suffix = crypto.createHash("sha256").update(fs.realpathSync.native(project)).digest("hex").slice(0, 12);
  return `${path.basename(project)}-${suffix}.json`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const searchRoot = fs.realpathSync.native(path.resolve(options.searchRoot));
  const templateRoot = fs.realpathSync.native(path.resolve(__dirname, ".."));
  const planDir = path.resolve(options.planDir);
  if (!options.apply) fs.mkdirSync(planDir, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(planDir)) throw new Error("Plan directory does not exist; run preview first");
  const projects = discover(searchRoot).filter((project) => fs.realpathSync.native(project) !== templateRoot);
  let passed = 0;
  let conflicts = 0;
  let failed = 0;

  for (const project of projects) {
    const planFile = path.join(planDir, planName(project));
    const args = [path.join(__dirname, "sync-template.js"), templateRoot, project, "--plan-file", planFile];
    if (options.apply) args.push("--apply");
    const result = spawnSync(process.execPath, args, { encoding: "utf8" });
    const label = path.relative(searchRoot, project) || path.basename(project);
    if (result.status === 0) { console.log(`OK ${label}`); passed += 1; }
    else if (result.status === 2) { console.log(`CONFLICT ${label}`); conflicts += 1; }
    else { console.error(`FAILED ${label}: ${(result.stderr || result.stdout).trim()}`); failed += 1; }
  }
  console.log(`projects=${projects.length}; ok=${passed}; conflicts=${conflicts}; failed=${failed}; mode=${options.apply ? "apply" : "preview"}`);
  if (conflicts || failed) process.exitCode = 1;
}

try { main(); } catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
