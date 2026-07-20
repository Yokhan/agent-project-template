<!-- PROGRESSIVE_STATUS
id: template-release-mcp-safety
status: active
updated: 2026-07-20
readiness: 15
plan: 55
inventory: 45
production: 0
cleanup: 10
tags: template,release,security,migration,manifest,mcp,change-strategy
next: finish the MCP and cross-platform sync audit, repair the shared boundaries, then prove a new patch release on Linux, Windows, and downstream canaries
-->

# Current Task - Template v4 Production Product Standard

## Active Slice - MCP Defaults and Native Sync Production Repair

### User Wants
- Audit the whole release/update path, remove the residual unsafe MCP defaults
  inherited from `v4.9.0`, replace the unstable Windows/MSYS apply workaround
  with a supported canonical path, and publish a production-safe patch.

### Success Means
- Context-router, Engram, and codebase-memory start in the project root, never
  the parent workspace; the graph cannot inherit sibling-project scope.
- MCP tool input never reaches a command shell; state-changing pipeline tools
  require explicit operator opt-in.
- `.mcp.json` and `.codex/config.toml` updates reject symlink/reparse targets,
  write atomically, preserve project-owned entries, and do not leave secret
  backups in the repository.
- Optional n8n setup is pinned, loopback-only by default, and does not disable
  secure cookies as a template default.
- Windows uses a native cross-platform sync/apply engine rather than relying on
  unstable Git-for-Windows MSYS orchestration. The Bash entrypoint remains a
  compatibility wrapper over the same engine, not a second implementation.
- Exact-tag dry-run/apply/repeat-dry-run passes on Linux, Windows, fresh setup,
  and dirty/project-owned downstream fixtures before a new stable tag is public.

### Failure Classification And System Map
- Observed failure: `v4.9.5` still carries the MCP block and context-router
  execution behavior from `v4.9.0`; Studio had to maintain downstream security
  overlays, and Windows migrations used release helpers manually after MSYS
  orchestration failed.
- Immediate symptoms: `cwd = ".."`; POSIX single-quote escaping passed to
  `child_process.exec` on Windows; always-exposed `run_pipeline`; project-local
  executables accepted as installed tools; `.mcp.json` copied without the safe
  config boundary; insecure optional n8n defaults.
- Broken links: template SOT did not absorb proven downstream hardening, while
  the canonical update contract still points Windows users at a Bash engine.
- Root cause: release validation proved Studio overrides and helper primitives,
  but did not test the standalone template defaults or one supported native
  end-to-end Windows update path.

### Change Strategy
- Posture: production; protected contracts are project-owned files, secrets,
  manifest identity, exact tags, dirty worktrees, Codex/AgentOS consumers, and
  repeatable rollback.
- Contradiction: provide one portable updater without weakening Bash consumers
  or maintaining two divergent sync implementations.
- Chosen destination x transition: `bounded-replace x staged-swap`. Move sync
  orchestration to one Node engine; retain the Bash command as a thin adapter
  until Linux/Windows and downstream parity is proven.
- Rejected: patch the current 866-line Bash path again. It cannot remove the
  Git-for-Windows fork/MSYS failure class and preserves duplicate shell/Node
  state transitions.
- Rejected: documentation-only preview warnings. They leave exploitable MCP
  defaults and make each downstream operator rediscover the same repair.
- Replan trigger: native parity would require weakening ownership, conflict,
  rollback, or exact-release provenance; if so, stop before tag and split the
  transition into a separate unreleased canary.

### Verification Plan
- Negative tests for Windows command metacharacters, parent cwd, project-local
  executable poisoning, pipeline opt-in, symlink/reparse MCP configs, secret
  backup absence, and secure n8n defaults.
- Existing aggregate template, MCP, context-router, text, SOT, routing, hooks,
  setup, sync, manifest, and release-provenance gates.
- GitHub Linux/Windows validation plus exact public tag/archive checksum.
- Pinned downstream preview/apply/repeat-preview with before/after hashes and
  no hidden stash or loss of project-owned state.

## Active Slice - Release v4.9.5 Downstream AGENTS Ownership and Routing Test Repair

### User Wants
- Fix the critical template update bug, publish the corrected patch release,
  and update `PersonalAssistant` without losing its project-specific agent rules.

### Success Means
- A manifest entry explicitly marked `project` is never silently migrated to
  template ownership, including legacy `AGENTS.md` entries.
- A customized downstream `AGENTS.md` remains byte-identical, its manifest hash
  reflects the preserved file, and the installed template version advances.
- A second same-tag dry-run reports no update, adoption, migration, or conflict.
- Newly bootstrapped projects still receive template-owned `AGENTS.md` guidance,
  and that guidance is truthful in both the source and downstream repositories.
- The exact published patch tag passes release gates before PersonalAssistant
  consumes it.

### Goal, Constraints, Approach, Verification, Risk
- Goal: restore safe convergence so downstream teams can receive new agent tools
  without sacrificing project-owned context.
- Constraints: preserve dirty worktrees and manifest compatibility; never rewrite
  project-owned files; keep source and downstream ownership claims truthful.
- Approach: remove the legacy forced-ownership exception, refresh preserved
  project hashes during reconciliation, neutralize the source-only wording, and
  replace the old migration fixtures with preservation and idempotence fixtures.
- Verification: focused legacy sync smoke, generated-project ownership check,
  complete template/release validation, public tag verification, then pinned
  PersonalAssistant dry-run/apply/repeat-dry-run.
- Risk/doubt: PersonalAssistant also has an independent unmanaged Codex MCP block
  conflict; that must be migrated explicitly after the AGENTS fix is released.

### Verification Evidence
- `scripts/test-template.sh`: 205/205 passed after removing a stale concurrent
  Git Bash test process that had exhausted Windows fork resources.
- `scripts/validate-template.sh`: 0 errors, 0 warnings; hooks: 12/12 passed;
  agent sync: 0 blocking issues and one existing size warning.
- Ownership fixtures prove preserved legacy and customized `AGENTS.md`, current
  project hash, version advancement, no sidecar, and clean same-tag repetition.
- Fresh bootstrap proves `AGENTS.md` remains template-owned and byte-matches the
  release source; project-owned symlink/reparse paths are rejected before copy.
- Context-router `npm ci`, test, and build passed with 0 vulnerabilities; the
  full ten-tool health profile reports every required tool available.
- Independent systems review found no remaining ownership/convergence blocker
  after SOT wording, bootstrap assertion, and symlink fixture were added.
- The immutable `v4.9.3` tag failed the Linux path-safety fixture before package
  or publish; no GitHub Release exists. `v4.9.4` carries the same product fix
  plus cross-platform fixture diagnostics and must pass branch CI before tagging.
- Linux diagnosis found that a manifest containing only `project` entries was
  incorrectly treated as empty and rebuilt before preflight. `v4.9.4` now
  reserves that rebuild path for a literal `files: {}` manifest, preserving the
  declared ownership registry before safety validation.
- PersonalAssistant exposed a second systemic validator defect after the `v4.9.4`
  rollout: baseline routing tests inherited live downstream Spec Kit artifacts
  from `process.cwd()`, so ordinary bugfix cases falsely gained strategic-review
  requirements. `v4.9.5` runs baseline cases in an empty temporary project and
  keeps orchestrator/artifact behavior behind explicit fixtures.
- Local aggregate smoke passed `206/206`; branch CI run `29705663077` passed all
  six Linux/Windows validation, bootstrap, and full-toolchain jobs.
- GitHub Release `v4.9.5` is public, non-draft, non-prerelease, and resolves to
  commit `f47fbbfe525ccb0941ea2b98e855bd60202fd862`.
- PersonalAssistant advanced from `4.7.0` through the verified patches to
  `4.9.5`; its project-owned `AGENTS.md` and `CLAUDE.md` retained local context,
  MCP health and all ten tools passed, and the final same-tag dry-run reported
  `UPDATED=0`, `NEW=0`, `CONFLICTS=0`.

## Active Slice - Release v4.9.2 Safety Repair

### User Wants
- Fix the release blockers found while previewing `v4.9.0` against the real
  `PersonalAssistant` 4.7.0 manifest and finish a production-safe patch release.

### Success Means
- Sync ownership comes only from the target release payload and the existing
  explicit project-owned contract; local downstream files can never appoint
  themselves template-owned.
- A safe legacy `AGENTS.md` ownership migration converges, while a locally
  modified `AGENTS.md` remains untouched, produces an explicit conflict, and
  prevents the manifest version from advancing.
- `CLAUDE.md` remains project-owned by design; `.codex/README.md` and other
  local-only files remain byte-identical and absent from the manifest.
- Conflict hashes are never rewritten to local content, so repeated sync cannot
  turn a conflict into a silent overwrite.
- MCP dry-run and merge plumbing never print or place existing MCP secrets in
  process arguments.
- Third-party tool installation runs without release write permission; packaging
  and publication occur on separate runners with checksum and tag verification.
- Tagged docs describe an immutable release snapshot, while GitHub owns live
  publication status.

### Failure Classification And Root Cause
- Observed failure: `v4.9.0` passed clean bootstrap CI but failed a real 4.7.0
  downstream preflight.
- Immediate symptom: manifest could say 4.9.0 while root Codex guidance remained
  4.7.0, and local `.codex/README.md` could enter template ownership.
- Broken link: downstream manifest was used both as installed baseline and as
  the authority for future ownership, then rebuilt by scanning downstream.
- Root cause: ownership policy, observed local state, and applied-version state
  were collapsed into one self-mutating reconciliation step.
- Smallest systemic fix: bounded replacement of reconciliation behind the
  existing manifest format, plus staged legacy migration and canary coverage.
- Regression guard: 4.7.0 safe/conflicting AGENTS fixtures, local-file poisoning,
  repeated-sync data-loss, MCP sentinel redaction, and workflow permission tests.

### Change Strategy
- Trigger: ownership conflict proven in `scripts/sync-template.sh` Phase A,
  Phase B, and manifest reconciliation.
- Posture: production; published tags and many downstream consumers exist.
- Destination x transition: `bounded-replace x staged-swap`.
- Protected: project-owned files, dirty worktree contents, manifest JSON shape,
  public sync CLI, secrets, exact tag/archive identity, and rollback.
- Rejected: add exclusions for `.codex/README.md` while retaining downstream
  scanning. That leaves the same self-ownership and repeated-overwrite paths.
- Approval: the user's `исправляй` follows the explicit defect review and covers
  the bounded source fix and patch release; downstream PA apply remains gated by
  a clean pinned preview.

### Verification
- Shell/Node syntax, `git diff --check`, MCP path-safety, secret-redaction, and
  release-workflow structure checks pass.
- `scripts/test-template.sh` passes 203/203, including safe and conflicting
  legacy 4.7 ownership, traversal/symlink rejection, new-path convergence,
  AgentOS setup, source-only exclusion, and exact pinned-ref application.
- Template validation passes with 0 errors and 0 warnings; hooks pass 12/12;
  routing, policy, skills, agents, SOT, text, production, design, Spec Kit, and
  progressive gates pass. Drift reports only two age warnings and 0 errors.
- Independent systems and test reviews report no P0/P1. Security review's final
  `.codex/config.toml` symlink bypass was fixed in both sync preflight and the
  merger itself, with target and parent regression coverage.
- The `v4.9.1` tag failed Linux/Windows validation before package or publish;
  no GitHub Release was created and the tag remains immutable as failure evidence.
- The first `v4.9.2` run passed validation, ten-tool health checks, packaging,
  checksum, and remote-tag verification; publish stopped because the no-checkout
  job lacked explicit `GH_REPO`. Commit `75c4460` bound the isolated publisher to
  the repository, and retry run `29687478584` completed validation, packaging,
  checksum/tag verification, and publication against the same immutable tag.
- GitHub Release `v4.9.2` is public and non-prerelease. Its archive checksum is
  `a4bde998a166ae6a9d9095bcedd3971c0c26bd3071e75c642d048514be095901`,
  and release metadata binds it to tag commit
  `755afd633582b3b9804b100d132398e813cbb1dc`.
- A pinned `v4.9.2` PersonalAssistant dry-run exited before apply on the expected
  protected boundaries: locally modified `AGENTS.md` and unmanaged legacy
  `context-router`/`engram` tables that overlap the new managed Codex MCP block.
  The downstream worktree retained all 205 porcelain entries, and the manifest,
  `AGENTS.md`, `CLAUDE.md`, `.codex/config.toml`, and `.codex/README.md` hashes
  remained unchanged. Downstream conflict resolution and apply are separate work.

### Rollback And Replan Trigger
- Source changes remain revertable patch-release commits; v4.9.0 and the failed
  v4.9.1 tag stay immutable, and only a green v4.9.2 Release is rollout-safe.
- Replan if a legacy fixture requires overwriting a project-owned file, if the
  manifest format must break compatibility, or if package/publish isolation
  cannot verify the exact same archive and tag commit.

## Active Slice - Code Intelligence Toolchain

### User Wants
- Put exactly ten complementary tools into `agent-project-template`, not into
  the downstream projects during this task.
- Make them work as one process instead of merely installing unused binaries.
- Use codebase-memory as the graph and clarify whether Engram remains.

### Success Means
- The ten-tool catalog excludes the process router and disabled Codesight.
- Engram remains the decision/session memory; codebase-memory is the sole
  persistent code graph; all other tools are on-demand CLI or short-lived LSP.
- Codex routing and context-router both emit the same task-specific workflow,
  so installation is tied to actual use.
- Setup/bootstrap can install and health-check pinned versions without starting
  ten permanent MCP servers or configuring any downstream project in this task.
- Token, memory, and latency benefits remain hypotheses until a separate
  representative benchmark passes the quality gate.

### Verification
- Catalog schema and selection unit tests.
- Native Windows plan and health-report smoke.
- Context-router build plus template, SOT, text, and generated-project checks.
- Representative TS/JS, Python, Go, Rust, and C# benchmark remains a promotion
  gate; no unmeasured savings are reported as achieved.

### Change Strategy
- Discovery: `tasks/toolchain-discovery.json`.
- Decision: `tasks/toolchain-change-strategy.json`.
- Destination: `bounded-replace`; transition: `direct-swap` inside the unshipped
  template diff.
- Protected: Engram memory, project-owned MCP entries, cross-platform bootstrap,
  pinned installs, and explicit rollback.
- Rejected: preserving the existing list and adding more documentation. That
  leaves the tools unused because neither router emits a workflow.

