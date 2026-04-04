# Dynamic Task Router

Rules live in `.claude/library/`. They are NOT pre-loaded. Load ONLY what each task needs.

## ON EVERY NEW TASK (not just session start):

1. User gives task → `bash scripts/route-task.sh "<task description>"`
2. Script outputs: rule files to Read + suggested agent
3. Read ONLY those files. Previous task's rules may no longer apply.
4. Script writes `tasks/.active-rules` — your current ruleset.
5. Work.

## ON TASK CHANGE mid-conversation:

When user switches context (e.g., "now review this" or "add design for this"):
1. Re-run `bash scripts/route-task.sh "<new task>"`
2. Load NEW rule files
3. State: "Switching context: [old mode] → [new mode], loading [N] rules"

## Manual mode override:

`/mode-code` `/mode-design` `/mode-review` `/mode-research` `/mode-write` `/mode-fix` `/mode-plan`

## After compaction:

1. `bash scripts/context-restore.sh` — restores mode, task, rules, context
2. Read files listed in `tasks/.active-rules`

## MCP Memory (PROACTIVE — do NOT wait to be asked):

- **Session start**: `mem_session_start` + `mem_context`
- **After EVERY decision/bug/discovery**: `mem_save` immediately
- **Before research**: `mem_search` first — answer may exist
- **On task switch**: `mem_save` summary of paused task
- **Session end**: `mem_session_end` with summary
- If Engram unavailable → tasks/lessons.md + brain/ (file fallback)

## Subagent discipline:

When launching subagents: pass task + file paths + findings summary ONLY.
Do NOT pass full rule content or full CLAUDE.md.
Subagent runs `route-task.sh` for its own rules.

## Design work (ALWAYS enforced):

NEVER hardcode visual values. System→Tokens→Components→Screens.
Every container needs layout mode. 8 states for interactive elements.
Search before creating. See `domain-design-pipeline.md`.

## Rule library map:

```
process/    context-first, research-first, plan-first, self-verification, self-improvement
technical/  architecture, code-style, error-handling, testing, git-workflow, writing, atomic-reuse
meta/       analysis, critical-thinking, strategic-thinking
domain/     domain-guards (all 8 domains condensed), domain-design-pipeline
conflict/   conflict-resolution
```

## Runtime helpers (use these instead of manual tool calls):

```
bash scripts/research.sh <path>        — auto research (replaces 6 tool calls)
bash scripts/plan-scaffold.sh <task>   — auto plan template
bash scripts/verify-check.sh --size M  — auto verification checklist
bash scripts/context-restore.sh        — context recovery after compaction
bash scripts/measure-context.sh        — token budget meter
```
