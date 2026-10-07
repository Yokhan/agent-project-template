# Release Checklist

Use this checklist before calling the template production-ready or cutting a release tag.

Release target: `v5.0.1`. This checklist records required evidence, not a
publication claim. Record the exact commit and workflow run after validation;
call the release live only after the GitHub Release is non-draft,
non-prerelease, its tag resolves to that commit, and its assets pass checksum
verification. The live Codex subagent probe is reported separately because it
consumes quota; static markers never count as runtime proof.

## Validation Gate

Run this gate once on the integrated candidate. The aggregates include their
leaf validators: do not run those again just to check another box. The release
workflow remains authoritative for fresh Linux/Windows and pinned-tool gates.

- [x] `bash scripts/validate-template.sh` — 2026-10-07: 0 errors/warnings
- [x] `bash scripts/check-drift.sh` — 2026-10-07: 0 errors, 2 dated-document warnings
- [x] `bash scripts/test-hooks.sh` — 2026-10-07: 12/12
- [x] `bash scripts/test-template.sh` — 2026-10-07: 201/201 including setup/sync
- [x] `bash scripts/sync-agents.sh` — 2026-10-07: 0 issues/warnings
- [x] `node scripts/test-ci-native-exit.js` — 2026-10-07: passed
- [x] Inspect the candidate diff and current project/tool-registry facts; regenerate only stale generated data, preserving maintained current-state sections — reviewed; no registry refresh needed

`test-template.sh` covers routing, agent policy, writing library/intent,
native sync, skill-link fixtures, agent/skill validation, production/design
policy, agent SOT, Spec Kit, text policy, and generated-project setup/sync smoke.
`validate-template.sh` adds release-version consistency, shell portability and
structural checks. Their required release-bound overlap is not permission to
repeat either aggregate after every local patch. Hook behavior, drift,
entrypoint parity and native PowerShell failure propagation have separate checks.

For changed skills, also inspect discovery with Codex `skills/list` for the
actual project cwd and perform bounded independent decision evaluation when
the workflow changes materially. Distinguish catalog discovery, instruction
quality and observed execution; none alone proves universal model compliance.

## Bootstrap Gate

- [ ] `bash setup.sh <smoke-project>` creates a clean project with `scripts/task-brief.sh`, starter task files, and no maintainer debug/audit leakage
- [ ] `cmd /c "(echo <smoke-project>) | setup.bat"` creates the same shipped surface on Windows
- [ ] Generated projects pass `bash scripts/test-hooks.sh`
- [ ] Generated projects pass `bash scripts/bootstrap-mcp.sh --dry-run`
- [ ] Linux and Windows runners pass `bash scripts/bootstrap-mcp.sh --install --tool-profile=full` and the matching `--check`
- [ ] Record the exact tested Codex version (local CLI `0.125.0`; CI pins `0.160.1`); verify trusted project MCP configuration and distinguish config discovery from live server/profile evidence
- [ ] `node scripts/test-codex-routing.js` proves AgentOS remains the task-graph owner when `.agent-os` is present
- [ ] Generated projects pass native `sync-template.js <template-root> <project> --plan-file <outside>` preview
- [ ] Generated projects can preview a pinned release with native `sync-template.js`, an exact tag, and an external plan file

## Migration Gate

- [ ] `bash scripts/downstream-census.sh --brief <project-dir ...>` classifies representative downstream repos
- [ ] Select representative downstream/canary evidence proportional to payload risk; record exact target, paths and results without treating historical rows as current proof
- [ ] Clean and manual-merge paths are documented in `docs/MIGRATION_MATRIX.md`
- [ ] Any legacy local sync-script breakage is bypassed by the target release's native updater against an explicit project path

## Trust Gate

