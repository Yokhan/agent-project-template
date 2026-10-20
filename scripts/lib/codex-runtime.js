"use strict";

const MINIMUM_NODE_MAJOR = 24;

function inspectRuntime({ version = process.versions.node, loadSQLite = () => require("node:sqlite") } = {}) {
  const match = /^v?(\d+)\./u.exec(String(version));
  const major = match ? Number(match[1]) : NaN;
  const issues = [];
  if (!Number.isInteger(major)) issues.push(`Could not read Node.js version from ${JSON.stringify(version)}`);
  else if (major < MINIMUM_NODE_MAJOR) issues.push(`Node.js ${MINIMUM_NODE_MAJOR}+ is required; found ${version}`);

  try {
    const sqlite = loadSQLite();
    const DatabaseSync = sqlite?.DatabaseSync || sqlite?.Database;
    if (typeof DatabaseSync !== "function") throw new Error("DatabaseSync is unavailable");
    const database = new DatabaseSync(":memory:");
    try {
      database.prepare("SELECT 1 AS runtime_check").get();
    } finally {
      database.close();
    }
  } catch (error) {
    issues.push(`Node.js node:sqlite is required and must open an in-memory database: ${error.message}`);
  }

  return { supported: issues.length === 0, version: String(version), issues };
}

function runtimeError(result) {
  const error = new Error([
    "Unsupported Codex runtime.",
    ...result.issues,
    "Install the current Node.js 24 LTS release from https://nodejs.org/, ensure that executable is first on PATH, then rerun setup or restart the Codex host.",
  ].join("\n"));
  error.code = "ERR_UNSUPPORTED_CODEX_RUNTIME";
  return error;
}

function assertSupportedRuntime(options) {
  const result = inspectRuntime(options);
  if (!result.supported) throw runtimeError(result);
  return result;
}

if (require.main === module) {
  if (process.argv.length !== 2) {
    process.stderr.write("Usage: node scripts/lib/codex-runtime.js\n");
    process.exitCode = 2;
  } else {
    try {
      const result = assertSupportedRuntime();
      process.stdout.write(`Codex runtime supported: Node.js ${result.version} with working node:sqlite\n`);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

module.exports = { MINIMUM_NODE_MAJOR, inspectRuntime, assertSupportedRuntime };
