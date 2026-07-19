#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const BEGIN = "# BEGIN agent-project-template managed MCP";
const END = "# END agent-project-template managed MCP";
const MANAGED_NAMES = ["context-router", "engram", "codebase-memory-mcp"];

function parseArgs(argv) {
  const options = { root: process.cwd(), reference: null, mode: "apply" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") options.root = path.resolve(argv[++index]);
    else if (arg === "--reference") options.reference = path.resolve(argv[++index]);
    else if (arg === "--check") options.mode = "check";
    else if (arg === "--dry-run") options.mode = "dry-run";
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function findBlock(text, label) {
  const begin = text.indexOf(BEGIN);
  const endMarker = text.indexOf(END);
  if (begin < 0 && endMarker < 0) return null;
  if (begin < 0 || endMarker < begin) throw new Error(`${label}: malformed managed MCP markers`);
  if (text.indexOf(BEGIN, begin + BEGIN.length) >= 0 || text.indexOf(END, endMarker + END.length) >= 0) {
    throw new Error(`${label}: duplicate managed MCP markers`);
  }
  return { start: begin, end: endMarker + END.length, text: text.slice(begin, endMarker + END.length) };
}

function normalizeBlock(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
}

function findManagedTable(text) {
  return MANAGED_NAMES.find((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^\\s*\\[mcp_servers\\.(?:${escaped}|"${escaped}")\\]\\s*$`, "mu").test(text);
  });
}

function mergeConfig(configText, referenceText) {
  const reference = findBlock(referenceText, "reference");
  if (!reference) throw new Error("reference: managed MCP block is missing");
  const wanted = normalizeBlock(reference.text);
  const current = findBlock(configText, ".codex/config.toml");
  const outside = current ? `${configText.slice(0, current.start)}\n${configText.slice(current.end)}` : configText;
  const duplicate = findManagedTable(outside);
  if (duplicate) throw new Error(`.codex/config.toml: unmanaged [mcp_servers.${duplicate}] conflicts with template-managed MCP`);

  if (current && normalizeBlock(current.text) === wanted) {
    return { status: "ok", changed: false, text: configText };
  }

  const newline = configText.includes("\r\n") ? "\r\n" : "\n";
  const rendered = wanted.replace(/\n/g, newline);
  if (current) {
    return {
      status: "updated",
      changed: true,
      text: `${configText.slice(0, current.start)}${rendered}${configText.slice(current.end)}`,
    };
  }
  const prefix = configText.length === 0 ? "" : `${configText.replace(/[\r\n]+$/u, "")}${newline}${newline}`;
  return { status: "added", changed: true, text: `${prefix}${rendered}${newline}` };
}

function lstatIfPresent(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function isInside(root, candidate) {
  const relation = path.relative(root, candidate);
  return candidate === root || (relation && !relation.startsWith("..") && !path.isAbsolute(relation));
}

function assertSafeConfigPath(root, { createParent = false } = {}) {
  const codexDir = path.join(root, ".codex");
  let parentStat = lstatIfPresent(codexDir);
  if (!parentStat && createParent) {
    fs.mkdirSync(codexDir);
    parentStat = fs.lstatSync(codexDir);
  }
  if (parentStat) {
    if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
      throw new Error(".codex must be a real directory, not a symlink/reparse point");
    }
    const realParent = fs.realpathSync.native(codexDir);
    if (!isInside(root, realParent)) throw new Error(".codex resolves outside the project root");
  }

  const configPath = path.join(codexDir, "config.toml");
  const configStat = lstatIfPresent(configPath);
  if (configStat?.isSymbolicLink() || (configStat && !configStat.isFile())) {
    throw new Error(".codex/config.toml must be a regular file, not a symlink/reparse point");
  }
  return { configPath, configStat };
}

function writeConfigAtomically(root, text) {
  const { configPath, configStat } = assertSafeConfigPath(root, { createParent: true });
  const temporaryPath = `${configPath}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  try {
    fs.writeFileSync(temporaryPath, text, { encoding: "utf8", flag: "wx", mode: configStat?.mode ?? 0o600 });
    assertSafeConfigPath(root);
    fs.renameSync(temporaryPath, configPath);
  } finally {
    try {
      fs.unlinkSync(temporaryPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

function run(options) {
  const root = fs.realpathSync.native(path.resolve(options.root));
  const { configPath } = assertSafeConfigPath(root);
  const referencePath = options.reference || path.join(root, "_reference", "codex-mcp-config.toml");
  if (!fs.existsSync(referencePath)) throw new Error(`Missing reference: ${referencePath}`);
  const configText = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  const result = mergeConfig(configText, fs.readFileSync(referencePath, "utf8"));

  if (options.mode === "check") {
    if (result.changed) throw new Error(`Codex MCP config drift: ${result.status}`);
  } else if (options.mode === "apply" && result.changed) {
    writeConfigAtomically(root, result.text);
  }
  return { root, mode: options.mode, status: result.status, changed: result.changed };
}

async function main() {
  try {
    console.log(JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { BEGIN, END, assertSafeConfigPath, findBlock, mergeConfig, parseArgs, run };
