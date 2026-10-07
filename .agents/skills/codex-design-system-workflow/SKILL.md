---
name: codex-design-system-workflow
description: "Create or substantially rework a broad design system, or make a focused change to an existing system layer. Use for tokens, component libraries, Storybook, and UI contracts; small layer edits need only relevant checks."
---

# Codex Design System Workflow

Read:

- `.claude/library/domain/domain-design-system.md`
- `.claude/library/domain/domain-design-pipeline.md`
- `.agents/skills/codex-design-workflow/references/design-command-modes.md` when the system change affects register, mode selection, hardening, polish, or critique.
- `_reference/tool-registry.md`

## Choose the scope

Use the complete system flow for a new broad design system or a substantial
change to its overall contract. For a bounded edit to an existing layer, inspect
that layer and its direct dependencies, preserve established conventions, and
verify the changed contract; do not rebuild every layer or produce unrelated
system documentation.

Future-facing slots, states, handlers, events, or flags belong only when the
accepted current change depends on that known contract. Keep incomplete
behavior clearly unavailable, dev-only, or safely no-op.

## Broad system flow

1. Foundations: confirm root `DESIGN.md` when present, choose product or brand register, then tokens for color, typography, spacing, radius, motion, layout, and control sizes.
2. Atoms: confirm primitive controls and states.
3. Molecules: compose from atoms and tokens only.
4. Organisms: compose from lower layers and expose a dependency trace.
5. Templates: define responsive layout and density rules.
6. Screen anatomy: every full screen starts with root frame, base background, independent background composition, content frame, and optional overlay layer before product components are placed.
7. Resolve any material open contract before implementing beyond accepted scope.
8. Replace superseded variants and stories where this change makes them
   obsolete; time-box migration scaffolding that must remain temporarily.
9. Add screens/stories that make the system's in-scope behavior inspectable,
   using representative product data and navigation states.
10. Verify rendered behavior and token/geometry alignment for important
    components; use the checks proportionate to the affected contract.

## No Raw Values

If a needed value has no token, stop and add/request the token. Do not invent local values inside larger components.

Root `DESIGN.md` is a project-owned visual context file. Update it when the
accepted change materially changes visual direction, token meaning, component
behavior, or guardrails; do not use template sync to overwrite an existing
project `DESIGN.md`.

## Required Stories

- Foundations tables: typography, spacing, radius, motion, layout.
- Atom states: default, hover, active, focus, disabled, loading, error, empty where applicable.
- Atom isolation: stories show the atom itself without unrelated frames, labels, or decorative wrappers unless the wrapper is part of the atom contract.
- Molecule composition traces.
- Organism and template responsive examples.
- Screen anatomy tables for full-page templates and screens.
- Product forms, account/auth, empty/loading/error, service gateway, docs/help surfaces when relevant.
- Stories or notes for future capabilities only when the accepted current
  contract depends on them and they are stubbed, feature-flagged, no-op, or
  dev-debug only.
- Cleanup notes for superseded variants/stories/flags affected by the change,
  and removal conditions for any temporary migration scaffold.

## Screen Anatomy Contract

Every screen, template, and full-page Storybook example must declare:

- Root frame: viewport/min-height, isolation, overflow, base surface, and base text color.
- Base background: flat fill, gradient, image/media slot, or another approved surface token.
- Background composition: decorative/media layer independent from content spacing.
- Content frame: safe-area, responsive padding, max-width/grid, column model, and allowed organisms.
- Overlay layer: modals, drawers, toasts, sticky actions, only when the scenario needs them.

Bounded vs edge-to-edge rule:

- Visible bounded surfaces (glass, cards, panels, modals, framed media) own internal padding, radius, border/effect tokens, and content-slot rules.
- Edge-to-edge content sections use the page grid/content frame directly and do not get fake card padding.
- If a screen cannot name these layers, stop before styling. Do not place headers, heroes, forms, service cards, or docs content directly into a naked `main` or story shell.
