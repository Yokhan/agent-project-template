"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const managed = require("./managed-temp.js");

function reportDirectory(root) {
  managed.assertNoLinks(root);
  const canonical = fs.realpathSync.native(root);
  const hash = crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 32);
  return path.join(os.homedir(), ".cache", "apt-r", hash);
}
function reportFile(root, runId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(runId || "")) throw new TypeError("Managed run ID is invalid");
  return path.join(reportDirectory(root), "runs", `${runId}.json`);
}
function compact(value) {
  if (Array.isArray(value)) return value.length > 24 ? [...value.slice(0, 24).map(compact), { omittedEntries: value.length - 24 }] : value.map(compact);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, compact(v)]));
  return typeof value === "string" && value.length > 800 ? value.slice(0, 800) + "…" : value;
}
function writeReport(root, report) {
  const directory = reportDirectory(root);
  managed.assertNoLinks(directory, { allowMissing: true });
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  managed.assertNoLinks(directory);
  if (!report || typeof report !== "object" || Array.isArray(report)) throw new TypeError("Managed report must be an object");
  const id = report.runId;
  const immutableDir = path.join(directory, "runs");
  managed.assertNoLinks(immutableDir, { allowMissing: true });
  fs.mkdirSync(immutableDir, { recursive: true, mode: 0o700 });
  managed.assertNoLinks(immutableDir);
  const destination = reportFile(root, id);
  managed.assertNoLinks(destination, { allowMissing: true });
  if (fs.existsSync(destination)) throw new Error("Immutable managed report already exists");
  const value = { schemaVersion: 2, projectRoot: fs.realpathSync.native(root), ...compact(report) };
  const text = JSON.stringify(value, null, 2) + "\n";
  if (Buffer.byteLength(text) > 65536) throw new Error("Managed result exceeds the bounded report size");
  const immutableTemporary = path.join(immutableDir, `${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(immutableTemporary, text, { flag: "wx", mode: 0o600 });
    managed.assertNoLinks(immutableDir);
    managed.assertNoLinks(destination, { allowMissing: true });
    fs.linkSync(immutableTemporary, destination);
  } finally {
    if (fs.existsSync(immutableTemporary)) { managed.assertNoLinks(immutableTemporary); fs.unlinkSync(immutableTemporary); }
  }
  const last = path.join(directory, "last.json");
  managed.assertNoLinks(last, { allowMissing: true });
  const temporary = path.join(directory, `${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, text, { flag: "wx", mode: 0o600 });
    managed.assertNoLinks(directory);
    managed.assertNoLinks(last, { allowMissing: true });
    fs.renameSync(temporary, last);
  } catch (error) {
    error.reportFile = destination;
    throw error;
  } finally {
    if (fs.existsSync(temporary)) { managed.assertNoLinks(temporary); fs.unlinkSync(temporary); }
  }
  return destination;
}
function validateReport(value, projectRoot, runId = null) {
  if (!value || ![1, 2].includes(value.schemaVersion) || typeof value.projectRoot !== "string" ||
      value.projectRoot !== projectRoot || typeof value.runId !== "string" ||
      runId && value.runId !== runId) throw new Error("Managed result ownership mismatch");
  return value;
}
function readReportPath(file) {
  if (typeof file !== "string" || !path.isAbsolute(file)) throw new TypeError("Absolute immutable report path required");
  const resolved = path.resolve(file);
  const runs = path.dirname(resolved);
  const reportDirectoryPath = path.dirname(runs);
  const expectedParent = path.resolve(os.homedir(), ".cache", "apt-r");
  if (path.resolve(path.dirname(reportDirectoryPath)) !== expectedParent || path.basename(runs) !== "runs" || path.basename(reportDirectoryPath).length !== 32 ||
      !/^[a-f0-9]{32}$/iu.test(path.basename(reportDirectoryPath))) throw new Error("Immutable report path is outside the managed report namespace");
  const runId = path.basename(resolved, ".json");
  if (path.basename(resolved) !== `${runId}.json` || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(runId)) throw new Error("Immutable report filename is invalid");
  managed.assertNoLinks(resolved);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw new Error("Managed result is not a bounded regular file");
  const value = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const expectedHash = crypto.createHash("sha256").update(value.projectRoot).digest("hex").slice(0, 32);
  if (expectedHash !== path.basename(reportDirectoryPath)) throw new Error("Immutable report project hash mismatch");
  return validateReport(value, value.projectRoot, runId);
}
function readReport(root) {
  const file = path.join(reportDirectory(root), "last.json");
  managed.assertNoLinks(file, { allowMissing: true });
  if (!fs.existsSync(file)) return null;
  if (fs.statSync(file).size > 65536) throw new Error("Managed result exceeds the bounded report size");
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  return validateReport(value, fs.realpathSync.native(root));
}
module.exports = { writeReport, readReport, readReportPath, reportDirectory, reportFile };
