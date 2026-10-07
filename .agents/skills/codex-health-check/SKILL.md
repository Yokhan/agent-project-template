---
name: codex-health-check
description: "Run project or template health checks: drift, validation, tests, security posture, dependency state, registry freshness, and release readiness."
---

# Codex Health Check

Use project-specific commands from `PROJECT_SPEC.md` and `_reference/tool-registry.md`.

Choose checks for the requested health question. Follow
`.claude/library/process/self-verification.md`; reuse fresh scope/state-bound
results and inspect aggregate coverage before adding leaf commands.

- Structure/instruction health: `bash scripts/validate-template.sh`.
- Delivered behavior/setup/sync regression: `bash scripts/test-template.sh`.
- Drift or entrypoint consistency: `bash scripts/check-drift.sh` or
  `bash scripts/sync-agents.sh` only for that uncovered question.

These are alternatives/supplements, not an additive baseline after every edit.
Required release/security gates still apply. A health-check request authorizes
diagnosis, not repairs, dependency installs, sync/apply or publication by itself.
Report failures first with evidence, likely cause and next action; distinguish
static configuration, observed runtime health and checks not performed.
