# Product Goal

## Final Outcome
`agent-project-template` generates and maintains production-grade agent-ready projects where Codex and Claude preserve final product intent, route work consistently, plan risky work, and verify user-facing outcomes instead of shipping prototype-quality drift.

## Quality Bar
- UX: agents verify full user journeys, dead ends, states, and return paths for product surfaces.
- Safety: high-risk work uses explicit route, risk, rollback, and verification gates.
- Privacy: auth and identity tasks minimize personal data and require explicit field justification.
- Reliability: template scripts and validators fail on broken contracts before downstream sync.
- Performance: generated projects avoid unnecessary startup/context bloat.
- Accessibility: design and UI work includes keyboard, focus, contrast, motion, and responsive checks.
- Design system: tokens, components, composition trace, Storybook, and rendered geometry gates are required.
- Data/API: contracts, schemas, and validation are part of product quality.
- Docs: linked docs are treated as product surfaces and verified by route/layout/assets/404 checks.
- Domain tone: plans, audits, and reports match the user's language and project vocabulary.

## Current Step
Ship the v4 production product standard, goal loop, routing, skills, and validators in the template source repo.

## Dependencies
- Shared `.claude/library/` rules.
- Codex skills in `.agents/skills/`.
- Template validation scripts.
- Agent SOT validation.
- Downstream sync release flow.

## Open Risks
- Router expansion could become too broad if gates are not kept backwards-compatible.
- More rules can increase startup noise if entrypoints are not concise.
- Downstream projects still need release-tag sync after the template is ready.

## Out Of Scope For Current Step
- Applying the new template to every downstream project.
- Reworking each downstream product UI.
- Changing user-level Codex or IDE model/sandbox defaults.
