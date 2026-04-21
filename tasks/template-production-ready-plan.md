# Template Production-Ready Implementation Plan

**Date**: 2026-04-21
**Status**: approved for implementation planning
**Owner**: agent-project-template
**Scope**: template repo only, plus validation on representative downstream projects

## User Wants

Bring `agent-project-template` to a real production-ready state:
- reliable bootstrap on Windows and Unix
- honest docs that match shipped files and behavior
- green self-validation
- safe sync/migration for downstream projects
- dual-agent support that is actually shipped
- script-first, token-efficient research so agents do not waste context on repetitive grep/find work

## Success Means

The template is considered production-ready only when all of these are true:

1. A clean checkout can be bootstrapped on supported environments without undocumented manual fixes.
2. `setup.sh` and `setup.bat` create materially equivalent project skeletons.
3. `README.md`, `SETUP_GUIDE.md`, bootstrap scripts, manifests, and self-checks agree on what ships.
4. The repo contains no user-local state, absolute-path leakage, or machine-specific configuration that can spread to downstream projects.
5. `validate-template`, `test-template`, `check-drift`, and `sync-agents` pass on a clean tree.
6. The template provides script-first summaries for common repo research tasks, with compact output and machine-readable mode.
7. Template sync is proven on representative downstream projects across different template generations.
8. CI blocks release when version drift, bootstrap drift, doc drift, or token-efficiency regressions appear.

## Verification Strategy

Production readiness will be verified by:

- clean-room bootstrap tests on:
  - Windows PowerShell + `setup.bat`
  - Windows Git Bash + `setup.sh`
  - Linux/macOS + `setup.sh`
- green local checks:
  - `bash scripts/validate-template.sh`
  - `bash scripts/test-template.sh`
  - `bash scripts/check-drift.sh`
  - `bash scripts/sync-agents.sh`
  - `bash scripts/test-hooks.sh`
- scripted smoke tests for new summary/research scripts
- downstream sync trials on 3-5 representative projects
- manual README walkthrough from a fresh clone

## Risk Classification

**Risk: HIGH**

Why:
- changes touch bootstrap and sync behavior
- changes affect all future child projects
- mistakes can spread broken structure into downstream repos
- migration behavior must stay reversible

## Global Constraints

- No destructive cleanup of downstream projects.
- Prefer additive migration and explicit conflict detection.
- Every phase must leave the template in a releasable state.
- No release until checks are green on a clean clone.
- Script-first automation must be cross-platform and default to compact output.

## Execution Model

Implementation should be done as a sequence of milestones. Each milestone must end in a stable, validated state before moving to the next one.

Recommended milestone order:

1. `M1` Stabilized Core
2. `M2` Reliable Validation
3. `M3` Script-First Research Layer
4. `M4` Real Automation
5. `M5` Migration Proven
6. `M6` Release Candidate

---

## Phase 0 - Freeze Scope And Define Product Boundary

### Goal

Stop ambiguity about what this repository is shipping and who it is for.

### Why This Comes First

The current repo mixes template infrastructure, orchestrator/dashboard concerns, local machine state, and historical residue. Nothing else is safe until the product boundary is explicit.

### Files Likely Touched

- `README.md`
- `SETUP_GUIDE.md`
- `AGENTS.md`
- `CLAUDE.md`
- `setup.sh`
- `setup.bat`
- possibly new: `docs/PRODUCT_BOUNDARY.md`
- possibly new: `docs/SUPPORTED_ENVIRONMENTS.md`

### Implementation Steps

1. Define the supported distribution modes.
   - Decide whether the repo ships:
     - plain project template only
     - template + orchestrator/dashboard
     - separate bootstrap modes for each
2. Create a canonical inventory of shipped artifacts.
   - classify every top-level file or directory as:
     - always shipped
     - template-source-only
     - generated on bootstrap
     - local-only
3. Create a supported environments matrix.
   - Windows PowerShell
   - Windows Git Bash
   - Linux
   - macOS
