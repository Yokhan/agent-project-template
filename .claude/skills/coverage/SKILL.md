---
name: coverage
description: "Analyze test coverage, find untested code paths, generate tests for gaps. Trigger on keywords: coverage, untested, test gaps."
---

# Test Coverage Analysis Skill

Find untested code and generate tests for critical gaps.

## Process

### Phase 1: Run Coverage
Detect stack and run appropriate coverage tool:
- **Node.js**: `npx vitest --coverage` or `npx jest --coverage`
- **Python**: `pytest --cov=src --cov-report=term-missing`
- **Rust**: `cargo tarpaulin`
- **Go**: `go test -coverprofile=coverage.out ./...`

### Phase 2: Analyze Gaps
1. Parse coverage report
2. Identify modules below threshold by layer:
   - `core/` -- 90% minimum
   - `features/` -- 80% minimum
   - `adapters/` -- 60% minimum (IO is hard to unit test)
   - `shared/` utilities -- 95% minimum
3. Report each layer separately
4. Prioritize by:
   - Business criticality (core/ > features/ > shared/)
   - Complexity (more branches = higher priority)
   - Recent changes (recently modified = higher priority)

### Phase 3: Generate Tests
For each critical gap, launch test-engineer agent to:
1. Read the untested source file
2. Identify untested paths (branches, error handlers)
3. Generate tests following project patterns
4. Run new tests and verify they pass
5. Verify coverage improved

### Phase 4: Report
```
## Coverage Report -- [date]

### Overall: [X]%

### Below Threshold (< 80%)
| Module | Coverage | Critical Paths Missing |
|--------|----------|----------------------|

### Tests Generated: [count]
### Coverage Delta: [before]% to [after]%
```

Save report to `brain/03-knowledge/coverage-YYYY-MM-DD.md`

---

## Coverage Is a TOOL, Not a GOAL

**Goodhart Law**: "When a measure becomes a target, it ceases to be a good measure."

Coverage percentage tells you what code EXECUTED during tests -- not what was VERIFIED. A test that calls a function without asserting anything produces coverage but zero confidence.

Anti-patterns that inflate coverage without value:
- Tests that call code but never assert outcomes ("coverage-only tests")
- Asserting only that no exception was thrown (verifies nothing about correctness)
- Snapshot tests on implementation details (breaks on any change, catches no bugs)
- Testing trivial getters/setters to pad numbers

The real question is not "what percentage of lines ran?" but "if I introduce a bug here, will a test fail?" That is what mutation testing answers.

## Coverage Types -- Know What You Are Measuring

### Line Coverage (Statement Coverage)
- **Measures**: which lines of code executed at least once
- **Misses**: branches within a line, short-circuit evaluation, ternary operators
- **Usefulness**: baseline metric, easy to understand, but weakest form
- Example of false confidence: `if (a && b)` -- line coverage counts this as covered if either branch runs

### Branch Coverage (Decision Coverage)
- **Measures**: whether each branch of every decision point was taken (both true AND false)
- **Misses**: combinations of conditions, path-dependent behavior
- **Usefulness**: significantly better than line coverage, catches many if/else gaps
- Example: `if (isAdmin || isOwner)` -- branch coverage requires testing both TRUE and FALSE overall, but does not require testing all combinations of isAdmin/isOwner

### Path Coverage
- **Measures**: every possible execution path through a function
- **Misses**: nothing in theory, but combinatorial explosion makes 100% impractical
- **Usefulness**: theoretical ideal, practical for small critical functions only
- A function with 5 independent if statements has 2^5 = 32 paths

### Mutation Testing
- **Measures**: whether tests DETECT changes to the code (not just execute it)
- **How it works**: automatically modify code (flip conditions, change operators, remove statements) and check if tests fail
- **Usefulness**: the strongest practical coverage metric -- directly answers "would my tests catch this bug?"
- Tools: Stryker (JS/TS), mutmut/cosmic-ray (Python), cargo-mutants (Rust), go-mutesting (Go)

## Coverage Strategy by Layer

Not all code deserves equal coverage investment. Risk-based allocation:

