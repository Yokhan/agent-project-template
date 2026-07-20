import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const fixture = mkdtempSync(join(tmpdir(), "context-router-runtime-"));
const project = join(fixture, "project");
const external = join(fixture, "external");
mkdirSync(project);
mkdirSync(external);
writeFileSync(join(project, "inside.txt"), "inside\n", "utf8");
writeFileSync(join(external, "outside.txt"), "outside\n", "utf8");

const server = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [server],
  cwd: project,
  env: environment,
  stderr: "pipe",
});
let serverStderr = "";
transport.stderr?.on("data", (chunk) => { serverStderr += String(chunk); });
const client = new Client({ name: "context-router-runtime-test", version: "1.0.0" });

try {
  try { await client.connect(transport); } catch (error) {
    throw new Error(`MCP connection failed: ${error instanceof Error ? error.message : String(error)}\n${serverStderr}`);
  }
  const tools = await client.listTools();
  const names = tools.tools.map((tool) => tool.name);
  assert(names.includes("research"));
  assert(names.includes("get_context"));
  assert(!names.includes("run_pipeline"), "mutating pipeline tool must be opt-in");

  const inside = await client.callTool({ name: "research", arguments: { target: "inside.txt" } });
  assert.notEqual(inside.isError, true, JSON.stringify(inside));
  assert.match(JSON.stringify(inside.content), /inside\.txt/u);

  const traversal = await client.callTool({ name: "research", arguments: { target: "../external/outside.txt" } });
  assert.equal(traversal.isError, true);
  assert.doesNotMatch(JSON.stringify(traversal.content), /outside\\n/u);
  console.log("context-router MCP initialize, tools/list, cwd, and boundary tests passed");
} finally {
  await client.close();
  rmSync(fixture, { recursive: true, force: true });
}