4. Define release expectations for child projects.
   - required files
   - optional files
   - local state that must never ship

### Deliverables

- product-boundary document
- supported-environments document
- shipping inventory document or generated table

### Acceptance Criteria

- no unresolved ambiguity around `start.sh/start.bat`, orchestrator mode, or dual-agent shipping
- there is one explicit answer to "what does a child project receive?"

### Risks

- hidden assumptions in older docs or scripts
- disagreement about whether dashboard/orchestrator belongs in the core template

### Mitigation

- write the product boundary before editing bootstrap behavior
- use the inventory as the source for later validation scripts

---

## Phase 1 - Unify Sources Of Truth

### Goal

Remove version drift, count drift, and onboarding drift.

### Why

Right now the template advertises different versions and different capabilities depending on which file is read. That makes the template impossible to trust.

### Files Likely Touched

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `setup.sh`
- `setup.bat`
- `scripts/check-drift.sh`
- `scripts/validate-template.sh`
- possibly new: `scripts/lib/template-metadata.sh`
- possibly new: `template-metadata.json` or similar canonical metadata file

### Implementation Steps

1. Create a single metadata source.
   - template version
   - supported platforms
   - shipped counts
   - feature flags
2. Replace hardcoded version strings in scripts and docs where practical.
3. Normalize all public entrypoint documentation.
   - if `start.sh/start.bat` are real, ship them
   - if not, remove references and replace with real entrypoints
4. Normalize counts in public docs.
   - rules
   - hooks
   - skills
   - agents
   - commands
   - scripts
5. Add validation checks that compare docs against canonical metadata.

### Deliverables

- canonical metadata source
- no version mismatch across release-facing files
- validation that catches drift early

### Acceptance Criteria

- `README.md`, `AGENTS.md`, `CLAUDE.md`, bootstrap output, and `check-drift.sh` all show the same version
- docs do not reference missing entrypoints

### Risks

- over-automation in docs generation could make docs harder to edit

### Mitigation

- automate only high-drift fields
- keep narrative docs hand-written, structured fields derived

---

## Phase 2 - Bootstrap Parity And Packaging Hygiene

### Goal

Make project creation reliable, equivalent across platforms, and free of local-state leakage.

### Why

Bootstrap is the first trust boundary. If it is inconsistent, everything downstream is suspect.

### Files Likely Touched

- `setup.sh`
- `setup.bat`
- `.gitignore`
- `.claude/settings.local.json`
- `.claude/settings.local.json.example`
- `.codex/config.toml`
- `.codex/hooks.json`
- `PROJECT_SPEC.md`
- `ecosystem.md`
- `.mcp.json`
- packaging-related validation scripts

### Implementation Steps

1. Define exact child-project payload.
   - list files copied by Unix bootstrap
   - list files copied by Windows bootstrap
   - diff them
2. Bring `setup.bat` to feature parity with `setup.sh`.
   - include Codex artifacts if dual-agent is truly supported
   - include starter docs and spec files
   - include MCP/context-router assets if intended
3. Remove user-local config from shipped payload.
   - do not ship real `.claude/settings.local.json`
   - ship example only
   - ensure bootstrap generates local config from example, not from template source state
4. Make local-only files impossible to commit accidentally.
   - fix `.gitignore`
   - add validation for absolute paths and user-home references
5. Normalize manifest generation across both setup paths.
   - same version source
   - same categories
   - same file classes
6. Add a bootstrap parity diff check.
   - create fixture projects using both bootstrap paths
   - compare required file sets

### Deliverables

- parity between shell and batch bootstrap
- clean local-state policy
- bootstrap parity smoke test

### Acceptance Criteria

- two fresh projects created by `setup.sh` and `setup.bat` contain the same required core files
- no absolute author paths appear in generated child projects
- no real local permissions file ships from the template repo

### Risks

- Windows batch complexity
- path quoting issues
- hidden assumptions about Git Bash availability

