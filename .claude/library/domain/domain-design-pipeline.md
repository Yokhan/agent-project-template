# Domain: Design (Product/UX/Visual/Game)

Use this guide to protect product fit, visual coherence, accessibility, and
implementation quality. Choose the checks that match the requested outcome and
changed surface; a small UI edit does not need a full design-process ritual.

## Context and outcome

- Use the active project goal or task artifact for user value, product priority,
  and accepted scope when one exists. Preserve accepted product waves and plans;
  design tasks and technical checkpoints do not become product waves by
  themselves.
- Read the root `DESIGN.md` when present. It is project-owned visual direction;
  preserve it unless the user asks to change that direction. If broad UI work
  lacks enough visual context, ask only for what materially affects the result.
- Identify the affected user job, surface, and constraints. Choose product,
  brand, or mixed register when that choice changes the design; do not force a
  formal register declaration for a self-evident minor edit.
- Prefer the smallest useful path: focused edit, screen/flow design, review, or
  new design system. State assumptions only when they materially shape the
  outcome.

## Durable design constraints

### Tokens and components

- Reuse the project's tokens, styles, and components when they fit. Do not
  introduce one-off visual values when an appropriate token exists.
- If the accepted change needs a value that has no token, add or request a
  suitable token; avoid hiding a new design decision inside an unrelated
  component.
- Compose with existing components where practical. Create or extend a
  component when the pattern or contract warrants it; raw shapes are not a
  substitute for an available component.
- Keep a useful dependency/composition trace for reusable components. The trace
  should clarify relevant token, child-component, state, and responsive
  dependencies, not become paperwork for a one-off adjustment.

### Product fit and subtraction

Before adding a panel, control, persistent list, or layer, check whether it
serves the current user job, duplicates another signal, belongs in this mode,
or can be removed, collapsed, or moved to where it is actionable. Keep the
primary action clear and do not imply incomplete behavior is production-ready.

### Full-screen structure

For a new or materially reworked full screen, make its layout legible: root
frame and base surface, any independent background composition, content frame,
and overlays only when needed. Bounded cards/panels own their internal spacing;
edge-to-edge sections align to the page grid rather than receiving fake card
wrappers. A focused edit to an existing screen need only revisit the layers it
affects.

### States, accessibility, and copy

- Cover the interactive states relevant to the control and user flow (such as
  focus, disabled, loading, error, or empty); do not enumerate inapplicable
  states just to complete a checklist.
- Preserve keyboard access, visible focus, understandable labels, adequate
  contrast, responsive text/layout, and reduced-motion behavior where relevant
  to the surface. Validate against the project's accessibility target and
  applicable platform guidance.
- Apply the Public Copy Gate in
  `.claude/library/technical/writing.md` to customer-facing UI, metadata, and
  accessibility text. Verify the real action before presenting success.

## Choosing design depth

Use the mode that matches the request:

- `shape`: resolve material uncertainty about user, job, scope, or visual lane.
- `craft`: implement the accepted change using the existing system.
- `audit` or `critique`: report material issues with impact and evidence.
- `distill`: remove, collapse, or move UI before considering additions.
- `harden`: exercise relevant data, state, localization, network, and motion
  edge cases.
- `polish`, `adapt`, `clarify`, or `typeset/layout`: make the corresponding
  focused refinement.

The command-mode reference describes the modes in more detail. A mode selects
useful depth; it does not replace the user's scope or the project's quality bar.

## Evidence and verification

Choose checks that can establish the claim for the changed surface. For visual
or interactive work, use a rendered browser, Storybook, design-tool preview, or
other appropriate view when available. Check the relevant viewports, content
length, focus path, contrast, important control geometry, and states. For a
small change, a focused visual or code check may be enough; for a broad or
high-risk surface, expand coverage to likely failure paths.

If rendered evidence is unavailable, say what could not be checked and the
resulting limitation. Do not call a surface production-ready on the strength of
a mockup or source inspection alone. Report confidence or the main uncertainty
only when it would help the reader judge a material decision.

## Design-system work

Use `.claude/library/domain/domain-design-system.md` and
`$codex-design-system-workflow` when creating a new broad system or substantially
reworking its contract. A bounded change to an existing layer can use the
focused checks relevant to that layer; it does not need to rebuild or document
every layer. Add future-facing seams only when the accepted current change
depends on that contract. See also `.claude/library/technical/atomic-reuse.md`
and `_reference/tool-registry.md` when relevant.

## Further reading

For deeper review prompts, use only the relevant discipline in
`.claude/skills/domain-design-review/references/design-failure-patterns.md`.
The review skill also names foundational books for product, visual, and game
design. These are optional context, not a checklist for every task.
