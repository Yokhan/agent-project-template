#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

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
  return relation === "" || (!relation.startsWith(`..${path.sep}`) && relation !== ".." && !path.isAbsolute(relation));
}

function resolveSafeTarget(rootInput, relativeTarget) {
  const root = fs.realpathSync.native(path.resolve(rootInput));
  if (!relativeTarget || path.isAbsolute(relativeTarget) || relativeTarget.includes("\0")) {
    throw new Error(`Unsafe target path: ${relativeTarget}`);
  }
  const parts = relativeTarget.replace(/\\/gu, "/").split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Unsafe target path: ${relativeTarget}`);
  }

  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.resolve(current, parts[index]);
    if (!isInside(root, current)) throw new Error(`Target escapes root: ${relativeTarget}`);
    const info = lstatIfPresent(current);
    if (!info && index === parts.length - 1) return { root, target: current };
    if (!info) throw new Error(`Missing target parent: ${relativeTarget}`);
    if (info.isSymbolicLink()) throw new Error(`Symlink/reparse target is not allowed: ${relativeTarget}`);
    if (index < parts.length - 1 && !info.isDirectory()) throw new Error(`Target parent is not a directory: ${relativeTarget}`);
    if (index === parts.length - 1 && !info.isFile()) throw new Error(`Target is not a regular file: ${relativeTarget}`);
  }
  return { root, target: current };
}

function readValidatedJson(sourceInput) {
  const source = path.resolve(sourceInput);
  const info = fs.lstatSync(source);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error("Source must be a regular file, not a symlink/reparse point");
  const text = fs.readFileSync(source, "utf8");
  JSON.parse(text);
  return text.endsWith("\n") ? text : `${text}\n`;
}

function writeJsonAtomically(rootInput, relativeTarget, sourceInput) {
  const text = readValidatedJson(sourceInput);
  const { root, target } = resolveSafeTarget(rootInput, relativeTarget);
  const temporary = `${target}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  try {
    fs.writeFileSync(temporary, text, { encoding: "utf8", flag: "wx", mode: 0o600 });
    resolveSafeTarget(root, relativeTarget);
    fs.renameSync(temporary, target);
    try { fs.chmodSync(target, 0o600); } catch (error) {
      if (process.platform !== "win32") throw error;
    }
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") options.root = argv[++index];
    else if (arg === "--target") options.target = argv[++index];
    else if (arg === "--source") options.source = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.root || !options.target || !options.source) throw new Error("Usage: safe-config-write.js --root ROOT --target RELATIVE_PATH --source JSON_FILE");
  return options;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    writeJsonAtomically(options.root, options.target, options.source);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { parseArgs, resolveSafeTarget, writeJsonAtomically };
