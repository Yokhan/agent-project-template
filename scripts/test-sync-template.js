#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const cli = path.resolve(__dirname, "sync-template.js");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "native-template-sync-"));

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

function manifest(project, files, remote = "") {
  const entries = {};
  for (const [file, category, installedText] of files) entries[file] = { category, hash: hash(installedText) };
  write(path.join(project, ".template-manifest.json"), `${JSON.stringify({ template_version: "1.0.0", template_remote: remote, files: entries }, null, 2)}\n`);
}

function fixture(name) {
  const base = path.join(root, name);
  const template = path.join(base, "template");
  const project = path.join(base, "project");
  fs.mkdirSync(template, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  const oldReadme = "old readme\n";
  const oldAgents = "# Agents\n<!-- Template Version: 1.0.0 -->\n";
  const localClaude = "# Private project Claude\n";
  const oldConfig = '[features]\ncustom = true\n\n# BEGIN agent-project-template managed MCP\n[mcp_servers.engram]\ncommand = "old"\n# END agent-project-template managed MCP\n';
  write(path.join(project, "README.md"), oldReadme);
  write(path.join(project, "AGENTS.md"), oldAgents);
  write(path.join(project, "CLAUDE.md"), localClaude);
  write(path.join(project, ".codex/config.toml"), oldConfig);
  manifest(project, [
    ["README.md", "template", oldReadme],
    ["AGENTS.md", "template", oldAgents],
    ["CLAUDE.md", "project", localClaude],
    [".codex/config.toml", "hybrid", oldConfig],
  ]);

  write(path.join(template, "README.md"), "new readme\n");
  write(path.join(template, "AGENTS.md"), "# Agents\n<!-- Template Version: 9.9.9 -->\n");
  write(path.join(template, "CLAUDE.md"), "# Default Claude\n<!-- Template Version: 9.9.9 -->\n");
  write(path.join(template, ".codex/config.toml"), oldConfig);
  write(path.join(template, "_reference/codex-mcp-config.toml"), '# BEGIN agent-project-template managed MCP\n[mcp_servers.engram]\ncommand = "engram"\n# END agent-project-template managed MCP\n');
  write(path.join(template, "setup.sh"), "must not ship\n");
  return { base, template, project, plan: path.join(base, "accepted-plan.json") };
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
}

function git(directory, args) {
  const result = spawnSync("git", ["-C", directory, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function snapshot(directory) {
  const result = {};
  function walk(current, relative = "") {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      const key = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory() && !entry.isSymbolicLink()) walk(child, key);
      else result[key] = entry.isSymbolicLink() ? "symlink" : hash(fs.readFileSync(child));
    }
  }
  walk(directory);
  return result;
}

try {
  const clean = fixture("clean");
  const beforePreview = snapshot(clean.project);
  let result = run([clean.template, clean.project, "--plan-file", clean.plan]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PREVIEW saved/u);
  assert.deepStrictEqual(snapshot(clean.project), beforePreview, "preview changed target");
  assert(fs.existsSync(clean.plan));
  result = run([clean.template, clean.project, "--plan-file", clean.plan]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepStrictEqual(snapshot(clean.project), beforePreview, "repeated preview changed target");

  result = run([clean.template, clean.project, "--plan-file", clean.plan, "--apply"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(clean.project, "README.md"), "utf8"), "new readme\n");
  assert.equal(fs.readFileSync(path.join(clean.project, "CLAUDE.md"), "utf8"), "# Private project Claude\n");
  assert.match(fs.readFileSync(path.join(clean.project, ".codex/config.toml"), "utf8"), /custom = true[\s\S]*command = "engram"/u);
  assert(!fs.existsSync(path.join(clean.project, "setup.sh")));
  assert.equal(JSON.parse(fs.readFileSync(path.join(clean.project, ".template-manifest.json"), "utf8")).template_version, "9.9.9");

  const stale = fixture("stale");
  assert.equal(run([stale.template, stale.project, "--plan-file", stale.plan]).status, 0);
  write(path.join(stale.project, "README.md"), "changed after preview\n");
  const staleBefore = snapshot(stale.project);
  result = run([stale.template, stale.project, "--plan-file", stale.plan, "--apply"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Preview plan no longer matches/u);
  assert.deepStrictEqual(snapshot(stale.project), staleBefore);

  const conflict = fixture("conflict");
  write(path.join(conflict.project, "README.md"), "local readme\n");
  const conflictBefore = snapshot(conflict.project);
  result = run([conflict.template, conflict.project, "--plan-file", conflict.plan]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /CONFLICT README\.md/u);
  assert.deepStrictEqual(snapshot(conflict.project), conflictBefore);
  assert(!fs.existsSync(path.join(conflict.project, "README.md.template-new")));

  const rollback = fixture("rollback");
  assert.equal(run([rollback.template, rollback.project, "--plan-file", rollback.plan]).status, 0);
  const rollbackBefore = snapshot(rollback.project);
  result = run([rollback.template, rollback.project, "--plan-file", rollback.plan, "--apply"], { TEMPLATE_SYNC_FAIL_AFTER_WRITES: "2" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /all writes rolled back/u);
  assert.deepStrictEqual(snapshot(rollback.project), rollbackBefore);

  const linked = fixture("linked");
  const external = path.join(linked.base, "external");
  fs.mkdirSync(external);
  write(path.join(external, "sentinel.md"), "outside\n");
  fs.symlinkSync(external, path.join(linked.project, "docs"), process.platform === "win32" ? "junction" : "dir");
  write(path.join(linked.template, "docs/sentinel.md"), "template\n");
  result = run([linked.template, linked.project, "--plan-file", linked.plan]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Symlink\/reparse/u);
  assert.equal(fs.readFileSync(path.join(external, "sentinel.md"), "utf8"), "outside\n");

  const planLinked = fixture("plan-linked");
  const externalPlanDirectory = path.join(planLinked.base, "external-plan");
  const linkedPlanDirectory = path.join(planLinked.base, "linked-plan");
  fs.mkdirSync(externalPlanDirectory);
  fs.symlinkSync(externalPlanDirectory, linkedPlanDirectory, process.platform === "win32" ? "junction" : "dir");
  const linkedPlan = path.join(linkedPlanDirectory, "accepted.json");
  result = run([planLinked.template, planLinked.project, "--plan-file", linkedPlan]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /symlink\/reparse parent/u);
  assert(!fs.existsSync(path.join(externalPlanDirectory, "accepted.json")));

  const pinned = fixture("pinned");
  git(pinned.template, ["init", "-q"]);
  git(pinned.template, ["add", "."]);
  git(pinned.template, ["-c", "user.name=Sync Test", "-c", "user.email=sync@example.invalid", "commit", "-q", "-m", "release"]);
  git(pinned.template, ["tag", "v9.9.9"]);
  const releaseCommit = git(pinned.template, ["rev-parse", "v9.9.9"]);
  write(path.join(pinned.template, "AGENTS.md"), "# Agents\n<!-- Template Version: 10.0.0 -->\n");
  write(path.join(pinned.template, "CLAUDE.md"), "# Default Claude\n<!-- Template Version: 10.0.0 -->\n");
  git(pinned.template, ["add", "AGENTS.md", "CLAUDE.md"]);
  git(pinned.template, ["-c", "user.name=Sync Test", "-c", "user.email=sync@example.invalid", "commit", "-q", "-m", "main moved"]);
  const pinnedManifest = JSON.parse(fs.readFileSync(path.join(pinned.project, ".template-manifest.json"), "utf8"));
  pinnedManifest.template_remote = pinned.template;
  write(path.join(pinned.project, ".template-manifest.json"), `${JSON.stringify(pinnedManifest, null, 2)}\n`);
  const pinnedBefore = snapshot(pinned.project);
  result = run(["--from-git", "--ref", "v9.9.9", "--project-dir", pinned.project, "--plan-file", pinned.plan]);
  assert.equal(result.status, 0, result.stderr);
  const accepted = JSON.parse(fs.readFileSync(pinned.plan, "utf8"));
  assert.equal(accepted.source.commit, releaseCommit);
  assert.equal(accepted.source.version, "9.9.9");
  assert.deepStrictEqual(snapshot(pinned.project), pinnedBefore);
  result = run(["--from-git", "--ref", "v9.9.9", "--project-dir", pinned.project, "--plan-file", pinned.plan, "--apply"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(path.join(pinned.project, "AGENTS.md"), "utf8"), /9\.9\.9/u);
  assert.doesNotMatch(fs.readFileSync(path.join(pinned.project, "AGENTS.md"), "utf8"), /10\.0\.0/u);

  console.log("Native template sync security and transaction tests passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
