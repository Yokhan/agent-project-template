# Native Request Workflow Gates

This source candidate changes local template behavior. It does not publish a
release or update consumer projects. Sol owns decisions and acceptance; useful
bounded execution goes to GPT-6 Luna High, sequentially or in independent parallel
lanes. Tiny work stays direct and explicit user opt-out wins.

## Activation

The full native workflow requires Node 24+ with working `node:sqlite` support.
Setup checks this before creating the project, and the hook runner checks the
same runtime capability. SQLite is required for authoritative child/profile and
Desktop transcript evidence; unavailable capability is not a successful gate.

`.codex/hooks.json` uses native Node commands for SessionStart, UserPromptSubmit,
PreToolUse, PostToolUse, SubagentStart, SubagentStop and Stop. Commands locate
the project from the current directory. No global model, approval or sandbox
setting is changed. Existing shared security hooks run through an absolute
resolved Git Bash/Bash executable with argument arrays; absent Bash blocks
security-sensitive calls instead of silently skipping those checks.

Use a current host supporting these lifecycle events and review/trust the exact
hook definitions using its `/hooks` interface. Changed hooks require renewed
trust. A source file or successful unit test does not establish activation.
For reviewed automation, Codex's per-invocation hook-trust flag can exercise the
candidate without modifying persisted trust. Record this distinction in results.
The host normalizes unified exec to `Bash`; code-mode nested tools also use hooks.
Tool hooks are workflow guardrails and are not a complete security boundary.

## Current Logical Request

Ignored `.session-cache/codex-turns/` holds a repository-bound session/request
ledger, fresh primary packet, application notes, native child events and result.
Normal user prompts start new request IDs. A Stop repair uses an exact single-use
continuation reason to retain the original request, packet and repair count.
Two repairs are allowed. Continued failure stops visibly unresolved; it never
becomes a successful gate because a retry limit was reached.

The Desktop `create_thread` tool delivers its initial task as a native typed
tool output, which does not trigger UserPromptSubmit. When request evidence is
absent, PreToolUse or Stop can recover that exact current-turn task from the
authoritative local transcript. Recovery records its distinct origin and never
claims a UserPromptSubmit event. Unverifiable or ambiguous input fails closed;
existing/corrupt evidence is never replaced. Concurrent first tools initialize
one request. Ignored lifecycle journals record event/session/turn/tool/child IDs
to distinguish trusted configuration from actual native execution.
Recovery does not reuse a prior turn's session pointer as current-turn evidence.
A crashed initializer can leave a recovery lock; the error identifies its path.
Confirm the initializer has stopped before clearing only that ignored lock.
Native child tools carry the parent session with the child's own turn and agent
IDs. Start/completion events bind that turn to its original request; follow-up
tools can bind a new turn only for an already observed child. User steering
never imports that child into the new current request.

UserPromptSubmit provides the route, a task-specific edition-bound section map
and complete selected primary units for substantive nonfiction. The packet's
selected topics and exact unit boundaries must all be covered; a fixed starting
quote or source-only receipt does not suffice. Read the entire packet if the
hook preview was shortened. Refine/add context for the actual editorial problem.
Missing sources block grounded output while safe non-writing work may continue.
Small acknowledgements and actual narrative fiction are exempt. A direct/code
task producing substantive explanatory prose is checked at Stop as well.
Code-only work and focused inspections do not preload books. If they produce a
substantive explanation, Stop requires its fresh reading and application.
Planned reading now defaults to a 96,000-character ceiling. Copied contents and
literal example excerpts are built explicitly with `writing-library index` in
the machine-local store. Hooks expose their location and relevant navigation;
inspect and read the actual references rather than treating their presence as
proof of application. The edition-bound index never replaces primary checks.

