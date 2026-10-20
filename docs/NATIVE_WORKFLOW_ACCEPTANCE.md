# Local Workflow Acceptance - 2026-10-18/20

The candidate was checked locally with native Codex CLI 0.163.0-alpha.10.2.
No release, push, tag or consumer-project update was performed. The initial
scenarios below used per-invocation hook trust. On 2026-10-18, the user authorized
persistent trust: all seven exact project definitions were reviewed/trusted
through the native CLI `/hooks` UI. Codex saved their hashes in the user's
`hooks.state` configuration. The older npm CLI 0.125.0 could not load the current
config and was not used as acceptance evidence.

## Readiness Repairs - 2026-10-20

The supported native workflow now requires Node 24+ and working node:sqlite.
Setup rejects an unsupported runtime before asking for a project name or
creating files. Native hooks fail closed with an actionable runtime message.
The source and generated-project preflight regressions passed. A real batch
setup invocation with a simulated Node 20 runtime was rejected with zero project
writes; this simulation is not a separate installed Node 20 binary.

Mandatory editor acceptance now requires both the native writing_editor role
and correlated Luna High runtime metadata. A requested role/profile alone is
insufficient. An already applied and independently reviewed file can be delivered
with a narrow one-line acknowledgement and an exact registered file link.
Changed/missing files, missing review, malformed links and added authored prose
remain gated; standalone short letters still require an independent editor.

A fresh ordinary native CLI letter task completed in session
`01a15802-ab88-7ba1-8b98-79f25b142689`, without temporary trust or model/config
overrides. The actual writing_editor child
`01a15803-bd02-7f12-bbdf-2baf84a5b11f` correlated to Luna High. The file's fresh
mapped reading, exact application and review passed; its final acknowledgement
with an absolute link passed native Stop with zero repairs and no second final
application record. The model corrected several tool-usage mistakes before
completion, so this is not a flawless-run or speed claim. An interrupted earlier
attempt is excluded. Command probes against the completed evidence rejected
changed/missing file bytes, missing review, an implementer posing as the editor,
and extra final claims. Original evidence was restored and verified again.

Real native setup.bat acceptance exposed a further defect: a missing Get-FileHash
cmdlet produced nonterminating errors and empty manifest hashes. Setup now uses
a .NET stream digest, expands wildcard paths to actual files and propagates
PowerShell failures. Both native-workflow documents are owned by the manifest.
A fresh setup passed, and all 463 manifest entries matched installed file bytes.
Generated runtime/hooks/recovery/CI guards, MCP configuration and a clean native
sync preview passed. An isolated source snapshot then changed one template-owned
document: the reviewed plan had no conflicts, injected apply failure restored
the exact file and manifest, and normal apply preserved all 35 project-owned
files. The repeat preview required zero writes. No existing consumer was updated.

Release packaging now depends on a native Windows setup.bat smoke and generated
manifest-byte checks on the same commit accepted by Linux validation. These
checks are wired and locally exercised; remote Linux/Windows CI on a frozen
release commit has not run. Local repair acceptance does not establish a
published release. Independent code review found no remaining substantive
finding after the delimiter and wildcard corrections. Final aggregate outcomes
are recorded in tasks/current.md; ignored raw traces and book text are not part
of the release payload.

## 96K Reading And Literal Local References - 2026-10-19

The single planned packet default and ceiling increased from 48,000 to 96,000
characters. Legacy retrieval retains its 24,000 default. Explicit smaller
budgets still fail on incomplete required context; no selected unit is silently
shortened. Focused boundary tests passed, including 96,001 rejection and a real
78,984-character example/counterexample packet that fails at 48,000.

Explicit local index creation copied authored contents and 504 complete
example-bearing source units from six pinned sources into the machine library's
derived study directory, outside Git. Navigation covers 1,213 units. EPUB
original NCX, authored Markdown contents and reviewed pinned PDF contents ranges
are retained with source hashes/offsets. Candidates are not automatically
verified before/after pairs; PDF table layout may require the original. Original
and pinned text-cache hashes remain valid. Read operations reject altered/stale
index data by reconstructing the expected source-derived index.

Actual CLI queries returned all 70 clear-understood NCX entries, the complete
1,262-character Markdown contents, and the requested correspondence comparison
table on PDF page 14. Fixture tests cover long uncut examples, exact-phrase
ranking, authored Markdown contents and tampering. Independent code review found
a Markdown TOC omission; it was fixed with a regression. Structural validation
finished with zero errors/warnings; skills, SOT, hooks and focused writing tests
passed. This is baseline plus delta, not a new aggregate release acceptance.

