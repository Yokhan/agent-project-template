# Current Task - Template v4 Production Product Standard

Last updated: 2026-06-11

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
- v4.2.0 design production upgrade is implemented locally and is in release-gate validation.

## Immediate Next Step
- Finish the v4.2.0 release gate, commit, tag, push, and verify the GitHub release workflow.

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
