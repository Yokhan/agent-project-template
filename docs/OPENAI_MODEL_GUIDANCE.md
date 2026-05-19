# OpenAI Model Guidance

Verified against official OpenAI docs on 2026-05-19.

Sources:

- `https://developers.openai.com/api/docs/models`
- `https://developers.openai.com/api/docs/guides/latest-model`
- `https://developers.openai.com/codex/skills`

## Current Recommendation

Use `gpt-5.5` as the default API starting point for complex reasoning, coding, tool-heavy agents, grounded assistants, long-context retrieval, and production workflows where execution quality matters.

Use smaller variants when the main constraint is latency or cost:

- `gpt-5.4-mini` for lower-latency, lower-cost coding, computer-use, and agent workloads.
- `gpt-5.4-nano` for simple, high-volume tasks.
- `gpt-5.4` when `gpt-5.5` quality is not required but frontier-family behavior is still useful.

For Codex product usage, do not hardcode the model in project config. Model and reasoning effort remain user or IDE settings. The template can document recommendations, but `.codex/config.toml` must stay project-specific only.

## API Defaults For GPT-5.5 Workloads

- Prefer the Responses API for reasoning, tool calling, multimodal, and multi-turn workflows.
- Start with `reasoning.effort: "medium"` for balanced quality, latency, and cost.
- Evaluate `low` before `none` for latency-sensitive workflows that still need planning, tool use, search, or multi-step decisions.
- Reserve `high` and `xhigh` for complex agentic tasks where evals show a measurable gain.
- Use `text.verbosity: "low"` when concise responses are desired.
- Use Structured Outputs instead of describing large schemas in prompts.
- Put stable prompt content first and dynamic context later to improve prompt caching.
- For tool-heavy workflows, put tool-specific usage rules in tool descriptions.
- Preserve `phase` when manually replaying assistant items instead of using `previous_response_id`.

## Prompting Direction

GPT-5.5 should be tuned as a new model family, not treated as a drop-in replacement for older GPT-5 prompts.

Prompt migration checklist:

1. Start from the smallest prompt that preserves the product contract.
2. State expected outcome, success criteria, allowed side effects, evidence rules, and output shape.
3. Remove step-by-step process guidance unless the exact path matters.
4. Remove output schema prose when Structured Outputs can enforce the schema.
5. Keep tool descriptions precise: purpose, when to use, required inputs, side effects, retry safety, and common failure modes.
6. Benchmark accuracy, token consumption, and end-to-end latency against representative examples.

## Template Policy

This repository should not set project-level model defaults for Codex.

Allowed:

- Documentation about recommended OpenAI models.
- Skills that tell agents how to choose models for API code they are writing.
- User-level or IDE-level model selection.

Not allowed:

- `model = "gpt-5.5"` in project `.codex/config.toml`.
- Project defaults for reasoning effort, approval policy, or sandbox mode.
- Stale model names in template-owned instructions.
