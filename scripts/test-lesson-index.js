#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { collect, parseArgs, MAX_OUTPUT_CHARS, MAX_SOURCE_BYTES } = require("./lesson-index.js");

function write(root, relative, contents) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
  return file;
}

function snapshot(root) {
  const result = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const stat = fs.lstatSync(file);
      result.push({ relative: path.relative(root, file), mode: stat.mode, size: stat.size, mtimeMs: stat.mtimeMs,
        bytes: entry.isFile() ? fs.readFileSync(file).toString("base64") : null });
      if (entry.isDirectory()) visit(file);
    }
  };
  visit(root);
  return result.sort((a, b) => a.relative.localeCompare(b.relative));
}

function fixtureLessons() {
  return [
    "# Lessons",
    "",
    "### 2026-10-01 — Активный unicode маршрут",
    "**Error**: Ошибка с русским текстом.",
    "**Root cause**: Проверка не находила Unicode.",
    "**Rule**: Сохраняй русские названия и проверяй активный маршрут.",
    "**Status**: ACTIVE",
    "",
    "### 2026-10-02 — Promoted stable rule",
    "**Rule**: Keep promoted scope bounded.",
    "**Status**: PROMOTED",
    "**Promoted to**: .claude/rules/project-example.md",
    "",
    "### 2026-10-03 — Retired obsolete lesson",
    "**Rule**: retired-unique-never-return",
    "**Status**: RETIRED",
    "",
    "### 2026-10-04 — Legacy old note",
    "**Rule**: Legacy notes are unclassified until reviewed.",
    "",
  ].join("\n");
}

function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-index-test-"));
  try {
    const project = path.join(temporary, "project");
    fs.mkdirSync(project);
    const lessonsPath = write(project, "tasks/lessons.md", fixtureLessons());
    const currentPath = write(project, "tasks/current.md", [
      "<!-- PROGRESSIVE_STATUS",
      "status: active",
      "-->",
      "# Current Task — Active Delivery",
      "Current header summary for navigation.",
      "",
      "## Active goal — deliver the current feature",
      "Preserve the exact acceptance contract and verify the live surface.",
      "",
      "## Later",
      "Do not select this section.",
    ].join("\n"));
    const strategyPath = write(project, "tasks/change-strategy.json", JSON.stringify({
      recommendation: { option_id: "bounded-route", reason: "Keep execution inside the approved boundary." },
      approval: { envelope: { current: true, outcome: "Complete bounded delivery", scope: "Existing project source" } },
    }));

    const before = snapshot(project);
    assert.deepEqual(parseArgs(["--query", "русский маршрут", "--limit", "10"]), { query: "русский маршрут", limit: 10 });
    assert.throws(() => parseArgs(["--query", "x", "--limit", "11"]), /limit must be an integer/u);
    const unicode = collect(project, "русский маршрут");
    assert(unicode.results.some(item => item.source === "tasks/lessons.md" && item.title.includes("Активный")), "Unicode query finds the active lesson");
    assert(!unicode.results.some(item => item.title.includes("Retired")), "retired lessons are excluded by default");
    assert.equal(unicode.excludedRetired, 1);
    const promoted = collect(project, "promoted bounded scope");
    const promotedItem = promoted.results.find(item => item.status === "PROMOTED");
    assert.equal(promotedItem?.destination, ".claude/rules/project-example.md");
    const legacy = collect(project, "unclassified notes");
    assert(legacy.results.some(item => item.status === "LEGACY-UNCLASSIFIED"), "legacy entries are explicitly unclassified");
    const current = collect(project, "acceptance contract live surface");
    assert(current.results.some(item => item.source === "tasks/current.md" && item.title.includes("Active goal")));
    const strategy = collect(project, "approved boundary");
    assert(strategy.results.some(item => item.source === "tasks/change-strategy.json"));
    assert(JSON.stringify(collect(project, "route", 10)).length <= MAX_OUTPUT_CHARS, "bounded navigation result stays within output cap");
    assert.equal(snapshot(project).length, before.length, "index creates no project artifacts");
    assert.deepEqual(snapshot(project), before, "index leaves source bytes and timestamps unchanged");

    const empty = path.join(temporary, "empty-project");
    fs.mkdirSync(empty);
    const emptyResult = collect(empty, "anything");
    assert.equal(emptyResult.results.length, 0);
    assert(emptyResult.gaps.some(gap => gap.source === "tasks/lessons.md" && gap.code === "missing"));
    assert(emptyResult.gaps.some(gap => gap.source === "tasks/current.md" && gap.code === "missing"));

    const oversized = path.join(temporary, "oversized-project");
    fs.mkdirSync(oversized);
    write(oversized, "tasks/lessons.md", "x".repeat(MAX_SOURCE_BYTES + 1));
    write(oversized, "tasks/current.md", "# Oversized case\n");
    const oversizedResult = collect(oversized, "case");
    assert(oversizedResult.gaps.some(gap => gap.source === "tasks/lessons.md" && gap.code === "oversized"));

    const outside = path.join(temporary, "outside");
    write(outside, "lessons.md", fixtureLessons());
    const linked = path.join(temporary, "linked-project");
    fs.mkdirSync(linked);
    fs.symlinkSync(outside, path.join(linked, "tasks"), "junction");
    const symlinkResult = collect(linked, "active");
    assert(symlinkResult.gaps.some(gap => gap.source === "tasks/lessons.md" && gap.code === "symlink-refused"));
    assert(symlinkResult.gaps.some(gap => gap.source === "tasks/current.md" && gap.code === "symlink-refused"));

    console.log("lesson-index focused tests passed: status filtering, promoted pointers, Unicode, active context, bounds, missing/oversized sources, symlink refusal, and read-only behavior");
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

main();
