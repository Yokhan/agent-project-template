---
name: codex-subagent-orchestration
description: "Use Codex subagents for parallel exploration, review, testing, docs research, design audit, and isolated implementation. Trigger when the task can be split across `.codex/agents` workers."
---

# Codex Subagent Orchestration

Use this skill when parallel work can reduce latency without creating edit conflicts.

## Default Pattern

1. Run `node scripts/codex-route-task.js "<user request>" --summary --write-state`.
2. Discover existing workflow artifacts first: Spec Kit, litkit, Kiro, AgentOS, `PROJECT_SPEC.md`, `tasks/current.md`, or project-local `project-*` skills.
3. If AgentOS is detected, treat it as the orchestrator and use Codex subagents only inside the assigned worker route.
4. Spawn read-only agents first: `pr_explorer`, `reviewer`, `security_reviewer`, `tester`, `docs_researcher`, or `design_reviewer`.
5. Ask for narrow outputs with file references and verification steps.
6. Wait for all results.
7. Consolidate in the parent thread.
8. Parent performs edits unless an `implementer` task is isolated to non-overlapping files.

For prompt templates and the routing matrix, read `docs/CODEX_FANOUT_PATTERNS.md`.

## Safe Prompt

```text
Use Codex subagents with existing project artifacts.
First inspect whether this project has Spec Kit, litkit, Kiro, AgentOS, or project-local workflow docs.
Spawn pr_explorer, reviewer, and tester for read-only grounding.
Wait for all results. Parent agent performs edits unless exact [P] tasks with non-overlapping files are assigned.
```

## Guardrails

- Do not use subagents for XS tasks.
- Do not spawn multiple write-capable agents on overlapping files.
- Treat `[P]` or equivalent project task metadata as the default signal for safe parallel work.
- Keep `agents.max_depth = 1`.
- Remember that subagents consume additional quota and tokens.
- In Zed, rely on the parent summary; child-thread visibility may lag CLI/app UX.
