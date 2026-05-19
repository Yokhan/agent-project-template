---
name: codex-agent-router
description: "Route Codex work to repository skills, shared rules, plans, memory, and verification gates without Claude model-routing assumptions. Trigger when choosing workflow or skill coverage."
---

# Codex Agent Router

Codex does not use the Claude subagent/model routing table. Route by task type and risk inside the current agent.

## Routing

- Implementation: `$codex-feature-workflow`, `$codex-pipeline-workflow`.
- Bugfix: `$codex-debug`.
- Review or audit: `$codex-audit`, `$codex-domain-software-review`, `$codex-domain-design-review`.
- Security: `$codex-security-audit`.
- UI/Figma: `$codex-design-workflow`, `$codex-figma-workflow`.
- Template changes: `$codex-template-sync`, `$codex-skill-maintenance`, `$codex-test-rules`.
- OpenAI API/model guidance: `$codex-openai-model-guidance`.

If no skill fits, read the shared `.claude/library/` rules listed in `AGENTS.md` and state the chosen workflow before editing.
