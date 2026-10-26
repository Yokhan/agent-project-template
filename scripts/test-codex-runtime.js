#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { inspectRuntime, assertSupportedRuntime } = require("./lib/codex-runtime.js");

function sqliteFixture() {
  return {
    DatabaseSync: class {
      prepare(sql) {
        assert.equal(sql, "SELECT 1 AS runtime_check");
        return { get: () => ({ runtime_check: 1 }) };
      }
      close() {}
    },
  };
}

assert.equal(inspectRuntime({ version: "v24.13.0", loadSQLite: sqliteFixture }).supported, true);
assert.deepEqual(inspectRuntime({ version: "v20.19.0", loadSQLite: sqliteFixture }).issues, [
  "Node.js 24+ is required; found v20.19.0",
]);
const missing = inspectRuntime({ version: "v24.13.0", loadSQLite: () => { throw new Error("Cannot find module"); } });
assert.equal(missing.supported, false);
assert.match(missing.issues[0], /node:sqlite is required/u);
assert.throws(() => assertSupportedRuntime({ version: "v22.0.0", loadSQLite: sqliteFixture }), {
  code: "ERR_UNSUPPORTED_CODEX_RUNTIME",
  message: /Install the current Node\.js 24 LTS/u,
});

const hookCode = [
  'const runtime = require("./scripts/lib/codex-runtime.js");',
  'runtime.assertSupportedRuntime = () => { const error = new Error("simulated unsupported runtime"); error.code = "ERR_UNSUPPORTED_CODEX_RUNTIME"; throw error; };',
  'require("./scripts/codex-hooks.js").main();',
].join("\n");
for (const event of ["SessionStart", "PreToolUse"]) {
  const result = spawnSync(process.execPath, ["-e", hookCode], {
    cwd: path.resolve(__dirname, ".."),
    input: JSON.stringify({ hook_event_name: event, cwd: path.resolve(__dirname, "..") }),
    encoding: "utf8",
    env: { ...process.env },
  });
  if (event === "PreToolUse") {
    assert.equal(result.status, 0, "PreToolUse must return the explicit deny protocol on unsupported runtime");
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.hookSpecificOutput, {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "simulated unsupported runtime",
    });
  } else {
    assert.equal(result.status, 2, `${event} must fail the hook process on unsupported runtime`);
    assert.match(result.stderr, /simulated unsupported runtime/u);
  }
}
const stop = spawnSync(process.execPath, ["-e", hookCode], {
  cwd: path.resolve(__dirname, ".."),
  input: JSON.stringify({ hook_event_name: "Stop", cwd: path.resolve(__dirname, "..") }),
  encoding: "utf8",
  env: { ...process.env },
});
assert.equal(stop.status, 0, stop.stderr);
assert.equal(JSON.parse(stop.stdout).continue, false, "Stop must block when runtime is unsupported");
assert.match(JSON.parse(stop.stdout).systemMessage, /simulated unsupported runtime/u);

process.stdout.write("Codex runtime guard checks passed\n");