- [ ] No local-only state ships to fresh projects (`.claude/settings.local.json`, debug logs, audit history, dependency artifacts)
- [ ] `PROJECT_SPEC.md` and `_reference/tool-registry.md` can be regenerated from scripts instead of placeholders
- [ ] Session-start uses compact summaries, not raw markdown dumps
- [ ] No project-level Codex defaults override IDE/user-level model or effort settings
- [ ] `scripts/codex-agent-policy.js` is the role/model/effort SOT; TOMLs match default profiles, and optional Max/XHigh requests have host support, a reason, caller-owned budget, and effective-profile evidence (capability is not a default)
- [ ] Router output includes an observable fan-out status/reason/profile set; direct XS questions and explicit user opt-out do not spawn agents
- [ ] Automatic fan-out remains read-only first, uses `max_depth = 1`, and write delegation requires exact non-overlapping ownership
- [ ] No mojibake, replacement characters, mixed line endings, raw `uname`, raw `/tmp`, or raw `mktemp` outside `scripts/lib/platform.sh`
- [ ] Fetched manifest paths are passed to Node as data, never interpolated into generated JavaScript or shell hashing commands
- [ ] Pinned semver refs fetch `refs/tags/<tag>`; dry-run does not add remotes or rewrite project files/manifests
- [ ] `docs/PRODUCT_BOUNDARY.md`, `docs/SAFE_DEFAULTS.md`, and `docs/SUPPORTED_ENVIRONMENTS.md` match the shipped contract
- [ ] `_reference/spec-kit/manifest.json` matches the intended pinned ref; run freshness check and disclose staleness. v5 retains optional `v0.8.13`; 2026-10-06 check found upstream `v1.1.1` and exited stale, while local snapshot validation passed. This is not a freshness pass or an automatic upstream migration
- [ ] `tasks/goal.md` and `templates/project-starter/tasks/goal.md` carry final result, approximate accepted waves, and a parent-derived detailed nearest-wave plan
- [ ] Root `DESIGN.md` and `design-policy.ignore` are project-owned in generated projects
- [ ] Design policy findings include rule id, file, evidence, impact, next action, and ignore/baseline tuning guidance
- [ ] Product/business outcome priority is present in shared rules, agent entrypoints, skills, routing, and validators
- [ ] Client-executor accountability, anti-sycophancy, and no-fake-completion evidence gates are present in shared rules, agent entrypoints, skills, routing, and validators
- [ ] Staged work preserves the accepted final result and approximate waves: successive usable versions of the same product, not task bundles or internal routes. Research and technical work are enabling checkpoints. Reassess the target and remaining waves together when constraints change. Nearest-wave plan/acceptance/responsibilities and parent verification are explicit; material deltas need approval. Plan/status artifacts are proportional, not universal ceremony
- [ ] Fresh relevant primary passages ground substantive nonfiction artifacts; all six sources are checked for applicability, actual fiction/lore prose is exempt, and missing/stale library blocks source-grounding rather than silently falling back to model memory
- [ ] One external store is discovered across projects; books and full text caches are absent from Git/setup/sync/release, no book symlinks/hardlinks are created, exact import is idempotent and preserves user originals
- [ ] Router output includes `planContract`, `productionBar`, `languagePolicy`, `qualityGates`, and `fanout`
- [ ] Codex routing uses exact patterns plus semantic intent scoring, reports exact/semantic matches, and has regression coverage for meaning-based routes
- [ ] Design-system work has token, composition trace, Storybook/equivalent, and rendered-geometry gates
- [ ] Design work has durable design context, command modes, hardening evidence, and deterministic design-policy checks
- [ ] Design work has product/brand register gates, command-mode reference coverage, critique ordering, and KPI-aware routing smoke
- [ ] Design work has a concrete screen anatomy/root-frame contract in shared rules, Codex design skills, and release smoke tests
- [ ] `sync-template.js --from-git --ref <tag> --plan-file <outside>` fetches the ref and shows a real sync preview without modifying the downstream project

## Release Decision

- [ ] README/setup flow matches shipped behavior
- [ ] README and CLAUDE release-facing counts match the shipped filesystem
- [ ] CI workflow covers validation scripts plus Linux/Windows bootstrap smoke
- [ ] GitHub workflows and CI templates use Node 24-compatible actions; release/validation jobs disable unnecessary setup-node package-manager cache
- [ ] Manual release input is passed through `env`, validated as `vX.Y.Z`, checked out before validation, and asserted to match `HEAD`
- [ ] Windows PowerShell native-command failures propagate to failed jobs rather than being masked by later successful commands
- [ ] Published release assets are never silently replaced by workflow reruns
- [ ] Remaining manual-merge cases are acceptable and documented
- [ ] Release notes mention any unsupported or review-required upgrade paths
- [ ] Git tag uses `vX.Y.Z`; downstream instructions reference the target release's `scripts/sync-template.js` and a digest-bound external plan
- [ ] README, SETUP_GUIDE, and docs/TEMPLATE_RELEASES show the immutable release snapshot, use `/releases/latest` only when selecting an unspecified target, require exact-release verification, and warn that `main` is for canary/template development only
- [ ] AGENTS, CLAUDE, `/update-template`, and Codex sync skill point to the canonical source/downstream update protocol
- [ ] AgentOS rollout notes state whether AgentOS is the orchestrator or the project uses Codex parent orchestration

## Evidence Boundaries

The dated GPT-6 candidate report records development/runtime evidence, not
publication or a completed comparative quality benchmark. Library read receipts
prove primary access and request/draft binding, not comprehension or semantic
quality. A Luna behavioral smoke covered a client email plus separate fiction;
it is not a benchmark. Token savings and prompt-prefix caching are not guaranteed.
Attach final commit, CI URL, exact tag/release and checksum verification after
publication; do not pre-check boxes based on plans or historical success.
