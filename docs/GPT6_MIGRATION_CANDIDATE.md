# Historical GPT-6 development evidence — former 4.10.0 candidate

This dated report preserves the pre-release evidence from 2026-10-06. The
4.10.0 candidate was not published separately; its work is incorporated into
v5.0.0. Statements below about no commit/publication describe that historical
probe, not the current release state. For the active contract and migration see
`docs/MIGRATION_V5.md`; verify current publication through the exact GitHub
Release, tag commit, CI and checksums, not this report.

Evidence date: 2026-10-06. Branch: `codex/gpt6-agent-policy`. Base commit:
`c36f0f964dfc26e42910fed230dd9732fe1dcf3b` (source base, post-tag ownership fix).
Published v4.9.6 tag is separately bound to
`728f14ae365d4f6af0f6bcd0dab979dfa2d23227`; source base is not that release commit.
No commit, push, tag, publication or downstream update has been performed.

## Implemented scope

- Sol 6.1 High orchestration/integration; Luna 6 High bounded workers; Astra 6
  Medium architecture consultant, High for consequential risk. Optional efforts
  are capabilities, not defaults or a quality/cost benchmark.
- Validated worker scope/acceptance and resource contracts, declared host model
  and dispatch capability gates, parent-owned unbounded integration. Per-role
  evidence is merged without losing assignment provenance. Budgets are
  caller-owned declarations, not runtime-enforced token/attempt limits.
- Explicit collaboration call contract with model, effort, fork_turns=none,
  exact scope/acceptance and a local developer-instructions source. Parent reads
  and includes those instructions before launching. Native role dispatch is
  selected only for an advertised agent_type schema. Explicit fallback does
  not claim a TOML-enforced sandbox or effective native role.
- Current concurrency key, maximum three children excluding parent and depth
  one; legacy alias accepted statically, not proof of old-client compatibility.
- Narrow whole-request direct routing; risk and multi-intent safeguards;
  architecture consultancy is conditional, including Russian inflections.
  MCP clients receive recommendation-only model/effort and workflow depth;
  custom worker-contract input remains CLI-only (`--contract-file`).
- Shorter instructions and selected skills/shared rules preserve production
  and domain standards, ownership, dirty work, secrets and release safeguards.
  Enabling steps are not falsely called end-to-end product outcomes. No
  speculative full future skeleton, KPI or universal ceremony is required.
- Context-router compatible dependency updates and regression/runtime tests.

## Runtime and compatibility evidence

CLI target and CI pin: 0.160.1, available in npm and locally bundled. Global
0.125.0 was not upgraded. `--strict-config doctor --json` loaded configuration;
this does not establish custom-role dispatch. Optional read-only SQLite/rollout
collection requires Node 22.5+, tested on Node 24.13.0; ordinary Node20 tooling
does not acquire runtime proof from an unavailable collector.

Actual implementation thread was Sol 6.1 High. Both delegated bounded workers
were independently confirmed Luna 6 High in runtime state. These collaboration
workers are not evidence that the installed native TOML role loader works.

Native-role live attempt (parent thread
`01a1124d-39c4-74e3-b424-e2e01f7b3dce`) was **unverified**: the actual tool schema
offered task_name rather than agent_type, and exec JSON did not include a
genuine spawn event. The linked parent/child rollout must be used for explicit
dispatch evidence, without deriving effective role from a prompt or task name.
The diagnostic retry verified explicit requested/effective Luna High and
successful completion: parent `01a11257-eace-72f0-a68f-279c736af7c6`, child
`01a11258-0ca7-7231-981b-61bf65e1a09a`. The read-only collector linked genuine
parent function_call/call_id output, runtime row and all child turn_context
metadata; linked wait and trusted child task_complete are present, with no
turn_aborted. A current `explicit-profile` revalidation returned `verified`.
Native effective role remains null/unverified, runtime permissions unknown.
Local result: `tasks/audit/gpt6-migration-20261006/explicit-profile-result.json`.

The smoke now resolves the real profile filename and embeds its developer
instructions into the explicit launch contract. That prompt-embedding repair
was **not live rerun**, so role-contract delivery/acceptance remains unverified.
The last completed diagnostic run proves model/effort/lifecycle, not native
TOML loading, instruction delivery or the 12-case quality benchmark.

AgentOS was not modified. Its observed launcher accepts GPT-6 low/medium/high
but drops optional max/xhigh; these efforts are unavailable through that
adapter until separately updated and verified. The graph remains AgentOS-owned.

## Validation status

### Reviewed-defect repair and swarm activation (2026-10-06)

All five reviewed defects are repaired: terminal/abort events bind to the exact
child session and source rollout; fan-out skip clears dispatch readiness and
call contracts; resolved task-name child IDs survive collection; Windows live
launcher discovery skips missing/broken/unsupported binaries; native-role mode
reports `custom-role-unsupported` in this explicit-only launcher instead of
pretending that a task label loaded a native role. Offline launcher coverage is
part of the aggregate smoke. Actual default selection chose bundled Codex
0.160.1 instead of incomplete newer bundle or global 0.125.0.

