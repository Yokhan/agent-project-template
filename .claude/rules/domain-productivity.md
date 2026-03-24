# Domain: Productivity & AI Use — Evidence-Based Guard

## NEVER Recommend (Myths & Anti-patterns)
1. **"You Are an Expert" Prompt Prefix** — Study of 162 personas: no improvement vs control (Zheng 2024). Instead: provide domain context and examples.
2. **"Think Step by Step" Everywhere** — For simple tasks, CoT adds 39-79% more tokens with no accuracy gain. Instead: reserve CoT for multi-step reasoning only.
3. **Context Window Stuffing** — "Lost in the Middle" (Liu 2023): U-shaped attention, middle info lost. Instead: curate to 30-50% window, critical info at start/end.
4. **LLM as Calculator/Database** — LLMs fail at arithmetic and hallucinate facts confidently. Instead: use code execution for math, RAG for facts.
5. **Multitasking as Productivity** — Task-switching costs 40% productivity (APA). Only 2.5% are genuine supertaskers. Instead: deep work, time-blocking.
6. **Hustle Culture (More Hours = More Output)** — Productivity drops sharply after 50hrs/week; at 55hrs it's negative. Instead: protect recovery, sleep, boundaries.
7. **No Output Verification** — Hallucination rates 3-27% across models. Instead: verify all AI outputs; implement human-in-the-loop for high-stakes.
8. **Agent Loops Without Termination** — Missing max_turns causes runaway costs. Instead: layer max iterations + cost caps + no-progress detection.
9. **Higher Temperature = More Creative** — Weakly correlated with novelty, moderately with incoherence (Peeperkorn 2024). Instead: creativity from better prompts.
10. **Panic-Driven Crisis Decisions** — Cortisol narrows cognition; snap decisions under acute stress are systematically wrong. Instead: pre-established frameworks, 10-min cooling.

## ALWAYS Apply (Evidence-Based Principles)
1. **Engineer Context, Not Just Prompts** — Design full information architecture: task, examples, RAG data, tools, state. 50% quality improvement reported.
2. **Few-Shot Examples** — 2-5 examples show 10-50% improvement over zero-shot for most tasks. Format and distribution matter more than label accuracy.
3. **Deep Work Blocks** — Newport: 2-4 hours uninterrupted focused work produces more than 8 hours of fragmented time. Protect ruthlessly.
4. **Spaced Repetition for Learning** — 50-200% retention improvement vs massed practice. Use expanding intervals (Anki, etc.).
5. **Implementation Intentions** — "When X, I will Y" doubles follow-through (Gollwitzer). Convert vague goals to specific triggers.
6. **Model Routing by Task** — Small models for simple tasks (classification, extraction); frontier models for complex reasoning. 20-60x cost savings.
7. **Verify Then Trust** — All AI outputs need validation. Fabricated citations, stats, and code are generated with equal confidence to accurate ones.
8. **Defense-in-Depth for AI Security** — Prompt injection is OWASP #1 for LLMs. Layer: input sanitization, output filtering, privilege separation.
9. **Pre-Mortem for Decisions** — Imagine the decision failed; list what went wrong. Surfaces risks optimism bias hides.
10. **Blameless Post-Mortems** — After failures, analyze root cause without blame. Organizations that blame first repeat crises (Elliott 2009).

## For Details
See `brain/03-knowledge/domains/crisis-fitness-productivity.md` and `ai-orchestration-prompting.md` for full practices.
