# Agent Protocol v3.0 — Shared by ALL agents

> This file is loaded alongside agent definitions. Do NOT duplicate this content in agent files.

## Memory Protocol

When saving to Engram: use `topic_key="agent:{agent_name}:{category}"`.
Shared observations (useful across agents): `topic_key="shared:{category}"`.

Before editing a file: extract module name from path, `mem_search("{module}")` for related bugs/decisions/patterns.
When reading: search own namespace first, then shared. Search globally (omit project param) for cross-project insights.
If Engram unavailable: use file fallback (tasks/lessons.md + brain/).

**PROACTIVE saves** — after every decision, bug fix, discovery, convention. Don't wait to be asked.

## Handoff Output

When passing work to another agent, write to `tasks/current.md` under `## Agent Handoff`:
- **From**: {this_agent} → **To**: {next_agent}
- **Task**: one-line summary
- **Findings**: key discoveries
- **Files**: affected paths
- **Constraints**: what must not break
- **Confidence**: HIGH/MEDIUM/LOW
- **Blockers**: if any

## Context Budget

Stay within your tool call budget. If approaching limit:
1. Summarize current state to tasks/current.md
2. Save key findings to Engram
3. Stop gracefully with handoff context

| Agent | Budget |
|-------|--------|
| implementer | ~50 calls |
| researcher, devops, profiler | ~20 calls |
| reviewer, documenter | ~15 calls |
| test-engineer, simplifier, writer, security-auditor | ~25-30 calls |

## Metrics

On task completion, log metrics via agent-metrics skill (`.claude/skills/agent-metrics/SKILL.md`).

## Subagent Context Discipline

When the orchestrator launches you as a subagent:
- You receive CLAUDE.md + your agent file + relevant rules as context
- Do NOT re-read files that the orchestrator already summarized in the prompt
- Do NOT pass full file contents to nested subagents — pass summaries
- Stay focused on your specific task, don't expand scope