### Mitigation

- keep the payload inventory explicit
- validate generated project trees with scripted comparisons

---

## Phase 3 - Make Validation Real

### Goal

Ensure the template can prove its own health and that self-checks fail only on real issues.

### Why

A production template cannot ship with broken validation or with tests that give false confidence.

### Files Likely Touched

- `scripts/validate-template.sh`
- `scripts/test-template.sh`
- `scripts/check-drift.sh`
- `.claude/hooks/check-encoding.sh`
- `.claude/hooks/session-start.sh`
- `.claude/agents/PROTOCOL.md`
- tests under `tests/`
- possibly new fixtures under `tests/fixtures/`

### Implementation Steps

1. Fix false positives in `validate-template.sh`.
   - do not match the script's own explanatory strings as violations
   - handle `PROTOCOL.md` consistently with actual agent rules
2. Fix portability issues in hooks and scripts.
   - remove or wrap `grep -P`
   - avoid shell features not available in supported environments
3. Strengthen `test-template.sh`.
   - add checks for shipped files that matter in v3.5+
   - add checks for dual-agent artifacts if promised
   - add checks for starter docs presence
4. Improve `check-drift.sh`.
   - use real parsing for tool-registry
   - eliminate placeholder-based false stale warnings
   - make version checks derive from the same source as Phase 1
5. Add regression coverage for bugs found in this audit.
   - version mismatch
   - missing entrypoints
   - local settings leakage
   - `grep -P` portability
   - protocol frontmatter exceptions

### Deliverables

- green validation on clean repo
- regression tests for previously observed failures

### Acceptance Criteria

- `validate-template.sh` passes on clean checkout
- `test-template.sh` fails when any critical shipping artifact is missing
- `check-drift.sh` emits only actionable warnings

### Risks

- validation becoming too strict for legitimate local extension

### Mitigation

- separate template-core checks from project-local extension checks

---

## Phase 4 - Script-First Research And Token-Efficiency Layer

### Goal

Replace repetitive raw grep/find archaeology with compact repo-summary scripts.

### Why

This is essential to make the template efficient in real agent use. If common analysis workflows still require large shell dumps, the template stays expensive and noisy even if everything else is correct.

### Files Likely Touched

- `scripts/scan-repo.sh`
- `scripts/blast-radius.sh`
- `scripts/import-graph.sh`
- `scripts/measure-context.sh`
- `scripts/scan-project.sh`
- `scripts/scan-projects.sh`
- possibly new:
  - `scripts/repo-summary.sh`
  - `scripts/file-context.sh`
  - `scripts/reuse-summary.sh`
  - `scripts/downstream-census.sh`
  - `scripts/template-inventory.sh`
  - `scripts/task-brief.sh`
- docs and agent instructions that reference research behavior

### Design Requirements

Every new research script should support:

- compact default output
- `--brief`
- `--json`
- predictable field names
- non-zero exit code on actual failure
- no recursive giant dumps by default

Optional but preferred:

- `--full`
- incremental mode
- lightweight cache usage

### Priority Script Targets

1. Project summary
   - stack
   - top-level directories
   - current task state
   - project spec status
   - tool-registry status
2. File context summary
   - imports
   - consumers
   - neighboring tests
   - related docs
3. Reuse summary
   - candidate shared utilities
   - matching tools
   - existing scripts that already solve part of the task
4. Downstream census
   - template version
   - manifest presence
   - spec status
   - agent support status
5. Template inventory
   - what ships
   - what is source-only
   - what is generated
6. Task brief
   - summary of `tasks/current.md`
   - blockers
   - next steps
   - stale/historical residue warnings

### Implementation Steps

1. Instrument common manual research patterns.
   - collect the top 10 repetitive shell tasks agents do manually
2. Group them into reusable summary domains.
3. Implement the smallest useful set of summary scripts.
4. Update existing scripts before adding duplicates.
5. Introduce output size discipline.
   - default output should fit in one screen whenever practical
