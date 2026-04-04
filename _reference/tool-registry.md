# Tool Registry

> Searchable index of reusable utilities across this project.
> **Check HERE before writing new code.** See `.claude/library/technical/atomic-reuse.md`.
>
> Maintained by: agents (manual), `scripts/scan-project.sh` (initial), `scripts/audit-reuse.sh` (ongoing).

## Template-Level (available in ALL projects)

| Tool | Path | Purpose |
|------|------|---------|
| check-drift | scripts/check-drift.sh | Template health check (9 checks) |
| check-banlist | scripts/check-banlist.sh | AI-slop word scanner for content |
| session-metrics | scripts/session-metrics.sh | Session stats collector (daily log) |
| sync-template | scripts/sync-template.sh | Template sync with hash verification |
| bootstrap-mcp | scripts/bootstrap-mcp.sh | MCP server auto-setup |
| audit-reuse | scripts/audit-reuse.sh | Duplicate detector, extraction candidates |
| scan-project | scripts/scan-project.sh | Initial project scan, registry population |
| test-hooks | scripts/test-hooks.sh | Hook syntax validation |
| brain-search | scripts/brain-search.sh | Search brain/ knowledge base |

## Project-Level (auto-populated by scan-project.sh, updated by agents)

| Tool | Path | Purpose | Used by |
|------|------|---------|---------|
| _Run `bash scripts/scan-project.sh` to populate_ | | | |

## Helpers & Utilities (src/shared/ or lib/)

| Function | Path | Signature | Used by |
|----------|------|-----------|---------|
| _Run `bash scripts/audit-reuse.sh` to detect_ | | | |

## Candidates for Extraction (auto-detected by audit-reuse.sh)

| Function | Found in | Count | Recommendation |
|----------|----------|-------|----------------|
| _Run `bash scripts/audit-reuse.sh` to detect_ | | | |

## Design Tokens & Components (Figma projects only)

| Component | ID/Path | Variants | Used by |
|-----------|---------|----------|---------|
| _Populated by agents working with Figma MCP_ | | | |

---

_Last scan: never_