### Current Evidence
- 53 top-level Git roots were inspected; 35 have Engram configuration, 30 have
  context-router/Codesight configuration, 6 still name CodeGraphContext, and 40
  ship the same grep-based import graph.
- The current dirty catalog counts context-router as tool #3 and disabled
  Codesight as tool #8; policy tests only selection and installation, not use.
- Primary-source and registry checks confirm codebase-memory `0.9.0`, Probe
  `0.6.0-rc325`, ast-grep `0.44.1`, Repomix `1.16.1`, dependency-cruiser
  `18.1.0`, and Gitleaks `8.30.0`. Probe is RC-only and must stay on-demand.
- The project fleet includes TS/JS, Python, Go, Rust, C#/.NET/Unigine, Docker,
  and documentation-only repositories, so one language-specific graph cannot be
  the universal implementation.

### Result
- Implemented the exact ten-tool catalog, pinned installers and health checks,
  shared task-to-tool policy, and matching Codex/context-router output.
- Native Windows generated-project smoke passed: the generated catalog validates
  with ten tools, Codesight is absent, and symbol refactoring routes through
  `codebase-memory -> Serena -> ripgrep`.
- A real `full` install and health check now reports all ten pinned commands OK.
  The run exposed and fixed missing GitHub-download retries, Probe's package vs.
  binary version mismatch, and an undersized Windows dependency-cruiser timeout.
- Catalog, routing, context-router build/tests, production standard, SOT, text,
  progressive-status, and template validation gates pass locally.
- The aggregate local smoke passes `196/196`; generated Linux and Windows
  projects, full-profile installs, Codex MCP loading, and AgentOS routing pass in
  validation run `29672263414`.
- Tag `v4.9.0` resolves to
  `e00b714505ac4b1efb05c29e60e148a8ee7b2c85`; release run `29672457240`
  published the GitHub Release and archive. Downstream apply, project indexing,
  and token benchmarks remain separate rollout work.

## Active Slice - Downstream v4.8.0 Preview

### Result
- Ran the pinned `v4.8.0 --dry-run` flow against three real downstream
  repositories without applying any update.
- `PersonalAssistant` (`4.7.0 -> 4.8.0`): 37 updates, 11 additions,
  0 conflicts, 4 project-owned files preserved, 2 deprecated files retained.
- `SUNDesignSystem` (`3.6.0 -> 4.8.0`): 45 updates, 229 additions,
  4 conflicts, 5 project-owned files preserved. Manual merge is required for
  `mcp-servers/context-router/package-lock.json`,
  `mcp-servers/context-router/src/index.ts`, `_reference/tool-registry.md`, and
  `.gitignore`; do not use it as the first canary.
- `giants_vale_project` (`4.3.4 -> 4.8.0`): 78 updates, 65 additions,
  0 conflicts, 6 project-owned files preserved, 24 deprecated files retained.
- A fourth preview checked the clean `YokhanAccountService` tree
  (`4.6.2 -> 4.8.0`). It detected a manifest-level conflict in the committed
  `README.md` and exited before producing a complete sync report, so a clean
  Git tree alone is not sufficient canary evidence.

### Safety Evidence
- All three manifests kept their installed version after preview.
- Git porcelain entry counts remained unchanged at 204, 104, and 178.
- Template remotes remained pinned to the canonical repository.
- No `*.template-new` files were created by dry-run.
- `YokhanAccountService` also remained clean at version 4.6.2 with no
  `*.template-new` artifacts after its failed preview.

### Next Decision
- Prefer `PersonalAssistant` as the smallest successful version jump, or
  `giants_vale_project` as the stronger project-overlay canary, but checkpoint
  their existing dirty work before either apply.
- Applying either update and running its downstream checks is a separate
  state-changing step. `SUNDesignSystem` needs a dedicated conflict-resolution
  plan before apply. `YokhanAccountService` needs its incomplete preview and
  committed `README.md` divergence diagnosed before canary use.

## Active Slice - Release v4.8.0

### User Wants
- Fix the independent review findings and deploy the completed Change Strategy Gate.

### Success Means
- Every decision that resumes edits is bound to a valid structured trigger.
- Protected contracts derive required compatibility checks even when declared impacts are incomplete.
- Local Windows checks and remote Linux/Windows release gates pass.
- Tag `v4.8.0` and the published GitHub Release resolve to the same verified commit.

### Verification
- Change-strategy, route, CLI, sync, text, skill, agent, and downstream tests.
- Manual Git diff and release payload review.
- GitHub validation and release workflows plus authoritative release lookup.

### Result
- Release tag `v4.8.0` resolves to `b417a81987cdf7cb4531c89c5dd2c3c6e14eeb3f`.
- Validation run `29647669075` passed Ubuntu/Windows validation and Linux/Windows bootstrap smoke.
- Release run `29647842430` revalidated the tag commit and published the GitHub release archive.
- Latest stable release: `https://github.com/Yokhan/agent-project-template/releases/tag/v4.8.0`.

## Active Slice - Change Strategy Gate

### Amendment - Pre-Repair Discovery Activation
- Architecture fitness is assessed while reading the affected path, before the
  first patch, not inferred only from failed repair count.
- A discovered wrong ownership/SOT boundary, duplicate state or implementation,
  obsolete final path, compatibility-only layer, or mismatch with the accepted
  product plan activates Change Strategy immediately.
- Research findings invoke the overlay in the existing pipeline. They cause one
  semantic reroute only when pipeline, risk, or approval authority changes.
- `blockEdits` lasts only until a machine-valid decision with the same trigger
  kind and evidence reference is unblocked; then the original pipeline resumes.
- A first isolated leaf defect skips the full gate when the bounded negative
  check finds no causal system or protected-boundary evidence. No general
  architecture proof is required. The second failed repair remains the
  mandatory fallback circuit breaker when initial diagnosis missed the problem.

### User Wants
- Stop agents from cycling through local patches when the implementation or
  architecture should be replaced.
- Preserve necessary caution for users, data, public contracts, releases, and
  migrations without treating old internal code as inherently valuable.
- Compare destination and transition alternatives with objective evidence for user
  and business outcome, maintainability, reliability, performance, security,
  operability, transition cost, and reversibility.

### Success Means
- Repeated failures, compatibility shims, architecture drift, stale-path tests,
  or sunk-cost behavior trigger one explicit change-strategy decision.
- The agent classifies project posture and protected contracts before deciding
  whether implementation is disposable, replaceable, or migration-bound.
- Internal replacement can proceed without ritual approval when product
  behavior and protected boundaries remain unchanged and rollback is proven.
- The user receives 2-3 options and a recommendation when product behavior,
  data, public contracts, scope, cost, release, or another material tradeoff
  changes.
- Claims such as "simpler", "faster", or "more maintainable" require a baseline,
  comparable evidence, confidence, and explicit unknowns.

### Product Goal Link
- Product user: downstream teams and the real users of products built with the
  template.
- Product effect: fewer correction loops, less legacy accumulation, faster
  delivery of the intended product, and safer preservation of live boundaries.
- Business effect: lower maintenance and support cost, better reliability and
  performance where measured, and less delivery time spent defending dead code.
- Quality bar: compatibility protects verified contracts, not implementation;
  replacement must not trade away data safety, security, product value, or
  observed reliability.

### System Map
- Failure or planned change -> route -> change-strategy gate -> posture and
  protected-contract inventory -> destination/transition comparison -> automatic
  internal decision or client checkpoint -> implementation -> cleanup and
  regression evidence.
- Shared policy SOT: `.claude/library/process/change-strategy-gate.md`.
- Hot pointers: `AGENTS.md` and `CLAUDE.md`.
- Codex adapter: `.agents/skills/codex-change-strategy/` plus existing debug,
  feature, product-goal, decomposition, strategy, and progressive JPEG skills.
- Enforcement: semantic route fixtures, production-standard anchors, skill/SOT
  validators, template smoke, text policy, and independent review.

### Implementation Plan
1. Add the shared change-strategy policy with lifecycle posture, protected
   contracts, circuit-breaker triggers, decision authority, evidence matrix,
   performance protocol, total-cost model, and client notification shape.
2. Model decisions on two axes: destination (`repair`, `bounded-replace`,
   `retire-remove`) and transition (`direct-swap`, `staged-swap`,
   `versioned-coexistence`, `expand-migrate-contract`).
3. Require evidence-bound hard constraints, repeated-attempt records, SOT and
   owner for protected contracts, compatibility profiles when API/data/external
   dependencies are affected, and a current approved change envelope.
4. Add concise AGENTS/CLAUDE pointers and connect the policy to the product,
   architecture, goal, client/executor, critical-thinking, and workflow rules.
5. Create the Codex change-strategy skill as an overlay over the real bugfix,
   feature, migration, product, strategy, or template pipeline.
6. Add semantic activation and fixtures for repeated patching, greenfield
   bounded replacement, protected production transition, read-only analysis,
   and unsupported performance or maintainability claims.
7. Add validator anchors and run rule, route, skill, SOT, text, progressive,
   sync, and template checks plus independent systems/test review.

### Complexity And Boundaries
- Size: L; user approved implementation after reviewing the proposed design.
- Risk: HIGH because this changes default agent decision behavior across
  downstream projects.
- Expected changes: one shared rule and one skill; about 12-18 existing rule,
  route, test, validator, task, and convention files.
- Public product/API behavior: none in this repository; downstream agents gain
  a new default operating-contract gate. Release classification remains a
  separate SOT decision after verification; do not predeclare patch/minor/major.
- Out of scope: publishing a version, rewriting downstream projects, requiring
  numeric performance tests where performance is not material, or treating LOC
  as proof of maintainability.

### Test Scenarios
- Greenfield with no live users/data/contracts -> replace wrong internals without
  asking solely to preserve compatibility.
- Evolving project with named internal consumers -> preserve the named contract,
  but allow internal replacement with rollback and checks.
- Production data or public API change -> choose migration or ask the user with
  options; never silently rewrite the boundary.
- Second failed local repair or new compatibility shim -> block another patch
  until destination and transition alternatives have been compared.
- "Faster" without a comparable workload/baseline -> remain estimated or unknown,
  never measured evidence.
- Fewer lines alone -> do not claim lower maintenance cost.
- Replacement -> remove the superseded path or time-box migration scaffolding
  with owner and removal condition.

### Progressive JPEG
- First useful view: the approved decision protocol and objective evidence
  criteria are explicit in this plan.
- Next sharpened layer: the shared SOT and skill become callable through real
  routes and current workflows.
- Rough edge: prompt-level behavior can be regression-tested for routing and
  required contract shape, but subjective architecture judgment still requires
  evidence from the target project.
- Replan trigger: the gate creates excessive prompts for internal reversible
  changes, or routing cannot distinguish repeated patching from normal bugfixes.
- Replacement/cleanup: consolidate overlapping sunk-cost, systemic-error, and
  progressive-layer advice under one decision owner; retain concise pointers,
  not competing procedures.

### Plan B
If structured JSON creates excessive ceremony, keep the same two-axis SOT and
overlay skill but record the decision in the active AgentOS/Spec/Plan/Tasks
artifact or response-only read-only report. JSON validation remains optional
tooling for decisions that need durable machine checking.

### Current View
- Sharp now: the bounded repair-path check runs during reading. Causal
  architecture/SOT/ownership evidence loads one change-strategy overlay before
  the first patch; a second failed repair is the fallback breaker.
- Lifecycle: local leaf defects continue normally; qualifying discovery blocks
  edits pending a bound validated decision; resolution resumes the same base
  pipeline without nested workflow or duplicate strategy/product-goal skills.
- Decision model: destination and transition are separate; hard constraints,
  compatibility profiles, objective evidence, total cost, KPI regressions, and
  the approved change envelope are machine-validated when JSON is used.
- Delivery: source checks and a native Windows `setup.bat` downstream smoke
  confirm the shared SOT, skill, router helper, policy, CLI, tests, and manifest
  payload are present and executable in a generated project.
- Verification: change-strategy, routing, agent policy, skill, production, SOT,
  progressive status, UTF-8/mojibake, exact-case Windows artifact detection,
  and generated-project Windows checks pass.
- Rough edge: Bash-only `test-template.sh` and synthetic `sync-template.sh`
  execution were not run on this Windows host because no native Bash command is
  available; their new fixture coverage was reviewed statically and remains a
  Linux CI/release-gate check.
- Release: no version bump, commit, tag, push, or release was requested or made.

## Active Slice - Release v4.7.0

### User Wants
- Commit and publish the completed writing pipeline and skill updates.
- Keep any recreation of Glavred outside this template release.

### Success Means
- Release-facing SOTs consistently identify `v4.7.0`.
- Local native Windows gates and remote Linux release gates pass.
- One release commit is tagged `v4.7.0`, pushed, and published by GitHub Actions.
- Glavred remains `not-configured:not-run`; no provider capability is fabricated.

### Verification
- Independent systems, test, and security review.
- Template, writing, routing, MCP, text, dependency, manifest, and downstream checks.
- Tag-to-commit match plus authoritative GitHub Actions and release verification.

### Result
- Release commits: `56ff86a` and gate follow-up `281eb65`.
- Tag `v4.7.0` points to `281eb65c3b078ea4f38b7598d6ca5c6c0f1ba4e7`.
- Aggregate validation run `29599897177` passed Linux/Windows validation and bootstrap smoke.
- Release workflow `29600194608` passed and published the GitHub release archive.
- Glavred remains `not-configured:not-run`; recreation stays out of scope.

## Active Slice - Russian Correspondence, Explanation, And Tool Truth

### User Wants
- Expand the Russian writing system with operational rules from `Новые правила
  деловой переписки`, `Ясно, понятно`, and related Ilyakhov/Bureau materials.
- Explain and enforce how Glavred is used when no paid API access exists.
- Preserve one writing SOT and make the behavior available through every route.

### Success Means
- Russian communication loads a dedicated business-correspondence contract.
- Russian informational, marketing, and communication work loads a dedicated
  explanation and evidence-calibrated persuasion contract.
- Books/public methods, profiles, and paid external tools are separate entities.
- The template reports `glavred-api:not-configured` and cannot claim a check,
  score, warning list, or provider response without artifact-specific evidence.
- Codex, shell, and MCP routes plus downstream setup deliver the same contract.

### Verification
- Writing registry, intent, Codex route, MCP parity, and TypeScript build.
- Production, template, skill, SOT, text-policy, and downstream setup checks.
- Independent systems and test review before closeout.

