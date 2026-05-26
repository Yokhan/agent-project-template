#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { getRoute } = require("./codex-route-task.js");

function assertIncludes(values, expected, message) {
  assert(
    values.includes(expected),
    `${message}: expected ${expected}, got ${values.join(", ")}`,
  );
}

function testRoute(task, expectations) {
  const route = getRoute(task, expectations.options || {});
  for (const mode of expectations.modes || []) {
    assertIncludes(route.modes, mode, `${task} modes`);
  }
  for (const skill of expectations.skills || []) {
    assertIncludes(route.skills, skill, `${task} skills`);
  }
  for (const subagent of expectations.subagents || []) {
    assertIncludes(route.subagents, subagent, `${task} subagents`);
  }
  if (expectations.risk) {
    assert.strictEqual(route.risk, expectations.risk, `${task} risk`);
  }
  if (expectations.orchestrator) {
    assert.strictEqual(
      route.orchestrator.owner,
      expectations.orchestrator,
      `${task} orchestrator`,
    );
  }
  if (typeof expectations.needsFreshDocs === "boolean") {
    assert.strictEqual(
      route.needsFreshDocs,
      expectations.needsFreshDocs,
      `${task} fresh docs`,
    );
  }
}

function withTempProject(setup, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-route-"));
  try {
    setup(root);
    callback(root);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}

function main() {
  testRoute("почини падающий тест логина", {
    modes: ["bugfix", "testing"],
    skills: ["codex-debug", "codex-coverage"],
    subagents: ["tester", "reviewer"],
    risk: "MEDIUM",
  });

  testRoute("сделай дизайн экрана и figma mockup", {
    modes: ["design", "figma"],
    skills: ["codex-design-workflow", "codex-figma-workflow"],
    subagents: ["design_reviewer", "tester"],
    risk: "MEDIUM",
  });

  testRoute("проверь безопасность auth secrets injection", {
    modes: ["security", "review"],
    skills: ["codex-security-audit", "codex-audit", "codex-strategic-review"],
    subagents: ["security_reviewer", "tester"],
    risk: "HIGH",
  });

  testRoute("обнови агентский шаблон, AGENTS.md, skills и router", {
    modes: ["template"],
    skills: [
      "codex-template-sync",
      "codex-skill-maintenance",
      "codex-test-rules",
      "codex-strategic-review",
    ],
    subagents: ["pr_explorer", "tester"],
    risk: "HIGH",
  });

  testRoute("выпусти release v3.8.0 и tag чтобы проекты качали релиз", {
    modes: ["release"],
    skills: [
      "codex-template-sync",
      "codex-health-check",
      "codex-strategic-review",
    ],
    subagents: ["security_reviewer", "tester"],
    risk: "HIGH",
  });

  testRoute("проверь current OpenAI GPT-5.5 model docs", {
    modes: ["openai"],
    skills: ["codex-openai-model-guidance"],
    subagents: ["docs_researcher"],
    needsFreshDocs: true,
  });

  testRoute("нарисуй mermaid control board for release flow", {
    modes: ["mermaid", "release"],
    skills: ["codex-mermaid-board-workflow"],
  });

  withTempProject(
    (root) => {
      fs.mkdirSync(path.join(root, ".agent-os"), { recursive: true });
      fs.mkdirSync(path.join(root, "tasks"), { recursive: true });
      fs.writeFileSync(path.join(root, "tasks", "current.md"), "fixture\n");
    },
    (root) => {
      testRoute("implement feature from AgentOS plan", {
        modes: ["feature"],
        skills: ["codex-feature-workflow"],
        orchestrator: "agentos",
        options: { cwd: root },
      });
    },
  );

  console.log("Codex routing smoke passed");
}

main();
