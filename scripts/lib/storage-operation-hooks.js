"use strict";

const fs = require("fs");
const path = require("path");
const registry = require("./storage-operation-registry.js");

const COPY_GUIDANCE = "Before a bulk snapshot/copy/materialization, use node scripts/storage-operation.js claim with the canonical source, input digest, purpose, target, reserveBytes and this session/request. Reuse a verified ready resource or wait for its writer; do not create a competing rN copy. Publish verified outputs or abandon the owned operation explicitly. Protect any legacy path still referenced by a project. Never use shared mutable hardlinks, archive/re-extract as a substitute for lifecycle ownership, or delete unknown/neighbor resources.";

function owner(input, record) {
  return { session: String(input.session_id || ""), request: String(record?.state?.requestId || input.turn_id || "") };
}

function inspect(root, input, record) {
  const identity = owner(input, record);
  const state = registry.status(root, { owner: identity.session, request: identity.request });
  const unfinishedWrites = (state.unfinishedWrites || []).filter(row => row.session === identity.session && row.request === identity.request);
  return { ...state, identity, unfinishedWrites };
}

function context(root, input, record) {
  const state = inspect(root, input, record);
  const resources = (state.operations || []).slice(0, 6).map(row => ({ id: row.id, state: row.state, target: row.target, generation: row.generation }));
  const protectedPaths = [...(state.protections || []), ...(state.pins || [])].slice(0, 8).map(row => ({ path: row.path, reason: row.reason || row.kind || "pin" }));
  return `Shared storage coordination (project scope; metadata only). Session: ${state.identity.session}; logical request: ${state.identity.request}. Registry revision: ${state.revision ?? "unavailable"}. ${COPY_GUIDANCE} Current registry: ${JSON.stringify({ present: state.registryPresent, resources, protectedPaths, ownUnfinished: state.unfinishedWrites.map(row => ({ id: row.id, target: row.target })) })}. This hook coordinates declared operations and recognizes ordinary bulk-copy invocations; it does not intercept arbitrary filesystem I/O or prove that legacy files are unused.`;
}

function commandText(input) {
  const data = input.tool_input || {};
  return typeof data.command === "string" ? data.command : typeof data.cmd === "string" ? data.cmd : "";
}

function isManaged(command) {
  return /^\s*node(?:\.exe)?\s+["']?(?:\.\/)?scripts[\\/]managed-temp\.js["']?\s+run(?:\s+--[\w-]+\s+[^\s;&|]+)*\s+--\s/u.test(command) && !/[\r\n;&|]/u.test(command);
}

function compound(command) {
  return /[\r\n;&|`]/u.test(command.replace(/"[^"\r\n]*"|'[^'\r\n]*'/gu, ""));
}

function isKnownBulkCopy(root, command) {
  if (!command || isManaged(command)) return false;
  // Look beyond a read-only prefix: a later chained command can still copy.
  if (/\brobocopy(?:\.exe)?\b/iu.test(command)) return compound(command) || !/\s\/L(?:\s|$)/iu.test(command);
  if (/(?:^|[;\r\n&|])\s*(?:Copy-Item\b[^\r\n]*-Recurse\b|cp\s+(?:-[a-zA-Z]*[rRa][a-zA-Z]*\b|--recursive\b))/iu.test(command)) return true;
  const bulk = /(?:\bfs\.(?:cpSync|copyFileSync)\s*\(|\bshutil\.(?:copytree|copy2|copyfile)\s*\()/u;
  if (/\b(?:node|python|python3)(?:\.exe)?\s+(?:-e|-c)\s/u.test(command)) return bulk.test(command);
  const script = command.match(/^\s*(?:node|python|python3)(?:\.exe)?\s+(?:"([^"]+)"|'([^']+)'|([^\s;|&]+))/u);
  if (!script) return false;
  const name = script[1] || script[2] || script[3];
  const file = path.resolve(root, name);
  if (!file.split(path.sep).includes(".session-cache") || !/\.(?:[cm]?js|py)$/u.test(file)) return false;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128 * 1024) return false;
    return bulk.test(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function beforeTool(root, input, record) {
  const command = commandText(input);
  if (!isKnownBulkCopy(root, command)) return;
  const state = inspect(root, input, record);
  // Parse only a single simple command. Embedded scripts remain cooperative:
  // --target declares their destination; the hook cannot prove their behavior.
  if (compound(command)) throw new Error("Run a bulk copy as one simple command with its declared destination; chained shell expressions are not accepted");
  const operands = Array.from(command.matchAll(/"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s;|&]+)/gu), match => match[1] ?? match[2] ?? match[3]);
  let destination;
  const executable = path.basename(operands[0] || "").toLowerCase().replace(/\.exe$/u, "");
  if (executable === "robocopy") {
    const supported = /^\/(?:E|S|MIR|NP|NFL|NDL|NJH|NJS|XJ|R:\d+|W:\d+|MT:\d+|COPY:DAT|DCOPY:DAT)$/iu;
    if (operands.slice(3).every(value => supported.test(value))) destination = operands[2];
  }
  else if (executable === "copy-item") {
    const positional = [];
    let namedSource, namedDestination, valid = true;
    for (let index = 1; index < operands.length; index++) {
      const value = operands[index];
      if (/^-(?:Recurse|Force)$/iu.test(value)) continue;
      if (/^-(?:Path|LiteralPath)$/iu.test(value) && namedSource === undefined) namedSource = operands[++index];
      else if (/^-Destination$/iu.test(value) && namedDestination === undefined) namedDestination = operands[++index];
      else if (value.startsWith("-")) valid = false;
      else positional.push(value);
    }
    if (valid && namedSource && namedDestination && positional.length === 0) destination = namedDestination;
    else if (valid && !namedSource && namedDestination && positional.length === 1) destination = namedDestination;
    else if (valid && !namedSource && !namedDestination && positional.length === 2) destination = positional[1];
  } else if (executable === "cp") {
    const positional = operands.slice(1).filter(value => !value.startsWith("-"));
    const valid = operands.slice(1).filter(value => value.startsWith("-")).every(value => /^(?:-[rRa]+|--recursive|--archive|--)$/u.test(value));
    if (valid && positional.length === 2) destination = positional[1];
  } else {
    const flag = operands.indexOf("--target");
    if (flag >= 0 && operands.lastIndexOf("--target") === flag) destination = operands[flag + 1];
  }
  const key = value => process.platform === "win32" ? value.replace(/\//gu, "\\").toLowerCase() : value;
  const authorized = destination && path.isAbsolute(destination) && state.unfinishedWrites.some(row => key(destination) === key(row.target));
  if (!authorized) {
    throw new Error(`Declare the bulk-copy operation and pass its exact target as a literal operand before allocating another snapshot. A different chat/request's claim is insufficient. ${context(root, input, record)}`);
  }
}

function unfinished(root, input, record) {
  const state = inspect(root, input, record);
  if (!state.unfinishedWrites.length) return null;
  return `Storage operations are not settled for this logical request: ${JSON.stringify(state.unfinishedWrites.map(row => ({ id: row.id, target: row.target })))}. Publish verified results or abandon the owned operation explicitly with scripts/storage-operation.js. Preserve all files and other chats' claims; a timestamp or TTL does not authorize deletion.`;
}

module.exports = { COPY_GUIDANCE, owner, inspect, context, beforeTool, unfinished, isKnownBulkCopy };