Fresh native CLI session `01a15537-ce1e-7380-bb09-c29a0c9e7d63` received an ordinary
three-sentence fact-versus-assumption task with explicit no-subagents. Its
13-unit/84,396-character reading packet and exact final application passed native
Stop after one application repair. No temporary hook-trust overrides were used.
It used the mapped packet; it did not issue a copied-index lookup, whose real
CLI behavior was checked separately. Large host tool/hook outputs can still be
truncated; the 96K script limit does not alter that transport limit. Full local
files must be read in bounded parts. Automatic multi-packet reading is not
implemented, and no speed/token-saving claim follows from this run.

The root completion exposed a separate carrier defect after native context
compaction: the host repeats turn_context for the same native turn, while the
earlier carrier rejected every duplicate context. Saved final bytes and the
observed Stop-prefix hash matched the actual transcript exactly. Reconciliation
now recognizes only an adjacent compacted/optional world_state/context sequence,
with matching valid turn/root IDs in the actual nested resume metadata and both
contexts; it discards pre-compaction final candidates. Unexplained duplicates,
malformed identity, changed bytes and unsupported latest finals still fail.
Carrier/recovery regressions and hook integration checks passed. A command probe
using this root's authoritative native transcript and observed Stop-prefix hash
passed the full handler; this probe is distinct from a subsequent native Stop.

## Persisted Trust And Desktop Acceptance

| Fresh run after trust | Observed result | Native session |
| --- | --- | --- |
| Native CLI, no hook-trust bypass or configuration overrides; explain build versus login acceptance | Current-request packet, exact final application and native Stop result `passed`, zero repairs | `01a1501c-62d1-70b0-bb99-a13211c9b4d4` |
| Desktop chat created by the app tool before native-task recovery; review source reading versus Russian text quality | No request ledger; this is a service-created chat, not evidence of a manually submitted user prompt | `01a1501a-85a0-7ef3-90f0-5590d2d04597` |
| Desktop service-created chat after recovery; inspect Node version | Actual SessionStart, PreToolUse, PostToolUse and Stop; current task recovered with explicit origin, Stop passed with zero repairs | `01a154e6-188c-7bb0-a9eb-7a1d35b45a23` |
| Desktop service-created chat after recovery; explain build versus login in three sentences, no subagents | Fresh mapped packet, exact final application and native Stop passed with zero repairs; explicit opt-out respected | `01a154e6-aaf6-7033-83c6-7d7dd9c8ef3d` |
| Desktop service-created client letter with no book/editor instructions | Mapped correspondence context, actual distinct runtime-correlated Luna High editor and final Stop passed; one repair | `01a15511-f444-73d0-8da8-d7273aa69712` |
| Separate user-started ordinary Desktop chat in this same directory | Actual UserPromptSubmit plus all seven lifecycle event types, including native editor start/completion; initial final acceptance exposed the citation-carrier defect below | `01a154f7-80a8-7a13-beab-e574b39f62f3` |

Persistent trust is established for this machine/project, not shipped in the
template. On 2026-10-19 the user confirmed all seven Desktop definitions were
Trusted/Enabled after reload. Native SessionStart context and the fresh Desktop
event journals above confirm current-process execution. No restart, temporary
trust flag or global defaults change was required for these runs.

The earlier cache hypothesis was not established. Read-only native transcripts
showed a different boundary: `codex_app.create_thread` supplies its initial task
as a typed function-call output containing `codex_delegation`, so that initial
task does not produce UserPromptSubmit. The runner now recovers only this typed
current-turn output using the authoritative read-only session database path.
It records `requestOrigin: native-app-create-thread`, never fabricates a prompt
event, rejects ambiguity/foreign paths and preserves existing evidence. A short
ignored lifecycle journal stores event/session/turn/tool names, without prompts
or command content. Independent read-only review verified the actual event shape.

A genuine text turn in a fresh app-server with the Desktop's code-mode flags
also ran SessionStart/UserPromptSubmit/Stop. This is separate protocol evidence.
Separate read-only evidence from a user-started ordinary Desktop chat in this
directory now confirms genuine UserPromptSubmit and all seven event types. Its
user messages were not created by this test harness. This closes activation
evidence; final-output correctness is evaluated separately below. No messages
were sent to that chat and its application/history work was not modified.

