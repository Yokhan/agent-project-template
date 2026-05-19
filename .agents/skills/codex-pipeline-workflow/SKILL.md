---
name: codex-pipeline-workflow
description: "Execute shared agent pipelines in Codex: feature, bugfix, security patch, design, review, and closeout workflows with explicit gates. Use when a task needs multiple phases, risk control, verification, or the user asks to run a pipeline."
---

# Codex Pipeline Workflow

Use `docs/AGENT_PIPELINES.md` as the source of truth.

## Process

1. Identify the pipeline: feature, bugfix, security patch, design, or review.
2. Read the relevant pipeline section from `docs/AGENT_PIPELINES.md`.
3. State the active phase and gate before doing work.
4. Complete one phase at a time.
5. Stop at user-approval gates when required by risk or local rules.
6. Write handoff notes to `tasks/current.md` for M+ or interrupted work.
7. Run the verification commands from the pipeline, then close out with confidence and doubt.

## Codex Adaptation

Do not promise Claude subagents or model routing. If an independent review is needed, perform a review pass in the current context or ask the user for a second-agent checkpoint.
