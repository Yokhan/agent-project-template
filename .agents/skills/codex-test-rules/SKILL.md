---
name: codex-test-rules
description: "Validate template rules, skills, hooks, AGENTS instructions, and regression fixtures. Trigger when changing rule files, skill files, validation scripts, or agent instructions."
---

# Codex Test Rules

Use this when changing template instruction infrastructure rather than application code.

## Checks

Follow `.claude/library/process/self-verification.md`: choose focused checks
for the current task; parent/integrator owns broad boundary acceptance.
These are check-selection conditions, not a full-suite checklist per patch:

- Changed shell/JavaScript validators: run their syntax and targeted regression checks.
- Changed skills: validate `.agents/skills` with `node scripts/validate-codex-skills.js`.
- Changed `AGENTS.md`: confirm it stays below 32KB.
- New template-owned paths: confirm setup and sync deliver them.
- Changed shipped behavior: add or update a focused smoke/regression fixture.

At the relevant task/integration closeout, select one relevant aggregate from
`docs/AGENT_CONTEXT_SOT.md`; do not separately repeat its contained leaf checks
without a concrete delta. State the invalidation before a broad rerun. Preserve
mandatory CI, security, release, and artifact-bound gates.

For instruction-only changes, validate maintained wording/wiring and review
realistic decisions. A static fixture proves that a rule is present and wired,
not that arbitrary hosts enforce its runtime behavior. Do not claim a universal
test-command ban without an actual enforcement boundary.
