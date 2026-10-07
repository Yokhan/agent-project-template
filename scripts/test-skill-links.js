#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { validateSkillLinks } = require("./lib/skill-links.js");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-skill-links-"));

function write(relativePath, content = "target\n") {
  const targetPath = path.join(tempRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

try {
  const skillsRoot = path.join(tempRoot, ".agents", "skills");
  const skillDir = path.join(skillsRoot, "sample-skill");
  write("Root Guide.md");
  write(".agents/skills/sample-skill/SKILL.md", [
    "[relative](references/guide.md)",
    "[root](../../../Root%20Guide.md)",
    "[fragment](#overview)",
    "[external](https://example.com/guide.md)",
    "[email](mailto:help@example.com)",
    "[template](path/to/<file>)",
    "`[inline example](missing-inline.md)`",
    "```md",
    "[fenced example](missing-fenced.md)",
    "```",
    "[broken](missing.md)",
  ].join("\n"));
  write(".agents/skills/sample-skill/references/guide.md", [
    "[nested](nested/deep.md)",
    "[space](nested/Guide%20with%20spaces.md)",
  ].join("\n"));
  write(".agents/skills/sample-skill/references/nested/deep.md");
  write(".agents/skills/sample-skill/references/nested/Guide with spaces.md");
  write(".agents/skills/project-owned/SKILL.md", "[ignored](missing-project.md)");

  const errors = validateSkillLinks(skillsRoot);
  assert.strictEqual(errors.length, 1, errors.join("\n"));
  assert.match(errors[0], /sample-skill\/SKILL\.md:11/);
  assert.match(errors[0], /missing\.md/);

  console.log("Skill link target tests passed");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