For UserPromptSubmit, an exact anchored `<realtime_delegation>` envelope uses
only its `<input>` for routing and writing classification. The full prompt,
including `<transcript_delta>`, remains bound as raw-prompt provenance.
Transcript assistant text cannot change the user's task. Malformed, quoted or
reported envelopes remain intact in the ledger and require a direct request
before routing. Actual writing inside `<input>` keeps the normal reading and
review gates. Normal substantive-output checks still apply to the final
response; correct task normalization does not exempt substantive prose.

This does not broaden native `create_thread` recovery: its strict
`<codex_delegation>` parser rejects a nested realtime wrapper with literal
`<input>` tags, so that form is not recovered from the transcript.

## Evidence Commands

Use the ledger path supplied by the native hook:

```text
node scripts/codex-turn.js status --state <request.json>
node scripts/codex-turn.js refresh --state <request.json> --query <focused-Russian-editorial-question>
node scripts/codex-turn.js integrate --state <request.json> --child <native-id> --assignment <bounded-contract.json> --result <integration-reference>
node scripts/codex-turn.js apply --state <request.json> --artifact <exact-final.txt> --notes <principles.json>
node scripts/codex-turn.js apply --state <request.json> --artifact <document.md> --notes <principles.json> --target file
node scripts/codex-turn.js editorial-assignment --state <request.json> --artifact <draft.txt>
node scripts/codex-turn.js review-accept --state <request.json> --artifact <draft.txt> --child <native-editor-id>
```

Assignments contain nonempty `scope` and `acceptance`. The integration reference
explains the used result, not merely that an agent started. Application notes
contain a source ID, passage digest, specific principle and observable effect
for every passage. Save exactly the final response bytes: the gate does not trim,
normalize newlines or rebind a changed draft. Registered files are read again at
Stop. The verifier checks current request start, retrieval age, source editions,
complete reading coverage, notes and output hashes.
Save required memory-citation metadata and its separators in the exact artifact.
Desktop Stop omits that footer from its input. The runner accepts this specific
carrier mapping only when the input is the exact artifact prefix and the full
artifact equals the authoritative current-turn native final. It then checks the
original full bytes. Missing evidence, changed text/footer/newlines still block.
Stop diagnostics record only final hashes, lengths and metadata-presence flags.
Authored nonfiction and material rewrites also require the distinct read-only
`writing_editor` (GPT-6 Luna High). Its exact native JSON final assesses meaning,
structure, claims/value, natural language and tone/rhythm, with draft excerpts,
specific corrections and book-derived decisions for selected topics. The gate
correlates child completion/model/effort and matches that actual result, never a
writer-created review file. Any outstanding finding blocks. Changed artifact
bytes or a refreshed packet invalidate the old review. Brief status/explanation,
literal typos and explicit user opt-out may self-check; a short ad/letter still
needs the editor. Required review unavailable is an acceptance gap, not a pass.
Mandatory editor acceptance requires both an observed `writing_editor` child
and the correlated configured GPT-6 Luna High model/effort; an implementer result, a role label
alone or another correlated profile cannot satisfy that requirement. A host
without that observed role has an explicit review acceptance gap.
Read-only behavior is the requested role contract, not inferred sandbox proof.
When an independently accepted registered file is delivered, a brief confirmation
that points to that verified file does not need a second editorial/application
record. Every file is still rechecked at Stop; added substantive final prose
and actual short authored letters/ads retain their normal checks.
After a long pause or insufficient reading, `refresh` keeps the logical request
but obtains new primary passages and digest. Prior application records then fail
binding until reapplied; it does not reset the repair budget or waive reading.

If the host cannot dispatch/observe a worker, splitting is unsafe, judgment is
unresolved or coordination would exceed useful work, record the concrete reason:

```text
node scripts/codex-turn.js fallback --state <request.json> --category host-unavailable --reason <specific constraint and its impact>
```

When an observed external host performs a complete, bounded assignment, record
it separately from the native-child fallback:

```text
node scripts/codex-turn.js fallback --state <request.json> --category external-host --reason <why this host was used> --evidence <project-relative evidence.json>
```

