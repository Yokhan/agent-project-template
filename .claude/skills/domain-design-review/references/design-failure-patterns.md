# Design Failure Patterns

Use only the discipline and prompts relevant to the review. These are lenses
for finding concrete risks, not a scorecard or a requirement to report every
item. Ground findings in the artifact, user evidence, or applicable standards.

## Product and UX

### Product value and decision-making

- **Feature factory / build trap:** output and shipping cadence become the goal
  while user outcomes remain unclear. Ask what user behavior or need the change
  is meant to improve and what evidence would show progress.
- **Stakeholder or vanity-metric bias:** a senior opinion or easy-to-count
  traffic metric stands in for task success. Compare it with evidence closer to
  the user's actual goal; keep proxy metrics labeled as proxies.
- **Taking a request literally:** a proposed feature may describe a solution,
  not the underlying need. Clarify the circumstance, motivation, and desired
  progress before prescribing a UI.
- **Research theater or confirmation bias:** polished prototypes, leading
  questions, or selective interpretation create confidence without testing the
  important assumption. Match the method to the question and look for
  disconfirming evidence.
- **Say-do gap:** stated preferences and observed behavior can differ. Use
  interviews, observation, support signals, analytics, or experiments according
  to the decision; none is a universal substitute for the others.
- **Experiment cargo cult:** an A/B test without a decision-relevant hypothesis,
  suitable traffic, or a sound stopping/analysis method can produce a misleading
  winner. Prefer qualitative or other evidence when an experiment cannot answer
  the question reliably.

### Flow and interaction

- **Feature bloat:** additions accumulate while redundant or unused paths stay
  in place. Check whether each element supports the current task, can be
  removed, or belongs behind progressive disclosure.
- **An unusable “minimum” release:** scope is reduced below the point where a
  user can complete a meaningful job or the team can learn from use. Define
  the smallest coherent value, not simply the fewest screens.
- **Onboarding before value:** long explanations or account setup arrive before
  users understand why they need them. Put guidance near the decision that
  needs it and defer avoidable friction.
- **Notification spam:** irrelevant or overly frequent notices train users to
  ignore or disable them. Check relevance, timing, frequency controls, and the
  value of silence.
- **Infinite scroll without orientation:** goal-directed browsing can lose
  location, scope, or a clear stopping point. Preserve context, return paths,
  and access to navigation; choose pagination or continuation based on the
  user's task.
- **Error-path neglect:** loading, empty, invalid, or failed states strand the
  user or hide recovery. Review the states and next action that matter to the
  flow.
- **Account before value:** mandatory registration may block a user from
  understanding the product's value. Check whether the account is genuinely
  needed at that point and explain the reason when it is.

Useful review lenses include the user's job, progressive disclosure, usability
heuristics, task completion, recovery, and the assumptions behind any metric or
research method. Select rather than mechanically apply them.

## Visual design and accessibility

- **Template thinking:** a template is used without understanding its
  hierarchy, grid, content needs, or brand fit. Review the structure and
  adaptation, not merely whether the layout looks familiar.
- **Crowded or undifferentiated composition:** decoration and content compete,
  or whitespace and alignment do not help group related information. Check
  reading order, hierarchy, density, and the primary action in context.
- **Contrast or readability failure:** text, controls, or meaningful states are
  hard to perceive. Test the applicable contrast requirements and real content
  rather than relying on visual impression alone.
- **Color-only encoding:** color is the sole way to distinguish status or
  meaning. Pair it with text, shape, iconography, or another perceivable cue.
- **Decorative over function:** visual effects obscure the offer, content, or
  next action. Keep art direction, imagery, and animation in service of the
  intended task and identity.
- **Inconsistent visual language:** similar controls or states look or behave
  differently without a reason. Check alignment with existing tokens,
  components, and platform conventions.