Independent review also closed contradictory raw ID normalization, an unresolved
second spawn disappearing behind a successful first, global-mailbox wait
association without activity events, and explicitly foreign-parent wait events.
Every distinct spawn call needs a resolved child; duplicate representations of
one call do not create extra launches. A mailbox wakeup establishes only the
wait reference, not completion. Latest child task/turn lifecycle prevents an old
completion from proving a resumed task and prevents an earlier aborted turn
from invalidating a later successful retry. Imported parent-tool input remains
an assumed-authentic input boundary; this is not cryptographic log attestation.

Routing surfaces the orchestration skill for useful candidate work, recognizes
English/Russian swarm opt-out and independent review wording, and keeps XS,
zero-slot and explicit-opt-out requests non-dispatchable. The agent derives
bounded contracts from task scope; users do not have to author them manually.
Native and explicit call contracts and instruction-delivery steps are distinct.

The natural read-only review probe used parent
`01a11275-5f6a-7452-add0-e2778baa4848` (Sol 6.1 High) and two actual Luna High
children, `/root/trace_isolation`
`01a11276-6f27-7470-99d7-3b8e5ceb46f2` and `/root/router_gates`
`01a11276-9cff-7f52-a647-707a49dc96c5`. The parent loaded the router and
orchestration skill, prepared bounded contracts and called real collaboration
tools. The prompt requested independent evidence packets, not an exact spawn
call or fabricated marker. Effective native roles remain null/unverified;
permissions and verbatim role-instruction delivery remain unverified. Shared
source changed during review, so the parent refreshed the trace lane; this
activation probe is not a benchmark or acceptance audit of the final code.

The parent completed with exit 0. Final CLI validation of the actual exported
trace plus read-only DB/rollout evidence returned `verified` for both children
separately: the trace lane's latest third turn and router lane's first turn each
have their own `task_complete`, zero aborts and linked wait references. No
generic mailbox wakeup was counted as successful completion. A controlled
negative replay withheld only the router child's terminal events: the trace
child remained verified but the router child and overall result became
unverified, confirming that sibling completion does not cross-contaminate.
This is a test transformation, not an actual failed runtime turn.

The natural review also exposed malformed slot values (for example string
`"0"`) failing open and unrecognized "child agents" opt-out wording. These
same gate boundaries now have fail-closed validation for supplied nonnegative
safe-integer slots and English/Russian child-agent opt-out regressions. The
live probe was not rerun after these narrow gate fixes; final local tests
establish their behavior. A blocked architecture resource recommendation is
still a recommendation, not a launch or effective worker ownership claim.

Local evidence is under `tasks/audit/gpt6-migration-20261006/natural-swarm-*`
(ignored maintainer files, not shipped downstream). No extra charged run,
global configuration change, release or downstream mutation is implied.

Final non-trace functional snapshot passed these exact commands locally on
Windows with Git Bash/Node 24.13.0:

| Command | Result |
|---|---|
| `bash scripts/validate-template.sh` | 0 errors, 0 warnings; validation subset passed |
| `bash scripts/test-template.sh` | 198/198, including offline live-launcher regressions, orchestrator bootstrap and native sync preview/binding/rollback/conflict/path safety |
| `bash scripts/check-drift.sh` | 0 errors, 7 historical document-freshness warnings |
| `bash scripts/test-hooks.sh` | all 12 hooks passed |
| `bash scripts/sync-agents.sh` | GREEN, no issues/warnings |
| `node scripts/test-codex-agent-policy.js` | passed |
| `node scripts/test-codex-routing.js` | passed, including independent-review regressions |
| `npm --prefix mcp-servers/context-router test` | routing, security, TypeScript build and actual MCP protocol tests passed |
| `node scripts/validate-text-policy.js` | passed, 511 tracked files scanned |
| `node scripts/progressive-status.js --check` | passed |
| `git diff --check` | passed; platform line-ending notices are not errors |
| `node scripts/validate-text-policy.js --path .codex/agents/architecture-consultant.toml docs/GPT6_MIGRATION_CANDIDATE.md` | both new untracked candidate files passed |

The final trace focused rerun passed `node scripts/test-subagent-trace.js`,
including synthetic SQLite→CLI fixtures, native-role versus explicit-profile
regressions, expected-profile mismatch, missing expectations and abort rejection.
Shell syntax and text-policy checks passed. Optional SQLite integration tests
explicitly skip on older Node rather than pretending collector verification.
Imported JSONL cannot self-assert trusted provenance: the CLI strips incoming
trust markers and the collector alone adds them. A forged-input CLI regression
failed verification as intended; the actual completed live profile revalidated
successfully after this hardening.
Earlier failed in-progress
runs are superseded by the listed successful source snapshot, not ignored.
No release CI run or Linux execution is implied by these Windows local results.