| Layer | Target | Rationale |
|-------|--------|-----------|
| `core/` | 90%+ branch | Business logic, pure functions. Bugs here have highest blast radius. Easy to test (no IO). |
| `shared/` | 95%+ branch | Used everywhere. A bug multiplies across all consumers. Also pure and easy to test. |
| `features/` | 80%+ branch | Feature logic with some complexity. Balance thoroughness with development speed. |
| `adapters/` | 60%+ line | IO-heavy code. Hard to unit test meaningfully. Focus on integration tests instead. |
| `types/` | N/A | Type definitions have no runtime behavior to test. Typecheck covers these. |

### Setting Thresholds in CI
- Configure per-directory thresholds, not a single global number
- Fail CI only when coverage DROPS (ratchet pattern), not when below target
- Ratchet: store current coverage, fail if new coverage < stored - 1%. This prevents backsliding while allowing gradual improvement.

## What to Do When Coverage Is Low -- Triage by Risk

When you inherit a codebase with low coverage, do not spray tests everywhere. Triage:

### Priority 1: High Risk, Low Coverage
- Code that handles money, auth, permissions, data mutations
- Code with many branches/conditions (high cyclomatic complexity)
- Code that has had recent bugs (check git blame + issue tracker)
- Action: write thorough tests immediately, including edge cases

### Priority 2: High Churn, Low Coverage
- Files frequently modified (check `git log --format=%H --follow -- file | wc -l`)
- Active feature areas where changes are planned
- Action: write characterization tests before next modification

### Priority 3: Stable, Low Coverage
- Code that has not changed in months and has no planned changes
- Legacy code that "just works"
- Action: defer. Write tests only when you need to modify this code (characterization tests first).

### Priority 4: Low Risk, Any Coverage
- Logging utilities, debug helpers, CLI formatting
- Action: do not bother unless they are broken. Time is better spent elsewhere.

## Mutation Testing -- Quality Beyond Coverage

Coverage tells you "this code ran." Mutation testing tells you "my tests would catch a bug here."

### How to Interpret Mutation Score
- **Killed mutant**: test suite detected the code change (GOOD)
- **Survived mutant**: code was changed and no test failed (BAD -- test gap)
- **Equivalent mutant**: mutation produces identical behavior (ignore -- not a real gap)
- **Mutation score** = killed / (killed + survived) -- aim for 80%+ on core modules

### When to Run Mutation Testing
- On `core/` and `shared/` modules -- where correctness matters most
- On code with high coverage but suspected weak assertions
- Before releasing critical features (security, financial calculations)
- NOT on adapter/IO code (too slow, too many false positives)

### Interpreting Survivors
Each survived mutant is a potential test gap. Review them:
1. Is the mutation meaningful? (Some mutations are logically equivalent -- skip these)
2. Does the survived mutation represent a real bug category? Then write a test
3. Is the untested behavior actually important? If yes, test it. If no, accept the gap.

## When 100% Coverage Is Wasteful vs Essential

### Essential (Pursue 100% or Near It)
- Cryptographic code, security-critical paths
- Financial calculations (money handling, tax computation)
- State machines with defined transitions (all transitions must be tested)
- Public library APIs (consumers depend on documented behavior)
- Serialization/deserialization (data corruption is catastrophic)

### Wasteful (Accept Lower Coverage)
- Generated code (ORM models, protobuf stubs, GraphQL resolvers)
- Framework boilerplate (config files, middleware wiring)
- Simple delegation (functions that just call another function)
- UI layout code (test behavior, not rendering details)
- Dead code that should be deleted instead of tested

### The 80/20 Rule of Coverage
The last 20% of coverage often requires 80% of the testing effort. Before chasing 100%, ask:
- "What bugs would the missing tests catch?"
- "What is the cost of those bugs vs. the cost of writing/maintaining these tests?"
- "Would mutation testing on the already-covered code be more valuable?"

## Cross-Reference

- `.claude/library/domain/domain-guards.md` -- "Property-Based Testing": for pure functions with wide input space, generate random inputs. Catches edge cases unit tests miss.
- `.claude/library/meta/strategic-thinking.md` -- "Find the bottleneck" (Theory of Constraints): low coverage in high-risk code is the bottleneck. Improving coverage in low-risk code is waste. "Culmination point": coverage effort has diminishing returns -- know when to stop.
- `.claude/library/technical/testing.md` -- Coverage thresholds by layer, test structure, what to test and what not to test
- `.claude/library/meta/critical-thinking.md` -- Goodhart Law awareness: when the metric becomes the target, the metric loses meaning
