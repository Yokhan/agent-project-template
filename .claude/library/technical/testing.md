# Testing Rules

## Disposable files and cleanup

Run tests and disposable build/copy experiments through
`node scripts/managed-temp.js run -- <executable> <args>` from the project root.
For example: `node scripts/managed-temp.js run -- node scripts/test-sync-template.js`.
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
`--max-work-bytes` (10 GiB) and `--min-free-bytes` (2 GiB) sample owned scratch
and disk space every five seconds and cancel the owned job on a breached limit;
these are best-effort guards, not hard disk quotas. `--timeout-ms` bounds a run.

Successful output is discarded unless explicitly exported with
`--keep-output NEW_DIRECTORY`; an existing destination is refused. Export is an
atomic directory move on the same volume; cross-volume fallback copies are refused
to avoid leaving partial output after interruption. Required
release/evidence artifacts are persistent only when deliberately saved. A compact
last result (at most 64 KiB) lives outside scratch: inspect
`node scripts/managed-temp.js report`. It records observed bytes actually removed,
retained cache bytes, process proof, and unresolved cleanup; it does not claim
to measure every byte created during execution. Command failure codes survive.

Existing trusted lifecycle hooks reclaim owned inactive remnants and idle owned
caches after tools, at Stop and next SessionStart. Inspect
`node scripts/managed-temp.js status`; retry
`node scripts/managed-temp.js sweep --budget-ms 10000` for partial cleanup.
Preserve active leases and investigate refused paths; never erase markers to
silence a warning. Explicit npm `--cache` flags can override environment routing;
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
