---
name: codex-agent-router
description: "Route Codex work to repository skills, shared rules, plans, memory, and verification gates without Claude model-routing assumptions. Trigger when choosing workflow or skill coverage."
---

# Codex Agent Router

Codex does not use the Claude subagent/model routing table. Route by task type and risk inside the current agent.

## Mandatory First Step

For any file edit, M+ task, template work, release, design, security task, or ambiguous request, run:

```bash
node scripts/codex-route-task.js "<user request>" --summary --write-state
```

State the returned modes, exact/semantic matches, skills, pipeline, subagents, risk, and orchestrator before editing. If the route reports `agentos`, treat AgentOS as the orchestrator and Codex as the worker.

Routing is not keyword-only. `scripts/codex-route-task.js` combines exact patterns with semantic intent scoring from `scripts/lib/codex-route-intents.js`. When a task is misrouted, update the relevant intent groups and add a regression fixture instead of only adding one literal keyword.

Before edits, state a compact strategy for ambiguous, M+, HIGH risk, template, release, security, design, or cross-project work:

`Goal -> Constraints -> Approach -> Verification -> Risk/Doubt`

If the route includes `$codex-strategic-review`, use it before choosing the implementation path.

## Routing

- Implementation: `$codex-feature-workflow`, `$codex-pipeline-workflow`.
- Bugfix: `$codex-debug`.
- Review or audit: `$codex-audit`, `$codex-domain-software-review`, `$codex-domain-design-review`.
- Security: `$codex-security-audit`.
- UI/Figma: `$codex-design-workflow`, `$codex-figma-workflow`.
- Product goal/current-step continuity: `$codex-product-goal`.
- Marketing, GTM, positioning, funnel, campaigns, offer, ICP, and sales messaging: `$codex-domain-communication-review`, `$codex-domain-business-review`, `$codex-product-goal`, `$codex-strategic-review`.
- Design system, Storybook, tokens, component contracts: `$codex-design-system-workflow`.
- Product UX flow/dead-end checks: `$codex-product-ux-audit`.
- Repeated downstream mistakes and template promotion: `$codex-cross-project-lessons`.
- Template changes: `$codex-template-sync`, `$codex-skill-maintenance`, `$codex-test-rules`.
- OpenAI API/model guidance: `$codex-openai-model-guidance`.
- Strategy, roadmap, release sequencing, ambiguous or HIGH-risk work: `$codex-strategic-review`, `$codex-decompose`.

For product, feature, design, game, API, or template implementation, route
progressive JPEG complaints to `$codex-product-goal`, `$codex-feature-workflow`,
and `$codex-strategic-review`: the expected behavior is an end-state skeleton
with 1% callable future capabilities, not legacy harness proof.

If no skill fits, read the shared `.claude/library/` rules listed in `AGENTS.md` and state the chosen workflow before editing.
