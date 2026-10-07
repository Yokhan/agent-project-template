---
name: test-rules
description: "Validate agent rules with available executable fixtures or a clearly labeled desk review; do not overstate behavioral evidence."
---

# Rule Validation

Use after a rule change or when the user asks whether a rule works. First find
the rule’s active source of truth and any maintained fixtures, validators, or
evaluation harness. Do not treat a checklist or imagined answer as a runtime
test.

## Evaluation

- Prefer an existing executable/static validator for structural properties and
  a realistic behavioral evaluation when the host supports one.
- For independent forward evaluation, give the evaluated agent the scenario and
  applicable rules, but withhold the expected answer. Score the result in a
  separate evaluator against the held-out expectation.
- Do not label a same-context mental rehearsal or the author’s own prediction a
  PASS. If no independent or executable evaluation is available, report a
  desk review as such and mark runtime behavior `not verified`.
- Keep scenarios relevant to the changed contract. Update fixtures only when
  their expectation is genuinely obsolete; do not add cases solely to prove a
  rule is present.

Report the method, scenarios covered, evidence, result, and what remains
unverified. Use `pass`, `fail`, `not run`, or `unverified` only when the chosen
method supports that label; do not turn a mental review into an X/Y test score.
