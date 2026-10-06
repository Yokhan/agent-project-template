#!/usr/bin/env node
"use strict";

const fs = require("fs");
const {
  collectChildRollouts,
  parseJsonLines,
  validateSubagentTrace,
} = require("./lib/subagent-trace.js");

function parseArgs(argv) {
  const options = {
    file: "", expectedRole: "", expectedModel: "", expectedEffort: "",
    stateDb: "", sessionsRoot: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--file") options.file = value;
    else if (key === "--expected-role") options.expectedRole = value;
    else if (key === "--expected-model") options.expectedModel = value;
    else if (key === "--expected-effort") options.expectedEffort = value;
    else if (key === "--state-db") options.stateDb = value;
    else if (key === "--sessions-root") options.sessionsRoot = value;
    else if (key === "--mode") options.validationMode = value;
    else throw new Error(`unknown argument: ${key}`);
    index += 1;
  }
  if (!options.file) throw new Error("--file is required");
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  // Trust markers can only be created by the read-only runtime collector,
  // never asserted by an imported JSONL file or a parent-authored message.
  const events = parseJsonLines(fs.readFileSync(options.file, "utf8")).map((event) => {
    const { _trace_provenance, ...untrustedEvent } = event;
    return untrustedEvent;
  });
  let childEvidence;
  try {
    childEvidence = await collectChildRollouts(events, options);
  } catch {
    childEvidence = [];
  }
  const result = validateSubagentTrace([...events, ...childEvidence], options);
  console.log(JSON.stringify(result, null, 2));
  if (!result.isValid) process.exit(1);
}

main().catch(() => {
  console.log(JSON.stringify({
    isValid: false,
    status: "unverified",
    issues: ["trusted child runtime metadata could not be collected"],
    children: [],
    runtimePermissions: {
      status: "unknown", evidence: null,
      reason: "trace metadata does not prove runtime permission enforcement",
    },
  }, null, 2));
  process.exitCode = 1;
});
