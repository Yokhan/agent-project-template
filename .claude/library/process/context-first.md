# Context-First Protocol — Know Before You Act

## The Rule
Understand enough project context to make the current decision safely. The
scope of reading should track task impact; a focused change does not require a
full-project refresh.

## Session Start Scan

At session start, restore active task context when available. For work that
depends on project structure or prior decisions, inspect the relevant sources:

1. `PROJECT_SPEC.md` — only if stack, dependencies, or structure affect the task.
2. `tasks/current.md` — when active work or a handoff may overlap.
3. Relevant entries in `tasks/lessons.md` and recent history — when they bear on
   the affected path or a known failure.
4. Current git status and affected files/consumers before editing.

Do not generate or refresh context documents just because they are absent or
stale. Create/update them when the task needs the missing context or the user
requested project setup/audit.

## PROJECT_SPEC.md Maintenance

### When to update:
- When stack/dependencies or structure change in a way that makes the document
  inaccurate
- When project setup, status, or audit explicitly calls for refresh

### What it contains:
- What this project IS (1-2 sentences)
- Stack and key dependencies
- File structure map (top-level directories with purpose)
- What it provides (APIs, exports, services)
- What it depends on (other projects, external services)
- Current state (active work, phase)
- Last scan date

### Auto-generation protocol:
1. Read package.json / Cargo.toml / go.mod / requirements.txt / pyproject.toml
2. Scan top-level directory structure
3. Read existing CLAUDE.md for project description
4. Check git log for recent activity patterns
5. Write PROJECT_SPEC.md with findings

## Session End Handoff

For interrupted, multi-step, or explicitly continued work, update
`tasks/current.md` with the useful state and next step. Do not create a handoff
for a completed one-step change unless the project workflow requires it:

```markdown
## Handoff — [DATE]
### Status: [in-progress / blocked / completed]
### Current file: [path to file being edited]
### What was done: [1-2 sentences]
### What's left: [next steps, ordered]
### Blockers: [what's preventing progress, if any]
### Modified files: [list, or "see git diff"]
### Key decisions: [anything the next session needs to know]
```

Keep the handoff factual and concise; include what is done, unverified, and
owned next.

## Documentation Freshness

Project-specific freshness rules may indicate when a source is due for review;
staleness alone does not make an unrelated task responsible for refreshing it.
Before relying on volatile documentation, check the canonical source or
validate the relevant claim.

## Why This Matters

Without project context, agents:
- Suggest wrong patterns for the stack
- Create files in wrong locations
- Miss existing utilities and duplicate code
- Break conventions established in previous sessions
- Ignore lessons from past mistakes

With project context, agents:
- Work within established conventions from the first action
- Find and reuse existing code
- Make architecture-aware decisions
- Continue previous work seamlessly
