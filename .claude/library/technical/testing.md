# Testing Rules

## Disposable files and cleanup

Run tests and disposable build/copy experiments through
`node scripts/managed-temp.js run -- <executable> <args>` from the project root.
For example: `node scripts/managed-temp.js run -- node scripts/test-sync-template.js`.
In a native Codex request, use the hook-provided immutable ledger binding:
`node scripts/managed-temp.js run --request-state <request.json> -- node scripts/test-sync-template.js`.
The runner validates the ledger against the project and observed session, then
propagates that captured identity to nested runs. A session environment variable
alone does not prove which request started a command; a mutable current-request
pointer must not be used to invent that proof.
The aggregate `bash scripts/test-template.sh` wraps itself automatically. The
live workflow harness also owns and removes its snapshot; its compact acceptance
report stays outside the snapshot. Keep required outputs outside scratch before
the process finishes. Do not copy books, chats or private source into reports.

On Windows the runner assigns the suspended command to an owned Job Object
before allowing it to execute. Its independent supervisor stops the family when
the foreground command ends, fails, is cancelled, or loses its runner. Cleanup
requires the supervisor's zero-active-process result. An unverified termination
retains resources and reports a failure. Strict launches on other platforms fail
closed: a POSIX process group cannot contain children that start another session.
For trusted test/command adapters, explicit `--process-contract foreground`
declares that every child stays in the group and is awaited. The aggregate selects
this limited mode on POSIX and passes it to nested test runs via
`AGENT_MANAGED_PROCESS_CONTRACT=foreground`. It never reports whole-family proof:
normal results plus group absence permit cleanup under that declared contract;
cancelled, interrupted, or uncertain runs remain protected by a marker written
before launch. Build/browser profiles cannot inherit this exception. Do not claim
POSIX has equivalent process cleanup. Persistent servers need a
separate explicit lifecycle; this runner stops its owned servers at command exit.

Select a profile for disposable builds/browser runs:

| Profile | Direct executable example | Managed outputs |
| --- | --- | --- |
| `test` (default) | `node scripts/test-sync-template.js` | TEMP/TMP/TMPDIR, npm/npx cache, Node compile cache |
| `vite` | `node node_modules/vite/bin/vite.js build` | build output; config runner avoids temporary config bundles in node_modules |
| `tsc` | `node node_modules/typescript/lib/tsc.js` | JS, declarations, incremental state, configured outFile |
| `cargo` | `cargo build --offline` | target and intermediate build directories, Cargo home cache |
| `browser` | direct Chromium/Chrome/Edge executable | fresh profile, disk cache, crash logs, default download directory; default 60s deadline |
| `command` | project-owned script | script must consume the declared output variables below |

For example, `node scripts/managed-temp.js run --profile cargo -- cargo build --offline`.
Vite requires a version supporting `--configLoader runner`. TypeScript build/watch,
trace/profiling, Cargo runtime argument forwarding, and browser screenshot/PDF flags
are rejected until an adapter owns those outputs. Configurations and plugins can
write custom paths: these profiles are adapters, not an OS filesystem sandbox.
Compound package build scripts require an explicit project adapter. Generic scripts
must use `AGENT_RUN_OUTPUT`, `AGENT_RUN_BROWSER_DIR`, `AGENT_RUN_COPY_DIR`,
`AGENT_RUN_ARCHIVE_DIR`, and `AGENT_RUN_LOG_DIR`; these paths are allocated and
registered before execution. Do not copy project snapshots to unregistered paths.

For ordinary browser assertions prefer the project's Playwright script through
the `test` profile. Its temporary profile inherits owned TEMP; direct traces,
screenshots and downloads to owned output and await browser.close(). The direct
`browser` adapter controls files and process lifetime; it does not guarantee that
every installed browser's sandbox/headless CLI works on this host. Never add
`--no-sandbox` automatically to conceal startup failures. A timeout is a failed
browser check even when its resource cleanup succeeds.

