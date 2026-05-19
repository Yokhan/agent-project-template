# Current Task - Production-Ready Template

## Goal
Finish the production-ready template program inside the repository, leaving only external rollout steps such as the first remote CI run and release tagging.

## User Wants
- Continue the approved template improvement plan from the correct recovery point.
- Keep debugging and recovery findings preserved in task and lesson logs.
- Do not reintroduce project-level Codex defaults that belong to IDE or user config.

## Active Roadmap
- Master plan: `tasks/template-production-ready-plan.md`
- Completed blocks: Phase 0 -> Phase 3 stabilization; Phase 5 living PROJECT_SPEC bootstrap; Phase 5 tool-registry population; Phase 6 downstream migration proof; Phase 7 CI/release contract; Phase 8 trust hardening; Phase 9 documentation rework; local Phase 10 release-candidate readiness
- Current milestone: external rollout confirmation
- Risk level from master plan: HIGH

## Current Status
- Fixed: session-start grep fallback bug and related shell patterns that broke Codex ACP/Zed launch.
- Fixed: project `.codex/config.toml` no longer hardcodes model, effort, approval, or sandbox defaults.
- Fixed: `setup.sh` and `setup.bat` now ship the same tracked-only project payload with clean starter overlays instead of maintainer-local junk.
- Fixed: generated projects now start with neutral `tasks/current.md`, `tasks/.research-cache.md`, `tasks/lessons.md`, empty `brain/01-daily`, and clean research/audit directories instead of maintainer notebook or audit history.
- Fixed: onboarding docs now match the real `setup.* -> bootstrap-mcp -> /setup-project` flow.
- Fixed: `bootstrap-mcp.sh` temp merge path and `sync-template.sh` coverage for `.codex/`, `.claude/docs/`, MCP lockfiles, bootstrap docs, and project spec files.
- Fixed: script bootstrap/source logic now normalizes `/C/...` to `/c/...` before sourcing shared helpers, which unblocks PowerShell -> Git Bash flows on Windows.
- Fixed: `sync-template.sh` now supports `--project-dir`, so the current template runner can dry-run or sync downstream repos even when their legacy local sync script is broken.
- Fixed: `setup.sh` and `setup.bat` now build payload strictly from tracked project-facing files, so new untracked maintainer files under shipped roots no longer leak into child projects.
- Added: `scripts/downstream-census.sh` for compact/JSON migration matrix output across downstream repos.
- Added: `scripts/generate-project-spec.sh`, and `PROJECT_SPEC.md` is now a generated project artifact instead of a placeholder stub.
- Added: generated `PROJECT_SPEC.md` now emits `Phase` from the active handoff milestone, so downstream orchestrators such as `AgentOS` can read current template state without depending on older markdown wording.
- Added: `scripts/scan-project.sh` now writes `_reference/tool-registry.md` with real project-level entries instead of only bumping a timestamp.
- Added: `docs/MIGRATION_MATRIX.md` with real dry-run results for `YokhanCallService`, `amplitude-client`, `PixelTilemapGenerator`, `GIANTS VALE DUNGEONS`, and `PersonalAssistant`.
- Added: `.github/workflows/validate-template.yml` now validates the real repo root, runs Linux/Windows validation, and includes bootstrap smoke jobs.
- Added: `docs/RELEASE_CHECKLIST.md` as the release contract for validation, bootstrap, migration, and trust gates.
- Added: `docs/PRODUCT_BOUNDARY.md`, `docs/SAFE_DEFAULTS.md`, and `docs/SUPPORTED_ENVIRONMENTS.md` as the explicit shipped-surface and environment contract.
- Fixed: `README.md` and `SETUP_GUIDE.md` now explicitly stay template-owned after bootstrap and document the real update paths.
- Verified: `scripts/validate-template.sh`, `scripts/check-drift.sh`, `scripts/test-hooks.sh`, `scripts/test-template.sh`, and `scripts/sync-agents.sh` pass on the current tree.
- Verified: a clean release-style copy outside the maintainer workspace passes the same validation set.
- Verified: current-tree and release-copy setup flows generate fresh Unix and Windows projects with matching payloads, `scripts/task-brief.sh`, clean starter state, no copied debug/research/audit history, and successful dry-run `bootstrap-mcp`/`sync-template`.
- Verified: a stale downstream fixture without manifest or newer root/config files recovers via `sync-template.sh --bootstrap` and then shows a clean dry-run.
- Verified: `scripts/sync-all.sh --dry-run` now works with the current `sync-template.sh --project-dir` flow and reports real downstream fleet status.
- Verified: `scripts/test-template.sh` now includes an untracked-sentinel smoke check so bootstrap leakage regressions fail locally before release.
- Verified: `scripts/scan-project.sh --report` stays concise on a real downstream repo (`YokhanCallService`), not only on the template itself.
- Added: `scripts/task-brief.sh`, and `scripts/context-restore.sh` now uses a compact handoff brief instead of raw `head -30`.
- Verified: `AgentOS` now resolves the sibling `agent-project-template` repo for create/deploy flows, falls back from `PROJECT_SPEC.md` to `tasks/current.md` milestone when scanning current template projects, and resolves Git Bash on Windows even when `bash` is not in `PATH`.
- Added: Codex now has a repository-scoped skill layer under `.agents/skills/` with 36 template-owned skills, including pipeline, subagent orchestration, design, Figma, audit, debug, security, migration, domain review, template sync, and OpenAI model guidance skills.
- Added: `docs/CODEX_SKILLS_AUDIT.md`, `docs/AGENT_PIPELINES.md`, and `docs/OPENAI_MODEL_GUIDANCE.md` document the Codex audit, shared pipelines, and current official OpenAI GPT-5.5 guidance.
- Verified: `node scripts/validate-codex-skills.js`, `scripts/test-template.sh`, `scripts/validate-template.sh`, `scripts/check-drift.sh`, and `scripts/sync-agents.sh` pass with the new Codex skill surface.
- Added: Codex subagent pack under `.codex/agents/` with 7 Spark-backed workers (`pr_explorer`, `reviewer`, `security_reviewer`, `tester`, `docs_researcher`, `design_reviewer`, `implementer`) plus `[agents] max_depth = 1` safety.
- Added: `docs/CODEX_SUBAGENTS_AUDIT.md`, `scripts/validate-codex-agents.js`, and `$codex-subagent-orchestration` for parallel Codex work.
- Verified: real `codex exec` spawned `pr_explorer` and returned `PR_EXPLORER_READY` from a child thread.
- Added: `docs/CODEX_FANOUT_PATTERNS.md` with Spec Kit-inspired but project-flexible routing, prompt templates, `[P]` task splitting, and AgentOS compatibility notes.
- Added: `scripts/test-codex-subagents-live.sh` as an opt-in quota-consuming live runtime check, not part of normal smoke.
- Strengthened: `scripts/validate-codex-agents.js` now enforces Spark-backed template agents, read-only defaults, scoped `implementer`, and `[agents]` concurrency/recursion guards.
- Logged in: `tasks/debug-recovery-log.md`, `tasks/.research-cache.md`, and `tasks/lessons.md`

