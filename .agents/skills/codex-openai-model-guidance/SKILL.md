---
name: codex-openai-model-guidance
description: "Use current official OpenAI sources to choose GPT models or effort, migrate model use, or update OpenAI-specific instructions. Trigger only when the request has an OpenAI, GPT, Codex, or Responses API anchor."
---

# Codex OpenAI Model Guidance

Use official OpenAI sources when current model capabilities, recommendations,
or API behavior matter. For the template's dated routing snapshot, read
[`docs/OPENAI_MODEL_GUIDANCE.md`](../../../docs/OPENAI_MODEL_GUIDANCE.md); verify
volatile details before relying on them.

- Keep parent model, effort, approval, and sandbox settings user/IDE-owned; do
  not write project-wide model or permission defaults.
- Treat the documented Sol/Luna/Astra profiles as recommendations, not proof of
  availability. Check the actual Codex/AgentOS host and report unsupported or
  unknown effective model/effort as `unverified`.
- Distinguish API parameters from Codex custom-agent configuration. Do not copy
  Responses API settings into Codex config without an applicable contract.
- Preserve task scope and cite official sources in user-facing current guidance.