Default caches are disposable. `--cache shared` reuses only newly owned caches
outside the repository; defaults are **10 GiB per project** and **7 idle days**.
`--cache-max-bytes` and `--cache-max-age-ms` configure one invocation; hooks use
the defaults. Pruning removes oldest idle owned caches first, preserves active
supervisor leases, and reports incomplete scans and budget excess. It never
cleans machine-wide npm/Cargo caches, downloaded browser binaries or toolchains.
The cache coordinator serializes new clients with a persistent SQLite
`BEGIN IMMEDIATE` transaction and keeps `.operation.claim` as the compatibility
barrier for older clients. It commits the persistent database identity before
acquiring the operation mutex; SQLite contention returns the retryable
`operation-in-progress` result. Only a strictly recognized `sqlite-v2` claim with
the matching database identity and an `ESRCH` process result is quarantined
automatically; legacy v1, live/uncertain, malformed and database-mismatch cases
stay blocked. An owner may recover a stale legacy claim only after reviewing
its bytes and PID: `node scripts/managed-temp.js cache-recover
--expected-sha256 <sha256> --pid <pid>`. Recovery runs under the same SQLite
transaction, rechecks the exact bounded regular-file bytes and process death,
then records an intent before atomically archiving the whole marker into a new
exclusive directory. A later coordinator completes a missing receipt from the
checked archive or blocks on an unknown/incomplete record. Recovery archives
are bounded to 32 directories and 2 MiB total, including unfinished records;
the marker remains in place when that budget is full. Receipts omit the marker
nonce. Recovery never changes cache payloads, leases, run markers or resource
ownership.
For the default ephemeral run, a project-wide shared-cache prune happens only
after the run's process and owned scratch cleanup. If that unrelated cache
housekeeping is incomplete, the command can still succeed when its child and
owned cleanup succeeded; the immutable report keeps the incomplete `cache`
result and adds `diagnostics.cacheHousekeeping` with `blocking: false`, its
reason, and measured remaining bytes when available. Owned process proof,
scratch removal, cache-lease release, work/free-space admission, and child
failures remain blocking. A run with `--cache shared` keeps cache housekeeping
strict. Standalone `sweep` and `cache-prune` also fail when cache pruning is
incomplete or over budget; a transient `operation-in-progress` result remains a
nonfailure for compatibility and is reported for an explicit retry. Inspect the
report rather than treating other incomplete cleanup as done.
`--max-work-bytes` (10 GiB) and `--min-free-bytes` (2 GiB) sample owned scratch
and disk space every five seconds and cancel the owned job on a breached limit;
these are best-effort guards, not hard disk quotas. `--timeout-ms` bounds a run.

For a workload that must fail when its owned work tree cannot be fully observed,
opt in with `--work-observation strict`. It checks the whole owned run tree before
launch, at the periodic interval, and after the owned process family has stopped.
An incomplete scan, unsafe entry, or observed byte count at or above
`--max-work-bytes` fails the run and prevents output export. Periodic scans use
a live traversal: normal writes and file creation/removal do not require a
quiescent tree. An entry observed to have vanished is accounted for explicitly;
it does not excuse an unreadable or unfinished directory listing. Before launch,
after process-family stop, and before export, scans additionally require stable
metadata and directory membership. Strict mode requires a positive work-byte
limit. Timeout still returns 124.

Strict scans default to 1,000 ms and 100,000 entries. Set positive safe integers
with `--work-observation-budget-ms` and `--work-observation-max-entries`; these
are separate from cache housekeeping's `--budget-ms`. Stable scans use two
metadata/membership passes sharing one scan's time and entry budgets; periodic
live scans use one complete bounded traversal. The default
`--work-observation best-effort` retains the existing 100 ms/10,000-entry scan
and permits incomplete observations below the observed byte threshold.
Reports record mode, scan bounds, complete/incomplete sample counts, the last,
`lastPeriodic`, and final samples, and failure reason under `workObservation`. Each sample names
its `scanKind` (`live`, `stable`, or `best-effort`) and counts safely observed
vanished entries in `transientMissingEntries`. A strict export also checks the
output tree and records `exportObservation`.