6. Add caching where repeated scans are expensive.
7. Add tests for `--brief` and `--json`.

### Deliverables

- script-first research toolkit
- machine-readable summary outputs
- reduced need for raw recursive grep

### Acceptance Criteria

- 80% of common repo research tasks can be handled without raw grep
- summary scripts return compact output by default
- scripts work on the template repo and on downstream sample repos

### Risks

- building too many scripts that nobody uses
- making scripts too clever and fragile

### Mitigation

- start with the most repeated workflows only
- prefer composable, small summaries over giant "do everything" scripts

---

## Phase 5 - Make Claimed Automation Actually Work

### Goal

Turn declared process features into functioning automation.

### Why

Several current features are promised in instructions but only partially implemented or decorative.

### Files Likely Touched

- `PROJECT_SPEC.md`
- `tasks/current.md`
- `_reference/tool-registry.md`
- `scripts/scan-project.sh`
- `scripts/context-restore.sh`
- `.claude/hooks/session-start.sh`
- `.claude/library/process/context-first.md`
- `.claude/library/process/research-first.md`
- possibly new:
  - `scripts/generate-project-spec.sh`
  - `scripts/populate-tool-registry.sh`
  - cache files under `.session-cache/`

### Workstream A - Living Project Spec

#### Implementation

1. Decide whether `PROJECT_SPEC.md` is:
   - auto-generated
   - agent-maintained with generator assistance
   - hybrid
2. Implement generation/update path.
   - project identity
   - stack
   - file structure
   - provides/depends on
   - current state
   - last scan
3. Update session-start to use the real source of freshness.
4. Ensure the starter template does not ship a misleading stale spec.

#### Acceptance Criteria

- new child projects either receive a valid initial spec or a clear one-command generator path
- session-start warnings are based on real spec state

### Workstream B - Tool Registry That Actually Populates

#### Implementation

1. Upgrade `scan-project.sh` from "timestamp only" to actual registry writer.
2. Distinguish:
   - template-level tools
   - project-level tools
   - helpers/utilities
   - extraction candidates
3. Skip placeholders and markdown separators in drift checks.
4. Keep the registry concise and useful, not exhaustive noise.

#### Acceptance Criteria

- `scan-project.sh` populates real entries
- `check-drift.sh` no longer reports placeholder rows as stale files

### Workstream C - Starter Artifact Cleanup

#### Implementation

1. Replace historical `tasks/current.md` residue with clean starter state.
2. Replace any misleading starter artifacts that look like active work.
3. Ensure starter files are neutral and reusable.

#### Acceptance Criteria

- new child projects do not inherit old template task history

### Workstream D - Context Compression

#### Implementation

1. Add compact session-start briefs.
2. Use cache or incremental scan where possible.
3. Ensure repeated context loading uses summary artifacts, not full rescans.

#### Acceptance Criteria

- session-start produces a short, useful summary
- repeated research is cheaper than first-pass research

---

## Phase 6 - Downstream Migration Program

### Goal

Prove that the improved template can safely update real projects.

### Why

A template is not production-ready if it only works for greenfield bootstrap and not for live repos already depending on it.

### Candidate Downstream Samples

- backend/service project
- frontend or web app
- Python project
- Rust/tooling project
- Godot or documentation-heavy project

Suggested initial sample set:

- `YokhanCallService`
- `amplitude-client`
- `PixelTilemapGenerator`
- `GIANTS VALE DUNGEONS`
- one `unknown` manifest-version project

### Files Likely Touched

- `scripts/sync-template.sh`
- `scripts/check-drift.sh`
- migration docs
- release checklist docs
- possibly new migration fixtures or reports under `docs/` or `tasks/`

### Implementation Steps

1. Define supported upgrade paths.
   - `unknown -> current`
   - `2.4.0 -> current`
   - `2.7.0 -> current`
   - `3.4.0 -> current`
