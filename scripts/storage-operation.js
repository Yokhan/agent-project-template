"use strict";

const fs = require("node:fs");
const path = require("node:path");
const registry = require("./lib/storage-operation-registry.js");

function parse(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (!key.startsWith("--") || !rest[i + 1]) throw new Error(`Expected --option value, received ${key}`);
    options[key.slice(2)] = rest[++i];
  }
  if (!options.root) throw new Error("--root is required");
  return { command, options };
}
function readInput(options) {
  if (!options.input) return {};
  const file = path.resolve(options.input);
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 4 * 1024 * 1024) throw new Error("Input JSON must be a regular file no larger than 4 MiB");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function run(argv) {
  const { command, options } = parse(argv);
  const root = path.resolve(options.root);
  const input = { ...readInput(options) };
  if (options.session) input.session = options.session;
  if (options.request) input.request = options.request;
  let result;
  switch (command) {
    case "claim": result = registry.claim(root, input); break;
    case "publish": result = registry.publish(root, input); break;
    case "protect": result = registry.protect(root, input); break;
    case "pin": result = registry.pin(root, input); break;
    case "release": result = registry.release(root, input); break;
    case "abandon": result = registry.abandon(root, input); break;
    case "reconcile": result = registry.reconcile(root, input); break;
    case "status": result = registry.status(root, { owner: options.owner || options.session, request: options.request }); break;
    default: throw new Error("Usage: storage-operation.js <claim|publish|protect|pin|release|abandon|reconcile|status> --root PATH [--input JSON_FILE] [--session ID] [--request ID]");
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}
if (require.main === module) {
  try { run(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`storage-operation: ${error.message}\n`); process.exitCode = 2; }
}
module.exports = { run };