Strict samples report `elapsedMs`, `entriesExamined`, and `exhaustedBy`
(`time`, `entries`, or `null`). LIVE entry work includes enumeration and repeated
ancestor checks; STABLE counts roots and enumeration across its two passes,
without charging every filesystem call. These are implementation work counters,
not unique-file or interchangeable OS-call counts. Use the measurements to distinguish
an elapsed-time limit from an entry limit before changing a producer's admitted
scan envelope. Cleanup duration includes deletion and is not a scan benchmark.
A successful scan of immutable inputs does not establish coverage under an
active producer's load. Unmeasured best-effort telemetry remains `null`.

Worker-backed observation is an explicit opt-in with
`--work-observation-executor worker --work-observation strict`; the default
executor remains inline. Admission requires Windows contained Job supervision,
`--work-observation-budget-ms 10000 --work-observation-max-age-ms 15000`,
100,000 charged operations, a run timeout from 1 through 1,800,000 ms, an
explicit positive sampled work limit no greater than 4 GiB, and a free-space
threshold of at least 2 GiB. The reviewed VPN policy uses 4 GiB and 2 GiB;
stricter byte limits remain valid. These time limits are an
accepted workload policy, not measured completion guarantees or global defaults.

One scanner thread handles one observation at a time. The parent starts its
monotonic deadline at dispatch, including startup and message delay, and rejects
late results. Five-second periodic ticks skip an occupied scanner without
queuing another observation. Freshness is measured from the start of the last
complete observation, seeded by prelaunch; pending, failed or cancelled work
never refreshes it. A 15-second freshness limit may therefore reject a second
observation before that observation's own 10-second deadline.

The controller plans free-space probes at one-second intervals while retaining
runtime and signal handling outside the scanner's synchronous traversal.
Actual scheduling and filesystem latency must be measured; this is not a
real-time guarantee. Observation error, unexpected worker exit, invalid identity,
unsafe entry, deadline or freshness expiry remains terminal. Stop the producer
promptly, then confirm scanner and process-family settlement before deleting
owned scratch. Unknown settlement retains resources.

On normal producer exit, explicitly cancel and settle any pending live scan
before complete stable final/output validation. Cancellation acknowledgement
must arrive within the pending observation's original deadline; shutdown has a
separate bounded wait of at most 10 seconds. Cancelled work stays visible
and cannot authorize export; earlier terminal failures remain failures. Confirm
scanner shutdown before moving required output or cleaning scratch. Worker
memory settings constrain its JS engine, not all external buffers or process RSS.

This is sampled logical-byte observation of the owned run tree, not an atomic
snapshot, an OS disk quota, or a security sandbox. Short-lived peaks between
samples and writes outside the owned tree are not bounded by this guard.

Successful output is discarded unless explicitly exported with
`--keep-output NEW_DIRECTORY`; an existing destination is refused. Export is an
atomic directory move on the same volume; cross-volume fallback copies are refused
to avoid leaving partial output after interruption. Required
release/evidence artifacts are persistent only when deliberately saved. A compact
terminal report (at most 64 KiB per run) lives outside scratch. Each run has an
immutable report under the external project report namespace's `runs/` directory;
`last.json` remains a latest-result view. Reports survive deletion of disposable
fixture projects. Inspect `node scripts/managed-temp.js report`. It records observed bytes actually removed,
retained cache bytes, process proof, and unresolved cleanup; it does not claim
to measure every byte created during execution. Command failure codes survive.
Forced process-family termination does not guarantee producer `catch` or
`finally` blocks will archive logs. If abort diagnostics are required, declare
an owned durable progress path before execution: retain only bounded,
grant/run-bound, explicitly allowed phase/counter fields as work advances.
Treat an interrupted write as uncommitted. Do not retain arbitrary stdout,
environment values, credentials, source trees or whole scratch as diagnostics.
Read a saved immutable report after its project is removed with
`node scripts/managed-temp.js report --report-path <absolute-report.json>`.

