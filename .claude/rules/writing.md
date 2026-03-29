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
