#!/usr/bin/env node
"use strict";

const { importLibrary, libraryStatus } = require("./lib/writing-library-store.js");
const { retrievePacket, retrievePlannedPacket, verifyApplication } = require("./lib/writing-library-retrieve.js");
const { planReading, listReadingTopics } = require("./lib/writing-reading-plan.js");
const fs = require("fs");
const { inspectSafePath } = require("./lib/writing-library-store.js");
const { selectLibrarySources } = require("./lib/writing-library-policy.js");
const { classifyWritingIntent } = require("./lib/writing-intent.js");

function parseArgs(argv) {
  const [command = "status", ...args] = argv;
  const options = {};
  const names = { "--root": "root", "--manifest": "manifest", "--task": "task", "--query": "query", "--kind": "kind", "--sources": "sourceIds",
    "--per-source": "perSource", "--max-characters": "maxCharacters", "--request-id": "requestId", "--packet": "packet", "--application": "application", "--artifact": "artifact",
    "--locators": "locators", "--request-started-at": "requestStartedAt", "--max-age-ms": "maxAgeMs", "--source": "sourceId", "--limit": "limit", "--offset": "offset" };
  for (let index = 0; index < args.length; index += 1) {
    const key = names[args[index]];
    if (!key || options[key] !== undefined) throw new Error(`Unknown/duplicate option: ${args[index]}`);
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value: ${args[index - 1]}`);
    options[key] = key === "sourceIds" ? value.split(",") : ["perSource", "maxCharacters", "maxAgeMs", "limit", "offset"].includes(key) ? Number(value) : value;
    if (key === "locators") options[key] = Object.fromEntries(value.split(",").map((item) => {
      const parts = item.split("@");
      if (parts.length !== 2 || !parts.every(Boolean)) throw new Error("--locators expects source-id@exact locator pairs");
      return parts;
    }));
  }
  return { command, options };
}

function run(argv) {
  const { command, options } = parseArgs(argv);
  if (command === "help" || command === "--help") return { usage: "node scripts/writing-library.js status | provision [--root ABSOLUTE] | index | index-status | contents [--source ID] [--limit N] [--offset N] | examples --query QUESTION [--source ID] [--limit N] | map [--source ID] | plan --task TASK | read --task TASK [--query EXTRA_EDITORIAL_QUESTION] [--request-id ID] [--max-characters 96000] | import --manifest FILE | select --task TASK | retrieve --task TASK [--query KEYWORDS] [--sources IDS] [--request-id ID] [--request-started-at ISO] [--kind nonfiction|fiction|mixed|code|small-chat] [--root ABSOLUTE] | verify-application --task TASK --request-id ID --request-started-at ISO --max-age-ms MS --packet FILE --application FILE --artifact FILE",
    note: "Import and index are explicit local writes. Index copies literal contents/examples only into the machine library's derived study directory; originals and pinned caches stay unchanged. provision uses authenticated gh to fetch only the exact pinned private source when the local store is absent; it never overwrites a stale store. Other commands are read-only. No dependency install, book copies in projects, or guaranteed prompt caching." };
  if (command === "provision") return require("./lib/writing-library-provision.js").provision(options);
  if (command === "__provision-owned") {
    if (Object.keys(options).length) throw new Error("Internal provision command accepts no overrides");
    return require("./lib/writing-library-provision.js").provisionOwned();
  }
  if (["index", "index-status", "contents", "examples"].includes(command)) {
    const index = require("./lib/writing-library-index.js");
    if (command === "index") return index.buildLibraryIndex(options);
    if (command === "index-status") return index.libraryIndexStatus(options);
    if (command === "contents") {
      const limit = options.limit ?? 10;
      const offset = options.offset ?? 0;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) throw new Error("contents requires limit 1..100 and a nonnegative integer offset");
      const result = index.listContents(options);
      if (result.state !== "ready") return result;
      return { ...result, contents: result.contents.map(entry => ({ ...entry, units: entry.units.slice(offset, offset + limit),
        navigation: { offset, limit, totalUnits: entry.units.length, hasMore: offset + limit < entry.units.length } })) };
    }
    if (!options.query && !options.task) throw new Error("examples requires --query with the actual editorial question");
    return index.searchExamples(options.query || options.task, options);
  }
  if (command === "status") return libraryStatus(options);
  if (command === "map") return listReadingTopics(options);
  if (command === "plan" || command === "read") {
    if (!options.task) throw new Error(`${command} requires --task`);
    return command === "plan" ? planReading(options.task, options) : retrievePlannedPacket(options.task, options);
  }
  if (command === "discover") {
    const status = libraryStatus(options);
    return { state: status.state, root: status.root, sourceCount: status.sources.length, issues: status.issues };
  }
  if (command === "verify-application") {
    for (const key of ["task", "requestId", "packet", "application", "artifact"]) if (!options[key]) throw new Error(`verify-application requires --${key === "requestId" ? "request-id" : key}`);
    const read = (file) => fs.readFileSync(inspectSafePath(file, { fileRequired: true }));
    return verifyApplication(options.task, JSON.parse(read(options.packet)), JSON.parse(read(options.application)), read(options.artifact), options);
  }
  if (command === "import") {
    if (!options.manifest) throw new Error("Import requires --manifest with the supplied exact-source manifest");
    return importLibrary(options.manifest, options);
  }
  if (command === "select" || command === "retrieve") {
    if (!options.task) throw new Error(`${command} requires --task`);
    return command === "select" ? selectLibrarySources(options.task, classifyWritingIntent(options.task), options.kind)
      : retrievePacket(options.task, options);
  }
  throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  try {
    const result = run(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    if (result.state === "blocked") process.exitCode = 2;
  } catch (error) { console.error(JSON.stringify({ state: "blocked", error: error.message })); process.exitCode = 2; }
}
module.exports = { run, parseArgs };
