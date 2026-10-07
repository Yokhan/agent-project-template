---
name: audit
description: "Strict architectural and code audit with multi-lens synthesis. Trigger on: аудит, audit, строгий аудит, проверь код строго, арх аудит, code review strict, lens synthesis, проверь архитектуру."
---

# Multi-Lens Audit Skill

Review code/architecture through the lenses relevant to the request, then
synthesize findings. Lenses are perspectives, not mandatory worker processes.
An audit is read-only unless the request separately authorizes changes or a
saved report; do not create task/lesson files as an audit side effect.

## When to use
- After completing a feature or significant change
- Before releases or major refactors
- When reviewing an unfamiliar codebase
- When user says "аудит", "audit", "проверь строго"

## Input
The user specifies ONE of:
1. **Project** — audit entire project or directory (default: current working directory)
2. **Files** — audit specific files or a PR diff
3. **Last work** — audit what was done in current/last task (reads `tasks/current.md` for changed files)

Infer the target from the request and active context. Ask only when ambiguity
would materially change audit scope.

## Process

### Phase 1: Scope & Context (read-only)
1. Determine target files/directories
2. If "last work" — read `tasks/current.md` for changed files list
3. Read all target files to understand the codebase
4. Count total lines/files to estimate audit depth

### Phase 2: Multi-Lens Analysis
Delegate only materially useful independent lanes within the host/project
fan-out policy and user authority. A focused audit may use no child agents;
compatible lenses can be reviewed together.

#### Lens 1: Architecture
- Module boundaries and dependency direction (no circular deps)
- Layer violations (does UI call DB directly?)
- Coupling analysis: connascence types, fan-in/fan-out
- Single Responsibility at module level
- Is complexity justified by requirements?

#### Lens 2: Code Quality
- Anti-patterns from `domain-software-review` checklist (god objects, deep nesting, primitive obsession, etc.)
- Naming clarity and consistency
- Cohesion, responsibility and review cost; no universal function/file length limits
- Error handling: fail-fast, no swallowed exceptions
- Dead code, commented-out code, TODOs without tickets
- DRY violations vs premature abstraction

#### Lens 3: Security
- OWASP Top 10 check (injection, XSS, CSRF, auth issues)
- Hardcoded secrets or credentials
- Input validation at boundaries
- Dependency vulnerabilities (if package manager available)
- Principle of least privilege

#### Lens 4: Performance & Scalability
- O(n^2) or worse algorithms where better exists
- N+1 queries, missing indexes
- Unbounded collections, memory leaks
- Caching opportunities
- Blocking operations in async context

#### Lens 5: Developer Experience (DX)
- Is the code readable by a new team member?
- Are errors actionable (clear messages, not stack traces)?
- Is the API intuitive or surprising?
- Test quality: behavior-driven, not implementation-coupled
- Documentation: sufficient but not excessive

### Phase 3: Synthesis
After all lenses complete, synthesize:

1. **Cross-lens patterns** — issues that appear in 2+ lenses (e.g., god object = architecture + quality + DX problem)
2. **Risk matrix** — severity (Critical/High/Medium/Low) x likelihood (Certain/Likely/Possible/Unlikely)
3. **Root causes** — why these issues exist (rushed deadline? missing knowledge? tech debt?)
4. **Priority ranking** — order fixes by: impact x effort (quick wins first)

### Phase 4: Verdict & Report
Rate each lens: PASS / WARN / FAIL

```
## Audit Report — [target] — [date]

### Verdict: [PASS / WARN / FAIL]

| Lens           | Rating | Findings |
|----------------|--------|----------|
| Architecture   | ...    | N issues |
| Code Quality   | ...    | N issues |
| Security       | ...    | N issues |
| Performance    | ...    | N issues |
| DX             | ...    | N issues |

### Critical (fix now)
1. ...

### High (fix this sprint)
1. ...

### Medium (fix this quarter)
1. ...

### Low (nice to have)
1. ...

### Cross-Lens Patterns
- [pattern]: appears in [lens1, lens2] — root cause: [why]

### Quick Wins (high impact, low effort)
1. ...
```

Return findings in the response. Save an audit report only when requested.
Suggest follow-up fixes without silently editing code or task/lesson records.
The format above is an example for a broad audit, not required ceremony for
each focused review. Do not invent root causes from a diff alone.

## Notes
- NEVER report "looks good" without evidence. Every PASS needs at least one specific observation.
- If a lens has no findings, explicitly state what was checked and why it passed.
- Use evidence levels from `domain-software-review` (A/B/C) when citing anti-patterns.
- For "last work" audits, also check the diff quality: are commits atomic? Messages clear?