### Exact final text and memory citations

A real memory-backed Desktop answer exposed a host carrier distinction. The
native response_item contains the complete final text and memory-citation footer;
Stop's last_assistant_message omits that footer but preserves its separator
newlines. In session `01a15512-9da3-7810-84cb-1603375f8bb1`, the raw final was
998 characters and the actual hook prefix was 628, including two final newlines.
Changing the saved artifact to 627 characters was an unsuccessful workaround,
not acceptance evidence. That run remains excluded from successful output checks.

The runner now reconciles only this observed carrier case: the hook message must
be the exact unmodified prefix before one terminal memory-citation footer, and
the complete saved artifact must exactly match the latest explicit native final
in the authoritative current-turn transcript. The ordinary reading/application
and independent-editor checks then run on those full original bytes. No body,
footer or newline changes are normalized or forgiven. Missing/ambiguous native
evidence retains the failure. Evidence stores only hashes/IDs/counts. Focused
negative cases cover altered text, separators, footer, stale turns and paths.
The fresh native repeat `01a15517-271d-7662-879b-f301faff305e` passed Stop with
zero repairs and a runtime `native-final-carrier.json` record. It used fresh
mapped reading, exact application and an explicit no-subagents request, without
temporary trust or model overrides. This is the successful carrier acceptance;
the earlier failed run was not relabelled.

