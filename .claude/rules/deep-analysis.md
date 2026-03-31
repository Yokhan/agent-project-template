# Deep Analysis Protocol — No Surface-Level Bullshit

## The Rule
When analyzing, auditing, or reporting on ANY system, project, or service — the agent MUST go deep.
HTTP 200 is not "working". Green CI is not "healthy". "Looks fine" is not analysis.

This rule exists because agents repeatedly report surface-level status as real analysis.
That's useless. The user has complex projects and needs REAL understanding.

## Minimum Analysis Depth (MANDATORY)

### For project health checks / status reports:
1. **Read PROJECT_SPEC.md** — understand what this project actually does
2. **Walk the user journey** — trace the FULL path a real user would take, step by step
3. **Check every integration point** — APIs, databases, external services, auth flows
4. **Evaluate with domain lens** — would a marketer/designer/user find this acceptable?
5. **Check error paths** — what happens when things fail? Are errors helpful or cryptic?
6. **Check data flow** — does data arrive where it should? Is it the right shape?
7. **Report with evidence** — "X works because I verified Y" not "X seems fine"

### For code analysis / reviews:
1. **Read the FULL file** — not just the changed lines. Context is in the surrounding code
2. **Read imports and dependents** — what feeds this code, what consumes its output
3. **Read the tests** — do they test behavior or just implementation?
4. **Check edge cases** — empty inputs, large inputs, concurrent access, error states
5. **Check the ACTUAL runtime** — does it work, or does it just compile?

### For any "is this working?" question:
- **Level 0 (INSUFFICIENT)**: HTTP 200, compiles, tests pass
- **Level 1 (MINIMUM)**: + user can complete primary action end-to-end
- **Level 2 (ADEQUATE)**: + error states handled, edge cases work, performance acceptable
- **Level 3 (THOROUGH)**: + evaluated from user/business/marketing perspective, competitive context

Level 0 is NEVER an acceptable answer. Level 1 is the minimum for any report.

## Anti-Patterns (what agents actually do wrong)

| Lazy analysis | Real analysis |
|--------------|---------------|
| "API returns 200" | "API returns valid user object with all fields populated, tested with real auth token" |
| "Tests pass" | "42 tests pass covering auth flow, error handling, and edge cases. Coverage: 87%" |
| "Site loads" | "Homepage loads in 1.2s, hero renders, CTA visible above fold, mobile responsive" |
| "Everything works" | "User registration → email verification → login → dashboard flow completes. Found: forgot-password link returns 404" |
| "Looks good" | "Code follows project conventions. One concern: auth.service.ts at 340 lines, approaching 375 limit" |

## Enforcement

Before submitting ANY analysis or status report, check:

1. **Did I actually TEST what I'm claiming works?** (not assume, not infer — test)
2. **Would a skeptical user accept this evidence?** (if they'd say "but did you actually check?" — you didn't go deep enough)
3. **Did I find at least ONE issue or improvement?** (zero findings = insufficient analysis, not perfect system)
4. **Am I reporting what I OBSERVED or what I EXPECTED?** (only observations count)

If any answer is "no" → go deeper before reporting.

## The "Three Whys" Test
For every finding, ask WHY three times:
- "Registration fails" → WHY? → "Validation error" → WHY? → "Email regex rejects valid TLDs" → WHY? → "Regex hasn't been updated since 2020, misses .dev and .app"

Stop at the root cause. Surface symptoms are not findings.

## Reference
Promoted from lesson 2026-03-31: "Agent reported services as working based on HTTP 200 without checking actual user experience."
See also: `.claude/rules/research-first.md`, `.claude/rules/self-verification.md`
