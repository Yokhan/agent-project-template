---
description: "Review product, visual, and game design decisions for user fit, accessibility, coherence, and harmful patterns. Apply the checks relevant to the requested review."
---
# Domain Design Review

Review the actual surface, flow, brief, or evidence in scope. Lead with the
highest-impact finding and explain its user impact and supporting observation.
Apply relevant principles below rather than scoring every design against a
fixed checklist. Distinguish observed defects from hypotheses that need user or
behavioral evidence.

## Product and UX

- Judge the design by the user's current job and the product outcome it is
  meant to support, not by feature count or stakeholder preference alone.
- Keep the primary action and information hierarchy clear. Reduce, group, or
  progressively disclose choices and secondary information where that helps
  the task.
- Prefer honest defaults, clear consent and cancellation, transparent pricing,
  and user control. Flag deceptive patterns, coercive urgency, or monetization
  that misleads or exploits users.
- Design useful loading, error, empty, and recovery paths when they apply.
  Do not present a simulation, placeholder, or unimplemented action as real.
- Use research and behavioral data when available and relevant. Treat requests,
  surveys, analytics, and experiments as evidence with limits; do not assume
  that one method or sample size fits every decision.

## Visual design and accessibility

- Evaluate hierarchy, readability, contrast, spacing, alignment, and visual
  consistency in the context of the product's established design language.
- Prefer semantic structure, keyboard operation, visible focus, clear labels,
  and assistive-technology support over accessibility overlays as a substitute
  for implementation.
- Check applicable contrast and target-size requirements against the project's
  chosen accessibility standard and platform guidance. Do not rely on color
  alone to convey essential meaning.
- Respect reduced-motion preferences when motion is present; visual finish
  should not obscure the task or create avoidable barriers.

## Game design

- Review the core loop, player agency, feedback, difficulty, readability, and
  how mechanics support the intended experience. Use playtesting or other
  player evidence when a judgment depends on actual play behavior.
- Avoid manipulative monetization, opaque odds, coercive time pressure, and
  grind designed to push payment. Consider fairness, accessibility, and the
  experience of players with different skills and play patterns.
- Favor consistent rules, meaningful choices, legible teaching, and rewards
  that fit the game's intended tone. Realism, complexity, and polish are means,
  not ends.

For concrete failure modes and review questions, consult only the relevant
section of [design failure patterns](references/design-failure-patterns.md).

## Evidence and reporting

Ground findings in the artifact, observed behavior, applicable standards, or
traceable research. Do not attach evidence grades or precise population,
conversion, prevalence, or performance statistics without a specific source
that supports the exact claim and its context. Avoid broad legal claims; name
the relevant jurisdiction and current authority when legal status matters.

For a useful review, report only what helps the owner act: the issue, evidence,
impact, and a practical next step. State confidence or the main uncertainty only
when material evidence is incomplete or competing interpretations could change
the recommendation. A focused review need not force a full audit format.

## Further reading

Use the relevant section of [design failure patterns](references/design-failure-patterns.md)
when concrete review prompts would help; do not read every discipline for a
focused review. For foundational context, the source materials include Teresa
Torres, *Continuous Discovery Habits*; Marty Cagan, *Inspired* and *Empowered*;
Melissa Perri, *Escaping the Build Trap*; Jesse Schell, *The Art of Game
Design*; Celia Hodent, *The Gamer's Brain*; and Mihaly Csikszentmihalyi,
*Flow*. Consult the source itself before attributing a specific finding or
number to it.