2. Run dry-run sync on selected downstream projects.
3. Record all conflicts and classify them:
   - expected local customization
   - template bug
   - manifest bug
   - docs gap
4. Improve `sync-template.sh` until conflict behavior is predictable.
5. Re-run sync and post-sync checks.
6. Document conflict resolution patterns.

### Deliverables

- migration matrix
- documented supported upgrade paths
- conflict-resolution guide

### Acceptance Criteria

- at least 3 representative downstream projects update successfully
- upgrade path is documented for older manifest generations

### Risks

- some old projects may contain hand-modified template files with no clean upgrade path

### Mitigation

- define "supported but manual merge required" explicitly where needed

---

## Phase 7 - CI And Release Engineering

### Goal

Make regressions impossible to miss before release.

### Why

Without CI, the repo will drift again even if manually cleaned up once.

### Files Likely Touched

- `.github/workflows/*.yml`
- `scripts/validate-template.sh`
- `scripts/test-template.sh`
- `scripts/check-drift.sh`
- new smoke scripts
- release docs

### CI Coverage Required

1. version consistency
2. shipped artifact consistency
3. bootstrap smoke
4. batch/bootstrap parity where feasible
5. validation scripts
6. hook syntax
7. summary-script smoke tests
8. local-state leak detection
9. doc consistency checks

### Implementation Steps

1. Create template CI workflow.
2. Add matrix where practical:
   - Linux
   - Windows
3. Add smoke fixtures for child-project generation.
4. Add a release checklist document.
5. Optionally add a release candidate workflow that tags only after green validation.

### Deliverables

- CI workflow
- release checklist
- smoke fixtures

### Acceptance Criteria

- merge to release branch is blocked by failing validation
- CI catches version/doc/bootstrap drift before release

---

## Phase 8 - Security And Trust Hardening

### Goal

Guarantee safe defaults for a template that will be copied into many projects.

### Why

A template multiplies both good and bad defaults.

### Files Likely Touched

- `.gitignore`
- `.mcp.json`
- `.claude/settings.json`
- `.codex/config.toml`
- `.codex/hooks.json`
- hooks and validation scripts
- security docs

### Implementation Steps

1. Add checks for:
   - absolute paths
   - user-home references
   - committed local settings
   - generated cache and dependency artifacts
2. Review default permissions and MCP configuration.
3. Review hook coverage symmetry between Claude and Codex.
4. Add release-time leak detection.
5. Document safe defaults and extension boundaries.

### Deliverables

- trust-hardening checks
- safe-defaults documentation

### Acceptance Criteria

- template source contains no personal machine state
- child project generation does not propagate sensitive or local-only data

---

## Phase 9 - Documentation Rework

### Goal

Make the docs accurate, minimal enough to trust, and aligned with the final system.

### Why

Production readiness is not just behavior. It is also whether a new user can succeed without guessing.

### Files Likely Touched

- `README.md`
- `SETUP_GUIDE.md`
- `AGENTS.md`
- `CLAUDE.md`
- docs created in earlier phases
- script usage docs

### Implementation Steps

1. Rewrite quick start around real entrypoints.
2. Separate "what ships", "what is optional", and "what is local-only".
3. Add Windows-specific guidance that does not assume `bash` is already available.
4. Document script-first summaries.
5. Document extension model:
   - `project-*`
   - local settings
   - orchestrator mode if kept
6. Add known limitations and supported environments.

### Deliverables

- truthful README
- updated setup guide
- summary-script usage guide
- supported environments doc

### Acceptance Criteria

- a new user can follow docs on a clean machine without repo archaeology

---

## Phase 10 - Release Candidate And Rollout

### Goal

Ship the improved template through a controlled release process.

### Why

Without an RC and pilot rollout, regressions will appear only after downstream adoption.

### Files Likely Touched

- release docs
- changelog files if maintained
- maybe version metadata

### Implementation Steps

