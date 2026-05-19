---
name: codex-openai-model-guidance
description: "Use current official OpenAI docs for model selection, GPT-5.5 migration, Responses API, reasoning effort, verbosity, structured outputs, tools, and prompt updates. Trigger on OpenAI model or GPT-5.5 guidance."
---

# Codex OpenAI Model Guidance

OpenAI model guidance is volatile. Browse official OpenAI docs when the user asks for current recommendations.

## Local Reference

Read `docs/OPENAI_MODEL_GUIDANCE.md` for the latest verified snapshot in this template.

## Rules

- Do not hardcode model defaults in project `.codex/config.toml`.
- Prefer official OpenAI docs over bundled notes.
- For GPT-5.5 API work, start with Responses API and `reasoning.effort: "medium"` unless evals show another setting is better.
- Cite official docs when answering the user.
