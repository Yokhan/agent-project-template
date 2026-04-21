# Writing Guard — Anti-AI, Human Voice, Platform Adaptation

## The Rule
All text produced by the writer agent (and any agent writing user-facing content) MUST pass anti-AI detection, follow project BAN-LISTs, and adapt to the target platform.

This rule applies to: articles, landing pages, social posts, game lore, marketing copy, documentation for end users, emails, newsletters.
This rule does NOT apply to: code comments, commit messages, internal docs, technical specs.

## BAN-LIST Enforcement (MANDATORY)

### Default BAN-LIST (Russian)
Never use these words/phrases — they are AI-slop markers:
- является, представляет собой, ключевой аспект, стоит отметить
- важно понимать, нюанс, комплексный подход, в современном мире
- безусловно, зачастую, по сути, на самом деле (as filler)
- Кроме того, Более того, Помимо этого, Таким образом
- Подведём итог, В заключение, Резюмируя

### Default BAN-LIST (English)
- Furthermore, Moreover, Additionally, In conclusion
- It's worth noting, It's important to understand
- In today's world, In this day and age
- Comprehensive, Holistic, Synergy, Leverage (as verb)
- Delve, Navigate, Landscape, Embark, Journey (metaphorical)
- Cutting-edge, Game-changer, Paradigm shift

### Project BAN-LIST Override
If the project has its own BAN-LIST file → merge with default. Project-specific bans take priority.

## Anti-AI Detection Patterns

### Structural markers (AI writes like this — don't):
- All paragraphs same length → vary: 1 line, 3 lines, 6 lines, 2 lines
- Smooth transitions between ALL paragraphs → humans jump, skip, digress
- Every section starts with a topic sentence → break this pattern
- Perfect grammar everywhere → humans make minor imperfections
- Lists for everything → prose for emotional content, lists for reference
- Ending with summary/conclusion → end on action, question, or half-thought

### Required human markers:
- Start some sentences with "И", "А", "Но", "Ну" (Russian) or "And", "But", "Or" (English)
- Include 1-2 incomplete thoughts or digressions per 1000 chars
- Mix sentence lengths: 3-word punches + 30-word explanations
- Use specific numbers (4477, not "about 4500")
- Include at least one moment of self-doubt or self-irony

## Platform Adaptation

Each platform has DNA. Don't write "an article" — write for the SPECIFIC audience.
If no platform specified → write neutral quality prose.
If platform specified → load platform rules from writer agent (.claude/agents/writer.md).

## Client-Facing Work Reports

This section applies to final reports after implementation, debugging, setup, review, migration, and other task closeouts.

### The Goal

A work report should read from the client's world:
- what changed
- why that matters
- what result was achieved
- what to expect next

The report is NOT a build log, tool transcript, or file inventory.

### Rules

1. Lead with the outcome, not with the process.
2. Write from the reader's benefit, not from the agent's effort.
3. Answer four questions in plain language:
   - What was wrong or incomplete before?
   - What is true now?
   - What practical result did this produce?
   - What should the reader expect next?
4. Translate technical changes into user-visible effect. Mention files and commands only when they help the reader make a decision or verify the result.
5. Cut internal kitchen noise: no step-by-step tool narration, no "I also checked", no heroic framing, no changelog-for-the-sake-of-changelog.
6. Be specific. Use concrete effects, counts, examples, or boundaries instead of "improved", "optimized", "enhanced".
7. Separate done from not done. If something still depends on an external step, say it directly and once.
8. Prefer short paragraphs. Use lists only when the content is inherently list-shaped.

### Default Closeout Structure

Use this order unless the user asked for something else:

1. `Что было` — the problem, gap, or risk before the work
2. `Что стало` — the new state after the work
3. `Что это даёт` — the practical result for the project, team, or user
4. `Чего ожидать дальше` — next effect, remaining external step, or operating guidance

### Style Markers

- Plain words over abstract nouns
- Strong nouns and verbs over adjectives
- No fake excitement
- No filler transitions
- No "important to note", "in conclusion", "moreover"
- No long preambles before the answer

### Report Check

Before sending a closeout, ask:
1. Can a non-author quickly retell the outcome after reading the first paragraph?
2. Does each technical detail explain a consequence, not just an edit?
3. If I remove the file list, does the message still make sense?
4. Does the reader see the result first and the caveat second?

## Human Voice Verification (Post-Write Check)

After writing, run this checklist:
1. **Read aloud test** — does it sound like a human talking, or a press release?
2. **BAN-LIST scan** — zero violations from default + project BAN-LISTs
3. **Paragraph variation** — no 3 consecutive paragraphs of similar length
4. **Transition check** — at least 2 "hard cuts" (no transition word) per 2000 chars
5. **Specificity check** — at least 3 specific details (names, numbers, places) per 1000 chars
6. **Mirror check** — does the reader think about THEMSELVES after reading, not the author?

If any check fails → rewrite that section before presenting.

## Writer Agent Routing

All writing tasks MUST go to the writer agent (`.claude/agents/writer.md`), which runs on Opus.
Never delegate writing to Sonnet or Haiku — quality degrades catastrophically.
If the main orchestrator is on Sonnet and receives a writing task → route to writer agent.