### Result
- Added separate Russian language, correspondence-process, explanation,
  persuasion, domain, and technical profiles with exact effect ownership.
- Added fail-closed registry validation and an explicit paid-provider state:
  `glavred-api:not-configured:not-run:paid`.
- Added anti-fabrication gates, direct provider-intent coverage, state recovery,
  release manifest coverage, and native Windows downstream verification.
- Verified the source repository and a newly generated project; no release was
  created because this slice did not include an explicit release request.

## Active Slice - Russian Writing Reference Boundary

### Observed Failure
- Immediate symptom: English technical and government standards were presented
  beside named writers as if all of them taught the agent how to write Russian.
- Broken link: the registry described provenance but not source language, usage
  class, or the dimensions a source is allowed to influence.
- Root cause: route selection returned one flat profile list, so language/voice,
  editorial method, information architecture, claims, and technical correctness
  were indistinguishable to the agent and to tests.

### Goal And Product Link
- Final outcome: Russian text uses Russian author/editor methods and concrete
  project-authored examples; domain standards verify facts and structure without
  leaking English voice or syntax into the result.
- Product effect: clearer Russian product communication, fewer editorial loops,
  and less risk of technically correct but unnatural or generic output.
- Current step: promote the Ilyakhov material into an operational Russian profile,
  split reference effects in schema and routing, then add hard negative tests.
- Quality bar: no author imitation, no copied book corpus, no unverified voice
  source by default, and no weakening of technical/legal correctness checks.
- Out of scope: selecting a universal literary canon or publishing a release.

### Plan
1. Extract purpose, system, structure, action, specificity, editing, examples,
   planning, and client communication from user-provided and official sources.
2. Add original `bad -> diagnosis -> better` Russian examples derived from those
   principles, clearly marked as template-authored rather than quotations.
3. Add source language, usage class, allowed effects, profile output language,
   and profile effects to the registry schema.
4. Return language/editorial and domain/correctness profile groups separately;
   keep the combined list only for adapter compatibility.
5. Reject domain standards that claim voice, syntax, idiom, line-editing, or
   example-authority effects; cover Russian and technical routes with tests.

### Verification
- `node scripts/test-writing-intent.js`
- `node scripts/test-writing-references.js`
- `node scripts/validate-writing-references.js --today 2026-07-17`
- `node scripts/test-codex-routing.js`
- `node scripts/validate-text-policy.js`
- Context-router tests and TypeScript build.
- Native Windows `setup.bat` downstream smoke with a release-equivalent temporary
  Git index; installed payload passed writing, routing, production, text-policy,
  and MCP checks.

### Result
- Russian prose authority is now owned by Russian author/editor sources and
  project-approved Russian examples, not English organizations or vendor guides.
- Ilyakhov/Sarycheva language editing, Ilyakhov planning/client service, domain
  constraints, and technical correctness are four separate authority groups.
- Routes report target-language certainty, selected/rejected profiles, editors,
  and gates through Codex, shell, and MCP adapters.
- Mixed-language work requires per-section language resolution; inferred language
  cannot silently authorize an edit/review profile.
- The registry rejects undeclared effects, cross-language style leakage, stale or
  missing provenance, and technical editors claiming Russian syntax authority.

## Active Slice - Reference-Grounded Writing And Technical Writer

### User Request
Fix and complete the writing system: add technical writing, search for stronger
sources, preserve useful LitAI reference properties, define real editors, and
correct route behavior.

### Goal And Product Link
- Final outcome: agents create and review texts from a verified purpose, source,
  reference, and editor contract instead of relying on generic model taste.
- Product users: readers, customers, operators, developers, and the client whose
  product KPI, trust, support load, or operational result depends on the text.
- Current step: establish the reusable reference/editor infrastructure and the
  technical-writing specialization without changing the four semantic modes.
- Quality bar: one behavioral SOT; provenance before authority; no copyrighted
  corpus copying; no unverified reference as a default; technical procedures must
  match the product and be executable in the stated environment.
- Out of scope: copying full third-party books or campaigns, publishing a release,
  or forcing one author voice on every project.

### System Map
- Request -> action + primary semantic mode + domain overlays.
- Writing SOT -> mode profile -> technical profile when selected.
- Reference registry -> provenance gate -> task-specific property pack.
- Editor board -> mode/domain review lenses -> independent evidence.
- Codex/MCP/shell adapters consume the same classifier and contracts.
- Project-owned approved references and terminology override template defaults.

### Architecture And Ownership
- `.claude/library/technical/writing.md`: parent behavioral SOT.
- `.claude/library/technical/writing-reference-registry.json`: structured source,
  property, provenance, freshness, content-policy, and editor mapping.
- `.claude/library/technical/writing-editorial-board.md`: editor roles and review
  composition by mode; no author impersonation.
- `.claude/library/technical/technical-writing-profile.md`: technical artifact
  types, docs-as-code contract, executable evidence, and release maintenance.
- `docs/WRITING_REFERENCE_PROVENANCE.md`: LitAI audit and external source rationale;
  architecture record, not behavioral SOT.
- Codex/Claude skills remain adapters; classifiers and routers select them.

### Decomposition
1. Reference infrastructure: registry, provenance record, validator, fixtures.
2. Writing behavior: technical profile, editorial board, Codex/Claude adapters.
3. Routing: shared classifier, Codex, MCP, shell, OpenAI false-positive fix.
4. Shipping and verification: validators, sync payload, smoke tests, documentation.

### Complexity
- Size: XL, decomposed into four M-sized changes above.
- Risk: HIGH because shared routes, skills, template payload, and source authority
  change across all downstream projects.
- Expected touch set: about 25 modified files and 8-12 new files.
- Reversibility: all changes are additive or route-table changes on the current
  branch and can be reverted together before any release.

### Test Scenarios
- Valid verified/default and unverified/opt-in references pass the registry schema.
- Missing provenance, duplicate IDs, stale required sources, unsafe content policy,
  or unverified default references fail with the source ID and field.
- Generic API guide -> informational + technical + API, never OpenAI guidance.
- OpenAI Responses API guide -> informational + technical + API + OpenAI guidance.
- Technical review -> technical review skill without generation self-certification.
- Literary/marketing/informational/communication requests keep their primary mode.
- Codex, MCP, and shell expose the same action, primary mode, and overlays.
- Generated downstream project receives registry, profiles, adapters, and validators.
- Existing writing and non-writing route fixtures remain green.

### Progressive JPEG
- First useful view: a reviewed source/editor architecture with explicit provenance
  boundaries and the route defect reproduced.
- Next sharpened layer: callable technical writer and registry validator wired into
  all three routing adapters.
- Final object plan: four semantic modes; technical specialization; verified
  reference registry; task-specific property selection; mode/editor board;
  independent acceptance; deterministic route and sync tests.
- Slice purpose: a downstream agent can produce technically accurate, source-grounded
  text through the real final route, not merely display a reference inventory.
- KPI evidence: fewer incorrect docs/actions, lower editing/support cost, honest
  marketing claims, and clearer reader decisions; falsified if routes load the wrong
  specialist or a default reference lacks provenance.
- Truth boundary: tests prove contracts and routing, not subjective prose quality;
  real downstream texts remain the outcome-validation layer.
- Replacement/cleanup: replace generic technical handling and the OpenAI/API
  collision; do not preserve obsolete branches or duplicate writing SOTs.
- Replan trigger: stop if a reference requires shipping copyrighted full text, if
  technical writing cannot remain an overlay, or if adapter parity requires a
  second competing classifier.

### Plan B
If a full reference registry makes session routing too heavy, keep the structured
registry and validator but load only selected source IDs through compact mode maps.
The SOT, provenance audit, technical profile, and tests remain reusable.

### Completion Evidence
- Four semantic modes remain the primary reader-job SOT; technical writing is a
  specialization and API is a domain contract.
- A shared route policy now drives Codex, MCP, and shell adapters, including
  explicit OpenAI vendor qualification and selected profile/editor IDs.
- Template and project-owned registries validate provenance, freshness, local
  hashes, rights policy, role/skill links, collisions, and explicit supersession.
- Technical generation and independent review skills cover accuracy, executable
  procedures, document architecture, language, OS/shell, and lifecycle ownership.
- Template setup/sync delivery includes the new infrastructure while preserving
  the project-owned `brain` registry.
- Verification passed: writing/reference/routing unit tests, MCP test/build,
  production/skill/SOT/text validators, template validation, and downstream smoke
  `176/176`.

## Active Slice - Four-Mode Writing Workflow

### User Request
Adapt the strongest parts of the local LitAI writing pipeline into the template and add one writing workflow with four semantic modes: literary, marketing/advertising, informational, and communication.

### Product Goal Link
- Final outcome: agents produce texts that fulfill the reader's real job and the product's purpose instead of applying one generic copywriting formula.
- Product user: the reader or recipient of the text, plus the client who needs a reliable business, informational, communication, or literary result.
- Product/business priority: clearer decisions and actions, honest conversion, lower support and editing cost, stronger trust and loyalty, and mode-specific quality.
- Quality bar: one shared SOT; no fabricated facts, proof, citations, human imperfections, or AI-detection claims; progressive JPEG slices must already fulfill the text's production purpose; review remains independent from generation.

### System Map
- User intent -> semantic writing route -> shared writing contract -> mode profile -> context/SOT pack -> text architecture -> functional 1% text -> detailing -> independent review -> release check -> feedback/evolution.
- Shared owner: `.claude/library/technical/writing.md`.
- Codex adapter: `.agents/skills/codex-writing-workflow/`.
- Claude adapter: `.claude/agents/writer.md`.
- Independent reviewer: `codex-domain-communication-review` and its shared Claude counterpart.

### Implementation Plan
1. Replace the current imitation-based writing rules with a purpose-first shared workflow derived from LitAI principles.
2. Add four mode profiles and progressive JPEG acceptance examples.
3. Add a Codex writing workflow skill with progressive disclosure references and metadata.
4. Point Claude writer and communication reviewers at the shared SOT without duplicating it.
5. Route literary, marketing, informational, and communication requests semantically to the writer skill; preserve business/strategy review for marketing work.
6. Add routing fixtures and production/template validation for the new contract.
7. Run text, SOT, skill, routing, production, template, and progressive-status checks; perform an independent findings-first audit.

### Replan Trigger
Replan before continuing if the four modes require separate competing SOTs, if routing cannot distinguish writing from review reliably, or if a new shipped path requires a template sync contract change beyond existing `.agents/skills/` and `.claude/` ownership.

### Completion Evidence
- Shared purpose-first writing SOT and detailed profiles cover literary, marketing/advertising, informational, and communication modes.
- One semantic classifier returns action, primary mode, and overlays across Codex, MCP, and shell fallback routes.
- Generation and independent review are separate; self-review cannot be reported as independent acceptance.
- Universal phrase bans and fabricated human markers are excluded from the active workflow; the legacy phrase scanner is diagnostic and non-blocking.
- Writing intent, Codex routing, MCP tests/build, production validation, skill/agent/SOT/text checks, sync checks, and the full template smoke suite passed; full smoke result: 172/172.

Last updated: 2026-07-11

## Goal
Prepare `agent-project-template` v4 so agents stop treating real product work as MVP/prototype work and instead operate from a persistent product goal, current step, dependencies, verification contract, and product/business outcome priority.

## User Wants
- No MVP/prototype mindset unless the user explicitly asks for a throwaway experiment.
- A `/goal`-like operating model: keep the final product outcome, quality bar, dependencies, open questions, and current work slice visible across tasks.
- Do not invent "final product slices" as a rigid concept. Slices already happen because agent turns and context are limited; the important contract is that every slice preserves the final product goal and does not lower the intended quality.
- Plans, audits, and reports must use the language of the user's request.
- Lessons from the last week across BUFF IT, design system, auth, CallService, SmartCart, docs, and GATES must become reusable template behavior.
- Any plan or improvement must prioritize the real product user's experience and app-specific business outcomes: revenue instruments, loyalty, retention, conversion, activation, and business KPIs. Technical perfection is second-order unless it directly protects or unlocks those outcomes.

## Route
- Route: `design+template+feature+strategy`
- Pipeline: `design`
- Risk: `HIGH`
- Skills: `codex-design-workflow`, `codex-domain-design-review`, `codex-template-sync`, `codex-skill-maintenance`, `codex-test-rules`, `codex-agent-router`, `codex-feature-workflow`, `codex-pipeline-workflow`, `codex-strategic-review`, `codex-decompose`
- Orchestrator: `codex-parent`

## Success Criteria
- `AGENTS.md` and `CLAUDE.md` define a production product standard and goal-loop protocol without bloating the session-start surface.
- Shared rules describe how to preserve final product intent while executing bounded current steps.
- Codex router returns product/design-system/UX quality gates for relevant work.
- New or updated Codex skills cover product goal planning, design-system contracts, product UX audit, and cross-project lesson promotion.
- Validators and smoke tests fail when the template loses the v4 production standard, goal contract, or key routing behavior.
- Release docs describe v4 rollout and downstream migration expectations.

## Lessons From Recent Projects
- BUFF IT landing: `200 OK` is not enough. Agents must verify the actual user path, assets, visual layout, nav, auth entry, and return path.
- BUFF IT design system: token docs are not enough. Rendered geometry checks are required because components can stretch or drift even when CSS references tokens.
- SmartCart/app UI: everyday product UI needs base typography, density, controls, forms, empty/loading/error states, and layout primitives, not only accent landing styles.
- Auth/Keycloak: privacy-first identity is part of product quality. Do not collect first/last name or mandatory email unless explicitly justified; verify real rendered forms.
- CallService: product flow beats copy patches. Define entry actions, dead-end handling, media permissions, and browser smoke before calling a flow done.
- Docs/Docusaurus: verify real docs routes, ingress links, CSS/JS content types, 404 behavior, and whether docs should be first-class site content.
- GATES: naming and domain language matter. Public UX must use product-approved language, not internal implementation terms.

## Plan

### Size And Risk
- Size: XL
- Risk: HIGH
- Reversibility: one branch, no downstream sync until release tag is cut
- Primary tradeoff: add enforceable contracts and small validators instead of only writing more instruction prose

