#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const setupBatchFile = path.join(root, "setup.bat");
if (fs.existsSync(setupBatchFile)) {
  const setupBatch = fs.readFileSync(setupBatchFile, "utf8").replace(/\r\n/gu, "\n");
  assert.equal([...setupBatch.matchAll(/\$ErrorActionPreference = 'Stop'/gu)].length, 2,
    "Windows copy and manifest PowerShell blocks must fail on cmdlet errors");
  assert.doesNotMatch(setupBatch, /Get-FileHash/u, "Windows manifest hashing must not depend on the Get-FileHash cmdlet");
  assert.match(setupBatch, /\[System\.Security\.Cryptography\.SHA256\]::Create\(\)/u,
    "Windows manifest hashing must use the .NET SHA-256 stream helper");
  assert.match(setupBatch, /foreach \(\$f in \$templateFiles\) \{[\s\S]*?foreach \(\$item in \(Get-ChildItem -Path \$f -File\)\)/u,
    "Windows manifest hashing must expand wildcard template paths to concrete files");
  assert.match(setupBatch, /Write-Host 'Generated \.template-manifest\.json'"\nif errorlevel 1 exit \/b 1/u,
    "Windows setup must stop when manifest generation fails");
  assert.match(setupBatch, /echo \[1\/6\] Copying template payload\.\.\.[\s\S]*?^  "\}"\nif errorlevel 1 exit \/b 1/mu,
    "Windows setup must stop when payload copying fails");

  const shellSetup = fs.readFileSync(path.join(root, "setup.sh"), "utf8");
  for (const relative of ["docs/NATIVE_WORKFLOW_GATES.md", "docs/NATIVE_WORKFLOW_ACCEPTANCE.md"]) {
    assert.match(setupBatch, new RegExp(`'${relative.replaceAll("/", "[/\\\\]")}'`, "u"),
      `${relative} must be included in the Windows manifest path list`);
    assert.match(shellSetup, new RegExp(`"${relative}"`, "u"),
      `${relative} must be included in the Unix manifest path list`);
    assert.match(shellSetup, new RegExp(`${relative.replaceAll("/", "[/\\\\]")}.*echo "template"`, "u"),
      `${relative} must be categorized as a template in the Unix manifest`);
  }

  if (process.platform === "win32") {
    const helper = setupBatch.match(/^\s*"\$getSha256 = (\{[^\n]+\});"\s*\^$/mu)?.[1];
    assert(helper, "Windows manifest SHA-256 helper must be extractable for legacy PowerShell verification");
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "template-sha256-"));
    const projectDir = path.join(tempDir, "Generated Project");
    const agentDir = path.join(projectDir, ".codex", "agents");
    fs.mkdirSync(agentDir, { recursive: true });
    const fixture = path.join(agentDir, "runtime-helper.toml");
    const bytes = Buffer.from("legacy powershell sha256 fixture\n", "utf8");
    fs.writeFileSync(fixture, bytes);
    try {
      const result = spawnSync("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-Command",
        `$ErrorActionPreference = 'Stop'; $getSha256 = ${helper}; $templateFiles = @('.codex/agents/*.toml'); $files = @{}; foreach ($f in $templateFiles) { if (Test-Path $f) { foreach ($item in (Get-ChildItem -Path $f -File)) { $rel = $item.FullName.Substring((Get-Location).Path.Length + 1).Replace('\\','/'); $h = & $getSha256 $item.FullName; if ($h -notmatch '^[0-9a-f]{64}$') { throw 'Invalid SHA-256' }; $files[$rel] = @{ category = 'template'; hash = $h } } } }; $files['.codex/agents/runtime-helper.toml'].hash`,
      ], { encoding: "utf8", cwd: projectDir });
      assert(!result.error, result.error?.message);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), crypto.createHash("sha256").update(bytes).digest("hex"));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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