Closed runs have no supported reopen, adoption or read-only handoff lease.
`retain()` belongs to the original live run handle and changes its owner marker;
`--keep-output` exports the current successful build before cleanup. Neither is
permission to rewrite a closed marker or adopt selected old payloads. Storage
operation pins do not establish managed-run leases. Known consumers of a closed
run require an explicit retention/handoff decision before further cleanup.

Existing trusted lifecycle hooks reclaim owned inactive remnants and idle owned
caches after tools, at Stop and next SessionStart. Inspect
`node scripts/managed-temp.js status`; retry
`node scripts/managed-temp.js sweep --budget-ms 10000` for partial cleanup.
After ownership, inactivity and cleanup claims are verified, cleanup can unlink
descendant symbolic-link/junction entries without following their targets.
Root/ancestor and ownership-marker links remain refusals; default inventory and
build export checks stay strict. Link entries consume traversal budgets but do
not count target bytes as removed payload. Rechecking parent paths narrows races;
it is not atomic protection against hostile concurrent ancestor replacement.
Preserve active leases and investigate refused paths; never erase markers to
silence a warning. Stop blocks only for unresolved runs with validated exact
ownership matching its session and request. Foreign, earlier, session-only and
legacy unscoped runs remain protected and appear in nonblocking diagnostics;
unattributed global cache warnings do not become the current request's failures.
This changes responsibility for Stop, not sweep deletion eligibility or the
standalone cleanup command's failure status. A termination-unverified reason
means missing positive evidence, not a proven live process. Reports retain safe
launch/proof metadata, not raw command arguments, environment or child output.
Explicit npm `--cache` flags can override environment routing;
do not point disposable commands at unmanaged caches. Sources, dependencies,
MCP databases, legacy directories, chat history, books, and unknown files stay
outside this cleanup contract. Never sweep OS Temp or .session-cache by prefix
or age. If all runners/app processes are stopped, recovery waits for the next
lifecycle event.

## Test Location
- Tests colocated with source code: `module.test.ts`, `test_module.py`, `module_test.go`
- Integration tests in `tests/integration/`
- E2E tests in `tests/e2e/`

## Test Independence
- Each test is fully independent. No shared mutable state between tests.
- Use factory functions for test data, not hardcoded objects.
- Setup/teardown per test, not per suite (unless expensive resources).

## Test Structure
- Arrange → Act → Assert (AAA pattern)
- One assertion concept per test (multiple asserts OK if testing same concept)
- Test name describes the scenario: `should_return_error_when_input_is_empty`

## What to Test
- Pure functions: input/output pairs, edge cases, error cases
- For pure functions with wide input space: property-based tests with fixed seed
- Async code: test both success and error paths
- Public API only. Don't test private internals.

