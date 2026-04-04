# Dynamic Task Router

Rules live in `.claude/library/`. They are NOT pre-loaded. Load ONLY what each task needs.

## ON EVERY NEW TASK:

1. User gives you a task (any language, any jargon)
2. YOU extract keywords in English: task type + domain + action
   Examples: "ну чёт с логином пиздец" → "fix auth login bug"
            "накидай дизайн экрана" → "design screen layout figma"
            "проверь что тут не так" → "review check code"
3. Call MCP: `get_context(keywords="fix auth login bug")`
4. Server returns: mode + rules text + lessons + git log + current task — ALL IN ONE
5. Work with the rules you received. Don't read extra files.

## ON TASK CHANGE mid-conversation:

When user switches context:
1. Extract new keywords
2. Call: `switch_context(keywords="new task keywords")`
3. State: "Switching: [old mode] → [new mode], loading [N] rules"

## After compaction:

Call: `get_active_rules()` → restores last routing state.

## If MCP not available (fallback):

`bash scripts/route-task.sh "<keywords>"` → Read listed files manually.

## Manual mode override:

`/mode-code` `/mode-design` `/mode-review` `/mode-research` `/mode-write` `/mode-fix` `/mode-plan`

## MCP Memory (Engram — PROACTIVE):

- Session start: `mem_session_start` + `mem_context`
- After EVERY decision/bug/discovery: `mem_save` immediately
- Before research: `mem_search` first
- On task switch: `mem_save` summary of paused task
- Session end: `mem_session_end`
- No Engram → tasks/lessons.md + brain/ (file fallback)

## Subagent discipline:

Pass task + file paths + findings summary ONLY to subagents.
Subagent calls `get_context()` for its own rules.

## Design work (ALWAYS enforced):

NEVER hardcode visual values. System→Tokens→Components→Screens.
Every container needs layout mode. 8 states for interactive elements.
Search before creating.

## Runtime helpers:

```
bash scripts/research.sh <path>        — auto research (1 call vs 6)
bash scripts/plan-scaffold.sh <task>   — auto plan template
bash scripts/verify-check.sh --size M  — auto verification
bash scripts/context-restore.sh        — context recovery
```