Current context-router npm audit reported zero vulnerabilities after the
compatible updates below. This is not a security audit of the ten-tool stack,
Probe reachability, downstream deployments or all dependencies on this machine.
Probe remains pinned to its existing RC; no unrelated dependency sweep occurred.
The direct SDK update stays within its 1.x API line. Its supported transitive
dependency graph includes @hono/node-server 1.x → 2.x; not every transitive
version change is a patch. MCP build, security and live protocol regressions
were used to verify this graph, without `--force` or blanket breaking upgrades.

| Package | Previous locked version | Candidate locked version |
|---|---|---|
| @modelcontextprotocol/sdk | 1.29.0 | 1.32.1 |
| @hono/node-server | 1.19.14 | 2.1.3 |
| body-parser | 2.2.2 | 2.3.0 |
| fast-uri | 3.1.3 | 3.1.8 |
| hono | 4.12.30 | 4.13.13 |
| ip-address | 10.2.0 | 10.7.3 |
| proxy-addr | 2.0.7 | 2.0.8 |
| qs | 6.15.3 | 6.16.0 |

Original versions were read from the exact base commit lock; before/after audit
JSON and transitive advisory paths are in local maintainer evidence at
`tasks/audit/gpt6-migration-20261006/`. This directory is intentionally ignored,
not a downstream-shipped audit claim.

## Comparative quality acceptance — not run

The following are accepted evaluation contracts, not executed benchmarks or
hidden evaluators. Fixtures, isolated workspaces and blind review must be
prepared before running them. All rows currently have status **not-run** for
every listed profile; all-agent tokens, latency, RAM and cost are **unknown**,
not zero. Routing assertions do not satisfy any of these quality evaluations.

| Case | Acceptance/fixture requirement | Profiles |
|---|---|---|
| 1 bounded off-by-one | Allowed one fixture module; hidden edge tests; no unrelated writes | Luna High/Max |
| 2 pure contract module | Allowed module; hidden valid/invalid input contract tests | Luna High/Max |
| 3 regression tests | Allowed tests only; seeded mutation must fail | Luna High/Max |
| 4 docs update | Allowed docs only; all commands resolve; no code writes | Luna High/Max |
| 5 primary research | Dated primary evidence, links/uncertainty; blind human rubric | Luna High/Max |
| 6 symbol rename | Allowed symbol/direct consumers; no unrelated diff; tests | Luna High/Max |
| 7 cross-module bug | Behavior reproduction plus hidden integration regression | Sol High/XHigh |
| 8 simple feature | Allowed feature boundary; end-to-end fixture; no forced Astra | Sol High/XHigh |
| 9 architecture conflict | Decision, risks/reversibility; blind human rubric | Astra Medium/High |
| 10 seeded security flaw | Exact exploit, safe mitigation; no planted-secret echo | Sol High/XHigh |
| 11 dirty downstream preview | Isolated fixture; zero filesystem mutation; project ownership preserved | Sol High |
| 12 interrupted continuation | Recheck stale evidence; no duplicate action or lost dirty work | Sol High |

Compare old and proportional rules using the same Sol High profile on selected
representative cases; historical fixtures are not a valid live old-model run.
The 12-case executable dataset/harness and full measurements remain pending.

RAM target is 2–3 GiB/project, not measured or enforced. Six projects imply
12–18 GiB plus host baseline; disk budget is separate and unspecified. There
were no OS memory optimizations or downstream changes.

## Remaining gates and reproduction

1. Independent review of the candidate; final broad source checks are listed above.
2. Live verify final embedded-instructions contract delivery/acceptance; model,
   effort and completion were verified separately. Native role support is
   a separate capability, not to be silently substituted or reported proven.
3. Prepare and execute the 12-case quality/effort/rules acceptance matrix;
   optional Max/XHigh need supported host, reason and bounded budget.
4. Commit reviewed source only after authorization, run Windows/Linux release
   CI, inspect archive/checksums and bind the exact tag to the validated commit.
   Publication and downstream digest-bound preview/apply remain separate gates.

```powershell
node scripts/test-codex-agent-policy.js
node scripts/test-codex-routing.js
node scripts/test-subagent-trace.js
npm --prefix mcp-servers/context-router test
```

```bash
bash scripts/validate-template.sh
bash scripts/check-drift.sh
bash scripts/test-hooks.sh
bash scripts/test-template.sh
bash scripts/sync-agents.sh
bash scripts/test-codex-subagents-live.sh --yes # consumes quota
```

An implementation candidate is not a completed migration, measured savings or
production release until its remaining acceptance and release gates pass.

The live script defaults to `explicit-profile`. This launcher is explicit-only:
`CODEX_LIVE_VALIDATION_MODE=native-role` fails before launch with
`custom-role-unsupported`. Testing an actually supported native-role host needs
a separate adapter with an observed `agent_type` schema; no substitute native
proof is claimed. Instruction delivery and permissions remain separate.
