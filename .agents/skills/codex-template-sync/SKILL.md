---
name: codex-template-sync
description: "Maintain or run template sync, bootstrap, downstream migration, manifest, allowlist, and release trust flows without touching user-owned files. Trigger on sync-template, setup payload, migration, or downstream update work."
---

# Codex Template Sync

Template sync is shared release infrastructure. Treat changes as MEDIUM/HIGH risk.

## Process

1. Read `docs/PRODUCT_BOUNDARY.md`, `docs/SAFE_DEFAULTS.md`, and `docs/SUPPORTED_ENVIRONMENTS.md`.
2. Use `docs/TEMPLATE_RELEASES.md#canonical-agent-update-protocol` as the update SOT.
3. Classify source versus generated/legacy downstream before choosing a command.
4. In template source, maintain the requested scripts/rules or prepare the release; never run downstream apply against the source. Release preparation does not authorize publication or fleet rollout. In downstream update work, read installed version from manifest and resolve one explicit stable tag; user/AgentOS target wins.
5. Verify remote, worktree, ownership, and overlays; never silently replace a conflicting remote.
6. For an authorized downstream update, use the target release's native Node updater to create an external plan, then apply that exact reviewed digest-bound plan. Preview/audit-only requests stop before apply. Bare `--from-git` is forbidden; branch consumption requires explicit canary intent and an explicit ref.
7. Never trust a stale downstream updater; use the target release checkout against the explicit project path.
8. Verify manifest target, diff, reported conflicts, overlays, and checks before claiming success.
9. Preserve project-owned files and prove the same updater on Linux and Windows.
10. For changed sync behavior, add focused smoke coverage. Select checks by changed surface and aggregate coverage per `.claude/library/process/self-verification.md`; do not append duplicate template/drift/routing runs. Preserve required cross-platform release gates and state unavailable evidence.
