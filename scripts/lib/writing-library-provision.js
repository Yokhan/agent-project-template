"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const { defaultCatalog, catalogHash, sha256, resolveLibraryRoot, inspectSafePath, importLibrary, libraryStatus } = require("./writing-library-store.js");
const { buildLibraryIndex, libraryIndexStatus } = require("./writing-library-index.js");
const managed = require("./managed-temp.js");

const REPOSITORY = "Yokhan/agent-project-template-library";
const REPO_ROOT = path.resolve(__dirname, "../..");
const DESCRIPTOR_PATH = path.join(REPO_ROOT, "_reference", "writing-library-source.json");
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const GH_BUFFER_BYTES = MAX_FILE_BYTES + 1;
const GH_TIMEOUT_MS = 30000;
const ATTRIBUTES = Buffer.from("* -text\n", "utf8");

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function validateDescriptor(descriptor, catalog = defaultCatalog) {
  if (!exactKeys(descriptor, ["schemaVersion", "repository", "commit", "catalogSha256"]) ||
      descriptor.schemaVersion !== 1 || descriptor.repository !== REPOSITORY ||
      !/^[a-f0-9]{40}$/u.test(descriptor.commit) || descriptor.catalogSha256 !== catalogHash(catalog)) {
    throw new Error("Pinned writing-library source descriptor is invalid or does not match the current catalog");
  }
  return descriptor;
}

function readDescriptor(file = DESCRIPTOR_PATH, catalog = defaultCatalog) {
  inspectSafePath(file, { fileRequired: true });
  try { return validateDescriptor(JSON.parse(fs.readFileSync(file, "utf8")), catalog); }
  catch (error) {
    if (error.message.startsWith("Pinned writing-library source descriptor")) throw error;
    throw new Error("Pinned writing-library source descriptor is missing or invalid");
  }
}

function expectedFiles(catalog) {
  if (!catalog || !Array.isArray(catalog.sources) || !catalog.sources.length) throw new Error("Writing-library catalog is invalid");
  const files = new Map([
    [".gitattributes", { kind: "attributes" }],
    ["library.json", { kind: "metadata" }],
  ]);
  for (const source of catalog.sources) {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/u.test(source.id) || typeof source.originalFile !== "string" ||
        source.originalFile === "." || source.originalFile === ".." ||
        path.basename(source.originalFile) !== source.originalFile || /[\\/\u0000-\u001f]/u.test(source.originalFile) ||
        !/^[a-f0-9]{64}$/u.test(source.originalSha256) || !/^[a-f0-9]{64}$/u.test(source.textSha256)) {
      throw new Error("Writing-library catalog contains an unsafe or invalid source entry");
    }
    const originalPath = `originals/${source.originalFile}`;
    const textPath = `text/${source.id}.txt`;
    if (files.has(originalPath) || files.has(textPath)) throw new Error("Writing-library catalog contains duplicate source paths");
    files.set(originalPath, { kind: "original", source });
    files.set(textPath, { kind: "text", source });
  }
  return files;
}

function ghRequest(args, { env = process.env, cwd = REPO_ROOT, runGh = spawnSync, maxBuffer = GH_BUFFER_BYTES, encoding = null } = {}) {
  let result;
  try {
    result = runGh("gh", args, { cwd, env, encoding, timeout: GH_TIMEOUT_MS, maxBuffer, windowsHide: true, shell: false });
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("GitHub CLI (`gh`) is required and must be available on PATH");
    throw new Error("Private writing-library request failed; verify GitHub CLI authentication and repository read access");
  }
  if (result?.error?.code === "ENOENT") throw new Error("GitHub CLI (`gh`) is required and must be available on PATH");
  if (!result || result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout) && typeof result.stdout !== "string") {
    throw new Error("Private writing-library request failed; verify GitHub CLI authentication and repository read access");
  }
  return Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout, "utf8");
}

