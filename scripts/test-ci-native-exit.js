#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createManifest } = require("./lib/setup-manifest");

const root = path.resolve(__dirname, "..");
const setupBatchFile = path.join(root, "setup.bat");
if (fs.existsSync(setupBatchFile)) {
  const setupBatch = fs.readFileSync(setupBatchFile, "utf8").replace(/\r\n/gu, "\n");
  assert.equal([...setupBatch.matchAll(/\$ErrorActionPreference = 'Stop'/gu)].length, 1,
    "Windows payload copy must fail on PowerShell errors");
  assert.match(setupBatch, /git -C \$templateRoot ls-files/u,
    "Windows setup must derive its candidate set from tracked files");
  assert.doesNotMatch(setupBatch, /\$payloadFiles \+ \$candidateMap\.Keys/u,
    "Windows setup must not admit untracked root payload files");
  assert.match(setupBatch, /foreach \(\$sourceRel in \$candidateMap\.Keys\)[\s\S]*?StartsWith\('templates\/project-starter\/'\)/u,
    "Windows starter overrides must come from the tracked candidate set");
  assert.match(setupBatch, /\.setup-copy-receipt\.json/u,
    "Windows setup must record its successful copy set");
  assert.match(setupBatch, /node scripts\\lib\\setup-manifest\.js --receipt \.setup-copy-receipt\.json/u,
    "Windows setup must generate the manifest from the successful copy receipt");
  assert.match(setupBatch, /if errorlevel 1 exit \/b 1\n\n:: Initialize git/u,
    "Windows setup must stop before git init when manifest generation fails");
  assert.match(setupBatch, /echo \[1\/6\] Copying template payload\.\.\.[\s\S]*?\.setup-copy-receipt\.json'\),[\s\S]*?\nif errorlevel 1 exit \/b 1/mu,
    "Windows setup must stop when payload copying fails");

  const shellSetup = fs.readFileSync(path.join(root, "setup.sh"), "utf8");
  assert.match(shellSetup, /git ls-files -- templates\/project-starter/u,
    "Unix starter overrides must come from tracked files");
  assert.match(shellSetup, /\.setup-copy-receipt/u,
    "Unix setup must record its successful copy set");
  assert.match(shellSetup, /node scripts\/lib\/setup-manifest\.js --receipt \.setup-copy-receipt/u,
    "Unix setup must generate the manifest from the successful copy receipt");

}

{
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "template-copy-manifest-"));
  const projectRoot = path.join(tempDir, "project");
  const sourceRoot = path.join(tempDir, "source");
  fs.mkdirSync(path.join(projectRoot, "docs"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "tasks"), { recursive: true });
  fs.mkdirSync(path.join(sourceRoot), { recursive: true });
  const copied = ["docs/WRITING_LIBRARY_SETUP.md", "tasks/current.md", "CLAUDE.md", ".mcp.json"];
  const bytesByPath = new Map(copied.map((file) => [file, Buffer.from(`fixture:${file}\n`, "utf8")]));
  for (const [file, bytes] of bytesByPath) {
    const destination = path.join(projectRoot, ...file.split("/"));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  }
  fs.writeFileSync(path.join(sourceRoot, "AGENTS.md"), "<!-- Template Version: 6.1.1 -->\n");
  const receiptPath = path.join(tempDir, "receipt.json");
  fs.writeFileSync(receiptPath, JSON.stringify({ files: copied }));
  try {
    const manifest = createManifest({ projectRoot, sourceRoot, receiptPath, date: new Date("2026-10-21T00:00:00.000Z") });
    assert.deepEqual(Object.keys(manifest.files).sort(), copied.slice().sort(),
      "manifest file set must exactly match the receipt, including newly added docs");
    assert.equal(manifest.files["docs/WRITING_LIBRARY_SETUP.md"].category, "template");
    assert.equal(manifest.files["tasks/current.md"].category, "project");
    assert.equal(manifest.files["CLAUDE.md"].category, "project");
    assert.equal(manifest.files[".mcp.json"].category, "hybrid");
    for (const file of copied) {
      assert.equal(manifest.files[file].hash, crypto.createHash("sha256").update(bytesByPath.get(file)).digest("hex"),
        `${file} must hash the actual copied bytes`);
    }

    const nulReceiptPath = path.join(tempDir, "receipt.nul");
    fs.writeFileSync(nulReceiptPath, Buffer.from(`${copied.join("\0")}\0`, "utf8"));
    const fromUnixReceipt = createManifest({ projectRoot, sourceRoot, receiptPath: nulReceiptPath });
    assert.deepEqual(Object.keys(fromUnixReceipt.files).sort(), copied.slice().sort(),
      "Unix NUL-delimited receipt must describe the same exact copied set");

    fs.writeFileSync(receiptPath, JSON.stringify(["../outside.txt"]));
    assert.throws(() => createManifest({ projectRoot, sourceRoot, receiptPath }), /Unsafe template path/u,
      "receipt path traversal must fail closed");
    fs.writeFileSync(receiptPath, JSON.stringify(["docs/missing.md"]));
    assert.throws(() => createManifest({ projectRoot, sourceRoot, receiptPath }), /ENOENT/u,
      "missing copied file must fail rather than produce an incomplete manifest");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

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

const releaseFile = path.join(root, ".github/workflows/release-template.yml");
if (fs.existsSync(releaseFile) && fs.existsSync(path.join(root, "setup.sh"))) {
  const release = fs.readFileSync(releaseFile, "utf8").replace(/\r\n/gu, "\n");
  assert.match(release, /validate-windows:[\s\S]*?ref:\s*\$\{\{\s*needs\.validate\.outputs\.commit\s*\}\}/u,
    "Windows release validation must checkout the exact commit already validated on Linux");
  assert.match(release, /- name: Smoke fresh project from setup\.bat[\s\S]*?\$project = Join-Path \$smokeRoot 'ci-template-smoke'[\s\S]*?Set-Location \$project[\s\S]*?configure-codex-mcp\.js[^\n]*--check[\s\S]*?sync-template\.js[^\n]*--plan-file/u,
    "Windows release validation must run generated-project MCP and sync checks from the generated project directory");
  assert.match(release, /\$manifestCheck = @'[\s\S]*?assert\.match\(entry\.hash, \/\^\[a-f0-9\]\{64\}\$\/u[\s\S]*?docs\/NATIVE_WORKFLOW_GATES\.md[\s\S]*?docs\/NATIVE_WORKFLOW_ACCEPTANCE\.md[\s\S]*?scripts\/lib\/codex-runtime\.js[\s\S]*?\.codex\/hooks\.json[\s\S]*?\$manifestCheck \| node - \$project/u,
    "Windows setup smoke must validate generated manifest hashes and required native workflow/runtime entries");
  assert.match(release, /package:[\s\S]*?needs:\s*\[validate,\s*validate-windows\]/u,
    "Packaging must remain gated on the Windows fresh-project smoke");
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
