"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const defaultCatalog = require("../../.claude/library/technical/writing-library-catalog.json");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const catalogHash = (catalog) => sha256(JSON.stringify(catalog));
const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
};

function resolveLibraryRoot(options = {}) {
  const override = options.root || (options.env || process.env).AGENT_WRITING_LIBRARY;
  if (override && !path.isAbsolute(override)) throw new Error("AGENT_WRITING_LIBRARY/--root must be an absolute path");
  return path.resolve(override || path.join(options.home || os.homedir(), ".local", "share", "agent-project-template", "writing-library"));
}

function inspectSafePath(file, { outsideGit = false, fileRequired = false } = {}) {
  const absolute = path.resolve(file);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) continue;
    const info = fs.lstatSync(current);
    if (info.isSymbolicLink()) throw new Error(`Symlink/reparse path is not allowed: ${current}`);
    if (outsideGit && info.isDirectory() && fs.existsSync(path.join(current, ".git"))) {
      throw new Error("Writing library must remain outside Git workspaces");
    }
  }
  if (fileRequired && (!fs.existsSync(absolute) || !fs.lstatSync(absolute).isFile())) throw new Error(`Missing regular file: ${absolute}`);
  return absolute;
}

function readChecked(file, expected) {
  inspectSafePath(file, { fileRequired: true });
  const bytes = fs.readFileSync(file);
  if (sha256(bytes) !== expected) throw new Error(`Hash mismatch: ${path.basename(file)}`);
  return bytes;
}

function splitUnits(text, format) {
  const pattern = format === "pdf" ? /^\[PDF page (\d+)\]\s*$/gmu
    : format === "epub" ? /^\[EPUB section ([^\]\r\n]+)\]\s*$/gmu : /^#{1,6}\s+(.+)$/gmu;
  const markers = [...text.matchAll(pattern)];
  return markers.map((match, index) => ({
    locator: format === "pdf" ? `PDF page ${match[1]}` : format === "epub" ? `EPUB section ${match[1]}` : `Section ${match[1]}`,
    text: text.slice(match.index + match[0].length, markers[index + 1]?.index ?? text.length).trim(),
  }));
}

function validateCache(bytes, source) {
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error(`Invalid UTF-8 cache: ${source.id}`);
  const units = splitUnits(text, source.format);
  if (!units.length || (source.units && units.length !== source.units)) throw new Error(`Locator/section count mismatch: ${source.id}`);
  return units;
}

function libraryStatus(options = {}) {
  const catalog = options.catalog || defaultCatalog;
  const root = resolveLibraryRoot(options);
  const result = { state: "blocked", root, catalogId: catalog.catalogId, catalogSha256: catalogHash(catalog), issues: [], sources: [] };
  try {
    inspectSafePath(root, { outsideGit: true });
    const manifestPath = path.join(root, "manifest.json");
    inspectSafePath(manifestPath, { fileRequired: true });
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.catalogSha256 !== result.catalogSha256 || manifest.sources?.length !== catalog.sources.length) {
      throw new Error("Library manifest/catalog mismatch; do not mix editions");
    }
    for (const source of catalog.sources) {
      const record = manifest.sources.find((item) => item.id === source.id);
      if (!record || record.originalSha256 !== source.originalSha256 || record.textSha256 !== source.textSha256 ||
          record.provenance?.originalSha256 !== source.originalSha256 || record.provenance?.textSha256 !== source.textSha256 ||
          record.provenance?.method !== "user-supplied-preextracted-text" || !/^[a-f0-9]{64}$/u.test(record.provenance?.importManifestSha256 || "")) {
        throw new Error(`Missing/mismatched cache provenance: ${source.id}`);
      }
      readChecked(path.join(root, "originals", source.originalFile), source.originalSha256);
      const cache = readChecked(path.join(root, "text", `${source.id}.txt`), source.textSha256);
      validateCache(cache, source);
      result.sources.push({ id: source.id, originalSha256: source.originalSha256, textSha256: source.textSha256 });
    }
    result.state = "ready";
  } catch (error) { result.issues.push(error.message); }
  return result;
}

function importLibrary(manifestFile, options = {}) {
  const catalog = options.catalog || defaultCatalog;
  const root = resolveLibraryRoot(options);
  if (root === path.parse(root).root || root === path.resolve(os.homedir())) throw new Error("Unsafe library root");
  inspectSafePath(root, { outsideGit: true });
  inspectSafePath(manifestFile, { fileRequired: true });
  const manifestBytes = fs.readFileSync(manifestFile);
  const input = JSON.parse(manifestBytes.toString("utf8"));
  if (input.sources?.length !== catalog.sources.length) throw new Error("Import requires exactly the catalog's six sources");
  const prepared = catalog.sources.map((source) => {
    const matches = input.sources.filter((item) => item.sha256 === source.originalSha256);
    if (matches.length !== 1) throw new Error(`Missing/duplicate exact edition: ${source.id}`);
    const entry = matches[0];
    if (inside(root, path.resolve(entry.local_path)) || inside(root, path.resolve(entry.text_path))) throw new Error("Import input must remain outside the store");
    const original = readChecked(entry.local_path, source.originalSha256);
    const text = readChecked(entry.text_path, source.textSha256);
    validateCache(text, source);
    return { source, original, text };
  });
  if (fs.existsSync(root)) {
    const status = libraryStatus({ ...options, catalog, root });
    if (status.state !== "ready") throw new Error(`Existing store is stale/incomplete; refusing overwrite: ${status.issues.join("; ")}`);
    return { ...status, action: "reused", copies: 0 };
  }
  fs.mkdirSync(path.dirname(root), { recursive: true });
  inspectSafePath(path.dirname(root), { outsideGit: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(root), `.${path.basename(root)}-import-`));
  try {
    fs.mkdirSync(path.join(staging, "originals"));
    fs.mkdirSync(path.join(staging, "text"));
    for (const { source, original, text } of prepared) {
      fs.writeFileSync(path.join(staging, "originals", source.originalFile), original, { flag: "wx", mode: 0o600 });
      fs.writeFileSync(path.join(staging, "text", `${source.id}.txt`), text, { flag: "wx", mode: 0o600 });
    }
    const manifest = { schemaVersion: 1, catalogId: catalog.catalogId, catalogSha256: catalogHash(catalog), sources: prepared.map(({ source }) => ({
      id: source.id, originalSha256: source.originalSha256, textSha256: source.textSha256,
      provenance: { method: "user-supplied-preextracted-text", originalSha256: source.originalSha256, textSha256: source.textSha256,
        importManifestSha256: sha256(manifestBytes), extractionFidelity: "not-independently-reextracted" },
    })) };
    fs.writeFileSync(path.join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    if (libraryStatus({ ...options, catalog, root: staging }).state !== "ready") throw new Error("Staged store failed verification");
    if (fs.existsSync(root)) throw new Error("Store appeared during import; refusing replacement");
    fs.renameSync(staging, root);
  } finally {
    if (fs.existsSync(staging) && path.dirname(staging) === path.dirname(root) && path.basename(staging).startsWith(`.${path.basename(root)}-import-`)) {
      fs.rmSync(staging, { recursive: true });
    }
  }
  return { ...libraryStatus({ ...options, catalog, root }), action: "imported", copies: prepared.length * 2 };
}

module.exports = { defaultCatalog, sha256, catalogHash, resolveLibraryRoot, inspectSafePath, readChecked, splitUnits, libraryStatus, importLibrary };
