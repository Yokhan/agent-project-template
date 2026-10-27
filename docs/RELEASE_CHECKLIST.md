# Release Checklist

Use this checklist before calling the template production-ready or cutting a release tag.

Release target: `v6.4.0`. This checklist records required evidence, not a
publication claim. Record the exact commit and workflow run after validation;
call the release live only after the GitHub Release is non-draft,
non-prerelease, its tag resolves to that commit, and its assets pass checksum
verification. The live Codex subagent probe is reported separately because it
consumes quota; static markers never count as runtime proof.

## v6.4.0 Candidate Acceptance

- [ ] Final scoped source commit and compatible version metadata verified.
- [ ] Terra profiles, runtime-only coverage, historical Luna compatibility and request-start cohorts pass focused checks; parent settings and busy workers remain preserved.
- [ ] Control-notice continuity, scoped wave execution references and truthful handoff reports pass focused checks. Source tests do not establish native host activation.
- [ ] One relevant integration aggregate plus diagnosed focused deltas are recorded honestly; mandatory exact-state hosted integration remains required.
- [ ] Local singleton watcher activation and actual report enqueue retain separate receipts; visible assistant reporting is claimed only by its real rendering owner.
- [ ] Exact-commit Linux/Windows preflight and exact-tag release jobs pass.
- [ ] Stable release, downloaded checksums, metadata and canonical archive match.
- [ ] Consumer rollout uses the verified new exact release and reviewed plans; publication alone does not establish installation or runtime activation.

## v6.1.2 Verified Publication And Scoped Rollout

- [x] Integrate the compatible routing and request-context repair at
  `e2c8bb6566a847c0db3773918672b5731d6f3385`; preserve unrelated work.