1. Cut `RC1`.
2. Run full acceptance suite.
3. Update selected downstream pilot projects.
4. Observe for a short stabilization window.
5. Fix blockers only.
6. Tag stable release.

### Deliverables

- release candidate tag
- acceptance report
- stable release

### Acceptance Criteria

- no open blockers in bootstrap, validation, migration, or security
- pilot downstream projects succeed without hidden template surgery

---

## Cross-Cutting Workstream - Instruction Layer Updates

This workstream spans Phases 4-9.

### Goal

Update agent behavior so the new automation is actually used.

### Files Likely Touched

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/agents/PROTOCOL.md`
- `.claude/library/process/context-first.md`
- `.claude/library/process/research-first.md`
- related command docs

### Required Behavioral Changes

1. Prefer summary scripts before raw grep.
2. Prefer compact task briefs before reading entire `tasks/current.md`.
3. Prefer file-context summary before recursive import search.
4. Treat raw grep as fallback, not default.

### Acceptance Criteria

- instructions reflect the script-first workflow
- no major research instruction still assumes large raw shell dumps as the normal path

---

## Priority Backlog

### P0

- version/source-of-truth drift
- missing or misleading public entrypoints
- bootstrap parity gap
- local settings leakage
- broken or misleading validation

### P1

- script-first research layer
- actual `PROJECT_SPEC` lifecycle
- actual tool-registry population
- starter artifact cleanup
- downstream migration proof

### P2

- richer context caches
- stronger rule tests
- richer release automation
- optional MCP wrapping for summary scripts

---

## Suggested Commit Strategy

Keep changes grouped by behavior, not by file type.

Recommended commit groups:

1. `chore(template): define shipping boundary and metadata source`
2. `fix(bootstrap): align setup.sh and setup.bat payloads`
3. `fix(validation): make template checks accurate and green`
4. `feat(research): add compact repo summary scripts`
5. `feat(automation): implement project-spec and tool-registry workflows`
6. `fix(sync): harden downstream migration behavior`
7. `ci(template): add bootstrap and validation workflows`
8. `docs(template): rewrite onboarding and operating docs`

---

## Effort Estimate

Realistic effort for one strong engineer:

- Phase 0-2: 3-5 days
- Phase 3: 2-4 days
- Phase 4: 3-5 days
- Phase 5: 3-5 days
- Phase 6: 4-7 days
- Phase 7-9: 3-5 days
- Phase 10: 2-3 days

Estimated total: **18-30 working days**

---

## Plan B

If the full production-ready program becomes too large to finish safely in one pass, use staged release:

### Plan B1 - Core Reliability Release

Ship only:
- Phase 0-3
- minimal Phase 8
- minimal Phase 9

This creates a trustworthy baseline template even if script-first automation and migration proof are not complete.

### Plan B2 - Efficiency And Migration Release

Ship later:
- Phase 4-7
- remaining docs
- RC rollout

### Signal To Switch To Plan B

Switch if either of these happens:
- bootstrap parity or validation work expands more than 50% beyond estimate
- downstream migration reveals unsupported legacy states that need a separate compatibility program

---

## Exit Checklist For "Production Ready"

Before declaring the template production-ready, confirm all items below:

- [ ] product boundary defined
- [ ] version drift eliminated
- [ ] docs match shipped behavior
- [ ] bootstrap parity achieved
- [ ] no local-state leakage
- [ ] validation green
- [ ] summary/research scripts implemented
- [ ] instructions updated to script-first behavior
- [ ] project-spec lifecycle works
- [ ] tool-registry lifecycle works
- [ ] downstream migration proven
- [ ] CI release gates active
- [ ] security/trust checks active
- [ ] release candidate validated

## Recommended First Implementation Slice

Start with this narrow but high-leverage slice:

1. Phase 0 product boundary
2. Phase 1 source-of-truth unification
3. Phase 2 bootstrap parity and local-state cleanup
4. Phase 3 validation hardening

Do not start with docs polish or advanced summary scripts before the core shipping surface is stable.