- **Generic imagery or overworked marks:** stock imagery or logo detail carries
  no specific meaning, fails at small sizes, or weakens recognition. Test
  relevance, distinctiveness, and use across actual placements.
- **Accessibility overlay as substitute:** an add-on cannot repair missing
  semantics, keyboard access, focus behavior, labels, or document structure.
  Inspect the underlying interface and assistive-technology behavior.
- **Motion without a usable alternative:** animation distracts, blocks task
  completion, or ignores reduced-motion preferences. Keep essential information
  available without relying on motion.

Useful checks include hierarchy and legibility in context, token/component
consistency, keyboard/focus behavior, contrast, text scaling, and reduced motion
when relevant. Apply the project's accessibility target and platform guidance.

## Game design

### Mechanics, teaching, and feedback

- **Difficulty by stat inflation alone:** increasing health or damage may add
  duration without adding a new decision or skill test. Ask what the challenge
  teaches and whether multiple viable strategies remain.
- **Tutorial information dump:** rules arrive before the player has context to
  use them. Teach at the decision point, let players practice, and preserve a
  way to revisit important guidance.
- **HUD overload:** persistent data obscures play or competes with the current
  decision. Keep essential signals legible and make secondary information
  available when actionable.
- **Burden of knowledge:** success depends on outside knowledge that the game
  does not communicate. Check whether mechanics, risks, and consequences are
  taught or signaled in the experience.
- **Balance by spreadsheet alone:** simulations and spreadsheets cannot reveal
  every emergent strategy or player interpretation. Combine analysis with
  playtesting when actual play is material to the decision.
- **No meaningful feedback:** a valid action has little readable response, so
  cause and effect are unclear. Consider visual, audio, or haptic feedback that
  fits the tone and accessibility needs.
- **Inconsistent rules:** the game teaches a rule and later breaks it without
  signaling the exception. Check whether the exception is learnable and fair.
- **Punishing exploration:** curiosity repeatedly leads to unrecoverable loss,
  dead ends, or unclear hazards. Examine warning, recovery, and reward signals
  against the intended risk/reward contract.

### Narrative, scope, and player trust

- **Copied mechanics without their context:** a mechanic is transplanted
  without the pacing, counterplay, or supporting systems that made it work.
  Review the whole interaction and its role in this game's design.
- **Unintended ludonarrative conflict:** repeated player actions undermine the
  characterization or themes the story asks the player to accept. Decide
  whether the tension is deliberate and legible.
- **Cutscene/gameplay separation:** important characterization or decisions
  exist only outside play, making the two modes feel disconnected. Consider
  whether the game can express the same intent through player action.
- **Artificial scarcity or coercive time pressure:** limited-time access,
  opaque odds, or expiring rewards pressure spending or attendance rather than
  supporting a fair choice. Make availability, odds, and consequences clear.
- **Pay-to-win or grind-to-pay:** purchases or deliberate friction distort
  competitive fairness or make the unpaid experience needlessly tedious.
  Review the actual progression and player alternatives.
- **Opaque dynamic difficulty:** hidden assistance or rubber-banding changes
  outcomes in ways that can feel arbitrary. Check whether adaptation serves
  the intended experience and whether players retain agency and trust.
- **Restrictive saves/checkpoints:** losing substantial progress or replaying
  long sections can disrespect the player's time, especially around failure or
  interruption. Review recovery against the intended tension and session
  structure.
- **Scope pressure and crunch:** feature growth or schedule assumptions create
  avoidable quality and sustainability risks. Surface the tradeoff and identify
  what can be cut without breaking the core experience.
- **Polish mistaken for value:** effects and finish do not compensate for an
  unclear or weak core loop. Validate the central play before investing in
  peripheral presentation.

Useful game-design lenses include the core loop, meaningful agency, readable
rules, challenge/skill fit, player testing, accessibility options, and ethical
monetization. Apply them in the context of the game's intended audience and
experience; none prescribes a single genre or art style.