function treeEntries(treeSha, catalog, options) {
  const endpoint = `repos/${REPOSITORY}/git/trees/${treeSha}?recursive=1`;
  const bytes = ghRequest(["api", endpoint], { ...options, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  let response;
  try { response = JSON.parse(bytes.toString("utf8")); } catch { throw new Error("Pinned writing-library tree response is invalid"); }
  if (!response || response.truncated === true || !Array.isArray(response.tree)) throw new Error("Pinned writing-library tree is incomplete");
  const required = expectedFiles(catalog);
  const expectedDirectories = new Set(["originals", "text"]);
  const seen = new Set();
  const blobs = new Map();
  let totalBytes = 0;
  for (const entry of response.tree) {
    if (!entry || typeof entry.path !== "string" || seen.has(entry.path)) throw new Error("Pinned writing-library tree has duplicate or invalid paths");
    seen.add(entry.path);
    if (expectedDirectories.has(entry.path)) {
      if (entry.type !== "tree" || !["040000", "40000"].includes(entry.mode)) throw new Error("Pinned writing-library tree has an unexpected directory entry");
      continue;
    }
    const expected = required.get(entry.path);
    if (!expected || entry.type !== "blob" || entry.mode !== "100644" || !/^[a-f0-9]{40}$/u.test(entry.sha) ||
        !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > MAX_FILE_BYTES) {
      throw new Error("Pinned writing-library tree must contain only the exact bounded regular-file set");
    }
    totalBytes += entry.size;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("Pinned writing-library source exceeds the total download limit");
    blobs.set(entry.path, { ...expected, sha: entry.sha, size: entry.size });
  }
  const expectedPaths = new Set([...required.keys(), ...expectedDirectories]);
  if (seen.size !== expectedPaths.size || [...expectedPaths].some(file => !seen.has(file)) || blobs.size !== required.size) {
    throw new Error("Pinned writing-library tree does not match the exact expected file set");
  }
  return blobs;
}

function pinnedTreeSha(descriptor, options) {
  const endpoint = `repos/${REPOSITORY}/git/commits/${descriptor.commit}`;
  const bytes = ghRequest(["api", endpoint], { ...options, encoding: "utf8", maxBuffer: 1024 * 1024 });
  let response;
  try { response = JSON.parse(bytes.toString("utf8")); } catch { throw new Error("Pinned writing-library commit response is invalid"); }
  if (response?.sha !== descriptor.commit || !/^[a-f0-9]{40}$/u.test(response.tree?.sha)) {
    throw new Error("GitHub did not return the exact pinned writing-library commit and tree");
  }
  return response.tree.sha;
}

function expectedMetadata(catalog) {
  return {
    schemaVersion: 1,
    catalogId: catalog.catalogId,
    catalogSha256: catalogHash(catalog),
    sources: catalog.sources.map(source => ({
      id: source.id,
      originalPath: `originals/${source.originalFile}`,
      textPath: `text/${source.id}.txt`,
      originalSha256: source.originalSha256,
      textSha256: source.textSha256,
    })),
  };
}

function validateGitBlob(bytes, entry) {
  const gitSha = crypto.createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  if (bytes.length !== entry.size || gitSha !== entry.sha) throw new Error(`Pinned writing-library blob failed Git identity validation: ${entry.kind}`);
  if (entry.source) {
    const expected = entry.kind === "original" ? entry.source.originalSha256 : entry.source.textSha256;
    if (sha256(bytes) !== expected) throw new Error(`Pinned writing-library blob failed catalog hash validation: ${entry.source.id}`);
  }
  return bytes;
}

function fetchPinnedFiles(descriptor, catalog, options = {}) {
  validateDescriptor(descriptor, catalog);
  const treeSha = pinnedTreeSha(descriptor, options);
  const entries = treeEntries(treeSha, catalog, options);
  const fetched = new Map();
  for (const [file, entry] of entries) {
    const args = ["api", "-H", "Accept: application/vnd.github.raw+json", `repos/${REPOSITORY}/git/blobs/${entry.sha}`];
    const bytes = ghRequest(args, { ...options, encoding: null, maxBuffer: GH_BUFFER_BYTES });
    fetched.set(file, validateGitBlob(bytes, entry));
  }
  if (!fetched.get(".gitattributes").equals(ATTRIBUTES)) throw new Error("Private writing-library .gitattributes does not match the required binary-preservation rule");
  let metadata;
  try { metadata = JSON.parse(fetched.get("library.json").toString("utf8")); }
  catch { throw new Error("Private writing-library metadata is invalid"); }
  const expected = expectedMetadata(catalog);
  const metadataMatches = exactKeys(metadata, ["schemaVersion", "catalogId", "catalogSha256", "sources"]) &&
    metadata.schemaVersion === expected.schemaVersion && metadata.catalogId === expected.catalogId &&
    metadata.catalogSha256 === expected.catalogSha256 && Array.isArray(metadata.sources) &&
    metadata.sources.length === expected.sources.length && metadata.sources.every((source, index) => {
      const wanted = expected.sources[index];
      return exactKeys(source, ["id", "originalPath", "textPath", "originalSha256", "textSha256"]) &&
        source.id === wanted.id && source.originalPath === wanted.originalPath && source.textPath === wanted.textPath &&
        source.originalSha256 === wanted.originalSha256 && source.textSha256 === wanted.textSha256;
    });
  if (!metadataMatches) {
    throw new Error("Private writing-library metadata does not match the pinned catalog and exact source hashes");
  }
  return fetched;
}

function ownedScratch(env) {
  const runRoot = env.AGENT_MANAGED_TEMP;
  const copyDirectory = env.AGENT_RUN_COPY_DIR;
  if (!runRoot || !path.isAbsolute(runRoot) || !copyDirectory || !path.isAbsolute(copyDirectory)) {
    throw new Error("Provisioning requires the managed command profile and its owned copy directory");
  }
  inspectSafePath(runRoot);
  inspectSafePath(copyDirectory);
  const realRun = fs.realpathSync(runRoot);
  const lease = managed.inspectRunLease(realRun);
  if (!lease.valid || !lease.active || !lease.owner ||
      lease.owner.id !== path.basename(realRun) || lease.owner.root !== fs.realpathSync(process.cwd())) {
    throw new Error("Provisioning requires a validated live managed run for the current project");
  }
  const realCopy = fs.realpathSync(copyDirectory);
  const relative = path.relative(realRun, realCopy);
  if (path.isAbsolute(relative) || relative.startsWith(`..${path.sep}`) || relative === ".." ||
      path.dirname(relative) !== "resources" || !/^\d+-copies$/u.test(path.basename(relative))) {
    throw new Error("Provisioning copy directory is not owned by the validated managed run");
  }
  const info = fs.lstatSync(realCopy);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Provisioning copy directory is not a regular owned directory");
  return { runRoot: realRun, copyDirectory: realCopy };
}

function validateDestination(root) {
  inspectSafePath(root, { outsideGit: true });
  if (root === path.parse(root).root || root === path.resolve(os.homedir())) throw new Error("Unsafe writing-library root");
}

function provisionOwned(options = {}) {
  const env = options.env || process.env;
  const { copyDirectory } = ownedScratch(env);
  const catalog = options.catalog || defaultCatalog;
  const descriptor = validateDescriptor(options.descriptor || readDescriptor(options.descriptorPath || DESCRIPTOR_PATH, catalog), catalog);
  const root = resolveLibraryRoot({ root: options.root || env.AGENT_WRITING_LIBRARY, home: options.home, env: {} });
  validateDestination(root);
  const before = libraryStatus({ root, catalog });
  if (before.state === "ready") return { ...before, action: "reused", copies: 0, networkRequests: 0, index: ensureIndex({ root, catalog }) };
  if (fs.existsSync(root)) throw new Error(`Existing writing-library store is stale/incomplete; refusing overwrite: ${before.issues.join("; ")}`);

  const files = fetchPinnedFiles(descriptor, catalog, { env, cwd: options.cwd || REPO_ROOT, runGh: options.runGh });
  const temporary = fs.mkdtempSync(path.join(copyDirectory, "writing-library-provision-"));
  try {
    const originals = path.join(temporary, "originals");
    const texts = path.join(temporary, "text");
    fs.mkdirSync(originals);
    fs.mkdirSync(texts);
    const sources = [];
    for (const source of catalog.sources) {
      const originalPath = `originals/${source.originalFile}`;
      const textPath = `text/${source.id}.txt`;
      const localOriginal = path.join(originals, source.originalFile);
      const localText = path.join(texts, `${source.id}.txt`);
      fs.writeFileSync(localOriginal, files.get(originalPath), { flag: "wx", mode: 0o600 });
      fs.writeFileSync(localText, files.get(textPath), { flag: "wx", mode: 0o600 });
      sources.push({ sha256: source.originalSha256, local_path: localOriginal, text_path: localText });
    }
    const manifestFile = path.join(temporary, "import-manifest.json");
    fs.writeFileSync(manifestFile, `${JSON.stringify({ sources }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    const imported = importLibrary(manifestFile, { root, catalog });
    const index = ensureIndex({ root, catalog, force: true });
    return { state: "ready", root, action: imported.action, copies: imported.copies, networkRequests: files.size + 2, index };
  } finally {
    if (fs.existsSync(temporary)) {
      inspectSafePath(temporary);
      fs.rmSync(temporary, { recursive: true });
    }
  }
}

function ensureIndex(options) {
  const current = libraryIndexStatus(options);
  return current.state === "ready" && !options.force ? current : buildLibraryIndex(options);
}

function parseProvisionResult(stdout, expectedRoot) {
  let result;
  try { result = JSON.parse(String(stdout).trim()); }
  catch { throw new Error("Managed writing-library provisioning returned invalid JSON"); }
  const comparable = value => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  if (!result || Array.isArray(result) || result.state !== "ready" || typeof result.root !== "string" ||
      comparable(result.root) !== comparable(expectedRoot) || !result.index || result.index.state !== "ready" ||
      typeof result.index.root !== "string" || comparable(result.index.root) !== comparable(expectedRoot)) {
    throw new Error("Managed writing-library provisioning returned an invalid result");
  }
  return result;
}

function provision(options = {}) {
  const catalog = options.catalog || defaultCatalog;
  const root = resolveLibraryRoot(options);
  validateDestination(root);
  const status = libraryStatus({ root, catalog });
  if (status.state === "ready") {
    return { ...status, action: "reused", copies: 0, networkRequests: 0, index: ensureIndex({ root, catalog }) };
  }
  if (fs.existsSync(root)) throw new Error(`Existing writing-library store is stale/incomplete; refusing overwrite: ${status.issues.join("; ")}`);
  validateDescriptor(options.descriptor || readDescriptor(options.descriptorPath || DESCRIPTOR_PATH, catalog), catalog);
  const managedTemp = path.join(REPO_ROOT, "scripts", "managed-temp.js");
  const writingLibrary = path.join(REPO_ROOT, "scripts", "writing-library.js");
  const args = [managedTemp, "run", "--profile", "command"];
  if (process.platform !== "win32") args.push("--process-contract", "foreground");
  args.push("--", process.execPath, writingLibrary, "__provision-owned");
  const env = { ...(options.env || process.env), AGENT_WRITING_LIBRARY: root };
  let result;
  try {
    result = (options.runSpawn || spawnSync)(process.execPath, args, {
      cwd: REPO_ROOT, env, encoding: "utf8", timeout: 600000, maxBuffer: 2 * 1024 * 1024, windowsHide: true, shell: false,
    });
  }
  catch { throw new Error("Managed writing-library provisioning command failed"); }
  if (result.error || result.status !== 0) throw new Error("Managed writing-library provisioning failed; check gh authentication, pinned source access and the managed-run report");
  return parseProvisionResult(result.stdout, root);
}

module.exports = { REPOSITORY, MAX_FILE_BYTES, MAX_TOTAL_BYTES, validateDescriptor, expectedFiles, expectedMetadata, validateGitBlob, pinnedTreeSha, fetchPinnedFiles, provisionOwned, parseProvisionResult, provision, ensureIndex };