### File Architecture
- `AGENTS.md`, `CLAUDE.md` - concise v4 operating rules and version bump
- `.claude/library/product/production-product-standard.md` - shared final-product quality rule
- `.claude/library/process/product-goal-loop.md` - shared goal/current-step/dependency protocol
- `.claude/library/domain/domain-design-pipeline.md` - stronger design-system and rendered-geometry requirements
- `.agents/skills/codex-product-goal/` - goal-loop skill
- `.agents/skills/codex-design-system-workflow/` - token/component/Storybook contract skill
- `.agents/skills/codex-product-ux-audit/` - useful-flow/dead-end audit skill
- `.agents/skills/codex-cross-project-lessons/` - promote lessons from downstream projects
- `templates/project-starter/tasks/goal.md` - starter persistent product goal file
- `scripts/codex-route-task.js` - route fields for production bar, plan contract, language, and gates
- `scripts/test-codex-routing.js` - regression fixtures for v4 routes
- `scripts/validate-production-standard.js` - template v4 contract validator
- `scripts/validate-codex-skills.js`, `scripts/validate-template.sh`, `scripts/test-template.sh` - include the new gate
- `docs/TEMPLATE_RELEASES.md`, `docs/RELEASE_CHECKLIST.md`, `README.md`, `scripts/check-drift.sh` - release/version alignment

### Implementation Order
1. Add shared production and goal-loop rules.
2. Update AGENTS/CLAUDE to load the rules without turning startup docs into a manual.
3. Add v4 Codex skills and metadata.
4. Strengthen design-system workflow and route outputs.
5. Add validators and route tests.
6. Update release docs/version.
7. Run validation gate and fix regressions.

### Verification
- `node scripts/validate-production-standard.js`
- `node scripts/validate-codex-skills.js`
- `node scripts/test-codex-routing.js`
- `node scripts/validate-agent-sot.js`
- `bash scripts/validate-template.sh`
- `bash scripts/test-template.sh`
- `bash scripts/check-drift.sh`

### Plan B
If router changes become too invasive, keep the new fields backwards-compatible and enforce the v4 behavior through skills plus `validate-production-standard.js`, then leave deeper router expansion for v4.1.

## Current Status
- Working branch: `feature/template-v4-production-product-standard`
- v4 production standard, product goal loop, design-system workflow, product UX audit, cross-project lesson promotion, text/platform policy, and UI Subtraction Gate are implemented in shared rules, Codex skills, router, starter files, and validators.
- v4.0.3 has been published as the text/platform policy and UI Subtraction Gate patch release.
- v4.1.0 has been published as the product-user and app-specific business KPI priority minor release.
- v4.1.1 has been published as the GitHub Actions Node 24-compatible workflow patch release.
- v4.2.0 has been published as the production design QA minor release.
- v4.3.0 has been published as the design pipeline and skill upgrade minor release.
- v4.3.1 has been published as the documentation drift patch release.
- v4.3.3 has been published as the design fixture sync patch release.
- v4.3.4 has been published as the downstream production-standard validator patch release.
- v4.4.0 has been published as the client-executor accountability minor release.
- v4.4.1 has been published as the GitHub entrypoint patch release.
- v4.4.2 has been published as the progressive JPEG client-control patch release.
- v4.5.0 has been published as the semantic intent routing minor release.
- v4.5.1 has been published as the progressive JPEG implementation gate patch release.
- v4.5.2 has been published as the progressive object readiness patch release.
- v4.5.3 has been published as the progressive layer replacement and project-slice status patch release.
- v4.6.0 has been published as the adaptive GPT-5.6 fan-out minor release.
- v4.6.2 is published with bounded Luna roles, one-wave fan-out, genuine child-trace validation, and the progressive JPEG anti-falsification planner.
- Live Codex CLI evidence remains unverified on `codex-cli 0.144.x`: after removing incompatible `--ephemeral`, the runtime still emitted no spawn event, an empty wait, and a parent-authored role name; the strict trace gate rejected it.
- Published: source commit `996416291a1d40a38fcd509f9edd1a33709a3f78`, tag `v4.6.2`, workflow `29146862497`, and GitHub Release `Agent Project Template v4.6.2` are live.
- Published asset: `agent-project-template-v4.6.2.tar.gz`, sha256 `0dbfabd3f7d8c15527f64f5aa3484280e2e3465a36faf6340ee8ed28b3f89440`.
- v4.6.1 has been published as the canonical agent update protocol and release hardening patch release.

## Immediate Next Step
- Preview `v4.6.2` in downstream projects before apply; keep the live custom-agent trace limitation explicit until the CLI emits genuine child evidence.

## Plan - v4.6.2 Cost-Aware Fan-Out And Truthful Progressive JPEG

### User Request
Use Luna where it is genuinely suitable, fix wasteful automatic subagent use, explicitly forbid falsifying progressive JPEG, and add a skill that plans iterations so every implementation slice solves the purpose for which the product exists.

### Product Goal Link
- Final outcome: downstream agents deliver useful product-shaped iterations without burning expensive reasoning on mechanical work or reporting internal motion as product value.
- Product user: the downstream product owner and the real end user of the generated application, game, text, service, or internal tool.
- Product/business priority: faster verified value, lower token/support/rework cost, honest acceptance, and protection of the application-specific KPI.
- Quality bar: no `max`/`ultra`; Luna only for bounded low-risk roles; critical decisions stay on Terra/Sol; no fake child success; no fake progressive slice; every implementation slice closes the real user-value loop at its declared depth.

### System Map
- Parent/session model and live permissions -> project thread/depth limits -> semantic route -> fan-out policy -> runtime agent profile -> child evidence -> parent consolidation.
- Product goal -> final inventory and contracts -> progressive iteration plan -> end-to-end slice -> user-path evidence -> cleanup/replacement gate -> next sharpening pass.
- Active SOTs: user instruction -> `tasks/goal.md` -> production/product-goal/client-executor rules -> agent policy and progressive planner skill -> validators/tests.

### Contradictions
- Need proactive parallelism without spawning workers whose combined attention costs more than the evidence they add.
- Need a whole future product shape at 1% without pretending that callable stubs or architecture alone achieve the product purpose.
- Need cheap Luna throughput without delegating ambiguous decisions or production writes beyond its proven quality envelope.

### Implementation Order
1. Correct fan-out semantics: XS imperative tasks skip, read-only work cannot become required mutation work, candidate count alone is not enough, and automatic fan-out has one bounded wave.
2. Add Luna `scout`, `log_analyst`, and `summarizer` roles for bounded read-only work; keep architecture, source verification, testing strategy, implementation, and critical review on Terra/Sol.
3. Harden live smoke: require a genuine spawn event, non-empty child thread, child completion, and observable role/model evidence when the runtime exposes it; never accept a marker written by the parent.
4. Add `$codex-progressive-jpeg-planner` with an iteration contract, anti-falsification gate, replacement gate, product-purpose test, and domain examples.
5. Update hot rules and shared SOTs concisely; route progressive planning by meaning to the new skill.
6. Add exact policy/routing/skill/production regressions, sync coverage, version/docs, full release gate, then tag and verify `v4.6.2`.

### Slice Acceptance Contract
Every implementation slice must state and prove:
- Product purpose: the real user outcome the product exists to create.
- End-to-end path: a real user/input reaches a real useful outcome, even when fulfillment is manual, narrow, or low-detail.
- Product shape: accepted final inventory/contracts exist at the declared readiness level.
- KPI signal: the slice can produce or protect one application-specific success signal.
- Truth boundary: stubs/debug/mocks are identified and are not the evidence for the product outcome.
- Replacement: superseded wrong layers are deleted, migrated, or time-boxed with removal conditions.
- Evidence: an executable path, rendered artifact, complete readable text, real service result, or equivalent product-domain proof.

Planning, research, architecture, migration preparation, and test scaffolding may be necessary work stages. If they do not deliver the product purpose, label them `preparation`, not a progressive product slice.

### Verification
- Exact unit fixtures for XS commands, read-only review, explicit parallel intent, high-risk mutation, Luna profiles, one-wave limit, and write-scope boundaries.
- Exact route fixtures proving progressive iteration planning selects the new skill without unrelated design-system or product agents.
- Skill and production validators require `product purpose`, `end-to-end`, `anti-falsification`, `evidence`, and `replacement` gates plus examples.
- Live CLI smoke must fail on the previously observed empty `wait` and parent-authored marker.
- Full template, sync, text, SOT, hook, agent, skill, routing, progressive-status, and release checks.

### Rough Edges And Replan Trigger
- Rough now: CLI `0.144.0` did not produce a real child in the existing live smoke, even with the anecdotal `multi_agent_v2` workaround.
- Replan trigger: if the installed CLI cannot expose a genuine custom child/profile, ship automatic fan-out as runtime-gated and report the unsupported CLI path instead of weakening the test or claiming success.
- Out of scope: changing user-owned global model defaults, enabling experimental Reddit configuration by default, or moving critical reviewer/implementer roles to Luna without eval evidence.

## Plan - v4.6.1 Canonical Agent Update Protocol

### User Request
Verify that v4.6 works, update instructions so agents do not confuse template maintenance, downstream updates, target versions, download sources, or release state, then push a release when the checks are green.

### Goal
Make "update your template" deterministic and trustworthy: classify workspace type, resolve one explicit stable release tag, preview the exact change without executing fetched filenames, preserve project-owned files, apply once, verify the result, and publish the same commit that passed the release gate.

### Product Goal Link
- Final outcome: users can request an update without teaching the agent which repository, tag, script, or working directory to use.
- Product/business priority: fewer broken updates and support loops, faster adoption of fixes, lower user correction cost, and higher release trust.
- Current step: strengthen the release SOT and hot instructions, remove path/workflow injection sinks, bind validation to the published tag commit, and add scenario regressions.
- Quality bar: user/AgentOS tag precedence; stable tags for normal rollout; dry-run before apply; no silent remote replacement; no code generation from fetched paths; no release claim without manifest/workflow evidence.
- Out of scope: mandatory signed historical tags, full `--force`/stash redesign, and immutable Action SHA migration; these change the trust/CLI model and need a separate hardening release.

### Strategy
- Goal -> one copy-ready state machine shared by Codex and Claude.
- Constraints -> preserve v4.6.0 ownership, Windows/Unix parity, AgentOS boundaries, canary support, and downstream compatibility.
- Approach -> release SOT -> hot pointers and command -> safe path/ref/workflow implementation -> scenario fixtures -> patch release.
- Verification -> malicious-path fixture, pinned tag vs divergent main, missing-tag rejection, dry-run immutability, exact post-sync manifest version, workflow ref assertion, full downstream and release gates.
- Risk/Doubt -> broader supply-chain hardening remains necessary, but mixing signed-tag and force/stash migration into this patch would change established contracts without a migration plan.

### Current View
- Sharp now: release docs, AGENTS, CLAUDE, `/update-template`, README, SETUP_GUIDE, and the Codex sync skill use one source/downstream/legacy update protocol.
- Sharp now: explicit user/AgentOS tag precedence, remote conflict handling, pinned preview/apply, legacy release-checkout fallback, and post-sync evidence are mandatory.
- Sharp now: fetched paths enter Node through `argv`; manifest hashes use Node `crypto`; the malicious-path regression does not execute its marker.
- Sharp now: semver refs fetch exact tags in an isolated repository, dry-run leaves project files and Git metadata unchanged, divergent `main` requires explicit canary intent, missing tags fail, conflicting manifest/remote sources block, and apply records the exact tag version.
- Sharp now: manual release input is env-bound and validated; workflow checkout, validation, archive, and publication are bound to one tag commit; existing release assets are not clobbered.
- Published: source commit `48eb80d6ef5188f5c6e388442d82a0f0d5823110`, tag `v4.6.1`, workflow `29082718223`, and the release archive are live.
- Remaining hardening: signed historical tags, complete `--force`/stash redesign, and full immutable Action SHA migration remain separate contract-changing work.

### Verification Results
- Passed: Git Bash `scripts/test-template.sh` (`160/160`)
- Passed: Git Bash syntax for `scripts/sync-template.sh` and `scripts/test-template.sh`
- Passed: `node scripts/validate-text-policy.js` (`431` files)
- Passed: `node scripts/test-codex-routing.js`
- Passed: `node scripts/test-codex-agent-policy.js`
- Passed: `node scripts/validate-codex-skills.js`
- Passed: `node scripts/validate-codex-agents.js`
- Passed: `node scripts/validate-production-standard.js` (`259` checks)
- Passed: `node scripts/validate-agent-sot.js`
- Passed: `node scripts/validate-design-policy.js`
- Passed: `node scripts/test-design-policy.js`
- Passed: `node scripts/validate-spec-kit.js`
- Passed: `node scripts/progressive-status.js --check`
- Passed: Git Bash `scripts/validate-template.sh`
- Passed: Git Bash `scripts/check-drift.sh` with one existing documentation-age warning and zero errors
- Passed: Git Bash `scripts/test-hooks.sh` (`12/12`)
- Passed: Git Bash `scripts/sync-agents.sh`
- Passed: `git diff --check`
- Published: GitHub Actions `Release Template` run `29082718223` completed `success` on the release commit
- Published: GitHub Release `Agent Project Template v4.6.1` is live at `https://github.com/Yokhan/agent-project-template/releases/tag/v4.6.1`
- Published: asset `agent-project-template-v4.6.1.tar.gz`, sha256 `a97d009490fbc2ee9aaaa47ad2e2af31a49aae902d4505c3b47d78de45a85aed`

## Plan - v4.6.0 Adaptive GPT-5.6 Fan-Out

### User Request
Update the template for GPT-5.6. Assign appropriate Sol/Terra models and reasoning effort to specialist agents, automatically spawn subagents without an explicit user request when independent work materially improves speed or quality, and never configure `max` or `ultra`; `xhigh` is the hard ceiling.

### Goal
Make downstream Codex work faster and more reliable by routing independent exploration, review, testing, security, design, system, and product work to appropriately priced GPT-5.6 specialists while the parent remains the accountable orchestrator.

### Product Goal Link
- Final outcome: downstream teams get faster verified results with less main-thread context pollution and fewer correction loops.
- Product/business priority: faster path to value, lower support and rework cost, safer releases, and better product decisions.
- Current step: add one machine-readable agent policy SOT, synchronize runtime agent manifests, expose an adaptive fan-out decision in the router, update hot rules and specialist guidance, add regressions, and release `v4.6.0`.
- Quality bar: parent model remains user-owned; auto-spawn requires independent useful work; write delegation requires exact non-overlapping ownership; maximum reasoning effort is `xhigh`; recursion remains disabled with `max_depth = 1`.
- Out of scope: forcing a parent model in project `.codex/config.toml`, using Luna for critical roles, or applying the release to downstream projects before their dry-run review.

