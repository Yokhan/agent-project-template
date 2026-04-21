# Safe Defaults

The template ships conservative defaults so a fresh project is safe to copy, inspect, and update.

## Codex And Claude Config

- `.codex/config.toml` keeps only project-specific toggles. Model, effort, approval, and sandbox stay in IDE or user-level config.
- `.claude/settings.local.json` is local-only and must not ship in the template payload.
- Shared rules live under `.claude/library/`; project-specific additions use `project-*` files.

## MCP Defaults

- `.mcp.json` includes only the template's local `context-router`, `engram`, and optional disabled `codesight`.
- `bootstrap-mcp.sh` installs or merges optional MCP integrations explicitly; they are not silently bundled into fresh projects.

## Bootstrap Defaults

- `setup.sh` and `setup.bat` copy only tracked project-facing files.
- Starter overlays reset `tasks/current.md`, `tasks/.research-cache.md`, `tasks/lessons.md`, and empty knowledge/audit folders.
- Maintainer logs, local fixtures, dependency artifacts, and machine-specific settings are excluded from generated projects.

## Update Contract

- `sync-template.sh` updates template-owned files from the manifest.
- `project-*` files, `CLAUDE.md`, `PROJECT_SPEC.md`, `ecosystem.md`, `tasks/`, and `brain/` remain project-owned.
- When both local and template versions changed, sync writes `*.template-new` instead of overwriting silently.
