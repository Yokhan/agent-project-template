# Post-Mortem: [Brief Title]

**Date**: YYYY-MM-DD
**Trigger**: [What caused this post-mortem — circuit breaker, user escalation, production incident]
**Severity**: [P0/P1/P2/P3]

## Timeline

| Time | Event |
|------|-------|
| HH:MM | [First sign of problem] |
| HH:MM | [Detection / circuit breaker triggered] |
| HH:MM | [Root cause identified] |
| HH:MM | [Fix applied] |
| HH:MM | [Verified resolved] |

## What Happened

[2-3 sentences: what broke and what was the user-visible impact]

## Root Cause

[The actual underlying reason, not the symptom. Use "Three Whys" from deep-analysis.md]

## What Went Well

- [What worked correctly during the incident]

## What Went Wrong

- [What failed or was slower than expected]

## Action Items

| Action | Owner | Deadline | Status |
|--------|-------|----------|--------|
| [Prevention rule → lessons.md or rules/] | agent | immediate | [ ] |
| [Fix underlying issue] | agent/user | [date] | [ ] |
| [Improve detection] | agent | [date] | [ ] |

## Lessons

[What should the system learn from this? What rule or check would have prevented it?]

## Related

- Lesson entry: tasks/lessons.md (entry date)
- Related post-mortems: [links if applicable]
