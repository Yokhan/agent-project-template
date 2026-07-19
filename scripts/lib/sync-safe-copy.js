#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${key || "<end>"}`);
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function normalizeRelative(rawPath) {
  const normalized = String(rawPath || "").replaceAll("\\", "/");
  const clean = path.posix.normalize(normalized);
  if (!normalized || clean === "." || clean !== normalized || clean.startsWith("../") ||
      path.posix.isAbsolute(clean) || /^[A-Za-z]:/.test(clean) || /[\r\n|]/.test(clean)) {
    throw new Error(`Unsafe sync path: ${rawPath}`);
  }
  return clean;
}

function relationInside(root, candidate) {
  const relation = path.relative(root, candidate);
  return relation && !relation.startsWith("..") && !path.isAbsolute(relation);
}

function resolveInside(root, relativePath) {
  const candidate = path.resolve(root, ...relativePath.split("/"));
  if (!relationInside(root, candidate)) throw new Error(`Path escapes root: ${relativePath}`);
  return candidate;
}

function lstatIfPresent(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function assertRealInside(root, candidate, label) {
  const real = fs.realpathSync.native(candidate);
  if (real !== root && !relationInside(root, real)) {
    throw new Error(`${label} resolves outside root: ${candidate}`);
  }
}

function inspectPath(root, relativePath, { createParents = false, requireFile = false } = {}) {
  const parts = relativePath.split("/");
  let current = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    current = path.join(current, parts[index]);
    let stat = lstatIfPresent(current);
    if (!stat && createParents) {
      fs.mkdirSync(current);
      stat = fs.lstatSync(current);
    }
    if (!stat) return { target: resolveInside(root, relativePath), exists: false };
    if (stat.isSymbolicLink()) throw new Error(`Symlink/reparse parent is not allowed: ${current}`);
    if (!stat.isDirectory()) throw new Error(`Non-directory path component: ${current}`);
    assertRealInside(root, current, "Path component");
  }

  const target = resolveInside(root, relativePath);
  const stat = lstatIfPresent(target);
  if (stat?.isSymbolicLink()) throw new Error(`Symlink/reparse target is not allowed: ${target}`);
  if (stat && requireFile && !stat.isFile()) throw new Error(`Expected regular file: ${target}`);
  return { target, exists: Boolean(stat), stat };
}

function readPaths(args) {
  if (args.path) return [normalizeRelative(args.path)];
  if (!args["paths-file"]) throw new Error("Missing --path or --paths-file");
  return fs.readFileSync(args["paths-file"], "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(normalizeRelative);
}

function copyOne(sourceRoot, projectRoot, relativePath, suffix) {
  const source = inspectPath(sourceRoot, relativePath, { requireFile: true });
  if (!source.exists || !source.stat.isFile()) throw new Error(`Missing regular source file: ${relativePath}`);

  const destinationRelative = normalizeRelative(`${relativePath}${suffix}`);
  const destination = inspectPath(projectRoot, destinationRelative, { createParents: true, requireFile: true });
  const temporaryPath = `${destination.target}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  try {
    fs.copyFileSync(source.target, temporaryPath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(temporaryPath, source.stat.mode & 0o777);
    inspectPath(projectRoot, destinationRelative, { requireFile: true });
    assertRealInside(projectRoot, path.dirname(destination.target), "Destination parent");
    fs.renameSync(temporaryPath, destination.target);
  } finally {
    try { fs.unlinkSync(temporaryPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args["project-root"]) throw new Error("Missing --project-root");
  const projectRoot = fs.realpathSync.native(path.resolve(args["project-root"]));
  const paths = [...new Set(readPaths(args))];

  if (args["check-only"] === "true") {
    for (const relativePath of paths) inspectPath(projectRoot, relativePath, { requireFile: true });
    return;
  }

  if (!args["source-root"]) throw new Error("Missing --source-root");
  const sourceRoot = fs.realpathSync.native(path.resolve(args["source-root"]));
  const suffix = args.suffix || "";
  if (suffix !== "" && suffix !== ".template-new") throw new Error(`Unsupported destination suffix: ${suffix}`);
  for (const relativePath of paths) copyOne(sourceRoot, projectRoot, relativePath, suffix);
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