- [x] All six [preflight jobs](https://github.com/Yokhan/agent-project-template/actions/runs/40070470065) and the
  [exact-tag release workflow](https://github.com/Yokhan/agent-project-template/actions/runs/40070918272) passed on Linux/Windows.
- [x] Verify stable non-draft v6.1.2 and the downloaded archive against its
  metadata, SHA-256 and canonical Git archive.
- [x] Apply reviewed digest-bound plans to the 36 approved v6.1.1 consumers,
  retain external rollback bytes and project overlays, and verify six focused
  checks per consumer plus zero-write/zero-conflict convergence.

The earlier ordinary native CLI probe remains separately correlated runtime
evidence; this rollout does not measure fleet-wide live call coverage, existing
MCP reloads or quota savings. See [patch notes](RELEASE_V6_1_2.md).

## v6.1.1 Verified Publication

- [x] The immutable `v6.1.0` tag at `88e6bdd` failed exact-tag Windows CI run [`39652334813`](https://github.com/Yokhan/agent-project-template/actions/runs/39652334813): the generated-project manifest assertion found `docs/WRITING_LIBRARY_SETUP.md` missing from the manifest. No GitHub Release was published for that tag; do not move or reuse it.
- [x] The earlier preflight for `88e6bdd` passed run [`39651182625`](https://github.com/Yokhan/agent-project-template/actions/runs/39651182625). That preflight does not override the later exact-tag failure or prove the `v6.1.1` candidate.
- [x] Replace duplicated setup manifest lists with tracked-copy receipts and canonical categories. Fresh full Windows setup verified all 539 copied-file hashes/categories, no BOM, actual context-router build and batch completion. The Unix fixture verified copied-set parity and exclusion of untracked sources/starter files.
- [x] Focused native-exit/manifest and fresh setup checks passed. The earlier 215-check aggregate is baseline evidence; full final aggregate runs remain mandatory in CI. Bounded local fixtures used an explicit lower free-space floor because this host was below the unchanged 2 GiB default reserve.
- [x] All six [preflight jobs](https://github.com/Yokhan/agent-project-template/actions/runs/39656474228) and the [exact-tag Linux/Windows release workflow](https://github.com/Yokhan/agent-project-template/actions/runs/39657696286) passed for `f2c313f7a02f26007de67ca253153925105ad6a1`, including 215/215 aggregate checks on each preflight platform, fresh native Windows setup and full toolchains. POSIX was verified in Linux CI within its declared foreground contract.
- [x] [v6.1.1](https://github.com/Yokhan/agent-project-template/releases/tag/v6.1.1) is stable and non-draft. Downloaded archive: 1,106,030 bytes, 577 allowlisted files; SHA-256 `02a6a6247a618657c8f49753afc266b394807125861e828b973042ffba5fc68d`. Checksums, metadata, exact file set and canonical Git archive bytes match.

The v6.1.1 candidate carries the v6.1.0 lifecycle behavior: managed disposable
run outputs, supervised Windows process-family cleanup, opt-in bounded project
caches, and cleanup evidence. The v6.1.0 lifecycle notes remain the feature
record; see [v6.1.1 patch notes](RELEASE_V6_1_1.md) for the candidate boundary.

The direct Chromium `--dump-dom` probe timed out; its timeout cleanup completed.
That probe is not a pass. The passing browser evidence above is from the
Playwright profile. Machine-wide tool caches, browser binaries, MCP databases,
unknown files and active leases remain outside cleanup; custom scripts must
write outputs under their documented `AGENT_RUN_*` paths to receive cleanup.

## Published v6.0.0 Record

- [x] Local integrated repair baseline: 210/210 aggregate; structure zero
  errors/warnings on 2026-10-20, before release-version metadata changes.
- [x] Actual ordinary native CLI/Desktop workflow and independent editor
  evidence, with persisted host trust: see NATIVE_WORKFLOW_ACCEPTANCE.md.
- [x] Real Windows setup, all 463 manifest byte hashes, isolated update/rollback
  and preservation of 35 project-owned files: same acceptance report.
- [x] Major-upgrade requirements and external-library/host-trust limits are
  described in RELEASE_V6_0_0.md. Existing consumers remain untouched.
- [x] Version-aligned local candidate on 2026-10-20: 210/210 aggregate;
  structure zero errors/warnings; legacy hooks 12/12; entrypoint parity green;
  drift zero errors and two document-age warnings. MCP tests/build passed and
  production dependency audit reported zero vulnerabilities.
- [x] Exact 559-path source tree allowlisted from the published baseline plus
  71 reviewed delta paths; candidate secret scan passed. No books, text caches,
  native transcripts, local settings or dependency artifacts enter that tree.
- [x] Immutable commit `5ab1c5527a95513be5452c5818d17cfee32756dd` passed
  [preflight Linux/Windows CI](https://github.com/Yokhan/agent-project-template/actions/runs/39400833664)
  and the [exact-tag release workflow](https://github.com/Yokhan/agent-project-template/actions/runs/39401829471),
  including the full pinned toolchain health checks and native Windows setup.
- [x] Checksum-bound archive packaged only after both release platform jobs
  passed; packaging and publication jobs completed successfully.
- [x] [v6.0.0](https://github.com/Yokhan/agent-project-template/releases/tag/v6.0.0)
  is stable, non-draft and latest. Downloaded archive: 1,027,480 bytes, 559
  allowlisted files; SHA-256
  `b98aec4d332e4fb7bcaebc00f930c1034541f03db997868f27d8240e24f76278`.
  SHA256SUMS and release-metadata.json match; canonical Linux Git archive bytes
  also match the exact frozen source commit.

Publication evidence belongs to the exact workflow and public assets. The tag
snapshot left later outcomes pending; this post-release record adds the observed
results without moving the immutable tag or replacing published assets.
The v5 checkboxes below are dated historical evidence, not v6 gate passes.

## Historical v5.0.1 Validation Baseline (not v5.0.2 release evidence)

The checked results below are historical v5.0.1 evidence only. They are not
fresh checks of the v5.0.2 candidate. The parent release owner records current
candidate and exact-commit workflow evidence after running the release gate.

### Checks recorded for v5.0.1 only

These checks are historical results against the v5.0.1 candidate, not current
release-gate status. The release workflow remains authoritative for fresh
Linux/Windows and pinned-tool gates.

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

## Historical Validation Gate (v5.0.2; local candidate passed)

Run this gate once on the integrated v5.0.2 candidate. Aggregates include their
leaf validators; do not repeat those solely to check another box. Record fresh
results here after the parent release owner runs them.

- [x] `bash scripts/validate-template.sh` — 2026-10-07: 0 errors/warnings
- [x] `bash scripts/check-drift.sh` — 2026-10-07: 0 errors, 2 document-age warnings
- [x] `bash scripts/test-hooks.sh` — 2026-10-07: 12/12
- [x] `bash scripts/test-template.sh` — 2026-10-07: 201/201, including generated-project setup and native sync
- [x] `bash scripts/sync-agents.sh` — 2026-10-07: 0 issues/warnings
- [x] `node scripts/test-ci-native-exit.js` — 2026-10-07: passed
- [x] Inspect integrated candidate diff and current project/tool-registry facts — reviewed; registry not stale, no regeneration needed

Codex CLI 0.125.0 `skills/list` found 46 repository skills, no discovery errors,
and all six changed skills enabled. MCP tests passed; routing parity was checked
again after the final intent-classifier correction. Independent review confirmed
the read-only intent and omitted implementation-verb regressions were fixed.
These are local candidate results, not proof of effective worker model selection
or downstream adoption. Exact-commit Linux/Windows workflow and asset verification
remain publication gates; inspect the run associated with the immutable tag.

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
