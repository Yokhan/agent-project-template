---
name: codex-pipeline-workflow
description: "Coordinate multi-phase feature, repair, design or release work with shared pipeline gates. Use for an explicit pipeline or meaningful phase dependencies, not every edit needing a test."
---

# Codex Pipeline Workflow

Use `docs/AGENT_PIPELINES.md` as the source of truth.

## Process

1. Reuse a valid supplied route or run `node scripts/codex-route-task.js "<user request>" --summary` when routing changes execution. Add `--write-state` only when hooks or the project's continuity contract require it.
2. Identify the pipeline: feature, bugfix, security patch, design, review, release, or template maintenance.
3. Read the relevant pipeline section from `docs/AGENT_PIPELINES.md`.
4. Apply `.claude/library/process/plan-first.md`: product waves are successive versions of the same product; pipeline phases and worker tasks stay inside that plan, not new product waves.
5. Respect phase dependencies; independent work may run in parallel inside the accepted scope. Do not recite every phase or restart completed research/checks without invalidation.
6. Stop at user-approval gates when required by risk or local rules.
7. Update the existing project/AgentOS artifact when a material decision, status change or handoff needs persistence. Do not create a competing `tasks/current.md` just because the task is M+.
8. Follow `.claude/library/process/self-verification.md`: focused worker checks, parent-owned integration, no duplicate full-suite cascade. A pipeline's check list is coverage to establish, not commands to rerun after each phase. Report observed results and material gaps, not mandatory confidence/doubt labels.

## Codex Adaptation

Do not reuse Claude model routing. Follow `scripts/codex-agent-policy.js` and
`codex-subagent-orchestration`: Luna High executes nontrivial bounded changes,
including sequential work. Sol 6.1 High defines contracts, resolves uncertainty,
integrates and accepts. Parallel lanes need independent ownership; delegation
itself does not require parallelism. Keep tiny edits direct and respect opt-out,
host limits and approval gates. Do not repeat the worker's implementation or checks.
