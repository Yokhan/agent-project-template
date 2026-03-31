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
- Risk: [LOW/MEDIUM/HIGH — why]

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

## Why This Matters

Without upfront planning:
- Files bloat to 500+ lines because "I'll split later" (never happens)
- Wrong directory structure gets cemented and is expensive to fix
- Complexity surprises cause half-finished features
- No one knows what was planned vs what was ad-hoc

With upfront planning:
- File sizes stay manageable from the start
- Architecture decisions are explicit and reviewable
- Complexity is visible before commitment
- Plans serve as documentation of intent
