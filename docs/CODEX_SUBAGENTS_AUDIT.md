# Codex Subagents Audit And Upgrade Plan

Date: 2026-05-19

## Result

Codex subagents are worth adding to this template, but they should not replace skills.

- `.agents/skills/` remains the knowledge and workflow layer.
- `.codex/agents/*.toml` is now the execution and delegation layer for Codex subagents.
- Zed runs Codex through ACP, but Codex itself reads native `.codex` configuration. Local CLI testing confirmed project-scoped custom agents work in a trusted repo.

## Current State Before This Pass

| Surface | State | Gap |
| --- | --- | --- |
| `.claude/agents/` | 10 specialized Claude agents plus `PROTOCOL.md` | Claude-specific model/tool metadata, not reusable as Codex TOML |
| `.codex/config.toml` | Project-safe hooks feature only | No `[agents]` concurrency guard |
| `.codex/agents/` | Empty | No project-scoped Codex subagents |
| `.agents/skills/` | 37 Codex skills | Skills describe workflows and route-first contracts; subagents provide parallel worker threads |
| Zed ACP | Runs managed `codex-acp` | Zed UI support for Codex child-thread visibility is not as explicit as Claude subagents |

## Local Test Evidence

Environment checked:

- `codex-cli 0.125.0`
- `codex features list` showed `multi_agent stable true`
- Zed has live managed `codex-acp.exe` processes under `AppData/Local/Zed/external_agents/registry/codex-acp/v_0.10.0...`

Probe results:

1. `codex exec --json` successfully called `spawn_agent` and `wait`.
2. A trusted repo-scoped `.codex/agents/probe-reader.toml` was applied: the child returned a marker that existed only in the TOML file.
3. A temp project outside the trusted repo returned `unknown agent_type`, so project trust/location matters for custom agent loading.
4. After adding the pack, `pr_explorer` spawned successfully and returned `PR_EXPLORER_READY` on `gpt-5.3-codex-spark`.

## Implemented Agent Pack

| Agent | Mode | Model | Purpose |
| --- | --- | --- | --- |
| `pr_explorer` | read-only | `gpt-5.3-codex-spark` | Map files, execution paths, dependencies, context |
| `reviewer` | read-only | `gpt-5.3-codex-spark` | Correctness, regressions, boundaries, test gaps |
| `security_reviewer` | read-only | `gpt-5.3-codex-spark` | Auth, secrets, injection, permissions, data exposure |
| `tester` | read-only | `gpt-5.3-codex-spark` | Regression strategy, edge cases, verification commands |
| `docs_researcher` | read-only | `gpt-5.3-codex-spark` | Official docs and source-backed API checks |
| `design_reviewer` | read-only | `gpt-5.3-codex-spark` | UI/UX/design-system/accessibility review |
| `implementer` | workspace-write | `gpt-5.3-codex-spark` | Isolated implementation chunks only |

## Prompt Patterns

Detailed fan-out prompts, routing rules, and Spec Kit-inspired task splitting live
in `docs/CODEX_FANOUT_PATTERNS.md`. The deterministic route entrypoint is:

```bash
node scripts/codex-route-task.js "<user request>" --summary --write-state
```

Keep this audit as the evidence and risk log.

Use this for safe fan-out in Zed or CLI:

```text
Spawn Codex subagents without full-history forks:
- pr_explorer: map affected files and execution paths.
- reviewer: find correctness, regression, and missing-test risks.
- tester: propose the smallest useful regression checks.
Wait for all results. Parent agent performs edits unless an implementer task is explicitly isolated.
```

Use this for review:

```text
Review this branch against main. Spawn:
1. pr_explorer for affected paths.
2. reviewer for correctness and maintainability.
3. security_reviewer for trust boundaries and secrets.
4. tester for regression coverage.
Wait for all and return consolidated findings ordered by severity.
```

Use this for design:

```text
Spawn design_reviewer to audit the UI/design-system/accessibility risks and tester to propose viewport and state checks. Wait for both before editing.
```

## Improvement Plan

1. Keep `codex-subagent-orchestration` aligned with `docs/CODEX_FANOUT_PATTERNS.md`.
2. Keep `scripts/validate-codex-agents.js` strict enough to catch unsafe defaults, missing model fields, and writable-agent drift.
3. Keep implementation delegation conservative: read-only agents first; `implementer` only for explicit non-overlapping files.
4. Use `scripts/test-codex-subagents-live.sh --yes` only when a quota-consuming runtime check is needed.
5. Avoid recursive fan-out: keep `agents.max_depth = 1`.

## Spec Kit Adaptation

The useful Spec Kit ideas are artifact discipline, not a mandatory folder layout:

- Work from `spec.md`, `plan.md`, and `tasks.md` when present.
- Preserve project-specific systems such as Spec Kit, litkit, Kiro, and AgentOS.
- Use `[P]` or equivalent task metadata to identify safe parallel work.
- Treat gates and constitutions as project-owned quality contracts.
- Keep the parent Codex thread responsible for final sequencing and verification.

## AgentOS Compatibility

No AgentOS code changes are required for this subagent pack. The template still
exports docs, skills, agents, and scripts through the existing setup/sync contract,
and AgentOS can continue to orchestrate via its own Strategy/Tactic/Plan/Todo/Gate
model.

If `scripts/codex-route-task.js` detects AgentOS, Codex treats AgentOS as the
orchestrator and uses subagents only inside the assigned worker route. AgentOS
may choose the template release tag, but the project applies it through
`scripts/sync-template.sh --from-git --ref <tag>`.

## Risks

- Subagents consume extra quota and tokens. Use them for parallelizable work, not every small edit.
- Zed may not show child threads as clearly as Codex CLI/app yet. Parent summaries remain the reliable interface.
- Concurrent write agents can conflict. Default to read-only fan-out and parent-owned edits.