A later continued source-chat answer exposed an additional Windows path case:
its authoritative SQLite rollout path used the extended-length `\\?\C:\` form,
for which Node's ordinary realpathSync failed at the drive root. The exact saved
answer, native final and hook prefix matched; the path failure caused the false
rejection. DOS/UNC extended-path aliases now canonicalize before the same strict
identity comparison. Windows regressions for both request recovery and final
carrier passed, and the real current-turn transcript reconciled successfully.

Independent review also exposed two concurrency/evidence issues during recovery
integration: a stale session pointer could substitute for a missing current-turn
mapping, and publication between a negative pointer snapshot and lock inspection
could reject a valid contender. Exact turn/observed-child binding and a final
pointer recheck corrected them. A true two-process paused-publication scenario,
deterministic snapshot regression, user-steering/child-follow-up isolation and
repeat focused runs passed. An unsupported latest multipart final now blocks
carrier reconciliation instead of falling back to an earlier matching draft.

## Book Depth And Style Acceptance

The candidate has three separate layers: persistent Russian editorial profiles,
fresh literal book passages, and source-to-output application records. The
profiles cover reader purpose, substance, structure, examples, natural syntax,
rhythm and preservation of meaning. The packet/record verifier checks provenance
and exact-output binding; it does not judge these editorial properties.

The initial Desktop source review demonstrated this limit with a disposable specimen:
nonsensical prose and nonempty `principle: "x"`, `effect: "y"` records passed
`verifyApplication`. This is a semantic-quality negative case, not successful
writing acceptance. No source code was changed by that review.

The fixed-anchor initial reading path has been replaced by an edition-bound
editorial topic map across all six sources. Selected primary units are read in
full, including mapped neighboring pages. Complaint, explanation, example,
counterexample, value-preservation sales, production and game jobs select
different context. A query supplements the mapped requirements. Missing context
or an insufficient 48K-character packet budget blocks instead of dropping topics.
The map is finite navigation, not whole-corpus learning.

Authored nonfiction/material rewrites now require an actual distinct editor.
Its JSON final binds the exact draft and mapped reading, assesses purpose,
structure, claims/value, natural language and tone/rhythm, and cites specific
draft evidence and source-derived decisions. The parent matches the actual
native child result and correlated runtime; writer-created records do not count.
Open findings block, changed drafts require new review. Brief technical status
can self-check; short ads/letters and a long artifact containing a short subtask
do not gain that exemption. Explicit user opt-out remains visible.

Current real scenarios (no hook-trust bypass):

| Task | Observed evidence | Session |
| --- | --- | --- |
| Shorten trainer service to 45-60 words, preserve schedule/equipment, exercise replacement and technique feedback | Mapped current reading, distinct runtime-correlated Luna High editor, exact final application and native Stop passed | `01a15064-ba2b-7b52-92f9-9c98d746a118` |
| Write a short delay letter, preserve data-safety fact and distinguish next update from unknown resolution time | Fresh mapped correspondence context and editor handoff; final retains those conditions | `01a1506d-e6b8-7763-b848-be8732461d5f` |
| Independently review a fixed misleading course ad | Actual Luna High critic returned revision_required, six concrete findings including two critical unsupported/contradictory offer claims; record verified against the actual child final and source/draft bindings | `01a15065-7cdc-7201-b582-01fd80f949f0` |

An independent code review exposed duplicate English project topics and a
mixed-scope brief-explanation exemption. Both were corrected with focused
regressions. Native loading also exposed non-ASCII editor nicknames; these were
corrected and the agent validator now checks the host's ASCII restriction.
The native service-writing runs used a runtime-verified explicit Luna contract
while that role was unavailable; do not relabel them as custom-role execution.
The source role is now registered and valid. The large template smoke passed
206/206 before the final host-delegation recovery change; later deltas need their
own matching evidence, not a relabelled whole-tree pass.

## Native Model Scenarios

These were fresh sessions with ordinary task prompts, not prompts telling the
model which agent to spawn. Disposable snapshots contained the current candidate
scripts, instructions and the writing registry's required communication source.
Early snapshots missing that source failed activation checks and are excluded.

| Scenario | Observed result | Native session |
| --- | --- | --- |
| Short acknowledgement | Passed, no child or writing application required | `01a14e9a-409d-7140-b10c-8fab47707595` |
| Implement integer parsing with invalid-input checks | Parent derived a bounded assignment, launched and awaited the implementer, inspected the result and integrated it; child runtime correlated to Luna High | `01a14e9e-68c5-7780-85db-dbde25e73376` |
| Shorten an offer to 45-60 words | Read primary passages, recorded specific application and delivered 46 words with exercise replacement and continued training benefit intact; no invented price or deadline | `01a14e9c-d12b-7913-91b0-0c560de6386f` |
| Explain build versus login acceptance, explicit no-subagents | Passed with primary-source application and zero children | `01a14ea4-ab9f-7872-80e5-9b570ba07fc5` |
| Remove the first application record at native Stop | Fault was detected; the model repaired evidence once under the same logical request and then passed | `01a14ea5-3851-7560-8141-efcc30ce9655` |

The integer-parsing child was `01a14e9f-ceac-7e40-891c-564695e32b31`.
Its effective profile came from parent-linked runtime metadata, not a role name.
Its observed duration was about 34 seconds; this is not a comparative speed claim.
Parallel routing and reading implementation in this actual template task also
ran on runtime-confirmed Luna High with disjoint file ownership:
`01a14e93-e5a6-7463-a353-45d5b8da7565` and
`01a14e94-0894-79c0-a522-b8fbf3862a71`.

An initial direct-typo delta exposed an unnecessary book-application check on a
short completion message. The gate now separates substantive explanation from
literal edit confirmation. A fresh repeat passed with no repair and no children;
its ignored fixture is `workflow-live-tiny-0b096cb4-9617-45e8-9577-e4fdcedb4b94`.

## Negative And Integration Checks

- A native Stop command against real completed writing evidence rejected an
  added final newline. Original bytes verified again. This was a command probe,
  not an additional model run.
- Focused regressions cover stale/tampered receipts, request-start freshness,
  incomplete reading, changed drafts, request/session isolation, continuation
  replay, bounded repair failure, unknown effective model, visible fallback and
  child completion after the user steers to another request.
- A refresh command replaces stale reading under the same logical request and
  invalidates old application bindings. Explanations and novel-publication plans
  are not exempt merely because they contain literary nouns; actual narrative
  outputs can concern business or technical subjects.
- Lesson lifecycle and exact privacy-allowlist checks passed. Product-value
  preservation was judged on the assembled offer above, not keyword presence.
- Routing/agent-policy and MCP build/router/runtime checks passed for their
  changed scope. MCP accepted a bounded worker contract and returned ready Luna
  dispatch metadata.
- Structural template validation passed with zero errors/warnings. The integrated
  smoke baseline passed 206/206 checks. The later recovery module, integration,
  concurrent initialization and fail-closed checks passed their focused tests;
  this is baseline plus delta, not a fresh whole-tree pass. Setup and transactional sync ran only
  against disposable fixtures, not existing projects.

Native traces, book packets, exact applications, usage and fault-injection
artifacts stay under ignored `.session-cache/`. This report includes sanitized
outcomes and IDs only. No token/cost saving, universal host enforcement, semantic
comprehension or downstream adoption is inferred from these samples.
