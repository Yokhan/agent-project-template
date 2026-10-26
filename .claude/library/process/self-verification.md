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

## Verification cadence — one useful wave, one broad owner

This is the shared source of truth for verification cadence, including worker
contracts and template closeout. Product waves follow
`.claude/library/process/plan-first.md#product-wave-semantics--source-of-truth`:
successive versions of one product, not technical batches or experiments.
A local fix is a task, not a miniature wave. It gets proportionate task-level
checks without a new roadmap. Integration, safety, or release checkpoints may
need broader checks before a long product wave ends; name their concrete risk,
do not rename them product waves or defer necessary verification for weeks.

Before implementation, the wave owner selects focused checks for the affected
paths and the broad acceptance check, if needed. During the wave, run the
smallest relevant tests, typecheck, lint, or manual check after a coherent batch
of changes. Do not unconditionally run the full suite after every edit. Expand
coverage when the actual blast radius or failure evidence warrants it.

The parent/integrator is the sole owner of broad integration verification at
the wave boundary, after worker changes are integrated. Workers run only their
assigned focused checks and return evidence; they must not independently
repeat the parent's full suite. Do not start simultaneous duplicate broad
runs. If an aggregate already includes a leaf check, do not run that leaf again
merely to satisfy an additive checklist.

Retain compact evidence in the existing task context: command, result, covered
scope, tested worktree/content state, and relevant inputs/toolchain. A commit
SHA alone does not identify dirty worktree content. Before reuse, compare later
changes with that evidence's scope; no new ledger or whole-repository hashing
ritual is required. A documentation-only edit unrelated to tested behavior
does not invalidate every test. Report an earlier full pass as a baseline plus
the checks covering the delta; never call it a full pass of the current tree.
For supervised runs, include elapsed time when available and distinguish the
child command's raw exit/result from wrapper, cleanup, or bookkeeping status.
Inspect the immutable receipt when those statuses disagree; a wrapper error is
not by itself proof that the command failed, and a successful child command is
not by itself proof that cleanup or the broader gate passed.

Repeat a broad check only after a concrete invalidation, and state the reason
before launching it:

- a cross-cutting change or demonstrated integration risk outside prior coverage;
- changed dependencies, build/runtime configuration, or relevant test inputs or
  toolchain;
- an unresolved failure whose diagnosed cause or reproduction conditions changed;
- a mandatory CI, security, release, or artifact-bound gate at its required
  boundary;
- an explicit user request for a repeat.

A local patch, a failed check alone, a worker finishing, compaction, or a desire
for reassurance is not sufficient reason to restart the full suite. Reproduce
a failure narrowly, diagnose and fix it, rerun the affected check, then widen
only when evidence requires it. A broad pass on the final integrated state may
still be required for acceptance; do not replace mandatory gates with stale
evidence, fabricated passes, or skipped tests.

These are agent workflow instructions, not a universal host-enforced command
ban. Static validation can protect their presence and consistency; observed
execution is needed to establish that a particular run followed them.

Before reporting, compare the original request with the result, inspect the
diff, and distinguish verified behavior from inference or unknowns. Do not
state a confidence label, doubt formula, alternative, or risk paragraph unless
it helps the user understand a material decision.

## Adversarial check when it matters

For consequential or ambiguous decisions, consider the most plausible failure,
the key assumption, a simpler viable alternative, and the evidence that would
falsify the chosen approach. Surface the result when it changes acceptance or
residual risk; do not invent a weakness solely to satisfy a template.

## Tie evidence to the promised outcome

For product or release claims, name the original user scenario and expected
after-state before choosing checks. Preserve the product facts and constraints
that define the promise. Identify the exact surface and environment: a Storybook
component check does not establish the served site, and a desktop browser check
does not establish native-device behavior. Exercise first-time and repeat paths
when they carry different state or expectations.

Separate evidence for source, built files, rendered target, installed package,
and active runtime. File fingerprints establish which bytes were inspected;
they do not establish publication, activation, semantic quality or user success.
Use fresh browser/device/native observations for the corresponding surface and
record gaps as unknown or partial handoff when evidence is unavailable. The
optional `codex-turn.js record-outcome` ledger can preserve those references and
recompute stale fingerprints; it is not a universal approval gate. Tiny edits,
no-change answers and narrow direct tasks still receive only proportionate
checks.

If evidence is missing, say exactly what was not verified and what check would
close the gap. Do not present uncertain work as complete. Uncertainty alone is
not a reason to stop safe, reversible work already inside the user's scope.
Ask only when the unresolved choice materially changes the outcome, permission,
data, security, scope, or irreversible state.

For closure labels, carryover fields, release boundaries, and next-wave
selection, follow
`.claude/library/process/product-goal-loop.md#closure-carryover-and-next-action`.
When waiting on a blocked gate, select an authorized independent next action
from the existing goal/task graph; an acknowledgement, timer, or stale turn
state is not progress. Recheck current owner activity/evidence and preserve
shared writers and heavy-resource ownership.

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
