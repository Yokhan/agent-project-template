# Design Checks

Source references:

- `.claude/library/domain/domain-design-pipeline.md`
- `.claude/skills/domain-design-review/SKILL.md`
- `.claude/docs/domain-full/domain-design.md`

Choose checks that cover the changed surface and likely failure modes. Depending
on scope, useful checks include:

- Rendered browser, design-tool, or Storybook inspection.
- Relevant desktop/mobile or target-device viewport checks.
- Text overflow, overlap, and long-content checks.
- Contrast, keyboard/focus, and assistive-technology checks for affected UI.
- Relevant interaction states and reduced-motion behavior when animation is
  present.

A focused edit may need only one or two targeted checks. Broader or
risk-bearing work needs correspondingly broader evidence; state limitations when
rendered checks are unavailable.
