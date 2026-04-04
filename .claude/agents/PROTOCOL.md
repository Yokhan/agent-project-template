# Agent Protocol v3.1 — Shared by ALL agents

> This file is loaded alongside agent definitions. Do NOT duplicate this content in agent files.

## Task Routing (FIRST THING every agent does)

Before starting work: `bash scripts/route-task.sh "<your task>"` → Read listed files.
If task changes mid-work: re-run route-task.sh.
Rules are in `.claude/library/`, NOT pre-loaded. Load only what you need.

## Subagent Context Discipline

When orchestrator launches you as a subagent:
- You receive: task description + relevant file paths + findings summary
- You do NOT receive: full CLAUDE.md, full rule content, full research
- Run `route-task.sh` yourself to load YOUR rules for YOUR subtask
- Do NOT re-read files that orchestrator already summarized in the prompt
- Stay focused on your specific task, don't expand scope

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

## Note

Old "Subagent Context Discipline" section removed (contradicted lines 11-18 above).
Subagent routing discipline is defined in the "Subagent Context Discipline" section at the top of this file.
