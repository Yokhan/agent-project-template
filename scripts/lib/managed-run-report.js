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
  const value = { schemaVersion: 1, projectRoot: fs.realpathSync.native(root), ...compact(report) };
  const text = JSON.stringify(value, null, 2) + "\n";
  if (Buffer.byteLength(text) > 65536) throw new Error("Managed result exceeds the bounded report size");
  const temporary = path.join(directory, crypto.randomUUID() + ".tmp");
  const last = path.join(directory, "last.json");
  managed.assertNoLinks(last, { allowMissing: true });
  try {
    fs.writeFileSync(temporary, text, { flag: "wx", mode: 0o600 });
    managed.assertNoLinks(directory);
    managed.assertNoLinks(last, { allowMissing: true });
    fs.renameSync(temporary, last);
  } finally {
    if (fs.existsSync(temporary)) { managed.assertNoLinks(temporary); fs.unlinkSync(temporary); }
  }
  return last;
}
function readReport(root) {
  const file = path.join(reportDirectory(root), "last.json");
  managed.assertNoLinks(file, { allowMissing: true });
  if (!fs.existsSync(file)) return null;
  if (fs.statSync(file).size > 65536) throw new Error("Managed result exceeds the bounded report size");
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  if (value.schemaVersion !== 1 || value.projectRoot !== fs.realpathSync.native(root)) throw new Error("Managed result ownership mismatch");
  return value;
}
module.exports = { writeReport, readReport, reportDirectory };
