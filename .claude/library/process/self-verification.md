# Self-Verification Protocol

Verification establishes the claim being made. Scale it to the changed
behavior, risk, and blast radius; do not turn routine work into a checklist
performance.

## Choose the check

- Direct answers and no-change work need no implementation gate.
- A focused edit needs a relevant check or a clear note explaining why no
  executable check applies.
- Broader, externally visible, or higher-risk work needs evidence that covers
  the changed path and material regression risk. Use independent review when it
  adds meaningful confidence, not just because the task crosses a size label.
- Project-specific release, security, data, or product acceptance gates still
  apply when relevant.

Before reporting, compare the original request with the result, inspect the
diff, and distinguish verified behavior from inference or unknowns. Do not
state a confidence label, doubt formula, alternative, or risk paragraph unless
it helps the user understand a material decision.

## Adversarial check when it matters

For consequential or ambiguous decisions, consider the most plausible failure,
the key assumption, a simpler viable alternative, and the evidence that would
falsify the chosen approach. Surface the result when it changes acceptance or
residual risk; do not invent a weakness solely to satisfy a template.

If evidence is missing, say exactly what was not verified and what check would
close the gap. Do not present uncertain work as complete. Uncertainty alone is
not a reason to stop safe, reversible work already inside the user's scope.
Ask only when the unresolved choice materially changes the outcome, permission,
data, security, scope, or irreversible state.

## Failed approaches

After two failed attempts, stop repeating local variants. Revisit the cause,
affected path and consumers, ownership/contract boundaries, and available
approaches. Use `.claude/library/process/change-strategy-gate.md` when evidence
shows a systemic mismatch or the repair-versus-replace decision is material.
Report a blocker only when progress requires user input or external state; do
not ask the user to choose implementation details that remain within accepted
scope.

## Reusable learning

Record a lesson when a failure or correction is likely to recur and the project
has a maintained lessons workflow. Capture the cause and the guard that would
have caught it; do not log every ordinary edit or judgment difference.

See `.claude/library/meta/critical-thinking.md` for evidence hierarchy and
`.claude/library/process/change-strategy-gate.md` for systemic repair decisions.
