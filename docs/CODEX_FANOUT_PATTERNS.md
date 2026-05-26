# Codex Fan-Out Patterns

Date: 2026-05-19

## Purpose

Use this document when a Codex task can be split across `.codex/agents` workers.

The goal is not to force a single spec system into every project. The goal is to
reuse the best Spec Kit ideas in a flexible way:

- Work from durable artifacts when they exist: `spec.md`, `plan.md`, `tasks.md`,
  `PROJECT_SPEC.md`, `tasks/current.md`, issue text, or domain-specific equivalents.
- Let existing project systems win: Spec Kit, litkit, Kiro, AgentOS, or project-local
  `project-*` skills and agents.
- Use explicit parallelism markers or non-overlapping file ownership before spawning
  write-capable work.
- Keep the parent Codex thread responsible for sequencing, consolidation, and final
  verification.

## Discovery First

Before spawning subagents, inspect the project for existing workflow artifacts:

For Codex, start with the deterministic route check:

```bash
node scripts/codex-route-task.js "<user request>" --summary --write-state
```

Use the returned skills, subagents, pipeline, risk, and orchestrator owner as the parent-thread contract. The script does not replace project artifacts; it makes the first routing step explicit and testable.

| Look for | Meaning |
| --- | --- |
| `.specify/`, `specs/*/spec.md`, `specs/*/plan.md`, `specs/*/tasks.md` | Spec Kit or Spec Kit-like flow |
| `litkit/`, `core/config.yaml`, domain `project-*` skills | Domain pipeline owns phases and vocabulary |
| `.kiro/`, `requirements.md`, `design.md`, `tasks.md` | Kiro-style artifact flow |
| `PROJECT_SPEC.md`, `tasks/current.md`, `docs/AGENT_PIPELINES.md` | Template-native context |
| `AgentOS` metadata, Strategy/Tactic/Plan/Todo/Gate terms | AgentOS owns orchestration state |

If a project has its own task graph, do not replace it. Treat it as the input
contract for Codex fan-out.

## Spec-Kit-Inspired Flow

Spec Kit's portable pattern is:

1. Spec: define the user-facing behavior and acceptance criteria.
2. Plan: map architecture, constraints, risks, and verification.
3. Tasks: create dependency-ordered tasks and mark independent work with `[P]`.
4. Implement: execute in dependency order, using parallel work only where safe.

Codex adaptation:

- Use `pr_explorer` and `docs_researcher` to ground the spec and plan in the repo.
- Use `tester`, `reviewer`, `security_reviewer`, and `design_reviewer` as gates.
- Use `[P]` tasks or explicit non-overlapping files as the only default write split.
- Use `implementer` only for isolated tasks with exact files and expected behavior.

## Routing Matrix

| Work type | Default agents | Parent action |
| --- | --- | --- |
| Bugfix | `pr_explorer`, `tester`, `reviewer` | Reproduce, patch, run regression check |
| Security patch | `security_reviewer`, `pr_explorer`, `tester` | Patch narrowly, prove exploit path is closed |
| UI/design | `design_reviewer`, `tester`, `reviewer` | Apply token/component/state fixes, screenshot-check |
| API/framework docs | `docs_researcher`, `reviewer` | Browse official docs when freshness matters, update code/docs |
| Large feature | `pr_explorer`, `docs_researcher`, `tester`, then optional `reviewer` | Build spec/plan/tasks before edits |
| Existing `tasks.md` | `pr_explorer`, `tester` | Identify dependency order and `[P]` groups |
| Release or migration | `reviewer`, `tester`, optional `security_reviewer` | Validate compatibility and rollback path |

## Prompt Templates

### Feature Fan-Out

```text
Use Codex subagents with a Spec/Plan/Tasks flow.

First inspect whether this project already has Spec Kit, litkit, Kiro, AgentOS,
or project-local workflow artifacts. Do not replace them.

Spawn:
- pr_explorer: map affected files, current behavior, dependencies, and tests.
- docs_researcher: verify official docs or source-backed APIs if external behavior matters.
- tester: propose acceptance and regression checks.

Wait for all results. Parent thread writes the plan and performs edits unless
there are explicit [P] tasks with non-overlapping files.
```

### Task Decomposition

```text
Read the existing spec/plan/tasks artifacts.
Spawn pr_explorer and tester to identify:
- dependency order
- tasks that are truly parallel-safe
- tasks that must not be split
- missing acceptance or regression checks

Return a revised task graph using [P] only for independent work.
Do not edit files during this pass.
```

### Review Fan-Out

```text
Review this branch/change. Spawn:
- pr_explorer for changed paths and execution flow.
- reviewer for correctness, regressions, boundaries, and missing tests.
- tester for the smallest useful verification suite.
- security_reviewer only if auth, secrets, input handling, permissions, storage,
  or dependency risk is touched.

Wait for all results and consolidate findings by severity.
```

### Security Fan-Out

```text
Spawn:
- security_reviewer: identify concrete exploit paths and trust-boundary failures.
- pr_explorer: map affected files and callers.
- tester: define checks that prove vulnerable and allowed behavior.

Parent thread applies the smallest patch and verifies the exploit path is closed.
```

### Design Fan-Out

```text
Spawn:
- design_reviewer: audit UX, UI, tokens, components, states, responsive behavior,
  accessibility, and visual consistency.
- tester: define viewport, state, overflow, and interaction checks.
- reviewer: check implementation boundaries and regressions.

Parent thread edits after results are merged.
```

### Debug Fan-Out

```text
Spawn:
- pr_explorer: trace failing path, callers, config, and recent history.
- tester: define the minimal reproduction and regression check.
- reviewer: check likely fix risks before editing.

Do not patch until the failure is observable or the blocker is explicitly documented.
```

## Write Delegation Rules

Default: all subagents are read-only, and the parent edits.

Use `implementer` only when all are true:

- The task maps to exact files.
- No other worker is editing those files.
- Inputs and expected behavior are stated in one prompt.
- The parent can run or inspect a narrow verification after the worker returns.

Do not use `implementer` for shared architecture, broad refactors, migrations with
hidden coupling, security-sensitive patches, or UI work that needs screenshot-driven
iteration across many components.

## AgentOS Compatibility

AgentOS has its own orchestration vocabulary and runtime loops. Keep Codex fan-out
additive:

- Do not require AgentOS schema changes for this template.
- Do not rename setup or sync entrypoints.
- Treat AgentOS Strategy/Tactic/Plan/Todo/Gate artifacts as the source task graph
  when present.
- If `codex-route-task.js` reports `orchestrator.owner = agentos`, Codex acts as
  a worker for the AgentOS task graph and does not create a competing graph.
- Ship new Codex docs, skills, and agents through the existing template setup/sync
  allowlist only.
- AgentOS may choose a template release tag, but projects still consume that tag
  through `scripts/sync-template.sh --from-git --ref <tag>`.

## Zed Note

Zed can run Codex through ACP and Codex can load native `.codex/agents` project
configuration in a trusted repo. Zed may not expose child-thread details as clearly
as the Codex CLI/app. Rely on the parent summary during normal work and use
`scripts/test-codex-subagents-live.sh --yes` only when runtime verification is worth
spending quota.

## Sources

- GitHub Spec Kit: https://github.com/github/spec-kit
- Spec Kit documentation: https://github.github.io/spec-kit/
- Spec-driven overview: https://github.com/github/spec-kit/blob/main/spec-driven.md
