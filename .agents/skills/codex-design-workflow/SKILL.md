---
name: codex-design-workflow
description: "Design and implement UI, UX, CSS, frontend screens, design systems, mockups, and game UI with token-first and component-first gates. Use for design, visual polish, responsive UI, accessibility, or Figma-adjacent work."
---

# Codex Design Workflow

Read `.claude/library/domain/domain-design-pipeline.md` before creating design output.

## Required Phases

1. Context: user journey, viewport, design language, constraints.
2. Analyze: art direction, UX, UI, flow, behavior.
3. Reference: inspect existing product/system or gold-standard references.
4. BOM: list tokens, components, states, assets, and content.
5. Discover: search existing components, tokens, and styles.
6. Compose: build tokens -> components -> screens.
7. Validate: screenshot or browser check, responsive check, contrast, overflow, and 8-state coverage.
8. Iterate: fix deviations and re-check.

## Hard Gates

- No raw visual values when tokens or variables exist.
- No raw shapes when a component exists.
- Every container uses layout mode, flexbox, or grid.
- Interactive controls account for default, hover, active, focus, disabled, loading, error, and empty states where applicable.
- Text must not overlap or overflow at target viewports.

For Figma writes, also use `$codex-figma-workflow`.