## What NOT to Test
- Framework code (React renders, Express routing)
- Simple getters/setters
- Type system (that's what typecheck is for)
- Stale implementation paths whose only requirement is "must not ship". Delete
  the stale path instead, and test the intended public contract plus absence of
  obsolete routes/flags only when that absence is a product or safety contract.

## Test Execution
- Follow `.claude/library/process/self-verification.md` for verification cadence.
- Before a useful wave, choose focused checks and any broad acceptance check.
  Run relevant tests after coherent change batches, not a full suite per patch.
- The parent/integrator owns broad verification at the wave boundary; workers
  return assigned scoped checks and evidence, not independent full-suite reruns.
- Reuse evidence only for its tested scope/content/inputs/toolchain. State the
  concrete invalidation before repeating a broad check; unrelated docs changes
  do not invalidate all tests. Report baseline plus delta honestly.
- On failure, reproduce and fix narrowly; widen coverage when causal evidence
  requires it. Preserve required CI, security, release, and artifact-bound gates.
- Fix failing tests before committing
- Never commit with known test failures

## Coverage Thresholds
- `core/` — 90% minimum.
- `features/` — 80% minimum.
- `adapters/` — 60% minimum (IO is hard to unit test).
- `shared/` utilities — 95% minimum.
- Property-based tests for pure functions with >3 parameters.

## Snapshot Tests
- Use ONLY for serialized outputs (JSON responses, HTML templates, CLI output).
- Never for business logic.
- Always review snapshot diffs — never run `--update-all` blindly.
- Snapshots must be deterministic (no dates, UUIDs, random values).

## Testing Pyramid Strategy
- **Many unit tests** (~70%): fast, isolated, test pure logic. Run in <10s. Cheap to write and maintain.
- **Fewer integration tests** (~20%): test module boundaries, DB queries, API contracts. Slower but catch wiring bugs.
- **Few E2E tests** (~10%): test critical user journeys only. Expensive, slow, flaky-prone.
- WHY this ratio: unit tests give fast feedback loops (seconds, not minutes). Integration tests catch what units miss (serialization, config, wiring). E2E tests prove the system works but are too slow/flaky to be the primary safety net.
- Invert the pyramid = slow CI, flaky builds, developer frustration, ignored test suites.

## Flaky Test Policy
- A flaky test is WORSE than no test — it erodes trust in the entire suite.
- When a test flakes: fix root cause within 48 hours or delete it.
- Never `@skip` / `.skip()` permanently. Skipped tests are invisible broken windows.
- Common flaky causes: time-dependent logic, shared state, network calls, race conditions.
- Fix pattern: make deterministic (inject clocks, isolate state, mock network, add proper waits).

## Test Naming Convention
- Format: `should_[expected behavior]_when_[condition]`
- Examples: `should_return_404_when_user_not_found`, `should_retry_when_connection_timeout`
- The name IS the specification. A reader should understand the requirement without reading the test body.
- Group related tests with `describe` blocks named after the unit under test.

## Factory / Fixture Pattern
- Never use raw object literals scattered across tests. Create factory functions.
- `createUser({ name: 'Alice' })` with sensible defaults for all other fields.
- Factories centralized per module: `auth.fixtures.ts`, `test_auth_factory.py`.
- Benefits: one place to update when schema changes, readable tests, less duplication.
- For complex graphs (user + org + permissions), use builder pattern: `UserBuilder().withOrg(org).withRole('admin').build()`

## Mocks vs Real Dependencies
- **Mock external services**: APIs, payment gateways, email providers — you don't control them.
- **Use real internal dependencies**: your own modules, in-memory DB, local queues — they're fast and accurate.
- Mocking internal code couples tests to implementation. Refactor breaks tests even when behavior is unchanged.
- Exception: mock internal dependencies that are genuinely slow (>100ms) or have side effects (file I/O).
- Rule: if you mock more than 2 things in a test, the design probably needs refactoring, not more mocks.

## Contract Testing for API Boundaries
- When modules communicate via API (REST, gRPC, messages): consumer-driven contract tests.
- Consumer defines expected request/response shape. Provider verifies it passes.
- Tools: Pact, Spring Cloud Contract, or custom schema validation.
- Contract tests catch breaking changes BEFORE deployment, not after production incidents.
- Especially critical for microservices and external API consumers.

## Performance Test Thresholds
- Define SLA for critical paths: API response time, page load, batch processing duration.
- Codify thresholds in tests: `expect(responseTime).toBeLessThan(200)` // ms
- Run performance tests in CI on every merge to main (not just before release).
- Fail the build on regression: if P95 latency increases >20%, investigate before merging.
- Track trends over time — slow degradation is invisible without historical data.
