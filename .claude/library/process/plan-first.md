# Plan-First Protocol — Architecture Before Code

## The Rule
For every task S+ size, the agent MUST produce a written plan with file structure and complexity estimate BEFORE writing any code.
Plans are saved to `tasks/current.md` under `## Plan` and tracked alongside the work.

Coding without a plan = bloated files, wrong structure, rework.

## When Planning is Mandatory

| Task Size | Planning Required | Detail Level |
|-----------|------------------|--------------|
| **XS** | No | Just do it |
| **S** | Brief | 3-5 lines: what files, what changes |
| **M** | Standard | Full plan (see template below) |
| **L** | Detailed | Full plan + user approval before coding |
| **XL** | Decompose first | Break into M-tasks, plan each one |

## Plan Template (M+ tasks)

Write this to `tasks/current.md` under `## Plan` BEFORE coding:

```markdown
## Plan

### Goal
[1 sentence: what this achieves for the user]

### Complexity Estimate
- Size: [XS/S/M/L/XL]
- Files to create: [count]
- Files to modify: [count]
- Estimated lines: [range]
- Risk: [LOW/MEDIUM/HIGH/CRITICAL — classify per risk-classification.md]

### File Architecture
[Directory tree of files to create/modify with purpose of each]

```
src/
  features/
    auth/
      auth.service.ts    — [NEW] login/logout logic
      auth.types.ts      — [NEW] AuthUser, AuthError types
      auth.test.ts       — [NEW] unit tests
      index.ts           — [MODIFY] add auth exports
```

### Implementation Order
1. [First file/step — why first]
2. [Second — depends on #1 because...]
3. [Third — ...]

### Boundaries
- Max file size: 375 lines. If any file approaches limit → split plan now, not later.
- Module boundary: [which module(s) this touches]
- Public API changes: [yes/no — if yes, document contract]

### Risks & Mitigations
- [Risk 1] → [Mitigation]
- [Risk 2] → [Mitigation]

### Plan B (mandatory for M+ tasks)
If the primary approach fails at step [N], the fallback is:
- [Alternative approach — what changes]
- [What can be reused from Plan A]
- [Signal to switch: what specific failure triggers Plan B]

For S tasks: mental Plan B is fine (no need to write it out).
For L/XL tasks: Plan B must be written and approved by user alongside Plan A.
```

## File Architecture Rules

### Before creating ANY file, answer:
1. **Does a similar file already exist?** Search with Grep/Glob first. Extend > duplicate.
2. **Will this file stay under 375 lines?** If not, split the responsibility NOW.
3. **Does it belong in this directory?** Check architecture rules (vertical slices, dependency direction).
4. **Is the naming consistent?** Match existing patterns in the project.

### Splitting heuristic:
- One concept = one file. If you're naming it `utils.ts` or `helpers.py`, you're avoiding the decision of WHERE it belongs.
- If a planned file has 3+ unrelated functions → it's 2-3 files.
- If a planned module has 5+ files → consider if it's actually 2 modules.

## Complexity Estimation

### Count before you code:
- **Files to touch**: 1-3 = safe, 4-7 = medium (plan carefully), 8+ = decompose
- **New dependencies**: each new import/package = +1 complexity point
- **Affected tests**: count tests that will need updating
- **Cross-module changes**: each module boundary crossed = +2 complexity points

### Estimate accuracy rule:
- Your first estimate is probably 50% too low (planning fallacy)
- If estimate says "M" but you feel unsure → it's "L"
- If touching shared/ or core/ → bump complexity one level

## Plan Tracking

### During implementation:
- Check off completed steps in the plan
- If the plan changes (new files needed, different structure) → UPDATE THE PLAN FIRST, then code
- If complexity exceeds estimate by >50% → STOP, reassess, inform user

### After implementation:
- Compare actual vs planned: files created, lines written, time spent
- If estimate was off by >2x → log to lessons.md WHY (improves future estimates)

## Planning Quality Gate (M+ tasks — must pass before coding begins)

A plan is NOT ready for execution until ALL applicable criteria are met.
If any criterion fails, refine the plan. Do not proceed to code.

| # | Criterion | Check | Fail Signal |
|---|-----------|-------|-------------|
| 1 | **Goal clarity** | Can you state the user's goal in ONE sentence without jargon? | If you need 2+ sentences, you don't understand the goal yet |
| 2 | **Scope boundary** | Are the files to modify/create explicitly listed? | "And maybe some others" = fail |
| 3 | **Dependency map** | Are imports, consumers, and cross-module effects documented? | No blast-radius for MEDIUM+ risk = fail |
| 4 | **Test scenarios** | Are happy path, edge cases, and error scenarios enumerated? | "Will add tests" without specifics = fail |
| 5 | **Risk classification** | Is risk level stated with justification? | Missing risk level = fail |
| 6 | **Size confidence** | Is estimate based on file count + line count, not gut feeling? | "Should be quick" = fail |
| 7 | **Reversibility** | Can this be reverted with `git revert`? If not, is rollback plan documented? | Irreversible change without rollback plan = fail |
| 8 | **Plan B exists** | Is there a concrete alternative if primary approach fails? | "We'll figure it out" = fail |
| 9 | **No premature code** | Does the plan describe WHAT and WHY, not HOW in code? | Code snippets in plan = premature |

**Scoring**: 9/9 = proceed. 7-8/9 = proceed with noted gaps. <7/9 = refine before coding.

For L/XL tasks, add:
- [ ] User has approved the plan
- [ ] Decomposition into M-sized subtasks is complete
- [ ] Each subtask passes criteria 1-9 independently

## Test Scenario Templates (required in plan for M+ tasks)

Before writing any code, enumerate test scenarios in the plan. This is NOT about writing test code — it's about THINKING about what could go wrong.

For EACH implementation unit (service, component, endpoint), add to plan:

```markdown
### Test Scenarios: [unit name]

**Happy path:**
- [ ] [Input] → [Expected output/behavior]
- [ ] [Another normal case]

**Edge cases:**
- [ ] Empty/null input → [expected behavior]
- [ ] Maximum/boundary values → [expected behavior]

**Error scenarios:**
- [ ] [Specific failure condition] → [expected error + message]
- [ ] Network/IO failure → [expected degradation]

**Integration:**
- [ ] [Component A] + [Component B] → [expected interaction]
```

### Minimum requirements by risk:

| Risk Level | Happy Path | Edge Cases | Errors | Integration |
|------------|-----------|------------|--------|-------------|
| LOW | 1 | 1 | 0 | 0 |
| MEDIUM | 2 | 2 | 1 | 0 |
| HIGH | 2 | 3 | 2 | 1 |
| CRITICAL | 3 | 3 | 2 | 2 |

### Rules:
1. If you cannot enumerate edge cases, you don't understand the problem well enough. Go back to research.
2. Scenarios written in plan are COMMITMENTS — implementation is not done until all have passing tests.
3. Test scenarios become the TEST step's input — test-engineer implements tests from these scenarios.
