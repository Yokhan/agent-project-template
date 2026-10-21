"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const managed = require("./lib/managed-temp.js");
const { sha256, catalogHash, libraryStatus } = require("./lib/writing-library-store.js");
const { libraryIndexStatus } = require("./lib/writing-library-index.js");
const { REPOSITORY, MAX_FILE_BYTES, expectedMetadata, validateDescriptor, provisionOwned, provision } = require("./lib/writing-library-provision.js");

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "writing-library-provision-test-"));
let fixtureContext = 0;

function makeCatalog() {
  const sources = ["sample-one", "sample-two"].map((id, index) => {
    const original = Buffer.from(`test-only original ${index}`);
    const text = Buffer.from(`# Section ${index + 1}\nA short fixture about reader context, evidence and action.\n`);
    return { id, title: `Fixture ${index + 1}`, originalFile: `${id}.pdf`, originalSha256: sha256(original), textSha256: sha256(text), format: "markdown", units: 1, original, text };
  });
  return { schemaVersion: 1, catalogId: "fixture-writing-sources", sources };
}

function gitBlobSha(bytes) {
  return crypto.createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

function sourceFiles(catalog, overrides = {}) {
  const files = new Map([
    [".gitattributes", Buffer.from("* -text\n")],
    ["library.json", overrides["library.json"] || Buffer.from(JSON.stringify(expectedMetadata(catalog)))],
  ]);
  for (const source of catalog.sources) {
    files.set(`originals/${source.originalFile}`, overrides[`originals/${source.originalFile}`] || source.original);
    files.set(`text/${source.id}.txt`, overrides[`text/${source.id}.txt`] || source.text);
  }
  return files;
}

function treeFor(files) {
  return [
    { path: "originals", mode: "040000", type: "tree", sha: "1".repeat(40) },
    { path: "text", mode: "040000", type: "tree", sha: "2".repeat(40) },
    ...[...files].map(([file, bytes]) => ({ path: file, mode: "100644", type: "blob", sha: gitBlobSha(bytes), size: bytes.length })),
  ];
}

function ghMock(files, options = {}) {
  const tree = options.tree || treeFor(files);
  const calls = [];
  const runGh = (_command, args) => {
    calls.push(args);
    if (options.missingCli) return { error: { code: "ENOENT" }, status: null, stdout: Buffer.from("book body sentinel") };
    if (options.authFailure) return { status: 1, stdout: Buffer.alloc(0), stderr: Buffer.from("private response and credential sentinel") };
    const endpoint = args[args.length - 1];
    if (endpoint.includes("/git/commits/")) {
      const sha = endpoint.split("/").pop();
      return { status: 0, stdout: Buffer.from(JSON.stringify({ sha: options.wrongCommit ? "0".repeat(40) : sha, tree: { sha: "b".repeat(40) } })), stderr: Buffer.alloc(0) };
    }
    if (endpoint.includes("/git/trees/")) return { status: 0, stdout: Buffer.from(JSON.stringify({ truncated: false, tree })), stderr: Buffer.alloc(0) };
    const sha = endpoint.split("/").pop();
    const blob = [...files.values()].find(bytes => gitBlobSha(bytes) === sha);
    if (!blob) return { status: 1, stdout: Buffer.alloc(0), stderr: Buffer.from("missing test blob") };
    return { status: 0, stdout: blob, stderr: Buffer.alloc(0) };
  };
  return { runGh, calls };
}

function descriptor(catalog, changes = {}) {
  return { schemaVersion: 1, repository: REPOSITORY, commit: "a".repeat(40), catalogSha256: catalogHash(catalog), ...changes };
}

function ownedContext(name) {
  const projectRoot = path.join(fixture, `${name}-${++fixtureContext}`);
  fs.mkdirSync(projectRoot, { recursive: true });
  const inherited = process.env.AGENT_MANAGED_TEMP;
  delete process.env.AGENT_MANAGED_TEMP;
  let run;
  try { run = managed.createRun(projectRoot, { processContract: "foreground" }); }
  finally { if (inherited !== undefined) process.env.AGENT_MANAGED_TEMP = inherited; }
  const copyDirectory = run.allocate("copies");
  const env = { ...process.env, AGENT_MANAGED_TEMP: run.root, AGENT_RUN_COPY_DIR: copyDirectory, AGENT_WRITING_LIBRARY: path.join(fixture, `${name}-store-${fixtureContext}`) };
  return { projectRoot, run, copyDirectory, env, root: env.AGENT_WRITING_LIBRARY };
}

function withOwned(context, action) {
  const previous = process.cwd();
  process.chdir(context.projectRoot);
  try { return action(); }
  finally {
    process.chdir(previous);
    context.run.finish({ foregroundCompleted: true });
  }
}

function expectOwnedFailure(catalog, desc, gh, expectedPattern, name) {
  const context = ownedContext(name);
  try {
    withOwned(context, () => {
      assert.throws(() => provisionOwned({ env: context.env, root: context.root, catalog, descriptor: desc, runGh: gh }), expectedPattern);
      assert.deepStrictEqual(fs.readdirSync(context.copyDirectory), [], "failed private provisioning retained temporary source inputs");
    });
    assert(!fs.existsSync(context.root), "failed private provisioning created a partial store");
  } finally { if (fs.existsSync(context.projectRoot)) fs.rmSync(context.projectRoot, { recursive: true, force: true }); }
}

function main() {
  const catalog = makeCatalog();
  const pinned = descriptor(catalog);
  const files = sourceFiles(catalog);
  try {
    assert.strictEqual(validateDescriptor(pinned, catalog), pinned);
    assert.throws(() => validateDescriptor(descriptor(catalog, { repository: "someone/other" }), catalog), /descriptor is invalid/u);
    assert.throws(() => validateDescriptor(descriptor(catalog, { catalogSha256: "0".repeat(64) }), catalog), /descriptor is invalid/u);
    assert.throws(() => validateDescriptor(descriptor(catalog, { commit: "main" }), catalog), /descriptor is invalid/u);

    const fresh = ownedContext("fresh");
    const gh = ghMock(files);
    try {
      const result = withOwned(fresh, () => {
        const imported = provisionOwned({ env: fresh.env, root: fresh.root, catalog, descriptor: pinned, runGh: gh.runGh });
        assert.deepStrictEqual(fs.readdirSync(fresh.copyDirectory), [], "successful provisioning retained temporary source inputs");
        return imported;
      });
      assert.strictEqual(result.state, "ready");
      assert.strictEqual(result.action, "imported");
      assert.strictEqual(result.copies, catalog.sources.length * 2);
      assert.strictEqual(result.networkRequests, gh.calls.length);
      assert.strictEqual(libraryStatus({ root: fresh.root, catalog }).state, "ready");
      assert.strictEqual(libraryIndexStatus({ root: fresh.root, catalog }).state, "ready", "fresh provisioning did not build the local study index");
      const callsBeforeReuse = gh.calls.length;
      const reused = provision({ root: fresh.root, catalog, runManaged() { throw new Error("ready stores must not start a managed network operation"); } });
      assert.strictEqual(reused.action, "reused");
      assert.strictEqual(reused.copies, 0);
      assert.strictEqual(reused.networkRequests, 0);
      assert.strictEqual(gh.calls.length, callsBeforeReuse, "ready store attempted private network access");
    } finally { fs.rmSync(fresh.projectRoot, { recursive: true, force: true }); }

    expectOwnedFailure(catalog, descriptor(catalog, { catalogSha256: "f".repeat(64) }), ghMock(files).runGh,
      /descriptor is invalid/u, "wrong-pin");

    const extraTree = [...treeFor(files), { path: "unexpected.txt", mode: "100644", type: "blob", sha: "3".repeat(40), size: 1 }];
    expectOwnedFailure(catalog, pinned, ghMock(files, { tree: extraTree }).runGh,
      /exact bounded regular-file set/u, "extra-tree");

    const symlinkTree = treeFor(files).map(entry => entry.path === "text/sample-one.txt" ? { ...entry, mode: "120000" } : entry);
    expectOwnedFailure(catalog, pinned, ghMock(files, { tree: symlinkTree }).runGh,
      /exact bounded regular-file set/u, "symlink-tree");

    const oversizedTree = treeFor(files).map(entry => entry.path === "originals/sample-one.pdf" ? { ...entry, size: MAX_FILE_BYTES + 1 } : entry);
    expectOwnedFailure(catalog, pinned, ghMock(files, { tree: oversizedTree }).runGh,
      /exact bounded regular-file set/u, "oversized-tree");

    expectOwnedFailure(catalog, pinned, ghMock(files, { wrongCommit: true }).runGh,
      /exact pinned writing-library commit/u, "wrong-commit-response");

    const changedText = Buffer.from("# Changed\nThe pinned edition does not match.\n");
    expectOwnedFailure(catalog, pinned, ghMock(sourceFiles(catalog, { "text/sample-one.txt": changedText })).runGh,
      /catalog hash validation/u, "wrong-source-hash");

    const changedMetadata = Buffer.from(JSON.stringify({ ...expectedMetadata(catalog), catalogSha256: "0".repeat(64) }));
    expectOwnedFailure(catalog, pinned, ghMock(sourceFiles(catalog, { "library.json": changedMetadata })).runGh,
      /metadata does not match/u, "wrong-remote-metadata");

    const authFailure = ghMock(files, { authFailure: true });
    const authContext = ownedContext("auth-failure");
    try {
      withOwned(authContext, () => {
        assert.throws(() => provisionOwned({ env: authContext.env, root: authContext.root, catalog, descriptor: pinned, runGh: authFailure.runGh }), error => {
          assert.match(error.message, /verify GitHub CLI authentication/u);
          assert(!error.message.includes("private response and credential sentinel"));
          return true;
        });
        assert.deepStrictEqual(fs.readdirSync(authContext.copyDirectory), []);
      });
      assert(!String(authFailure.calls).includes("private response and credential sentinel"), "private response leaked into request records");
      assert(!fs.existsSync(authContext.root));
    } finally { fs.rmSync(authContext.projectRoot, { recursive: true, force: true }); }

    const missingCliContext = ownedContext("missing-gh");
    try {
      withOwned(missingCliContext, () => assert.throws(() => provisionOwned({
        env: missingCliContext.env, root: missingCliContext.root, catalog, descriptor: pinned, runGh: ghMock(files, { missingCli: true }).runGh,
      }), error => {
        assert.match(error.message, /GitHub CLI .* required/u);
        assert(!error.message.includes("book body sentinel"));
        return true;
      }));
      assert(!fs.existsSync(missingCliContext.root));
    } finally { fs.rmSync(missingCliContext.projectRoot, { recursive: true, force: true }); }

    const staleRoot = path.join(fixture, "stale-existing-store");
    fs.mkdirSync(staleRoot);
    const sentinel = path.join(staleRoot, "keep-me.txt");
    fs.writeFileSync(sentinel, "preserve existing incomplete destination");
    let launched = false;
    assert.throws(() => provision({ root: staleRoot, catalog, runManaged() { launched = true; } }), /refusing overwrite/u);
    assert(!launched, "stale destination started a private network operation");
    assert.strictEqual(fs.readFileSync(sentinel, "utf8"), "preserve existing incomplete destination");

    const inheritedRoot = path.join(fixture, "inherited-library-root");
    const inheritedEnv = { AGENT_WRITING_LIBRARY: inheritedRoot };
    let spawnArgs;
    let spawnOptions;
    const multilineResult = { state: "ready", root: inheritedRoot, index: { state: "ready", root: inheritedRoot, indexPath: path.join(inheritedRoot, "study") } };
    const provisioned = provision({ env: inheritedEnv, catalog, descriptor: pinned, runSpawn(_command, args, options) {
      spawnArgs = args;
      spawnOptions = options;
      return { status: 0, stdout: JSON.stringify(multilineResult, null, 2), stderr: "" };
    } });
    assert.deepStrictEqual(provisioned, multilineResult, "public provision did not parse the complete pretty-printed child JSON");
    assert.strictEqual(spawnOptions.env.AGENT_WRITING_LIBRARY, inheritedRoot,
      "an inherited AGENT_WRITING_LIBRARY override was not preserved for the managed child");
    assert(spawnArgs.includes("__provision-owned"), "public provision did not launch its internal managed worker");

    const invalidProvisionResults = [
      "true",
      "{ malformed private body sentinel",
      JSON.stringify({ ...multilineResult, root: path.join(fixture, "wrong-root") }),
      JSON.stringify({ ...multilineResult, index: { ...multilineResult.index, root: path.join(fixture, "wrong-index-root") } }),
    ];
    for (const stdout of invalidProvisionResults) {
      assert.throws(() => provision({ env: inheritedEnv, catalog, descriptor: pinned, runSpawn() { return { status: 0, stdout, stderr: "" }; } }), error => {
        assert.match(error.message, /returned (?:invalid JSON|an invalid result)/u);
        assert(!error.message.includes("private body sentinel"), "managed child parse failure leaked raw output");
        return true;
      });
    }

    const noLease = { env: {}, catalog, descriptor: pinned, runGh: ghMock(files).runGh };
    assert.throws(() => provisionOwned(noLease), /managed command profile/u, "internal provisioning accepted missing managed lease variables");
    process.stdout.write("writing-library provisioning tests passed\n");
  } finally {
    if (fs.existsSync(fixture)) fs.rmSync(fixture, { recursive: true, force: true });
  }
}

main();
