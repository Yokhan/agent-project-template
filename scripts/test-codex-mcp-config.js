#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { BEGIN, END, mergeConfig, parseArgs, run } = require("./configure-codex-mcp.js");

const block = `${BEGIN}\n[mcp_servers.engram]\ncommand = "engram"\n${END}\n`;

function main() {
  const added = mergeConfig("[agents]\nmax_depth = 1\n", block);
  assert.strictEqual(added.status, "added");
  assert(added.text.includes("[agents]"));
  assert(added.text.includes("[mcp_servers.engram]"));

  const current = `[agents]\nmax_depth = 1\n\n${BEGIN}\n[mcp_servers.engram]\ncommand = "old"\n${END}\n`;
  const updated = mergeConfig(current, block);
  assert.strictEqual(updated.status, "updated");
  assert(updated.text.includes('command = "engram"'));
  assert(!updated.text.includes('command = "old"'));

  const unchanged = mergeConfig(updated.text, block);
  assert.strictEqual(unchanged.status, "ok");
  assert.strictEqual(unchanged.changed, false);

  assert.throws(
    () => mergeConfig('[mcp_servers.engram]\ncommand = "custom"\n', block),
    /unmanaged \[mcp_servers\.engram\] conflicts/u,
  );
  assert.deepStrictEqual(parseArgs(["--check", "--root", "."]).mode, "check");
  assert(parseArgs(["--reference", "_reference/codex-mcp-config.toml"]).reference.endsWith("codex-mcp-config.toml"));

  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mcp-path-safety-"));
  const reference = path.join(fixture, "reference.toml");
  fs.writeFileSync(reference, block, "utf8");
  try {
    const targetRoot = path.join(fixture, "target-root");
    const targetExternal = path.join(fixture, "target-external.toml");
    fs.mkdirSync(path.join(targetRoot, ".codex"), { recursive: true });
    fs.writeFileSync(targetExternal, "external target sentinel\n", "utf8");
    try {
      fs.symlinkSync(targetExternal, path.join(targetRoot, ".codex", "config.toml"), "file");
      assert.throws(() => run({ root: targetRoot, reference, mode: "apply" }), /regular file/u);
      assert.strictEqual(fs.readFileSync(targetExternal, "utf8"), "external target sentinel\n");
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOSYS"].includes(error.code)) throw error;
    }

    const parentRoot = path.join(fixture, "parent-root");
    const parentExternal = path.join(fixture, "parent-external");
    fs.mkdirSync(parentRoot);
    fs.mkdirSync(parentExternal);
    fs.writeFileSync(path.join(parentExternal, "config.toml"), "external parent sentinel\n", "utf8");
    try {
      fs.symlinkSync(parentExternal, path.join(parentRoot, ".codex"), process.platform === "win32" ? "junction" : "dir");
      assert.throws(() => run({ root: parentRoot, reference, mode: "apply" }), /real directory/u);
      assert.strictEqual(fs.readFileSync(path.join(parentExternal, "config.toml"), "utf8"), "external parent sentinel\n");
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOSYS"].includes(error.code)) throw error;
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
  console.log("Codex MCP config tests passed");
}

main();
