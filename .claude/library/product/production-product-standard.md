# Production Product Standard

## Rule
Treat every real product task as work toward the final shipped product, not as an MVP, demo, prototype, placeholder, or "good enough for now" version.

MVP/prototype thinking is banned by default for real product work.

The agent may still deliver bounded current steps because context, time, and risk are finite. The current step must preserve the final product goal and must not introduce decisions that lower the intended product quality without explicit user approval.

## Required Product Bar

Before changing state for product work, state or infer:

- Final user outcome: what the end user should be able to do when the product is complete.
- Product qualities: safety, reliability, UX, performance, privacy, accessibility, maintainability, domain tone.
- Current step: the smallest valuable reversible step toward that outcome.
- Dependencies: services, auth, data, design system, docs, deployment, or external contracts.
- Non-goals: what is intentionally not handled in this step without pretending it is done.
- Verification: evidence that proves the user outcome improved, not only that code changed.

## Forbidden Defaults

Do not use these as internal justification:

- "MVP is enough."
- "Prototype-quality is acceptable."
- "We'll polish later" when the issue affects core UX, data safety, security, or architecture.
- "HTTP 200 means it works."
- "The screenshot looks close" without checking interaction, states, responsiveness, and real content.
- "The user asked for X, so ignore adjacent broken flow Y" when Y blocks the same user journey.

Allowed exception: the user explicitly asks for a throwaway experiment, spike, mock, or disposable draft. Even then, label it as such and prevent it from being confused with production.

## Current Step Contract

A bounded step is acceptable when it is honest:

- It moves one real product capability forward.
- It does not create fake dead-end UX.
- It keeps future production constraints visible.
- It has a rollback or follow-up path.
- It reports remaining gaps as gaps, not as completed product behavior.

## Domain Examples

### UI/Product
- Build from design system tokens and components.
- Include default, hover, active, focus, disabled, loading, error, and empty states where applicable.
- Verify full flows: entry, success, error, empty data, return navigation, and mobile/desktop.
- Do not create a dashboard or account page that has no useful user action.

### Auth/Identity
- Privacy-first by default. Ask why each identity field is needed.
- Do not require email, first name, last name, phone, or personal data unless the product contract requires it.
- Verify rendered forms, locale, redirect behavior, logout, expired session, and recovery.

### Docs
- Docs are product surfaces when linked from the product.
- Verify route, layout, assets, search/navigation, 404 behavior, and ingress links.
- Do not mask broken docs with generic fallback pages.

### Games
- Design the full intended gameplay loop and progression economy first.
- A current implementation step may cover one mechanic, but it must not bake in shallow progression or fake pacing as the final model.

## Closeout Requirement

Final reports must say:

- What changed for the user.
- Which product quality improved.
- What was verified.
- What remains intentionally incomplete.
- Confidence and doubt.
