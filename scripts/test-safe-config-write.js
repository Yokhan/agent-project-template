#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { resolveSafeTarget, writeJsonAtomically } = require("./lib/safe-config-write.js");

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "safe-config-write-"));
const root = path.join(fixture, "root");
const external = path.join(fixture, "external");
const source = path.join(fixture, "source.json");
fs.mkdirSync(root);
fs.mkdirSync(external);
fs.writeFileSync(source, '{"safe":true}\n', "utf8");
fs.writeFileSync(path.join(external, "sentinel.json"), '{"outside":true}\n', "utf8");

try {
  assert.throws(() => resolveSafeTarget(root, "../external/sentinel.json"), /Unsafe target path/u);
  writeJsonAtomically(root, "config.json", source);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8")), { safe: true });

  const linked = path.join(root, "linked");
  fs.symlinkSync(external, linked, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => writeJsonAtomically(root, "linked/sentinel.json", source), /Symlink\/reparse/u);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(external, "sentinel.json"), "utf8")), { outside: true });
  console.log("Safe JSON config writer tests passed");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