The bounded JSON envelope requires `schemaVersion: 1`, the current `requestId`,
`actualHost`, `sessionRef`, `fenceRef`, `operation`, `assignment.scope`,
`assignment.acceptance`, `submissionRef`, `completionRef`, `outputRef`,
`outputSha256`, `parentIntegrationRef` and `limitations`. Each reference points
to a local project file. Submission, completion and integration wrappers carry
the current request ID; completion also references the captured raw host
response and its SHA-256. The raw host history need not invent a native
request/child ID. The parent verifies the exact output hash, assignment and
integration bindings and that referenced bytes have not changed.

Only a `completed` response with matching output and parent integration is
reported as `reported-completed-integrated`. This is a parent-inspected host
response claim, not native provider/runtime proof. Submitted or pending work
gets no completed-work credit; changed, unrelated or malformed evidence is
unverified. This route makes no Stop-time network call, does not acquire API
keys or change global model settings, and does not waive writing-editor,
security or other independent acceptance gates.

An exception is visible and does not count as Luna success. Historical Terra
receipts remain historical evidence and do not become Luna calls. A profile name alone
is unverified. Native child IDs are correlated with parent-linked runtime
metadata for model/effort; missing metadata stays unverified. Timings describe
observed execution only, not savings. Evaluate total duration, available usage
and rework on comparable tasks before claiming an improvement.

## Owned Resource Lifecycle

The existing SessionStart, PostToolUse and Stop handlers also sweep inactive
registered scratch and prune this project's idle owned caches. Their hook
definitions do not change. Launch supported tests/build/browser tools through
`scripts/managed-temp.js`; adapters, cache limits, export behavior, and the Windows
Job Object versus POSIX foreground-contract boundary are documented in
`.claude/library/technical/testing.md`. Last-run accounting is bounded and stored
outside scratch; inspect `node scripts/managed-temp.js report`. Cleanup errors,
unresolved leases and partial scans remain visible at Stop. Live jobs keep their
leases. Trusted/enabled configuration still requires a real native event to prove
activation; a synthetic handler test alone is insufficient.

The sweep remains project-wide and preserves every unresolved or unknown marker.
Only a pending/error run whose normalized marker has exact session and request
ownership matching the Stop ledger can block that request. Other-session,
earlier-request, legacy, malformed and unscoped results are bounded diagnostics;
cache-budget observations are project-wide diagnostics too. SessionStart still
delivers its normal context when diagnostics exist. Bind a managed command to the
immutable ledger with `node scripts/managed-temp.js run --request-state
"<request.json>" -- <executable> <args>`; mutable current pointers and bare
session IDs do not establish exact request ownership. A global `last.json` result
is named current only when its normalized ownership matches the current ledger.

Declared bulk copies also use the project storage operation registry. Its owner
fences, reservations, protected paths, native event behavior and cooperative
enforcement limits are documented in [STORAGE_OPERATIONS.md](STORAGE_OPERATIONS.md).

## Semantic And Privacy Limits

Records do not prove comprehension, relevance, text quality or useful delegation.
Self-check and risk-appropriate independent review establish stronger evidence.
An agent with write access can edit local ledgers: this is accidental-omission
protection, not tamper-proof enforcement. Do not upload packets, raw prompts,
transcripts, private client/clinical data or the machine book store as evidence.
Publish only sanitized summaries/digests when authorized. Use the shared
privacy-transfer allowlist for recovery/export/upload and preserve supported
product value when shortening sales copy.

## Optional Outcome Evidence

When a request needs a concise delivery record, attach it to the existing
request ledger with `node scripts/codex-turn.js record-outcome --state
<request.json> --result <outcome-evidence.json>` and inspect it with
`node scripts/codex-turn.js outcome-status --state <request.json>`. The bounded
JSON binds the request and original scenario to an expected outcome, product
fact references, an exact target surface/environment, source and built-file
SHA-256 fingerprints, evidence-file references and known gaps. It is optional
recording support, not a new plan, universal Stop gate or substitute for the
existing native/editor receipts.

