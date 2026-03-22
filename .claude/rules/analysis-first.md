# Analysis-First Protocol — Extract Logic, Never Copy Surface

## The Rule
When given ANY external material (document, project, codebase, example, system, methodology):
NEVER start by copying structure. ALWAYS start by extracting principles.

## The Anti-Pattern: Cargo Cult Imitation
Copying the WHAT without understanding the WHY produces systems that:
- Look correct but break under different conditions
- Have elements that serve no purpose in the new context
- Miss critical elements that weren't visible in the surface structure
- Cannot adapt when requirements change

## The Protocol (MANDATORY for any external input analysis)

### Step 1: Decompose — WHAT does it do?
Map components and relationships. Don't evaluate yet.
- What are the major parts?
- How do they connect?
- What flows between them? (data, control, events)

### Step 2: Interrogate — WHY does each part exist?
For EVERY significant element:
- What PROBLEM does this solve?
- What CONSTRAINT led to this design choice?
- What would BREAK if this element were removed?
- What ALTERNATIVE was likely rejected, and why?

If you can't answer WHY → you don't understand it enough to use it.

### Step 3: Abstract — What are the PRINCIPLES?
- What invariants does the system maintain?
- What trade-offs were made and why?
- What assumptions about the environment does it depend on?
- What would need to change if the environment were different?

### Step 4: Evaluate — Do these principles APPLY HERE?
- Do our constraints match the source's constraints?
- Do our scale/team/timeline requirements match?
- Which principles are universal vs context-specific?
- What needs ADAPTATION vs adoption as-is?

### Step 5: Synthesize — Design for OUR context
- Apply the PRINCIPLES that are relevant
- Adapt the STRUCTURE to our constraints
- Drop elements whose WHY doesn't apply here
- Add elements needed for our context that the source didn't need

## Output Format (when analyzing external material)

ANALYSIS:
- Source: [what was given]
- Principles extracted: [3-7 core principles with WHY each matters]
- Context match: [which principles apply to us and why]
- Context mismatch: [which DON'T apply and why]
- Adaptation plan: [what to adopt, adapt, or drop]

## Red Flags (you're imitating, not analyzing)
- "Let's do it the same way as [source]" → WHY is it that way? Do our constraints match?
- "The example has X, so we need X" → Does OUR context need X?
- "Following the reference implementation" → Following the PRINCIPLES, adapted
- Copying directory structure without understanding each directory's responsibility
- Using the same technology because the example used it, not because our constraints demand it
- Same number of phases/layers/steps without justifying each one for our situation
- Reproducing formatting/naming conventions without understanding the communication intent

## The Litmus Test
After analyzing any external material, you should be able to:
1. Explain each element's PURPOSE without referencing the source
2. Justify each element's PRESENCE in terms of OUR constraints
3. Explain what you DROPPED from the source and why it doesn't apply
4. Explain what you ADDED that the source didn't have and why we need it

If you can't do all four → you're copying, not understanding.

## References
- `.claude/rules/critical-thinking.md` — cargo cult practices (#7), evidence hierarchy
- `.claude/rules/strategic-thinking.md` — situational awareness (#45), "Don't custom-build commodities" (#46)
- `.claude/rules/self-verification.md` — Doubt Protocol applies to analysis outputs too