### Strategy
- Goal -> automatic, observable, role-aware delegation without requiring the user to ask each time.
- Constraints -> preserve project-owned overlays, avoid duplicate SOTs, avoid unnecessary token spend, and keep hot context short.
- Approach -> policy SOT -> validated TOML profiles -> route fan-out decision -> concise AGENTS/skill rule -> focused fixtures -> full release gate.
- Verification -> policy/agent validator, route regressions, skill/agent/SOT validators, text/platform checks, template/sync tests, live role smoke when available, release workflow.
- Risk/Doubt -> launch-day model availability may vary by account; keep parent defaults user-owned and make failures observable with one bounded fallback rather than silent repeated spawning.

### Accepted Agent Policy
- Terra `medium`: `pr_explorer`, `docs_researcher`, `tester`.
- Terra `high`: `implementer` for exact isolated write scopes.
- Sol `high`: `reviewer`, `design_reviewer`, `product_reviewer`.
- Sol `xhigh`: `security_reviewer`, `systems_reviewer`.
- Forbidden in template policy: `max`, `ultra`, recursive fan-out, overlapping write ownership, and unconditional spawning for XS tasks.

### Current View
- Sharp now: one policy SOT owns all nine role profiles, fan-out limits, opt-out behavior, write-scope checks, and the `xhigh` ceiling; TOML manifests and route output are validated against it.
- Sharp now: semantic routing distinguishes research about release pages/diagrams from state-changing release work in Russian and English.
- Sharp now: setup and sync manage JavaScript route helpers on Windows and Unix; an unowned legacy helper is adopted only when it matches the target, otherwise sync preserves it and emits a normal conflict.
- Sharp now: downstream setup, empty-manifest recovery, source-only exclusion, legacy-helper adopt/conflict handling, and from-git preview pass in a generated project.
- Published: source commit `40c72265cf91056fb5d63f766ca212279a4e07f5`, tag `v4.6.0`, workflow `29077360521`, and the release archive are live.
- Replan trigger: any final gate or GitHub workflow failure blocks the tag or release claim.

### Verification Results
- Passed: `node scripts/test-codex-agent-policy.js`
- Passed: `node scripts/test-codex-routing.js`
- Passed: `node scripts/validate-codex-agents.js`
- Passed: `node scripts/validate-production-standard.js`
- Passed: `node scripts/validate-agent-sot.js` with existing freshness warnings only
- Passed: `node scripts/validate-text-policy.js` (`424` files scanned)
- Passed: Git Bash `scripts/validate-template.sh`
- Passed: Git Bash `scripts/test-template.sh` (`152/152`)
- Passed: Git Bash `scripts/check-drift.sh` with one existing documentation-age warning and zero errors
- Passed: Git Bash `scripts/test-hooks.sh` (`12/12`)
- Passed: Git Bash `scripts/sync-agents.sh`
- Passed: Git Bash `scripts/generate-project-spec.sh --write`
- Passed: Git Bash `scripts/scan-project.sh --report`
- Passed: `node scripts/validate-design-policy.js`
- Passed: `node scripts/test-design-policy.js`
- Passed: `node scripts/validate-spec-kit.js`
- Passed: `node scripts/progressive-status.js --check`
- Passed: `git diff --check`
- Published: GitHub Actions `Release Template` run `29077360521` completed `success`
- Published: GitHub Release `Agent Project Template v4.6.0` is live at `https://github.com/Yokhan/agent-project-template/releases/tag/v4.6.0`
- Published: asset `agent-project-template-v4.6.0.tar.gz`, sha256 `6e27b98aeccda549eb51188acbf6cf1cd4da1b02c6b2b6759df2d350f4bdbbb1`

## Plan - v4.5.3 Progressive Layer Replacement Pipeline

### User Request
Correct the progressive JPEG workflow so agents stop preserving wrong earlier iterations, bad placeholders, commented-out old paths, or tests whose only purpose is to keep stale code out of release. The expected behavior is to replace, delete, migrate, and clean obsolete layers as the object sharpens.

### Goal
Make progressive JPEG an object evolution pipeline: every sharpening pass must audit superseded artifacts and remove or replace anything that no longer belongs to the accepted final plan, then report the current project detail level as a tool-readable status slice.

### Product Goal Link
- Final outcome: downstream agents converge toward production objects without accumulating hidden legacy, dead branches, and disabled scaffolds.
- Product/business priority: lower correction loops, lower maintenance/support load, fewer release surprises, and faster production readiness for generated products.
- Current step: update hot rules, shared product/process rules, Codex skills, progressive status script, validator anchors, route regression, version docs, and release `v4.5.3`.
- Quality bar preserved: keep valid 1% placeholders only when they are accepted by the final plan, callable, honest, and tracked as the next readiness target.
- Out of scope: deleting downstream project code before projects sync and apply the released template.

### Strategy
- Goal -> encode cleanup as part of progressive JPEG, not optional polish.
- Constraints -> preserve v4.5.2 final-plan object readiness and avoid deleting real migration/rollback scaffolding that protects live users.
- Approach -> add a replacement pipeline: plan -> build layer -> superseded-layer audit -> replace/delete/migrate -> absence verification -> project-slice report -> next detail layer.
- Verification -> progressive status check, production-standard validator, route tests, skill/agent validators, text/platform checks, template gate, release workflow.
- Risk/Doubt -> too-aggressive deletion can break real migrations; rule must allow time-boxed, named temporary scaffolding only when it protects rollback/migration and is outside the normal product path.

### Current View
- Sharp now: shared product/process/client-executor rules, AGENTS/CLAUDE hot rules, Codex product/feature/design/design-system/decompose/strategic/router skills, design rules, route fixtures, validators, release docs, starter task status, and the new `scripts/progressive-status.js` gate are updated for progressive layer replacement and project-slice reporting.
- Behavior: after each sharpening pass, agents must audit superseded layers and delete, replace, or time-box old artifacts before claiming the next readiness level; iteration reports can include an aligned ASCII slice from `node scripts/progressive-status.js`.
- Rough edge: this is template behavior only until downstream projects sync `v4.5.3`.
- Replan trigger: if remote release validation fails, fix the workflow/docs without moving the tag.

### Verification Results
- Passed: `node scripts/progressive-status.js --check`
- Passed: `node scripts/test-codex-routing.js`
- Passed: `node scripts/validate-production-standard.js` (`252` checks)
- Passed: `node scripts/validate-codex-skills.js`
- Passed: `node scripts/validate-codex-agents.js`
- Passed: `node scripts/validate-design-policy.js`
- Passed: `node scripts/test-design-policy.js`
- Passed: `node scripts/validate-agent-sot.js` with existing freshness warnings only
- Passed: `node scripts/validate-spec-kit.js`
- Passed: `node scripts/validate-text-policy.js` (`423` files scanned)
- Passed: `git diff --check`
- Passed: Git Bash `scripts/generate-project-spec.sh --write`
- Passed: Git Bash `scripts/scan-project.sh --report`
- Passed: Git Bash `scripts/check-drift.sh` with existing freshness warnings only
- Passed: Git Bash `scripts/test-hooks.sh`
- Passed: Git Bash `scripts/sync-agents.sh`
- Passed: Git Bash `scripts/test-template.sh` (`138/138`)
- Passed: Git Bash `scripts/validate-template.sh`
- Published: commit `7a795a42120416e2bbbc06e4e1bb925de16ad8ba`
- Published: tag `v4.5.3` on origin
- Published: GitHub Actions `Release Template` run `28783641828` completed `success`
- Published: GitHub Release `Agent Project Template v4.5.3` is live at `https://github.com/Yokhan/agent-project-template/releases/tag/v4.5.3`
- Published: asset `agent-project-template-v4.5.3.tar.gz`, sha256 `d4b37c0945f86cd443916c59acc98b13f4b8d3c9d483add5fbb80ea8d402b88c`

## Plan - v4.5.2 Progressive Object Readiness

### User Request
Clarify that progressive JPEG means an LLM should first plan the final product object, then create the whole product-shaped object skeleton at 1% readiness: all accepted classes, components, interfaces, variables, functions, routes, sections, and placeholders exist and are callable/executable. If the final plan is missing, the agent must gate the work and force/propose creation of that plan because later plan changes intentionally change the object.

### Goal
Make the template teach and enforce object readiness levels across domains: game actor, site/app, text/book, and project/module. At 1% readiness the object must still perform its production function in the smallest honest way.

### Product Goal Link
- Final outcome: downstream agents produce complete product-shaped scaffolds first, then refine detail level, instead of creating throwaway fragments.
- Product/business priority: less rebuild churn, clearer acceptance, faster production convergence, fewer correction loops, and safer downstream sync.
- Current step: update shared rules, Codex skills, route fixtures, validators, version docs, and release `v4.5.2`.
- Quality bar preserved: no speculative architecture; no fake user-visible readiness; final plan is required before full object skeleton creation.
- Out of scope: implementing a new generator or modifying downstream Unreal/game/site projects.

### Strategy
- Goal -> encode progressive JPEG as final-plan-gated object readiness.
- Constraints -> preserve v4.5.1 end-state skeleton, v4.5 semantic routing, SOT, text/platform, and sync gates.
- Approach -> add concise hot rule plus detailed examples in existing shared rules and skills, then validator/route coverage and patch release.
- Verification -> route tests, production-standard validator, skill/agent validators, text/platform checks, template gate, release workflow.
- Risk/Doubt -> if the rule is too broad, agents may over-scaffold speculative futures; the wording must require an accepted final plan and reject unknown/speculative capabilities.

### Current View
- Sharp now: AGENTS/CLAUDE, shared production/product-goal/client-executor rules, Codex product/feature/design/design-system/decompose/strategic/communication skills, route fixtures, validators, and release docs now define progressive JPEG as final-plan object readiness.
- Behavior: if the final plan is missing, implementation gates on creating/proposing the plan; if the plan exists, the 1% object must include the planned inventory and execute its smallest honest production function before detail depth is judged.
- Examples covered: Unreal/game actor, site/app, book/text, and project/module.
- Rough edge: this changes template behavior and shipped guidance; downstream projects must sync `v4.5.2` before their agents inherit it.
- Replan trigger: if route or release validation treats speculative capabilities as mandatory, tighten the rule around accepted final plans before tagging.

### Verification Results
- Passed: `node scripts/test-codex-routing.js`
- Passed: `node scripts/validate-production-standard.js` (`213` checks)
- Passed: `node scripts/validate-codex-skills.js`
- Passed: `node scripts/validate-codex-agents.js`
- Passed: `node scripts/validate-design-policy.js`
- Passed: `node scripts/test-design-policy.js`
- Passed: `node scripts/validate-agent-sot.js` with existing freshness warnings only
- Passed: `node scripts/validate-spec-kit.js`
- Passed: `node scripts/validate-text-policy.js` (`423` files scanned)
- Passed: `git diff --check`
- Passed: Git Bash `scripts/generate-project-spec.sh --write`
- Passed: Git Bash `scripts/scan-project.sh --report`
- Passed: Git Bash `scripts/validate-template.sh`
- Passed: Git Bash `scripts/check-drift.sh` with existing freshness warnings only
- Passed: Git Bash `scripts/test-hooks.sh`
- Passed: Git Bash `scripts/test-template.sh` (`135/135`)
- Passed: Git Bash `scripts/sync-agents.sh`
- Published: commit `3fdd8bad256c0b64adb6dba0cb5c993696fbace9`
- Published: tag `v4.5.2` on origin points to the same commit
- Published: GitHub Actions `Release Template` run `28754954123` completed `success`
- Published: GitHub Release `Agent Project Template v4.5.2` is live at `https://github.com/Yokhan/agent-project-template/releases/tag/v4.5.2`
- Published: asset `agent-project-template-v4.5.2.tar.gz`, sha256 `ae90ca62c0ef3a612ce6c6c595183c71959f91ceaf5aa0b9f59786a92480bead`

## Plan - v4.5.1 Progressive JPEG Implementation Gate

### User Request
Исправить повторяющуюся ошибку: агенты трактуют progressive JPEG как "доказать harness" или отчитаться слоями, вместо того чтобы сразу строить продуктовую сущность в будущей форме. Компонент/фича должны с первого полезного слоя иметь известные будущие функции как вызываемые 1% контракты, хотя полная реализация может быть позже.

### Goal
Сделать правило end-state skeleton обязательным для product/feature/design/template work: если финальная способность уже известна, первый слой должен включать ее безопасный callable hook/slot/handler/contract с честным stub/no-op/dev debug сигналом, а не отсутствующую архитектурную точку.

### Product Goal Link
- Final outcome: downstream teams get agents that shape product components toward the final product from the first implementation pass.
- Product/business priority: fewer rebuilds, fewer fake proof cycles, faster route to real product behavior, lower support/correction load.
- Current step: update shared rules, Codex skills, validator anchors, route regression, release docs, and patch version.
- Quality bar preserved: no fake user-visible readiness; debug placeholders must be explicit, safe, and not leak as completed product behavior.
- Out of scope: changing downstream product code or forcing stubs for speculative capabilities that are not part of the accepted product direction.

### Strategy
- Goal -> encode progressive JPEG as implementation architecture: end-state skeleton plus 1% callable capabilities.
- Constraints -> preserve v4.5 semantic routing, SOT rules, text/platform gates, project-owned overlays, and release flow.
- Approach -> patch hot rules and workflow skills, add validator smoke and routing regression, then publish as `v4.5.1`.
- Verification -> route tests, production-standard validator, skill/agent validators, text/platform checks, template gate, tag/release verification.
- Risk/Doubt -> the rule must not encourage fake production behavior; the guard will require honest stubs/no-ops and explicit rough edges.

### Current View
- Sharp now: shared rules, AGENTS/CLAUDE, Codex product/feature/design/design-system/decompose/strategic skills, route intents, route fixtures, and production-standard anchors now encode progressive JPEG implementation as end-state skeleton plus 1% callable capabilities.
- Next sharpened layer: commit, tag `v4.5.1`, push, and verify the GitHub release artifact.
- Rough edge: this changes agent behavior but does not modify downstream product code until projects sync the tag.
- Replan trigger: if release workflow fails remotely, fix the release workflow or docs without moving the tag.

