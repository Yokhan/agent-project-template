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
- v4.2.0 has been published as the production design QA minor release.
- v4.3.0 has been published as the design pipeline and skill upgrade minor release.
- v4.3.1 has been published as the documentation drift patch release.
- v4.3.3 has been published as the design fixture sync patch release.
- v4.3.4 has been published as the downstream production-standard validator patch release.
- v4.4.0 has been published as the client-executor accountability minor release.
- v4.4.1 has been published as the GitHub entrypoint patch release.
- v4.4.2 progressive JPEG client-control patch release is in progress.

## Immediate Next Step
- Finish the v4.4.2 release gate, commit, tag, push, and verify the GitHub release.

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
