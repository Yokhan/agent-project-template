import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixture = mkdtempSync(join(tmpdir(), "context-router-security-"));
const projectRoot = join(fixture, "project");
const externalRoot = join(fixture, "external");
mkdirSync(join(projectRoot, "tasks"), { recursive: true });
mkdirSync(externalRoot);
writeFileSync(join(projectRoot, "tasks", "safe.txt"), "inside", "utf8");
writeFileSync(join(externalRoot, "sentinel.txt"), "outside", "utf8");

process.env.CONTEXT_ROUTER_PROJECT_ROOT = projectRoot;
const files = await import(`./project-files.js?security=${Date.now()}`);

try {
  for (const unsafe of ["../external/sentinel.txt", "/tmp/file", "C:\\temp\\file", "\\\\server\\share\\file", "tasks/../file", "tasks//file"]) {
    assert.throws(() => files.normalizeProjectPath(unsafe), /Unsafe project path/u, unsafe);
  }

  assert.equal(files.readProjectText("tasks/safe.txt"), "inside");
  files.writeProjectTextAtomic("tasks/safe.txt", "updated");
  assert.equal(readFileSync(join(projectRoot, "tasks", "safe.txt"), "utf8"), "updated");

  const linkPath = join(projectRoot, "linked-outside");
  symlinkSync(externalRoot, linkPath, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => files.readProjectText("linked-outside/sentinel.txt"), /Symlink\/reparse/u);
  assert.throws(() => files.writeProjectTextAtomic("linked-outside/sentinel.txt", "pwned"), /Symlink\/reparse/u);
  assert.equal(readFileSync(join(externalRoot, "sentinel.txt"), "utf8"), "outside");

  console.log("context-router filesystem security tests passed");
} finally {
  delete process.env.CONTEXT_ROUTER_PROJECT_ROOT;
  rmSync(fixture, { recursive: true, force: true });
}
