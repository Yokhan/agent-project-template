# Current Task - Template v4 Production Product Standard

Last updated: 2026-06-11

## Goal
Prepare `agent-project-template` v4 so agents stop treating real product work as MVP/prototype work and instead operate from a persistent product goal, current step, dependencies, and verification contract.

## User Wants
- No MVP/prototype mindset unless the user explicitly asks for a throwaway experiment.
- A `/goal`-like operating model: keep the final product outcome, quality bar, dependencies, open questions, and current work slice visible across tasks.
- Do not invent "final product slices" as a rigid concept. Slices already happen because agent turns and context are limited; the important contract is that every slice preserves the final product goal and does not lower the intended quality.
- Plans, audits, and reports must use the language of the user's request.
- Lessons from the last week across BUFF IT, design system, auth, CallService, SmartCart, docs, and GATES must become reusable template behavior.

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
- v4 production standard, product goal loop, design-system workflow, product UX audit, and cross-project lesson promotion are implemented in shared rules, Codex skills, router, starter files, and validators.
- v4.0.2 has been published as the sync-boundary hotfix.
- v4.0.3 is in progress as a patch release for fail-hard text/platform policy, no-mojibake gates, Windows-safe shell helpers, generalized UI Subtraction Gate, and faster sync regression smoke.
- Verified green so far: `node scripts/validate-text-policy.js`, `node scripts/validate-codex-skills.js`, `node scripts/test-codex-routing.js`, `bash scripts/validate-template.sh`, `bash scripts/test-template.sh`.

## Immediate Next Step
- Finish the v4.0.3 release gate, commit, tag, push, and verify the GitHub release workflow.
