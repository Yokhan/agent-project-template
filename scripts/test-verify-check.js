"use strict";

// Run against a disposable Git repository, never the user's working tree.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const script = path.resolve(__dirname, "verify-check.sh");
function findBash() {
  if (process.platform !== "win32") return "bash";
  const gitPaths = spawnSync("where.exe", ["git.exe"], { encoding: "utf8" }).stdout || "";
  const candidates = [process.env.BASH_EXE];
  for (const gitPath of gitPaths.trim().split(/\r?\n/).filter(Boolean)) {
    const base = path.dirname(gitPath);
    candidates.push(path.resolve(base, "../bin/bash.exe"), path.resolve(base, "../usr/bin/bash.exe"));
  }
  candidates.push(path.join(process.env.ProgramFiles || "C:/Program Files", "Git/bin/bash.exe"));
  const found = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (!found) throw new Error("Git Bash not found; put Git on PATH or set BASH_EXE to its executable");
  return found;
}
const bash = findBash();
const prefix = path.join(os.tmpdir(), "agent-template-verify-");
const tempRoot = fs.mkdtempSync(prefix);
const fixture = path.join(tempRoot, "subject");
const sentinel = path.join(tempRoot, "sentinel");
const hooks = path.join(tempRoot, "no-hooks");
const globalConfig = path.join(tempRoot, "empty-gitconfig");
function isolatedGitEnv(source) {
  return {
    ...Object.fromEntries(Object.entries(source).filter(([key]) => !/^GIT_/i.test(key))),
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: globalConfig,
  };
}
const hostileEnv = { ...process.env, GIT_DIR: path.join(sentinel, ".git"),
  GIT_WORK_TREE: sentinel, GIT_INDEX_FILE: path.join(sentinel, ".git/index"),
  GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.hooksPath", GIT_CONFIG_VALUE_0: "inherited-hooks" };
const env = isolatedGitEnv(hostileEnv);
const gitAt = (cwd, ...args) => execFileSync("git", ["-c", `core.hooksPath=${hooks}`, ...args],
  { cwd, env, stdio: "pipe" });
const git = (...args) => gitAt(fixture, ...args);
const run = () => spawnSync(bash, [script.replaceAll("\\", "/"), "--size", "XS"], {
  cwd: fixture, env, encoding: "utf8", timeout: 15000,
});

try {
  for (const dir of [fixture, sentinel, hooks]) fs.mkdirSync(dir);
  fs.writeFileSync(globalConfig, "");
  gitAt(sentinel, "init", "--quiet");
  fs.writeFileSync(path.join(sentinel, "keep.txt"), "sentinel\n");
  gitAt(sentinel, "add", ".");
  const sentinelIndex = fs.readFileSync(path.join(sentinel, ".git/index"));
  const sentinelHead = fs.readFileSync(path.join(sentinel, ".git/HEAD"));
  git("init", "--quiet");
  fs.writeFileSync(path.join(fixture, "cohesive.js"), "// baseline\n");
  fs.writeFileSync(path.join(fixture, "data.json"), "{}\n");
  git("add", ".");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
    "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture");

  fs.writeFileSync(path.join(fixture, "cohesive.js"), "// cohesive fixture\n".repeat(500));
  const large = run();
  assert.equal(large.status, 0, large.stderr || large.stdout);
  assert.match(large.stdout, /500 lines/);
  assert.match(large.stdout, /0 failed/);
  assert.doesNotMatch(large.stdout, /limit 375|FIX \d+ auto-check/);

  fs.writeFileSync(path.join(fixture, "data.json"), "{invalid\n");
  const invalid = run();
  assert.equal(invalid.status, 1, invalid.stderr || invalid.stdout);
  assert.match(invalid.stdout, /JSON: data.json/);
  assert.match(invalid.stdout, /1 failed/);
  assert.deepEqual(fs.readFileSync(path.join(sentinel, ".git/index")), sentinelIndex);
  assert.deepEqual(fs.readFileSync(path.join(sentinel, ".git/HEAD")), sentinelHead);
  assert.equal(fs.readFileSync(path.join(sentinel, "keep.txt"), "utf8"), "sentinel\n");
  console.log("verify-check: large file accepted; invalid JSON fails; inherited Git state isolated (3/3)");
} finally {
  const resolved = path.resolve(tempRoot);
  assert.ok(resolved.startsWith(path.resolve(prefix)) && resolved !== path.resolve(os.tmpdir()));
  fs.rmSync(resolved, { recursive: true, force: true });
}