The input shape is fixed and bounded:

```json
{
  "schemaVersion": 1,
  "requestId": "<request id from request.json>",
  "originalScenario": { "taskSha256": "<sha256 of the ledger task>", "description": "A new visitor needs to confirm a booking." },
  "expectedOutcome": "The visitor sees the assigned time and confirmation.",
  "factSources": [{ "ref": "docs/product-facts.md", "sha256": "<current file sha256>" }],
  "target": { "surface": "served booking page", "environment": "staging desktop browser 1440x900", "modality": "ui" },
  "artifacts": [
    { "role": "source", "path": "src/booking.js", "sha256": "<current source sha256>" },
    { "role": "built", "path": "dist/booking.js", "sha256": "<current build sha256>" }
  ],
  "evidence": [],
  "gaps": ["Native-device behavior was not checked."]
}
```

`publication-receipt`, `render-observation`, `installation-observation` or
`active-observation`, plus a project-relative `ref`/`sha256`, exact `surface`
and `environment`, and the `sourceSha256` and `builtSha256` they observed. A
publication receipt also records `provider` and at least one of `tag`, `commit`
or `url`. It is a local provenance record bound to the request, target and
artifact fingerprints; its JSON contents do not independently prove that a
remote provider published anything.

Statuses are deliberately separate: `published` requires a matching local
publication receipt; `rendered` requires a matching render observation;
`installed` and `active` require their respective matching observations. A
Storybook or local preview observation can establish only rendering on that
exactly named target. It cannot establish publication on another target. A
receipt does not establish that the published target rendered, and a render
observation does not establish publication.

Set `target.modality` to `ui` (default), `artifact`, `native-script` or
`interpreted`. UI and release artifacts require source and built fingerprints.
Native scripts and interpreted material require a source fingerprint and omit
the `built` artifact; status reports `built: not-applicable`, and matching
evidence uses `"builtSha256": null`. This represents a real no-build path
without inventing a hash. Render observations are accepted only for `ui`.

For a GitHub release, record the actual local release receipt and bind it to
the values observed for that release. For example, use `provider: "GitHub"`,
the exact release tag, commit, and release URL in a `publication-receipt`
entry whose target names that release and whose hashes match the request's
source and built artifact. The evaluator records that evidence as
`evidence-recorded`; verification of the remote release remains external.

```json
{
  "kind": "publication-receipt",
  "ref": "evidence/github-release.json",
  "sha256": "<sha256 of the saved local release receipt>",
  "provider": "GitHub",
  "tag": "vX.Y.Z",
  "commit": "<release commit>",
  "url": "https://github.com/<owner>/<repo>/releases/tag/vX.Y.Z",
  "surface": "GitHub release vX.Y.Z",
  "environment": "GitHub repository <owner>/<repo>",
  "sourceSha256": "<source fingerprint>",
  "builtSha256": "<release artifact fingerprint>"
}
```

For a future native PersonalAssistant (PA) activation, use
`modality: "native-script"`, fingerprint the script as `source`, omit `built`,
and attach an `active-observation` file captured from the actual PA activation
with the exact native target/environment and `builtSha256: null`. A local
receipt or example alone is not activation evidence.

```json
{
  "kind": "active-observation",
  "ref": "evidence/pa-activation.json",
  "sha256": "<sha256 of the saved native activation observation>",
  "surface": "PersonalAssistant native activation",
  "environment": "<actual PA host and version>",
  "sourceSha256": "<native script fingerprint>",
  "builtSha256": null
}
```

Local file references must remain inside the project and cannot traverse
symlinks; external product-fact URLs remain reference-only. Status
rechecks fingerprints, so changed linked bytes become stale. `evidence-recorded`
means the request, target and bytes line up in the ledger; it does not prove
remote publication, device behavior, semantic quality or user acceptance.
Missing or mismatched evidence remains an explicit gap/unknown suitable for an
honest partial handoff.