### Verification Results
- Passed: `node scripts/test-codex-routing.js`
- Passed: `node scripts/validate-codex-skills.js`
- Passed: `node scripts/validate-codex-agents.js`
- Passed: `node scripts/validate-production-standard.js` (`182` checks)
- Passed: `node scripts/validate-design-policy.js`
- Passed: `node scripts/test-design-policy.js`
- Passed: `node scripts/validate-agent-sot.js` with existing freshness warnings only
- Passed: `node scripts/validate-spec-kit.js`
- Passed: `node scripts/validate-text-policy.js` (`423` files scanned)
- Passed: `git diff --check`
- Passed: Git Bash `scripts/generate-project-spec.sh --write`
- Passed: Git Bash `scripts/scan-project.sh --report`
- Passed: Git Bash `scripts/validate-template.sh`
- Passed: Git Bash `scripts/check-drift.sh` with existing freshness warnings only
- Passed: Git Bash `scripts/test-hooks.sh`
- Passed: Git Bash `scripts/test-template.sh` (`135/135`)
- Passed: Git Bash `scripts/sync-agents.sh`
- Published: commit `5e91d62aa8995f9e0b15bf90c2d5943b8a4d5366`
- Published: tag `v4.5.1` on origin points to the same commit
- Published: GitHub Actions `Release Template` run `28754220908` completed `success`
- Published: GitHub Release `Agent Project Template v4.5.1` is live at `https://github.com/Yokhan/agent-project-template/releases/tag/v4.5.1`
- Published: asset `agent-project-template-v4.5.1.tar.gz`, sha256 `41366ef81d541a787cde6efdb729edda900d0b65a89ec6d9be0541c8a886a0d9`

## Plan - v4.5.0 Semantic Intent Routing Release

### User Request
Доделать routing так, чтобы маршруты вызывались не только по ключевикам, а по смыслу задачи; это касается всех route categories. Поднять версию до `4.5.0` и зарелизить.

### Goal
Сделать Codex router устойчивым к разным формулировкам: exact regex остаётся быстрым слоем, но смысловые группы в `scripts/lib/codex-route-intents.js` должны вызывать правильные skills/gates даже без старого literal keyword.

### Product Goal Link
- Final outcome: downstream teams get agents that choose the right workflow from user intent instead of brittle keyword coincidence.
- Product/business priority: fewer misroutes, fewer correction loops, better marketing/product/security/design routing, lower support load, and safer releases.
- Current step: add semantic intent scoring, route output transparency, regression fixtures, validator anchors, version/release docs, and release gate.
- Quality bar preserved: no external LLM dependency in release infrastructure; no project-owned overlays touched; no weakening of text/platform, SOT, client-executor, progressive JPEG, design, or sync gates.
- Out of scope: replacing the router with a runtime embedding/LLM classifier.

### Current View
- Sharp now: `scripts/codex-route-task.js` reports `MATCHES: exact=... | semantic=...`; semantic-only fixtures route bugfix, security, design, product-UX, marketing, API, migration, and lessons correctly.
- Next sharpened layer: complete version bump/release docs and full release gate.
- Rough edge: semantic scoring is concept-based, not a true embedding model; future misroutes should update intent groups plus regression fixtures.
- Replan trigger: if semantic scoring creates broad false positives, tighten thresholds or split high-risk route concepts before release.

### Verification Results
- Passed so far: `node scripts/test-codex-routing.js`
- Passed so far: `node scripts/validate-production-standard.js` (`144` checks)
- Passed: `node scripts/validate-codex-skills.js`
- Passed: `node scripts/validate-codex-agents.js`
- Passed: `node scripts/validate-design-policy.js`
- Passed: `node scripts/test-design-policy.js`
- Passed: `node scripts/validate-agent-sot.js` with existing freshness warnings only
- Passed: `node scripts/validate-spec-kit.js`
- Passed: `node scripts/validate-text-policy.js` (`423` files scanned)
- Passed: `git diff --check`
- Passed: Git Bash `scripts/generate-project-spec.sh --write`
- Passed: Git Bash `scripts/scan-project.sh --report`
- Passed: Git Bash `scripts/validate-template.sh`
- Passed: Git Bash `scripts/check-drift.sh` with existing freshness warnings only
- Passed: Git Bash `scripts/test-hooks.sh`
- Passed: Git Bash `scripts/test-template.sh` (`135/135`)
- Passed: Git Bash `scripts/sync-agents.sh`
- Published: commit `41c563a4b715b4d76c0de4cb895ff33e006c050f`
- Published: tag `v4.5.0` on origin points to the same commit
- Published: GitHub Actions `Release Template` run `28737895466` completed `success`
- Published: GitHub Release `Agent Project Template v4.5.0` is live at `https://github.com/Yokhan/agent-project-template/releases/tag/v4.5.0`
- Published: asset `agent-project-template-v4.5.0.tar.gz`, sha256 `7aa4dbf93f3fca20b5172d31c462e5d7893fef40ac39780bb32cd074c62681c7`

## Plan - Main Agent File Control And Systemic Error Gate

### User Request
Добавить в основной агентский файл: проверку единого SOT, протокол конфликта двух SOT с обращением к пользователю и вариантами решений, больше практических примеров формулировки задач из референсов, и системный анализ ошибок вместо локального патча "здесь и сейчас".

### Goal
Сделать `AGENTS.md` более поведенческим: агент должен видеть, как формулировать задачи, как действовать при конфликте источников правды, и когда обязан искать системную причину ошибки.

### Product Goal Link
- Final outcome: downstream teams get agents that preserve the correct source of truth and fix root causes, not isolated symptoms.
- Product/business priority: fewer regressions, lower support load, safer template/project changes, faster acceptance because the agent asks for a decision when authority conflicts.
- Current step: update `AGENTS.md`, mirror critical shared behavior into `CLAUDE.md`/SOT docs, add validator anchors, and run focused checks.
- Quality bar preserved: no release tag until explicitly requested; no fake single-SOT resolution when authority is ambiguous; no bloated copy of long references into hot memory.
- Out of scope: redesigning the whole routing system or adding a new task runner.

### First Useful View
- Add hot rules for SOT conflict, task formulation examples, and systemic error analysis.

### Next Sharpened Layer
- Validate with agent SOT, production-standard, text-policy, and sync-agents checks.

### Rough Edges
- These rules improve behavior, but cannot prove every future agent will choose the right option without observing real tasks.

### Replan Trigger
- If `AGENTS.md` approaches the 32KB limit or validators become brittle, move examples into shared docs and keep only a compact pointer in hot memory.

### Current View
- Sharp now: `AGENTS.md` includes SOT Conflict Protocol, Task Formulation Examples, Systemic Error Analysis, and Thinking Tools Gate with TRIZ contradiction + plan reality check; `CLAUDE.md` mirrors the critical dual-agent behavior.
- Next sharpened layer: validate the route regression that previously misclassified the `AGENTS`/SOT request as `review`.
- Rough edge: this is implemented locally, but not released as a new tag.
- Replan trigger: if the examples feel too broad in real use, move detailed examples to a shared reference and keep only the command contract in hot memory.

### Audit Finding - Reasoning Tools Gap
- The previous exact request `усилить AGENTS основной файл... SOT... references... системный анализ...` routed as `review/MEDIUM` instead of `template/HIGH`, so it loaded only `codex-audit` and missed template/strategy/product-goal gates.
- TRIZ/contradiction thinking was present only indirectly through strategic-thinking references; no hot rule, Codex skill, or validator anchor required it.
- Ilyakhov examples lived in `brain/03-knowledge/communication/ilyakhov-planning-principles.md`; the earlier local recommendation said not to add the note directly to `AGENTS.md`. That conflicted with the later product-owner request for concrete examples in the main agent file, so the decision is now recorded as compact hot-path examples plus cold full note.
- Fixed locally: router patterns, routing tests, AGENTS/CLAUDE hot rules, Codex strategic-review skill, shared strategic-thinking rule, Ilyakhov note, and validators.
- Follow-up audit: Sun Tzu existed only in the old Claude strategic-review/full docs; Codex hot skill and validators did not require Sun Tzu/stratagem terrain thinking.
- Follow-up audit: marketing/business/communication skills existed, but marketing/positioning/funnel/offers in Russian or English routed to generic review instead of a marketer/GTM lens.
- Follow-up audit: release routing had a Russian false positive because bare `тег` matched inside `стратегический`, so strategic requests could incorrectly load release gates.
- Fixed locally: added marketing/GTM route, marketer gates, Sun Tzu/stratagem triggers, false-positive route regression tests, and validator anchors.

### Verification Results
- Passed: exact missed route now returns `template/HIGH` with template, product-goal, strategic-review, and SOT gates.
- Passed: TRIZ/agent-file route returns `template+review+strategy/HIGH`.
- Passed: `node scripts/test-codex-routing.js`
- Passed: `node scripts/validate-production-standard.js` (`112` checks)
- Passed: `node scripts/validate-agent-sot.js` with existing freshness warnings only
- Passed: `node scripts/validate-text-policy.js`
- Passed: `node scripts/validate-codex-skills.js`
- Passed: `git diff --check`
- Passed: Git Bash `scripts/validate-template.sh`
- Passed: Git Bash `scripts/test-template.sh` (`135/135`)
- Passed: Git Bash `scripts/sync-agents.sh`
- Passed: Git Bash `scripts/check-drift.sh` with existing freshness warnings only
- Not done: no commit, no version bump, no release tag.
- Follow-up Sun Tzu/marketing route patch passed: exact marketing route returns `marketing+review`, Sun Tzu/stratagem route returns `review+strategy` without release, and strategic overview no longer false-matches release.
- Passed after follow-up: `node scripts/test-codex-routing.js`, `node scripts/validate-production-standard.js` (`129` checks), `node scripts/validate-agent-sot.js`, `node scripts/validate-text-policy.js`, `node scripts/validate-codex-skills.js`, `git diff --check`, Git Bash `scripts/validate-template.sh`, Git Bash `scripts/test-template.sh` (`135/135`), Git Bash `scripts/sync-agents.sh`, Git Bash `scripts/check-drift.sh` with existing freshness warnings only.

## Plan - Progressive JPEG Client Control Gate

### User Request
Усилить интеграцию принципов из текстов Ильяхова, потому что сейчас не чувствуется даже принцип progressive JPEG. Дожать с умом; спорные моменты выносить пользователю на согласование.

### Goal
Сделать progressive JPEG не cold note, а обязательным hot-path поведением для M+/HIGH/template/product планов, статусов, перепланирований и closeout: агент сначала показывает полезную грубую картинку результата, затем следующий проверяемый слой, и заранее называет триггер перепланирования.

### Product Goal Link
- Final outcome: downstream teams get agents that keep the client in control during work instead of going silent until a final answer.
- Product/business priority: fewer correction loops, lower support load, faster acceptance decisions, and higher trust in agent-managed product/template work.
- Current step: add a compact progressive JPEG/client-control gate to shared rules and Codex skills, then cover it with validator smoke.
- Quality bar preserved: no broad natural-language ban-list, no fake exact deadlines, no weakening of v4.4.1 release-entrypoint checks, text/platform policy, or release gates.
- Out of scope: hard-validating every user-facing sentence or forcing exact calendar deadlines when the honest answer is only the next evidence checkpoint.

### Strategy
1. Promote the principle from `brain/03-knowledge/...` into `.claude/library/process/client-executor-contract.md`.
2. Wire it into `plan-first`, `product-goal-loop`, `writing`, and Codex planning/decomposition/strategy skills.
3. Add validator checks in `scripts/validate-production-standard.js` so future edits cannot silently remove it.
4. Run focused template checks before deciding whether to publish a patch release.

### Progressive JPEG Acceptance
- Plans must name the first useful visible result, not only internal preparation.
- Status updates must name current state, next visible result, evidence/checkpoint, and risk/replan trigger.
- Closeouts must distinguish what is sharp/verified now from what remains rough, deferred, or uncertain.
- Agents must not promise exact deadlines when they only know the next verifiable checkpoint.

### Plan B
If the new rule makes hot instructions too bulky or validators too brittle, keep the gate in shared rules and skills but remove broad text checks. Do not turn contextual writing guidance into a naive word ban.

### Current View
- Sharp now: progressive JPEG delivery is present in `AGENTS.md`, `CLAUDE.md`, shared client-executor/planning/product-goal/writing rules, and Codex product-goal/strategic/decompose skills.
- Next sharpened layer: run the full template release gate and publish `v4.4.2`.
- Rough edge: behavioral quality still depends on agents loading the route-selected rules; the validator proves the gate exists, not that every future answer will be perfect.
- Replan trigger: if release tests fail due to instruction size or brittle wording checks, reduce the hard validator to exact shared-rule/skill anchors instead of adding prose bans.

### Release Gate Results
- Passed: `node scripts/validate-production-standard.js`
- Passed: `node scripts/validate-codex-skills.js`
- Passed: `node scripts/validate-text-policy.js`
- Passed: `node scripts/test-codex-routing.js`
- Passed: `node scripts/validate-codex-agents.js`
- Passed: `node scripts/validate-agent-sot.js` with existing freshness warnings only
- Passed: `node scripts/validate-design-policy.js`
- Passed: `node scripts/test-design-policy.js`
- Passed: `node scripts/validate-spec-kit.js`
- Passed: Git Bash `scripts/validate-template.sh`
- Passed: Git Bash `scripts/test-template.sh` (`135/135`)
- Passed: Git Bash `scripts/check-drift.sh` with existing freshness warnings only
- Passed: Git Bash `scripts/test-hooks.sh`
- Passed: Git Bash `scripts/sync-agents.sh`
- Published: commit `e234c40dcaf10668341e0ef9b20181d518623ad3`
- Published: tag `v4.4.2` on origin points to the same commit
- Published: GitHub Actions `Release Template` run `28716527851` completed `success`
- Published: GitHub Release `Agent Project Template v4.4.2` is live at `https://github.com/Yokhan/agent-project-template/releases/tag/v4.4.2`
- Published: asset `agent-project-template-v4.4.2.tar.gz`, sha256 `e34362d4344e9f64578c2ef6f4b7a9be7457f8e54a97e5d7180954e333ff970d`

## Plan - v4.4.1 GitHub Entrypoint Patch Release

### User Request
Доработать GitHub/repo entrypoint: если агенту дали только ссылку на репозиторий, он должен понять актуальную стабильную версию, что скачивать, когда использовать tag, и когда нельзя брать `main`.

