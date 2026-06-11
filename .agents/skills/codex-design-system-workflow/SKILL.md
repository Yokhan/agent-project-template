---
name: codex-design-system-workflow
description: "Build, audit, or extend production design systems with foundations, atoms, molecules, organisms, templates, Storybook, token tables, composition traces, and rendered geometry checks. Use for design-system, tokens, Storybook, component library, or UI contract work."
---

# Codex Design System Workflow

Read:

- `.claude/library/domain/domain-design-system.md`
- `.claude/library/domain/domain-design-pipeline.md`
- `_reference/tool-registry.md`

## Required Flow

1. Foundations: confirm tokens for color, typography, spacing, radius, motion, layout, and control sizes.
2. Atoms: confirm primitive controls and states.
3. Molecules: compose from atoms and tokens only.
4. Organisms: compose from lower layers and expose a dependency trace.
5. Templates: define responsive layout and density rules.
6. Screens/stories: use real product data and navigation states.
7. Verification: Storybook/browser screenshots plus computed-style and bounding-box checks.

## No Raw Values

If a needed value has no token, stop and add/request the token. Do not invent local values inside larger components.

## Required Stories

- Foundations tables: typography, spacing, radius, motion, layout.
- Atom states: default, hover, active, focus, disabled, loading, error, empty where applicable.
- Molecule composition traces.
- Organism and template responsive examples.
- Product forms, account/auth, empty/loading/error, service gateway, docs/help surfaces when relevant.
