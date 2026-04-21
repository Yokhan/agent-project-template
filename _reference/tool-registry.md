# Tool Registry

> Searchable index of reusable utilities across this project.
> **Check HERE before writing new code.** See `.claude/library/technical/atomic-reuse.md`.
>
> Maintained by: agents (manual), `scripts/scan-project.sh` (project-level scan), `scripts/audit-reuse.sh` (ongoing).

## Template-Level (available in ALL projects)

| Tool | Path | Purpose |
|------|------|---------|
| check-drift | scripts/check-drift.sh | Template health check (9 checks) |
| check-banlist | scripts/check-banlist.sh | AI-slop word scanner for content |
| session-metrics | scripts/session-metrics.sh | Session stats collector (daily log) |
| sync-template | scripts/sync-template.sh | Template sync with hash verification |
| bootstrap-mcp | scripts/bootstrap-mcp.sh | MCP server auto-setup |
| audit-reuse | scripts/audit-reuse.sh | Duplicate detector, extraction candidates |
| downstream-census | scripts/downstream-census.sh | Migration matrix across downstream template repos |
| generate-project-spec | scripts/generate-project-spec.sh | Build PROJECT_SPEC.md from repo state |
| scan-project | scripts/scan-project.sh | Initial project scan, registry population |
| task-brief | scripts/task-brief.sh | Compact summary for tasks/current.md |
| test-hooks | scripts/test-hooks.sh | Hook syntax validation |
| brain-search | scripts/brain-search.sh | Search brain/ knowledge base |

## Project-Level (auto-populated by scan-project.sh, updated by agents)

| Tool | Path | Purpose | Used by |
|------|------|---------|---------|
| blast-radius | scripts/blast-radius.sh | blast-radius.sh — BFS through import graph to find all affected files | agent/manual |
| codex-hook-adapter | scripts/codex-hook-adapter.sh | codex-hook-adapter.sh — Translates Codex hook env vars to Claude hook | agent/manual |
| context-restore | scripts/context-restore.sh | context-restore.sh — Restore context after compaction or session start | agent/manual |
| import-graph | scripts/import-graph.sh | import-graph.sh — Find most-imported files (hot files) in a project | agent/manual |
| measure-context | scripts/measure-context.sh | measure-context.sh — Measure auto-loaded context size + budget check | agent/manual |
| module-status | scripts/module-status.sh | Module Status Scanner — analyze project module health | agent/manual |
| plan-scaffold | scripts/plan-scaffold.sh | plan-scaffold.sh — Generate plan skeleton in tasks/current.md | agent/manual |
| research | scripts/research.sh | research.sh — Automated research protocol (replaces 6+ tool calls with | agent/manual |
| route-task | scripts/route-task.sh | route-task.sh — Dynamic keyword router (zero AI tokens) | agent/manual |
| scan-projects | scripts/scan-projects.sh | Scan directory for git repos and output JSON-friendly pipe-delimited dat | agent/manual |
| scan-repo | scripts/scan-repo.sh | scan-repo.sh — Scan a cloned/untrusted repo for security risks before | agent/manual |
| set-mode | scripts/set-mode.sh | set-mode.sh — manually set task mode (alternative to route-task.sh) | agent/manual |
| sync-agents | scripts/sync-agents.sh | sync-agents.sh — Validate CLAUDE.md and AGENTS.md reference the same s | agent/manual |
| sync-all | scripts/sync-all.sh | sync-all.sh — Sync template to all projects with .template-manifest.js | agent/manual |
| test-template | scripts/test-template.sh | test-template.sh — Smoke test for agent-project-template | agent/manual |
| update-template | scripts/update-template.sh | update-template.sh — Update project from newer template version | agent/manual |
| validate-template | scripts/validate-template.sh | validate-template.sh — Pre-release validation for agent-project-templa | agent/manual |
| verify-check | scripts/verify-check.sh | verify-check.sh — Automated verification checklist | agent/manual |

## Helpers & Utilities (src/shared/ or lib/)

| Function | Path | Signature | Used by |
|----------|------|-----------|---------|
| _No shared utilities detected_ | | | |

## Candidates for Extraction (auto-detected by audit-reuse.sh)

| Function | Found in | Count | Recommendation |
|----------|----------|-------|----------------|
| _Run `bash scripts/audit-reuse.sh` to detect_ | | | |

## Design Tokens & Components (Figma projects only)

| Component | ID/Path | Variants | Used by |
|-----------|---------|----------|---------|
| _Populated by agents working with Figma MCP_ | | | |

---

_Last scan: 2026-04-21_
