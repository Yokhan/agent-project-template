#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const guardPatterns = [
  /\$ErrorActionPreference\s*=\s*'Stop'/u,
  /\$PSVersionTable\.PSVersion\s*-lt\s*\[version\]'7\.3'/u,
  /\$PSNativeCommandUseErrorActionPreference\s*=\s*\$true/u,
];

for (const name of ["release-template.yml", "validate-template.yml"]) {
  const file = path.join(root, ".github", "workflows", name);
  // Generated projects deliberately do not receive the template-source release
  // workflow, but their shipped validation workflow still needs these guards.
  if (name === "release-template.yml" && !fs.existsSync(file) && !fs.existsSync(path.join(root, "setup.sh"))) continue;
  const workflow = fs.readFileSync(file, "utf8").replace(/\r\n/gu, "\n");
  const blocks = [...workflow.matchAll(/shell: pwsh\n\s+run: \|\n((?:[ ]{10}[^\n]*\n?)+)/gu)];
  assert(blocks.length, `${name}: expected native PowerShell checks`);
  for (const [, block] of blocks) {
    const beforeNative = block.slice(0, block.search(/^\s*(?:node|npm\.cmd|if \(\(git)\b/mu));
    for (const pattern of guardPatterns) assert(pattern.test(beforeNative), `${name}: native checks lack fail-closed guard ${pattern}`);
  }
}

// Exercise the same preferences in an isolated process: a later successful
// native command must not mask the first failure, as default PowerShell does.
const header = "$ErrorActionPreference = 'Stop'; if ($PSVersionTable.PSVersion -lt [version]'7.3') { throw 'Unsupported PowerShell' }; $PSNativeCommandUseErrorActionPreference = $true; ";
const failure = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", `${header}& '${process.execPath.replaceAll("'", "''")}' -e 'process.exit(13)'; & '${process.execPath.replaceAll("'", "''")}' -e 'console.log("MASKED_FAILURE")'`], { encoding: "utf8" });
if (failure.error?.code === "ENOENT" && process.platform !== "win32") {
  console.log("CI native-exit guards verified; isolated PowerShell runtime unavailable on this host");
} else {
  assert(!failure.error, failure.error?.message);
  assert.notEqual(failure.status, 0, "failed native command was masked by later success");
  assert(!(failure.stdout || "").includes("MASKED_FAILURE"), "execution continued after native failure");
  const success = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", `${header}& '${process.execPath.replaceAll("'", "''")}' -e 'console.log("NATIVE_PASS")'`], { encoding: "utf8" });
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /NATIVE_PASS/u);
  console.log("CI native-exit guards and isolated fail-then-pass checks passed");
}
