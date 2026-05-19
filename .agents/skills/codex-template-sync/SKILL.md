---
name: codex-template-sync
description: "Maintain or run template sync, bootstrap, downstream migration, manifest, allowlist, and release trust flows without touching user-owned files. Trigger on sync-template, setup payload, migration, or downstream update work."
---

# Codex Template Sync

Template sync is shared release infrastructure. Treat changes as MEDIUM/HIGH risk.

## Process

1. Read `docs/PRODUCT_BOUNDARY.md`, `docs/SAFE_DEFAULTS.md`, and `docs/SUPPORTED_ENVIRONMENTS.md`.
2. Preserve project-owned files and `project-*` overlays.
3. Ship tracked files only plus starter overlays.
4. Update Unix and Windows setup paths together.
5. Add smoke coverage before changing sync behavior.
6. Run `test-template`, `check-drift`, and focused sync dry-runs.
