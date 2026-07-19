#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${key || "<end>"}`);
    }
    result[key.slice(2)] = value;
  }
  return result;
}

function normalizeRelative(rawPath) {
  const normalized = String(rawPath || "").replaceAll("\\", "/");
  const clean = path.posix.normalize(normalized);
  if (!clean || clean === "." || clean.startsWith("../") || path.posix.isAbsolute(clean)) {
    throw new Error(`Unsafe manifest path: ${rawPath}`);
  }
  return clean;
}

function resolveInside(root, relativePath) {
  const absolute = path.resolve(root, ...relativePath.split("/"));
  const relation = path.relative(root, absolute);
  if (!relation || relation.startsWith("..") || path.isAbsolute(relation)) {
    throw new Error(`Path escapes root: ${relativePath}`);
  }
  return absolute;
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function isSourceOnlyPath(relativePath) {
  return relativePath === "setup.sh" ||
    relativePath === "setup.bat" ||
    relativePath === ".github/workflows/release-template.yml" ||
    relativePath.startsWith("templates/");
}

function getCategory(relativePath) {
  if (relativePath === "CLAUDE.md" ||
      relativePath === "DESIGN.md" ||
      relativePath === "design-policy.ignore" ||
      relativePath === "PROJECT_SPEC.md" ||
      relativePath === "ecosystem.md" ||
      relativePath.startsWith("tasks/") ||
      relativePath.startsWith("brain/")) {
    return "project";
  }
  if (relativePath === ".gitignore" ||
      relativePath === ".codex/config.toml" ||
      relativePath === ".mcp.json" ||
      relativePath.startsWith(".vscode/")) {
    return "hybrid";
  }
  return "template";
}

function readAdditions(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(normalizeRelative);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const key of ["manifest", "template-root", "project-root", "new-version", "conflicts", "additions-file", "project-additions-file"]) {
    if (!(key in args)) throw new Error(`Missing --${key}`);
  }

  const manifestPath = path.resolve(args.manifest);
  const templateRoot = path.resolve(args["template-root"]);
  const projectRoot = path.resolve(args["project-root"]);
  const conflictCount = Number.parseInt(args.conflicts, 10);
  if (!Number.isSafeInteger(conflictCount) || conflictCount < 0) {
    throw new Error(`Invalid conflict count: ${args.conflicts}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const originalSemanticState = JSON.stringify(manifest);
  const nextFiles = {};
  let removed = 0;
  let migrated = 0;
  let added = 0;

  for (const [rawPath, rawInfo] of Object.entries(manifest.files || {})) {
    const relativePath = normalizeRelative(rawPath);
    if (relativePath === ".claude/settings.local.json" ||
        relativePath.startsWith("docs/.setup-leak-sentinel-") ||
        isSourceOnlyPath(relativePath)) {
      removed += 1;
      continue;
    }

    const info = { ...rawInfo };
    if (info.hash) info.hash = String(info.hash).replace(/^[\\/]+/, "");
    const templatePath = resolveInside(templateRoot, relativePath);
    const projectPath = resolveInside(projectRoot, relativePath);

    if (relativePath === ".codex/config.toml" && fs.existsSync(projectPath) && fs.statSync(projectPath).isFile()) {
      nextFiles[relativePath] = { category: "hybrid", hash: hashFile(projectPath) };
      if (info.category === "project") migrated += 1;
      continue;
    }

    if (info.category === "project") {
      if (relativePath === "AGENTS.md" &&
          fs.existsSync(templatePath) && fs.existsSync(projectPath) &&
          hashFile(templatePath) === hashFile(projectPath)) {
        nextFiles[relativePath] = { category: "template", hash: hashFile(templatePath) };
        migrated += 1;
      } else {
        nextFiles[relativePath] = info;
      }
      continue;
    }

    if (!fs.existsSync(templatePath) || !fs.statSync(templatePath).isFile()) {
      removed += 1;
      continue;
    }

    if (fs.existsSync(projectPath) && fs.statSync(projectPath).isFile()) {
      const sourceHash = hashFile(templatePath);
      if (hashFile(projectPath) === sourceHash) info.hash = sourceHash;
    }
    nextFiles[relativePath] = info;
  }

  for (const relativePath of readAdditions(args["additions-file"])) {
    if (nextFiles[relativePath] || isSourceOnlyPath(relativePath)) continue;
    const templatePath = resolveInside(templateRoot, relativePath);
    const projectPath = resolveInside(projectRoot, relativePath);
    if (!fs.existsSync(templatePath) || !fs.existsSync(projectPath)) {
      throw new Error(`Applied addition is missing: ${relativePath}`);
    }
    const sourceHash = hashFile(templatePath);
    if (hashFile(projectPath) !== sourceHash) {
      throw new Error(`Applied addition differs from release payload: ${relativePath}`);
    }
    nextFiles[relativePath] = { category: getCategory(relativePath), hash: sourceHash };
    added += 1;
  }

  for (const relativePath of readAdditions(args["project-additions-file"])) {
    if (nextFiles[relativePath]) continue;
    if (getCategory(relativePath) !== "project") {
      throw new Error(`Explicit project addition is not project-owned: ${relativePath}`);
    }
    const templatePath = resolveInside(templateRoot, relativePath);
    const projectPath = resolveInside(projectRoot, relativePath);
    if (!fs.existsSync(templatePath) || !fs.statSync(templatePath).isFile()) {
      throw new Error(`Project addition is absent from release payload: ${relativePath}`);
    }
    if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isFile()) {
      throw new Error(`Project addition is missing downstream: ${relativePath}`);
    }
    nextFiles[relativePath] = { category: "project", hash: hashFile(projectPath) };
    added += 1;
  }

  manifest.files = Object.fromEntries(Object.entries(nextFiles).sort(([left], [right]) => left.localeCompare(right)));
  if (conflictCount === 0) manifest.template_version = args["new-version"];
  if (JSON.stringify(manifest) === originalSemanticState) {
    console.log(`Manifest unchanged: version=${manifest.template_version}; conflicts=${conflictCount}`);
    return;
  }
  manifest.updated = new Date().toISOString().slice(0, 10);

  const temporaryPath = `${manifestPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryPath, manifestPath);
  console.log(`Manifest reconciled: version=${manifest.template_version}; added=${added}; migrated=${migrated}; removed=${removed}; conflicts=${conflictCount}`);
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
