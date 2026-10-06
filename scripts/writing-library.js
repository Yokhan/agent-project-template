#!/usr/bin/env node
"use strict";

const { importLibrary, libraryStatus } = require("./lib/writing-library-store.js");
const { retrievePacket, verifyApplication } = require("./lib/writing-library-retrieve.js");
const fs = require("fs");
const { inspectSafePath } = require("./lib/writing-library-store.js");
const { selectLibrarySources } = require("./lib/writing-library-policy.js");
const { classifyWritingIntent } = require("./lib/writing-intent.js");

function parseArgs(argv) {
  const [command = "status", ...args] = argv;
  const options = {};
  const names = { "--root": "root", "--manifest": "manifest", "--task": "task", "--query": "query", "--kind": "kind", "--sources": "sourceIds",
    "--per-source": "perSource", "--max-characters": "maxCharacters", "--request-id": "requestId", "--packet": "packet", "--application": "application", "--artifact": "artifact", "--locators": "locators" };
  for (let index = 0; index < args.length; index += 1) {
    const key = names[args[index]];
    if (!key || options[key] !== undefined) throw new Error(`Unknown/duplicate option: ${args[index]}`);
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value: ${args[index - 1]}`);
    options[key] = key === "sourceIds" ? value.split(",") : ["perSource", "maxCharacters"].includes(key) ? Number(value) : value;
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
  if (command === "help" || command === "--help") return { usage: "node scripts/writing-library.js status | import --manifest FILE | select --task TASK | retrieve --task TASK [--query KEYWORDS] [--sources IDS] [--kind nonfiction|fiction|mixed|code|small-chat] [--root ABSOLUTE]",
    note: "Import is explicit and once per machine. Status/select/retrieve do not write. No network, dependency install, book copies in projects, or guaranteed prompt caching." };
  if (command === "status") return libraryStatus(options);
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