## Immediate Next Step
- Run the first remote GitHub Actions workflow with the new Linux/Windows bootstrap smoke and confirm runner parity.
- If that run is green, cut the release tag / rollout using `docs/RELEASE_CHECKLIST.md`.

## Plan

### Goal
Unblock `sync-template.sh` dry-run/validation when a downstream manifest has no template-trackable files.

### Complexity Estimate
- Size: S
- Files to modify: 3 (`scripts/sync-template.sh`, `scripts/test-template.sh`, `tasks/current.md`)
- Estimated lines: 15-30
- Risk: MEDIUM/HIGH because template sync is shared release infrastructure

### Implementation Order
1. Reproduce the blocker with a tiny downstream fixture that has only project-category manifest entries.
2. Change `sync-template.sh` so dry-run warns and continues to Phase B instead of exiting.
3. Add a smoke regression in `scripts/test-template.sh` for that exact fixture.
4. Run the focused dry-run and available validation checks.

### Test Scenarios
- Happy path: empty-trackable manifest + `--dry-run` reports new template additions and exits 0.
- Edge case: non-dry-run empty-trackable manifest still rebuilds the manifest before sync.
- Error scenario: invalid manifest still exits with parse error.

### Plan B
If continuing dry-run produces misleading output, make `--dry-run --bootstrap` generate the report in a temp copy instead, preserving the real project unchanged.

**Edge cases:**
- [x] Historical debug details remain discoverable via linked files.
- [x] Session-start does not depend on old `Session End` dump blocks.

**Error scenarios:**
- [x] No stale instruction in this file points back to the March task as the active work.

## Files Changed In Current Recovery Pass
- `.claude/hooks/pre-compact.sh`
- `.claude/hooks/session-start.sh`
- `.claude/skills/task-queue/SKILL.md`
- `.codex/config.toml`
- `scripts/check-drift.sh`
- `scripts/context-restore.sh`
- `scripts/session-metrics.sh`
- `scripts/validate-template.sh`
- `tasks/.research-cache.md`
- `tasks/current.md`
- `tasks/lessons.md`

## Constraints
- Do not mass-kill `codex-acp.exe` from a live Zed Codex session.
- Do not reintroduce project-level model, effort, or default approval settings.
- Keep this file short and current; use linked plan and debug files for depth.
- Repo-side production readiness requires local validation green plus shipped-surface trust docs and no bootstrap leakage.

## Next Steps
1. Push the branch or open a PR so `.github/workflows/validate-template.yml` runs on real GitHub runners.
2. If Linux and Windows smoke stay green remotely, tag the release candidate or stable release.
3. Use `docs/RELEASE_CHECKLIST.md` as the final human gate before rollout.

## References
- Detailed roadmap: `tasks/template-production-ready-plan.md`
- Recovery log: `tasks/debug-recovery-log.md`
- Lessons: `tasks/lessons.md`
- Session-start brief entrypoint: `scripts/context-restore.sh`

## Handoff Note
This file is the short handoff surface. Do not append session-end dumps here. Put deep session history in `brain/01-daily/`, debugging sequences in `tasks/debug-recovery-log.md`, and enduring findings in `tasks/.research-cache.md`.

Last updated: 2026-04-21