### Goal
Выпустить `v4.4.1`, где README, setup guide и release docs дают агентам короткий pinned-tag путь: `releases/latest` -> `vX.Y.Z` -> `sync-template.sh --from-git --ref <tag>`.

### Product Goal Link
- Final outcome: downstream teams can hand an agent only the repository URL and get a safe, reproducible template install or sync without guessing between `main`, archives, local paths, and release tags.
- Product/business priority: lower upgrade confusion and support load, fewer stale-template installs, safer downstream rollout, and faster adoption of released template behavior.
- Current step: update release-facing docs, add regression coverage for the GitHub entrypoint, bump patch version, and publish `v4.4.1`.
- Quality bar preserved: no sync boundary changes, no weakening of tracked-only payload, text/mojibake policy, Windows platform policy, design-policy gates, or client-executor evidence rules.
- Out of scope: changing the underlying sync algorithm or applying the new tag to every downstream project.

### Strategy
- Put the agent-safe instructions in README first, because GitHub renders it when only the repo link is shared.
- Keep `docs/TEMPLATE_RELEASES.md` as the deeper release contract.
- Update `SETUP_GUIDE.md` because it still contains an old pinned tag example.
- Add a `scripts/test-template.sh` smoke so future releases fail if the README loses `releases/latest`, pinned `--ref`, or the normal-project warning against `main`.

### Verification
- `node scripts/validate-text-policy.js`
- `node scripts/test-codex-routing.js`
- `node scripts/validate-agent-sot.js`
- Git Bash `scripts/validate-template.sh`
- Git Bash `scripts/test-template.sh`
- Git Bash `scripts/check-drift.sh`
- Remote tag/release verification after push.

### Release Gate Results
- Passed: `node scripts/validate-text-policy.js`
- Passed: `node scripts/test-codex-routing.js`
- Passed: `node scripts/validate-agent-sot.js` with existing freshness warnings only
- Passed: Git Bash `scripts/test-template.sh` (`135/135`)
- Passed: Git Bash `scripts/validate-template.sh`
- Passed: Git Bash `scripts/test-hooks.sh`
- Passed: Git Bash `scripts/sync-agents.sh`
- Passed: Git Bash `scripts/check-drift.sh` with existing freshness warnings only
- Passed: `node scripts/validate-codex-skills.js`
- Passed: `node scripts/validate-codex-agents.js`
- Passed: `node scripts/validate-production-standard.js`
- Passed: `node scripts/validate-design-policy.js`
- Passed: `node scripts/test-design-policy.js`
- Passed: `node scripts/validate-spec-kit.js`
- Published: commit `462e5b926ec6a964738a56fa4c90ef535eaf3de1`
- Published: tag `v4.4.1` on origin points to the same commit
- Published: GitHub Actions `Release Template` run `28706246735` completed `success`
- Published: GitHub Release `Agent Project Template v4.4.1` is live at `https://github.com/Yokhan/agent-project-template/releases/tag/v4.4.1`
- Published: asset `agent-project-template-v4.4.1.tar.gz`, sha256 `dd8ed1ed7ebf88bfd5f4f6caed7f3b9bb997a611fce69826ca3a99269d30256a`

### Plan B
If the release gate shows broad doc/version drift, keep the README entrypoint fix and reduce the release to a documentation-only patch. Do not change sync behavior in this patch.

## Plan - v4.4.0 Client Executor Accountability Release

### User Request
Release the client-executor accountability, anti-sycophancy, and no-fake-completion template update.

### Goal
Publish `v4.4.0`, where template-derived agents treat the user as the client/product owner and the agent as an accountable executor that must challenge harmful requests and prove completion with evidence.

### Product Goal Link
- Final outcome: downstream teams get agents that preserve final product intent while reducing false "done" reports and agreeable-but-wrong execution.
- Product/business priority: safer delivery, lower support load, higher trust in agent-managed product work, and fewer correction loops.
- Current step: bump version/release docs, regenerate `PROJECT_SPEC.md`, run release gates, commit, tag, and push `v4.4.0`.
- Quality bar preserved: existing v4.3.4 downstream-aware validation, text/mojibake policy, Windows platform policy, design-policy gates, sync trust boundaries, and release smoke remain active.
- Out of scope: applying `v4.4.0` to every downstream project after the tag.

### Verification
- Full local template gate before commit/tag.
- Git tag `v4.4.0` exists locally and is pushed to `origin`.
- GitHub release workflow is triggered by the pushed tag; remote asset completion is a follow-up check after CI finishes.

### Release Gate Results
- Passed: Git Bash `scripts/validate-template.sh`
- Passed: Git Bash `scripts/test-template.sh` (`134/134`)
- Passed: Git Bash `scripts/test-hooks.sh`
- Passed: Git Bash `scripts/sync-agents.sh`
- Passed: Git Bash `scripts/check-drift.sh` with existing freshness warnings only
- Passed: `node scripts/test-codex-routing.js`
- Passed: `node scripts/validate-codex-skills.js`
- Passed: `node scripts/validate-codex-agents.js`
- Passed: `node scripts/validate-production-standard.js`
- Passed: `node scripts/validate-design-policy.js`
- Passed: `node scripts/test-design-policy.js`
- Passed: `node scripts/validate-agent-sot.js`
- Passed: `node scripts/validate-spec-kit.js`
- Passed: `node scripts/validate-text-policy.js`
- Passed: Windows `setup.bat` smoke after staging tracked payload

## Plan - Client Executor Contract And Anti-Sycophancy

### User Request
Сделать так, чтобы агент воспринимал себя как ответственного исполнителя, пользователя - как заказчика, но не начал поддакивать, фальсифицировать работу или скрывать отсутствие проверок. Проверить научные источники и Reddit перед внедрением.

### Goal
Добавить в шаблон контракт "заказчик/исполнитель", который усиливает честное планирование, evidence-first статусы и профессиональное несогласие с пользователем, если запрос вредит результату.

### Product Goal Link
- Final outcome: downstream teams get agents that are accountable to the user's outcome, not merely agreeable or busy.
- Product/business priority: safer delivery, lower support load, fewer false "done" reports, higher trust in agent-driven product work.
- Current step: add a shared client-executor rule, wire it into product goal/planning/writing/skills, add regression checks, and preserve existing v4.3.4 gates.
- Quality bar preserved: no MVP/prototype drift, no weakening of mojibake/platform/design/release validators, no bloated startup instructions.
- Out of scope for this step: releasing a new tag unless explicitly requested after validation.

### Complexity Estimate
- Size: M
- Files to create: 2
- Files to modify: about 10
- Risk: HIGH because this changes agent operating behavior.

### File Architecture
- `.claude/library/process/client-executor-contract.md` - shared source of truth for the role contract, anti-sycophancy, and no-fake-completion rules.
- `brain/03-knowledge/communication/client-executor-anti-sycophancy-research.md` - cold research note with scientific/OpenAI/Reddit evidence and local conclusions.
- `.claude/library/process/product-goal-loop.md` - load the contract for M+ product/template work.
- `.claude/library/process/plan-first.md` - add plan reality and acceptance checkpoint rules.
- `.claude/library/technical/writing.md` - add evidence-first client-facing report rules.
- `.agents/skills/codex-product-goal/SKILL.md`, `.agents/skills/codex-strategic-review/SKILL.md`, `.agents/skills/codex-decompose/SKILL.md` - route relevant Codex work through the contract.
- `AGENTS.md`, `CLAUDE.md` - one short hot-memory pointer only.
- `scripts/codex-route-task.js`, `scripts/test-codex-routing.js`, `scripts/validate-production-standard.js`, `scripts/test-template.sh` - regression coverage.

### Implementation Order
1. Add research note and shared contract.
2. Wire the contract into product goal, plan-first, writing, and Codex skills.
3. Add routing and validator smoke coverage, including the prior `contract` misroute regression.
4. Run focused validation and report remaining release status.

### Risks And Mitigations
- Sycophancy risk -> require challenge-before-action when user request conflicts with evidence, safety, quality, or product outcome.
- Fake completion risk -> require fresh evidence before claiming done, tests passed, reviewed, researched, or released.
- Over-ceremony risk -> apply full contract to M+/HIGH/template/product work; keep XS tasks lightweight.
- Research overreach risk -> treat Reddit as qualitative signal, not best-practice evidence.

### Plan B
If routing changes create broad regressions, keep the shared rule and skill references, then defer router pattern changes to a patch. Do not weaken the no-fake-completion rule.

### Verification Results
- Passed: `node scripts/test-codex-routing.js`
- Passed: `node scripts/validate-production-standard.js`
- Passed: `node scripts/validate-codex-skills.js`
- Passed: `node scripts/validate-agent-sot.js`
- Passed: `node scripts/validate-text-policy.js`
- Passed: Git Bash `scripts/validate-template.sh`
- Passed: Git Bash `scripts/test-template.sh`
- Passed with existing freshness warnings only: Git Bash `scripts/check-drift.sh`

### Status
- Done: client-executor shared rule, anti-sycophancy/no-fake-completion gates, research note, skill wiring, router regression, and validator coverage.
- Not done: release commit/tag/push. This step intentionally integrated and verified the behavior without publishing a new template tag.

## Plan - v4.3.2 Screen Anatomy And Git Dry-Run Patch

### User Request
Preserve the valuable PA/BUFF IT screen anatomy design-system lessons, make the abstract v4.3 design rules more operational, release a new template version, and then update PA to that version.

### Goal
Release `v4.3.2`, where full-screen UI work must name root frame, base background, background composition, content frame, and overlay policy before styling, and where git-based template dry-runs show real downstream sync changes.

### Product Goal Link
- Final outcome: downstream agents can build and audit production UI from concrete screen contracts instead of vague design prose.
- Product/business priority: reduce design correction loops, broken Storybook contracts, layout drift, and unsafe template rollouts.
- Current step: merge screen anatomy into shared design rules and Codex skills, add regression checks, fix git dry-run preview, release the tag, and apply it to PA.
- Quality bar preserved: no MVP thinking, no loss of v4.3 register/mode/hardening rules, no `--force` downstream sync.
- Out of scope: rewriting every downstream project design system in this release.

### Verification
- `bash scripts/test-template.sh` must fail if screen anatomy/root-frame terms disappear.
- `bash scripts/test-template.sh` must prove `sync-template.sh --from-git --dry-run` shows a real sync preview.
- Full release gate must pass before tag.
- PA must update from the released tag with design conflicts resolved manually.

## Plan - v4.3.1 Documentation Drift Patch

### User Request
Доделать хвост после критической проверки `v4.3.0`: исправить README/CLAUDE drift и выпустить patch.

### Goal
Выпустить `v4.3.1`, где release-facing docs честно отражают shipped template surface, а release gate ловит будущие расхождения.

### Product Goal Link
- Final outcome: downstream teams can trust release docs when deciding whether and how to sync the template.
- Product/business priority: reduce upgrade confusion, support load, and rollout mistakes caused by inaccurate capability counts or nonexistent commands.
- Current step: fix README/CLAUDE counts/title, add regression check, bump patch version, and publish release.
- Quality bar preserved: no sync boundary changes, no weakening of `v4.3.0` design pipeline, text/mojibake and Windows-safe policies remain hard gates.
- Out of scope: reorganizing README architecture or adding new capabilities.

### Verification
- `bash scripts/test-template.sh` must fail on README/CLAUDE count drift.
- Full release gate must pass before tag.
- Windows `setup.bat` smoke confirms `4.3.1` generated manifest and project-owned design files.

## Plan - v4.3.0 Design Pipeline And Skill Upgrade

### User Request
Сделать следующую версию шаблона с обновлениями дизайн-пайплайна и design skills поверх уже выпущенного `v4.2.0`, не потеряв существующие проверки.

### Goal
Выпустить `v4.3.0`, где AI agents быстрее приходят к production design за счет register-aware решения, подробных design command modes, правильного порядка critique и regression coverage для KPI/conversion задач.

### Product Goal Link
- Final outcome: downstream teams get agents that can choose the right design operation, improve product UI faster, and keep visual decisions tied to user experience and app-specific business KPIs.
- Product/business priority: reduce design correction loops, protect conversion/activation/retention/loyalty-sensitive UI, and prevent support-load regressions from unclear product surfaces.
- Current step: add workflow/skill/reference improvements and release them as a minor template version.
- Quality bar preserved: `v4.2.0` hard design-policy validator, hook notifications, root `DESIGN.md`, text/mojibake policy, Windows-safe platform policy, and template sync ownership all remain active.
- Out of scope: adding subjective taste rules to the hard validator, adopting Impeccable as a mandatory dependency, or overwriting downstream `DESIGN.md` files.

### Architecture
- `.agents/skills/codex-design-workflow/references/design-command-modes.md` - detailed progressive-disclosure design mode and register reference.
- `.agents/skills/codex-design-workflow/SKILL.md` - short hot skill that routes M+ mode work to the reference.
- `.agents/skills/codex-domain-design-review/SKILL.md` - critique ordering and product/brand register review.
- `.agents/skills/codex-design-system-workflow/SKILL.md` - design-system register awareness.
- `.claude/library/domain/domain-design-pipeline.md` - shared register gate and critique ordering.
- `.claude/library/domain/domain-design-system.md` - register-aware design-system contract.
- `scripts/codex-route-task.js`, `scripts/test-codex-routing.js` - regression fix so `conversion KPI` does not match `version` release routing.
- `scripts/validate-production-standard.js`, `scripts/test-template.sh` - v4.3 contract enforcement.

### Verification
- `node scripts/validate-production-standard.js`
- `node scripts/validate-codex-skills.js`
- `node scripts/validate-codex-agents.js`
- `node scripts/test-codex-routing.js`
- `node scripts/validate-design-policy.js`
- `node scripts/test-design-policy.js`
- `node scripts/validate-agent-sot.js`
- `node scripts/validate-spec-kit.js`
- `node scripts/validate-text-policy.js`
- Git Bash `scripts/validate-template.sh`
- Git Bash `scripts/test-template.sh`
- Git Bash `scripts/check-drift.sh`
- Git Bash `scripts/test-hooks.sh`
- Git Bash `scripts/sync-agents.sh`

### Plan B
If the new design reference causes skill validation or sync payload regressions, keep the register gate in shared rules and defer the reference to a patch after reducing its surface. Do not weaken the existing `v4.2.0` validator/hook layer.

