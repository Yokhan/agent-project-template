# Lessons Learned

Self-improvement log for AI agent sessions. After EVERY user correction or discovered mistake, add an entry below using the format shown in the example. Read this file at the start of every session to avoid repeating past mistakes.

When this file exceeds 50 entries, run `/weekly` to promote recurring patterns into permanent project rules (`.claude/rules/project-*.md`) and archive promoted entries to `brain/03-knowledge/lessons-archive.md`.

---

## Entry Format

```
### [YYYY-MM-DD] - [Brief descriptive title]
**Track**: BUG | KNOWLEDGE | PATTERN | PROCESS
**Severity**: P0 | P1 | P2 | P3
**Error**: What went wrong (observable symptom)
**Root cause**: Why it happened (the actual underlying issue)
**Rule**: Concrete, actionable prevention rule for the future
**Applies to**: [agent name / skill name / general]
**Category**: [security | architecture | testing | workflow | tooling | performance | ux | general]
**Status**: ACTIVE | PROMOTED | RETIRED
```

### Tracks
- **BUG**: Code broke, tests failed, regression. Something was WRONG.
- **KNOWLEDGE**: Didn't know something. API quirk, wrong syntax, tool behavior.
- **PATTERN**: Recurring anti-pattern spotted. Not a single bug, but a tendency.
- **PROCESS**: The workflow itself failed. Skipped a step, wrong ceremony level.

### Severity
- **P0**: Would cause data loss, security breach, or production outage
- **P1**: Significant user-facing bug or architectural mistake
- **P2**: Minor bug, wrong pattern, suboptimal approach
- **P3**: Style issue, minor inefficiency, cosmetic

### Status
- **ACTIVE**: Currently relevant, check during sessions
- **PROMOTED**: Moved to `.claude/rules/project-*.md` via `/weekly`
- **RETIRED**: No longer relevant, archived to `brain/03-knowledge/lessons-archive.md`

> Old entries without Track/Severity/Status fields remain valid. Add new fields when editing old entries.

---

## Entries

_No project-specific lessons logged yet._
