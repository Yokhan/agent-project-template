#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { getCategory, normalizeRelative } = require("./template-payload-policy");

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!new Set(["--receipt", "--source"]).has(key) || !argv[index + 1]) {
      throw new Error("Usage: setup-manifest.js --receipt <path> --source <template-root>");
    }
    options[key.slice(2)] = argv[++index];
  }
  if (!options.receipt || !options.source) {
    throw new Error("Usage: setup-manifest.js --receipt <path> --source <template-root>");
  }
  return options;
}

function createManifest({ projectRoot, sourceRoot, receiptPath, date = new Date() }) {
  const receiptBytes = fs.readFileSync(receiptPath);
  let receipt;
  if (receiptBytes.length === 0) {
    receipt = [];
  } else if (receiptBytes.at(-1) === 0) {
    receipt = receiptBytes.toString("utf8").split("\0").filter(Boolean);
  } else {
    const parsed = JSON.parse(receiptBytes.toString("utf8"));
    receipt = Array.isArray(parsed) ? parsed : parsed?.files;
  }
  if (!Array.isArray(receipt) || receipt.some((entry) => typeof entry !== "string")) {
    throw new Error("Copy receipt must be a JSON array of relative file paths");
  }

  const files = {};
  for (const rawPath of receipt) {
    const relativePath = normalizeRelative(rawPath);
    if (Object.hasOwn(files, relativePath)) throw new Error(`Duplicate copied path: ${relativePath}`);
    const absolutePath = path.resolve(projectRoot, ...relativePath.split("/"));
    const relativeToRoot = path.relative(projectRoot, absolutePath);
    if (!relativeToRoot || relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) {
      throw new Error(`Copied path escapes project root: ${relativePath}`);
    }
    const stat = fs.lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Copied path is not a regular file: ${relativePath}`);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
    files[relativePath] = { category: getCategory(relativePath), hash };
  }

  const agentsPath = path.join(sourceRoot, "AGENTS.md");
  const agents = fs.readFileSync(agentsPath, "utf8");
  const version = agents.match(/Template Version:\s*([0-9.]+)/u)?.[1] || "4.0.1";
  const { execFileSync } = require("node:child_process");
  let templateRemote = "";
  try {
    templateRemote = execFileSync("git", ["-C", sourceRoot, "remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { /* Local setup without an origin is supported. */ }
  const today = date.toISOString().slice(0, 10);
  return {
    template_version: version,
    template_remote: templateRemote,
    created: today,
    updated: today,
    files: Object.fromEntries(Object.entries(files).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)),
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const projectRoot = process.cwd();
  const receiptPath = path.resolve(projectRoot, options.receipt);
  const sourceRoot = path.resolve(options.source);
  const manifest = createManifest({ projectRoot, sourceRoot, receiptPath });
  const destination = path.join(projectRoot, ".template-manifest.json");
  const temporary = `${destination}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporary, destination);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
  fs.rmSync(receiptPath, { force: true });
  process.stdout.write("Generated .template-manifest.json\n");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { createManifest, parseArgs };