## Plan - v4.1.0 Product/Business Outcome Priority

### Goal
Make every plan and improvement start from product-user value and app-specific business outcomes before technical optimization.

### Product Goal Link
- Final outcome: template-derived projects get agents that improve real product outcomes, not just code shape or internal tooling.
- Current step: add shared rules, entrypoint summaries, skills, router metadata, validator checks, and release docs for the priority contract.
- Quality bar preserved: concise hot memory, shared SOT, downstream sync compatibility, text/platform policy, and release verification.
- Out of scope for this step: applying the released template to downstream projects.

### Complexity Estimate
- Size: M
- Files to modify: about 15
- Risk: HIGH because this changes agent operating behavior and release metadata.

### File Architecture
- `.claude/library/product/production-product-standard.md` - canonical rule for product/business outcome priority.
- `.claude/library/process/product-goal-loop.md` - plan/goal artifact contract.
- `AGENTS.md`, `CLAUDE.md` - concise hot-memory pointers.
- `.agents/skills/codex-product-goal/SKILL.md`, `.agents/skills/codex-strategic-review/SKILL.md` - Codex skill gates.
- `scripts/codex-route-task.js`, `scripts/validate-production-standard.js`, `scripts/test-codex-routing.js` - enforcement and smoke coverage.
- `tasks/goal.md`, `templates/project-starter/tasks/goal.md` - durable goal template fields.
- README/release/checklist/version files - `4.1.0` release alignment.

### Implementation Order
1. Update shared product/goal rules.
2. Update agent entrypoints and Codex skills.
3. Add router/validator smoke coverage.
4. Update version/release docs.
5. Run release gate and publish `v4.1.0`.

### Plan B
If router changes create broad regressions, keep route output backwards-compatible and enforce the rule through `validate-production-standard.js` plus shared rules, then defer deeper routing changes to a later patch.

## Plan - v4.1.1 GitHub Actions Node 24 Runtime

### Goal
Remove the upcoming GitHub Actions Node 20 runtime risk from template-owned release and validation workflows before downstream teams inherit it.

### Product Goal Link
- Final outcome: template-derived projects can validate and release without CI runtime deprecation warnings or surprise runner migration failures.
- Current step: update official GitHub actions, Node version, CI template defaults, regression smoke, and release docs.
- Quality bar preserved: release workflow keeps `contents: write` only where needed and disables unnecessary package-manager cache.
- Out of scope for this step: changing project app dependencies or introducing new CI providers.

### Complexity Estimate
- Size: S
- Files to modify: about 9
- Risk: HIGH because release workflow changes must be proven by a real tag-triggered GitHub run.

### File Architecture
- `.github/workflows/release-template.yml` - source-only release workflow.
- `.github/workflows/validate-template.yml` - shipped validation workflow.
- `.github/ci.yml.template` - optional starter CI template.
- `scripts/test-template.sh` - regression check for Node 24-compatible workflow actions.
- README/release/checklist/version files - `4.1.1` release alignment.

### Implementation Order
1. Update workflows/templates to Node 24-compatible official actions.
2. Add smoke check against old Node 20 action/runtime references.
3. Bump patch version and regenerate project spec.
4. Run release gate, then tag and verify GitHub release.

### Plan B
If latest major actions introduce runner or credential behavior changes, use the smallest Node 24-compatible major that avoids the warning and preserves current workflow behavior.

## Queued Plan - v4.2.0 Design Production Upgrade

### User Request
Подробно спланировать внедрение улучшений из Impeccable/Design.md research так, чтобы ускорить достижение production design quality с AI agents и не потерять уже сделанные наработки шаблона.

### Goal
Добавить в template v4.2.0 операционный слой production design QA: долговременный design context, командные режимы design skill, deterministic design checks, browser/visual hardening и release gates.

### Product Goal Link
- Final outcome: downstream teams get agents that produce and verify product UI faster, stay on brand, preserve user value/business KPI priority, and avoid AI-design drift.
- Product/business priority: improve downstream delivery speed, product-user trust, conversion/activation/retention-sensitive UI quality, lower redesign/support load, and reduce repeated design correction loops.
- Current step: plan and then implement template-owned design workflow improvements without changing downstream project-owned files.
- Quality bar preserved: v4.1.0 product/business priority stays first; v4.1.1 runtime release work remains intact; text/mojibake/platform policies remain hard gates.
- Out of scope for this step: adopting Impeccable as a mandatory external dependency, replacing Figma workflow, changing user-level Codex config, or applying the upgrade to every downstream project.

### Preservation Gates
- Do not replace or weaken `.claude/library/product/production-product-standard.md`.
- Do not replace the existing UI Subtraction Gate; extend it only when the extension improves user decision clarity.
- Do not remove token-first, component-first, 8-state, Storybook/equivalent, rendered-geometry, or product UX audit requirements.
- Keep `tasks/goal.md` product/business outcome priority unchanged unless the final outcome truly changes.
- Preserve `project-*` overlays and downstream-owned files in template sync.
- All new scripts must be cross-platform Node or use existing platform helpers; no raw Linux-only `/tmp`, `mktemp`, `uname`, or shell assumptions.
- All tracked text must stay UTF-8 without BOM, with no mojibake, replacement characters, or mixed line endings.
- New design checks must support a baseline/ignore path so known intentional exceptions do not create permanent noise.
- New design hooks and validators must notify the user clearly when they fire: rule id, file, evidence, why it matters for product/design quality, and how to tune or ignore with a reason.

### Resolved Decisions
- Design context location: root `DESIGN.md` in generated projects for best Google DESIGN.md and agent-tool compatibility.
- Validator mode: hard gate in v4.2.0, with user-facing notifications and tuning data whenever a rule fires.
- Hook policy: default Codex hook for UI edits in v4.2.0, wired only to conservative deterministic checks and cross-platform Node paths.
- Release order: finish and publish `v4.1.1` first, then start `v4.2.0`. `v4.1.1` means the already-planned GitHub Actions Node 24 patch release: run the release gate, commit/tag/push, and verify the GitHub release workflow no longer emits Node 20 runtime warnings.

### Architecture
- `templates/project-starter/DESIGN.md` - root starter design context following a lightweight Google DESIGN.md-compatible shape.
- `templates/project-starter/tasks/goal.md` - link product/business priority to design context without duplicating it.
- `.claude/library/domain/domain-design-pipeline.md` - add design context, command-mode routing, hardening, and deterministic QA gates.
- `.claude/library/domain/domain-design-system.md` - add design token contract expectations for DESIGN.md, Storybook, and visual regression.
- `.agents/skills/codex-design-workflow/SKILL.md` - add submodes: shape, craft, audit, critique, distill, harden, polish, adapt, clarify, typeset/layout.
- `.agents/skills/codex-design-system-workflow/SKILL.md` - add DESIGN.md/token extraction/update responsibilities.
- `.agents/skills/codex-product-ux-audit/SKILL.md` - connect design changes to activation, conversion, retention, loyalty, support-load, or app-specific KPI.
- `scripts/validate-design-policy.js` - deterministic starter validator for universal design rules.
- `.codex/hooks.json` template/starter hook coverage where applicable - default UI-edit hook that runs the design validator after relevant edits.
- `scripts/validate-production-standard.js` - ensure v4.2 design gates do not regress product/business priority.
- `scripts/test-template.sh` and Windows-equivalent coverage where present - include new starter files and design validator smoke.
- `docs/TEMPLATE_RELEASES.md`, `docs/RELEASE_CHECKLIST.md`, `README.md`, version files - document v4.2.0 release and downstream migration.

### Implementation Slices

#### Slice 1 - Design Context Contract
Goal: give agents a durable visual source of truth before they design.

Tasks:
- Define where template-owned design context lives and how it coexists with `tasks/goal.md`.
- Add starter `DESIGN.md` with machine-readable tokens plus human-readable rules.
- Add rules for scan mode versus seed mode:
  - scan mode extracts existing tokens/components when a project has UI code;
  - seed mode asks only the minimum strategic visual questions when no UI exists.
- Require explicit user confirmation before overwriting an existing downstream `DESIGN.md`.

Verification:
- Template validator confirms starter design context is shipped.
- Text policy passes.
- Documentation explains that `tasks/goal.md` owns product/business intent while `DESIGN.md` owns visual decisions.

#### Slice 2 - Design Skill Command Modes
Goal: make design work faster by naming the exact operation instead of running one broad manual every time.

Tasks:
- Extend `codex-design-workflow` with command-like modes:
  - `shape`: clarify product job, surface, constraints, and visual lane before edits.
  - `craft`: implement a confirmed UI change end to end.
  - `audit`: technical quality scan for accessibility, responsiveness, token drift, and anti-patterns.
  - `critique`: UX/design review with severity, user impact, and next action.
  - `distill`: remove, collapse, or move UI before adding anything.
  - `harden`: edge cases, i18n, overflow, loading/error/empty, long data, slow/offline states.
  - `polish`: final alignment, spacing, density, hierarchy, and visual consistency pass.
  - `adapt`: mobile/desktop viewport and touch-target adaptation.
  - `clarify`: labels, error copy, instructions, and support/empty state text.
  - `typeset/layout`: typography and spatial rhythm fixes.
- Keep modes as local workflow language first; do not add a new command runner unless validation needs it.

Verification:
- `node scripts/validate-codex-skills.js`
- Route tests prove design requests still resolve to the design pipeline and product goal gates.

#### Slice 3 - Deterministic Design Policy Validator
Goal: catch repeated design failures without relying only on LLM taste.

Tasks:
- Add `scripts/validate-design-policy.js` as a hard-gate validator for conservative deterministic checks.
- Include user-facing notification output for every finding:
  - severity and rule id;
  - file and evidence;
  - product/design impact;
  - exact next action;
  - ignore/baseline instruction requiring a reason.
- Start with universal checks only and do not add subjective taste rules until fixtures prove low false-positive risk:
  - tracked UI files do not introduce obvious raw hardcoded visual values when tokens exist;
  - no nested-card patterns in known UI examples;
  - no gradient text default;
  - no obvious text overflow fixtures;
  - no skipped heading fixtures where static HTML is available;
  - no mojibake in design context files;
  - no platform-unsafe shell paths in new design tooling.
- Add `design-policy.ignore` or equivalent baseline with reason and optional expiry.
- Add default Codex UI-edit hook after the validator is stable enough to run in the local template gate.
- Hook must be cross-platform Node, scoped to relevant UI/design files, and must not assume Linux shell behavior.

Verification:
- Validator has passing and failing fixtures.
- `node scripts/validate-design-policy.js`
- `node scripts/validate-text-policy.js`
- `bash scripts/test-template.sh`
- Manual hook smoke confirms a UI fixture edit triggers a visible design-policy notification.

#### Slice 4 - Browser/Visual Hardening Gate
Goal: make "looks good" mean rendered evidence, not static confidence.

Tasks:
- Add a required hardening checklist for M+ UI work:
  - desktop and mobile screenshots;
  - `getBoundingClientRect()` or equivalent geometry checks for important controls;
  - long text and long-word stress;
  - empty/loading/error states;
  - slow/offline or API error behavior where relevant;
  - 200 percent zoom/text scaling check when feasible;
  - reduced-motion behavior for animated surfaces.
- Document when Playwright screenshot snapshots, Storybook visual tests, or Chromatic are recommended.
- Keep heavyweight visual regression optional unless the project already uses it.

Verification:
- Design workflow docs require evidence and residual doubt.
- Existing design-system skill still requires Storybook/equivalent and rendered geometry.

#### Slice 5 - Template Sync And Release Integration
Goal: ship v4.2.0 without breaking downstream sync or current release flow.

Tasks:
- Update sync allowlists/manifests for new template-owned files only.
- Preserve `project-*` overlays.
- Update release docs with migration notes:
  - new projects get starter `DESIGN.md`;
  - existing projects should not have their design context overwritten;
  - deterministic design policy checks are hard gates in the template;
  - existing projects can tune noise with explicit baseline/ignore entries instead of disabling the gate.
- Bump version to `4.2.0`.
- Keep v4.1.1 Node 24 workflow changes intact.

Verification:
- `node scripts/validate-production-standard.js`
- `node scripts/validate-codex-skills.js`
- `node scripts/test-codex-routing.js`
- `node scripts/validate-agent-sot.js`
- `node scripts/validate-text-policy.js`
- `node scripts/validate-design-policy.js`
- `bash scripts/validate-template.sh`
- `bash scripts/test-template.sh`
- `bash scripts/check-drift.sh`

### Approach Choice
Chosen approach: implement an internal template-native design QA layer inspired by Impeccable and Google DESIGN.md.

Rejected alternative: make Impeccable a mandatory dependency. Reason: it adds external release/runtime risk, possible subjective false positives, and cross-platform hook risk. The template should first encode stable invariants locally and leave external tools optional.

Rejected alternative: only add more prose to the design skill. Reason: prose improves intent but does not catch regressions. The missing production-speed layer is deterministic checks plus durable context.

### Rollback Plan
- Each slice lands in its own commit.
- If validator noise is too high, do not disable the whole gate; demote or remove the noisy rule, add a focused fixture, or require an explicit ignore/baseline entry with a reason.
- If root `DESIGN.md` causes sync ambiguity, keep root location for new projects and add stricter overwrite protection for existing projects instead of silently moving the file.
- If route changes regress existing behavior, keep command modes in skills only and defer router expansion.

### Remaining Clarifications During Implementation
- Which first validator rules are objective enough for hard-fail status in the initial commit?
- Which file patterns count as UI/design files for the default hook without scanning unrelated backend/docs changes?
- What exact notification format is least noisy while still giving enough evidence to tune rules quickly?

### First Safe Slice
Completed: `v4.1.1` was already published. v4.2.0 Slice 1 through Slice 4 are implemented locally: root `DESIGN.md`, project-owned `design-policy.ignore`, design command modes, hard design policy validator, default Codex hook notification, and browser/visual hardening gate.

### Release Gate Status
- Passed: `node scripts/validate-production-standard.js`
- Passed: `node scripts/validate-codex-skills.js`
- Passed: `node scripts/validate-text-policy.js`
- Passed: `node scripts/test-codex-routing.js`
- Passed: Git Bash `scripts/test-template.sh`
- Passed: Windows `setup.bat` smoke for `DESIGN.md` and `design-policy.ignore` project-owned manifest categories.
- Remaining before tag: full final release gate after version/project spec regeneration.
