#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { defaultCatalog, sha256, resolveLibraryRoot, importLibrary, libraryStatus } = require("./lib/writing-library-store.js");
const { retrievePacket, verifyApplication, rankPassages } = require("./lib/writing-library-retrieve.js");
const { selectLibrarySources } = require("./lib/writing-library-policy.js");
const { classifyWritingIntent } = require("./lib/writing-intent.js");
const { getWritingRoutePolicy } = require("./lib/writing-route-policy.js");
const { isPayloadPath } = require("./lib/template-payload-policy.js");
const { run, parseArgs } = require("./writing-library.js");

function select(task) { return selectLibrarySources(task, classifyWritingIntent(task)); }
function throws(action, pattern) { assert.throws(action, pattern); }
function snapshot(root) {
  return fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((item) =>
    item.isDirectory() ? [item.name, snapshot(path.join(root, item.name))] : [item.name, sha256(fs.readFileSync(path.join(root, item.name))), fs.statSync(path.join(root, item.name)).mtimeMs]);
}

function main() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "writing-library-test-"));
  try {
    const inputDir = path.join(fixture, "input");
    fs.mkdirSync(inputDir);
    const catalog = { schemaVersion: 1, catalogId: "test-editions", sources: [] };
    const input = { sources: [] };
    for (const source of defaultCatalog.sources) {
      const original = Buffer.from(`test-only original ${source.id}`);
      const marker = source.format === "pdf" ? "[PDF page 1]" : source.format === "epub" ? "[EPUB section OPS/ch1.xhtml]" : "# Source heading";
      const text = Buffer.from(`${marker}\nUseful reader task principle facts context explanation action project game.\n`);
      const localPath = path.join(inputDir, source.originalFile);
      const textPath = path.join(inputDir, `${source.id}.txt`);
      fs.writeFileSync(localPath, original);
      fs.writeFileSync(textPath, text);
      catalog.sources.push({ ...source, units: 1, originalSha256: sha256(original), textSha256: sha256(text) });
      input.sources.push({ local_path: localPath, text_path: textPath, sha256: sha256(original) });
    }
    const manifestFile = path.join(inputDir, "manifest.json");
    fs.writeFileSync(manifestFile, JSON.stringify(input));
    const root = path.join(fixture, "store");
    const options = { root, catalog };
    assert.strictEqual(libraryStatus(options).state, "blocked");
    assert.strictEqual(importLibrary(manifestFile, options).action, "imported");
    const before = snapshot(root);
    const originalsBefore = snapshot(inputDir);
    assert.strictEqual(importLibrary(manifestFile, options).copies, 0);
    assert.deepStrictEqual(snapshot(root), before, "reuse/status must not touch files");
    assert.deepStrictEqual(snapshot(inputDir), originalsBefore, "originals and supplied caches stay untouched");
    const task = "Write a guide for the reader";
    const requestStartedAt = new Date(Date.now() - 1000).toISOString();
    const packet = retrievePacket(task, { ...options, requestId: "request-one", requestStartedAt, query: "reader facts context" });
    assert.strictEqual(packet.passages.length, 2);
    assert.deepStrictEqual(packet.pendingSourceIds, []);
    assert(packet.retrievedAt);
    assert(packet.receipts.every((receipt) => receipt.locator && receipt.readAt && receipt.originalSha256 && receipt.textSha256));
    const artifact = Buffer.from("A complete test artifact.");
    const application = { requestId: packet.requestId, packetId: packet.packetId, artifactSha256: sha256(artifact), principles: packet.passages.map((passage) => ({
      sourceId: passage.sourceId, passageSha256: passage.passageSha256, principle: "Clarify the reader task", effect: "Opening states the action and verified facts" })) };
    assert.strictEqual(verifyApplication(task, packet, application, artifact, { ...options, requestId: "request-one", requestStartedAt }).state, "application-record-verified");
    throws(() => verifyApplication(task, packet, application, artifact, { ...options, requestId: "request-two" }), /request-id mismatch/);
    throws(() => verifyApplication(`${task} changed`, packet, application, artifact, { ...options, requestId: "request-one" }), /binding mismatch/);
    throws(() => verifyApplication(task, packet, application, Buffer.from("changed draft"), { ...options, requestId: "request-one" }), /Draft changed/);
    throws(() => verifyApplication(task, packet, { ...application, principles: [] }, artifact, { ...options, requestId: "request-one" }), /principle\/application/);
    const staleReceipt = structuredClone(packet);
    staleReceipt.receipts[0].readAt = "2020-01-01T00:00:00.000Z";
    throws(() => verifyApplication(task, staleReceipt, application, artifact, { ...options, requestId: "request-one" }), /digest/);
    const stalePacket = structuredClone(packet);
    stalePacket.retrievedAt = "2020-01-01T00:00:00.000Z";
    stalePacket.receipts = stalePacket.receipts.map((receipt) => ({ ...receipt, readAt: stalePacket.retrievedAt }));
    stalePacket.packetId = sha256(JSON.stringify({ requestId: stalePacket.requestId, taskSha256: stalePacket.taskSha256,
      catalogSha256: stalePacket.catalogSha256, retrievedAt: stalePacket.retrievedAt, passages: stalePacket.passages, receipts: stalePacket.receipts }));
    throws(() => verifyApplication(task, stalePacket, { ...application, packetId: stalePacket.packetId }, artifact, { ...options, requestId: "request-one" }), /stale/);
    throws(() => verifyApplication(task, packet, application, artifact, { ...options, requestId: "request-one", requestStartedAt: "2020-01-01" }), /request-started-at/);
    throws(() => verifyApplication(task, packet, application, artifact, { ...options, requestId: "request-one", maxAgeMs: 0 }), /positive safe integer/);
    throws(() => verifyApplication(task, packet, application, artifact, { ...options, requestId: "request-one", requestStartedAt: new Date(Date.now() + 5000).toISOString() }), /predates the current request/);
    const fake = structuredClone(packet);
    fake.passages[0].text = "fake source text";
    throws(() => verifyApplication(task, fake, application, artifact, { ...options, requestId: "request-one" }), /digest/);
    const targeted = retrievePacket(task, { ...options, query: "no-matches-xyz", locators: { "write-short": "PDF page 1", "clear-understood": "EPUB section OPS/ch1.xhtml" } });
    assert.strictEqual(targeted.passages.length, 2);
    const focused = retrievePacket(task, { ...options, requestId: "focused-request", sourceIds: ["write-short"], query: "reader facts" });
    assert.deepStrictEqual(focused.coveredSourceIds, ["write-short"]);
    assert.deepStrictEqual(focused.pendingSourceIds, ["clear-understood"]);
    const focusedApplication = { ...application, requestId: focused.requestId, packetId: focused.packetId,
      principles: focused.passages.map((passage) => ({ sourceId: passage.sourceId, passageSha256: passage.passageSha256,
        principle: "Clarify the reader task", effect: "Opening states the action and verified facts" })) };
    throws(() => verifyApplication(task, focused, focusedApplication, artifact, { ...options, requestId: "focused-request" }), /Primary reading missing: clear-understood/);
    const inconsistentCoverage = structuredClone(packet);
    inconsistentCoverage.pendingSourceIds = ["clear-understood"];
    throws(() => verifyApplication(task, inconsistentCoverage, application, artifact, { ...options, requestId: "request-one" }), /Inconsistent covered\/pending/);
    const incompleteSourceApplication = { ...application, principles: application.principles.filter((item) => item.sourceId !== "clear-understood") };
    throws(() => verifyApplication(task, packet, incompleteSourceApplication, artifact, { ...options, requestId: "request-one" }), /principle\/application: clear-understood/);
    throws(() => retrievePacket(task, { ...options, query: "no-matches-xyz" }), /no relevant passage/);
    throws(() => retrievePacket(task, { ...options, query: "reader", maxCharacters: 100 }), /Packet bounds/);
    assert.strictEqual(retrievePacket(task, { ...options, query: "reader", maxCharacters: 96000 }).state, "retrieved-not-yet-applied",
      "the legacy retrieval path accepts the new 96000-character ceiling");
    throws(() => retrievePacket(task, { ...options, query: "reader", maxCharacters: 96001 }), /3500\.\.96000/);
    const ranked = rankPassages([{ locator: "first", text: "irrelevant text" }, { locator: "second", text: "reader context explanation" }], "reader context");
    assert.strictEqual(ranked[0].locator, "second", "query must not retrieve first N characters by default");
    const installedManifest = path.join(root, "manifest.json");
    const manifestBefore = fs.readFileSync(installedManifest);
    const badProvenance = JSON.parse(manifestBefore);
    badProvenance.sources[0].provenance.originalSha256 = "0".repeat(64);
    fs.writeFileSync(installedManifest, JSON.stringify(badProvenance));
    assert(libraryStatus(options).issues.some((issue) => /provenance/u.test(issue)));
    fs.writeFileSync(installedManifest, manifestBefore);
    const installedOriginal = path.join(root, "originals", catalog.sources[0].originalFile);
    const heldOriginal = path.join(fixture, "held-test-original");
    fs.renameSync(installedOriginal, heldOriginal);
    assert(libraryStatus(options).issues.some((issue) => /Missing regular file/u.test(issue)));
    fs.renameSync(heldOriginal, installedOriginal);
    fs.appendFileSync(installedOriginal, "wrong edition bytes");
    assert(libraryStatus(options).issues.some((issue) => /Hash mismatch/u.test(issue)));
    fs.copyFileSync(input.sources[0].local_path, installedOriginal);
    assert.strictEqual(libraryStatus(options).state, "ready");
    fs.appendFileSync(path.join(root, "text", "write-short.txt"), "poison");
    assert.strictEqual(libraryStatus(options).state, "blocked");
    throws(() => retrievePacket(task, { ...options, query: "reader" }), /source-grounding-blocked/);
    throws(() => importLibrary(manifestFile, options), /refusing overwrite/);
    const corruptRoot = path.join(fixture, "wrong-edition");
    const wrong = structuredClone(input);
    wrong.sources[0].sha256 = "0".repeat(64);
    const wrongFile = path.join(inputDir, "wrong.json");
    fs.writeFileSync(wrongFile, JSON.stringify(wrong));
    throws(() => importLibrary(wrongFile, { root: corruptRoot, catalog }), /exact edition/);
    assert(!fs.existsSync(corruptRoot), "invalid import creates no store");
    const gitRoot = path.join(fixture, "repo");
    fs.mkdirSync(path.join(gitRoot, ".git"), { recursive: true });
    throws(() => importLibrary(manifestFile, { root: path.join(gitRoot, "books"), catalog }), /outside Git/);
    assert.strictEqual(resolveLibraryRoot({ home: fixture, env: {} }), path.join(fixture, ".local", "share", "agent-project-template", "writing-library"));
    throws(() => resolveLibraryRoot({ root: "relative-root" }), /absolute/);
    assert.deepStrictEqual(select("Объясни, как работает кэш").sourceIds, ["write-short", "clear-understood"]);
    assert(select("Сделай описание услуги").required);
    const trainingOffer = select("Сократи описание услуги, сохрани пользу: тренер составляет план под оборудование и расписание");
    assert(trainingOffer.sourceIds.includes("social-media"));
    assert(!trainingOffer.sourceIds.includes("project-resolution"), "a training plan inside service facts is not a project-production artifact");
    assert(select("Write a business book about game development").sourceIds.includes("game-as-business"));
    assert(select("Напиши главу книги про бизнес игровой студии").sourceIds.includes("project-resolution"));
    for (const planTask of ["Напиши план коммерческой игры", "Plan game production"]) {
      assert(select(planTask).sourceIds.includes("game-as-business"));
      assert(select(planTask).sourceIds.includes("project-resolution"));
    }
    assert(select("Спланируй работу над романом").sourceIds.includes("project-resolution"));
    assert(!select("Напиши сцену диалога героя").required);
    assert(!select("Сделай описание персонажа").required);
    assert(!select("Напиши лорную заметку").required);
    assert(!select("Implement an API endpoint").required);
    assert(!select("пропиши себе что компонент сразу содержит будущие функции на 1 процент и debug").required);
    assert(!select("Спасибо!").required);
    assert(select("Write a scene and a deployment guide").required);
    const email = select("Напиши письмо клиенту о задержке");
    assert(email.sourceIds.includes("business-correspondence"));
    assert(!email.sourceIds.includes("social-media"));
    const blockedPolicy = getWritingRoutePolicy(classifyWritingIntent(task), { libraryOptions: { root: path.join(fixture, "missing") } });
    assert.strictEqual(blockedPolicy.sourceGrounding.state, "blocked");
    assert(blockedPolicy.gates.includes("source-grounding-blocked"));
    assert(isPayloadPath("scripts/writing-library.js"));
    assert(isPayloadPath(".claude/library/technical/writing-library-catalog.json"));
    for (const source of defaultCatalog.sources) {
      assert(!isPayloadPath(`writing-library/originals/${source.originalFile}`));
      assert(!isPayloadPath(`writing-library/text/${source.id}.txt`));
    }
    assert.strictEqual(run(["select", "--task", "Объясни кэш"]).required, true);
    const parsed = parseArgs(["verify-application", "--request-started-at", requestStartedAt, "--max-age-ms", "1234"]);
    assert.strictEqual(parsed.options.requestStartedAt, requestStartedAt);
    assert.strictEqual(parsed.options.maxAgeMs, 1234);
    console.log("Writing library: import/reuse/provenance/edition/freshness/request/coverage/draft/routing/payload checks passed");
  } finally {
    const resolved = path.resolve(fixture);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("writing-library-test-")) fs.rmSync(resolved, { recursive: true });
  }
}
main();
