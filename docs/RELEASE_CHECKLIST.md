# Release Checklist

Use this checklist before calling the template production-ready or cutting a release tag.

## Validation Gate

- [ ] `bash scripts/validate-template.sh`
- [ ] `bash scripts/check-drift.sh`
- [ ] `bash scripts/test-hooks.sh`
- [ ] `bash scripts/test-template.sh`
- [ ] `bash scripts/sync-agents.sh`
- [ ] `bash scripts/generate-project-spec.sh --write`
- [ ] `bash scripts/scan-project.sh --report`

## Bootstrap Gate

- [ ] `bash setup.sh <smoke-project>` creates a clean project with `scripts/task-brief.sh`, starter task files, and no maintainer debug/audit leakage
- [ ] `cmd /c "(echo <smoke-project>) | setup.bat"` creates the same shipped surface on Windows
- [ ] Generated projects pass `bash scripts/test-hooks.sh`
- [ ] Generated projects pass `bash scripts/bootstrap-mcp.sh --dry-run`
- [ ] Generated projects pass `bash scripts/sync-template.sh <template-root> --dry-run`

## Migration Gate

- [ ] `bash scripts/downstream-census.sh --brief <project-dir ...>` classifies representative downstream repos
- [ ] At least 3 real downstream repos have been evaluated for the current target version
- [ ] Clean and manual-merge paths are documented in `docs/MIGRATION_MATRIX.md`
- [ ] Any legacy local sync-script breakage is reproducible via the template-owned `sync-template.sh --project-dir` path

## Trust Gate

- [ ] No local-only state ships to fresh projects (`.claude/settings.local.json`, debug logs, audit history, dependency artifacts)
- [ ] `PROJECT_SPEC.md` and `_reference/tool-registry.md` can be regenerated from scripts instead of placeholders
- [ ] Session-start uses compact summaries, not raw markdown dumps
- [ ] No project-level Codex defaults override IDE/user-level model or effort settings
- [ ] `docs/PRODUCT_BOUNDARY.md`, `docs/SAFE_DEFAULTS.md`, and `docs/SUPPORTED_ENVIRONMENTS.md` match the shipped contract

## Release Decision

- [ ] README/setup flow matches shipped behavior
- [ ] CI workflow covers validation scripts plus Linux/Windows bootstrap smoke
- [ ] Remaining manual-merge cases are acceptable and documented
- [ ] Release notes mention any unsupported or review-required upgrade paths
