# Product Goal

## Final Outcome
`agent-project-template` generates and maintains production-grade agent-ready projects where Codex and Claude preserve final product intent, route work consistently, plan risky work, and verify user-facing outcomes instead of shipping prototype-quality drift.

## Product/Business Priority
The primary user is the downstream product team or operator using a generated project. Every plan or improvement should first improve that team's product-user experience or app-specific business outcomes: safer delivery, faster path to value, adoption, retention, lower support load, revenue instruments, loyalty, conversion, activation, or the KPI the application actually uses. Technical cleanup is justified only when it directly protects or unlocks those outcomes.

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
- Progressive JPEG truth: every implementation slice completes the product's real purpose end to end at its declared detail level. Architecture, status, tests, debug markers, mocks, and callable stubs may support a slice but cannot impersonate the product outcome.
- Change strategy: compatibility protects verified user, data, and public
  contracts rather than old implementation. Causal architecture evidence found
  during reading triggers an evidence-backed destination and transition
  decision before the first patch; a second failed repair is the fallback gate.

## Current Step
The evidence-backed Change Strategy Gate, pre-repair discovery activation, and
decision-to-resume lifecycle are implemented. The current state-changing step
is the approved `v4.8.0` release: pass local and remote gates, bind one tag to
the verified commit, publish it, and verify the authoritative GitHub Release.

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
- Codex CLI surfaces can expose different multi-agent runtimes; automatic fan-out must not assume a custom model profile was applied without runtime evidence.
- Glavred recreation is a separate product task; this release must keep the provider explicitly not configured and not run.

## Out Of Scope For Current Step
- Applying the new template to every downstream project.
- Reworking each downstream product UI.
- Changing user-level Codex or IDE model/sandbox defaults.
- Treating planning, research, architecture-only work, or a debug harness as a delivered product slice.
- Recreating, proxying, or bundling Glavred.
- Publishing or tagging the Change Strategy Gate before its behavior and
  downstream sync contract are verified.
