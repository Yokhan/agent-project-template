---
name: codex-audit
description: "Audit or review a specified code, architecture, instruction or document surface; return evidence-backed findings without implicit repairs."
---

# Codex Audit

Read:

- `.claude/library/process/research-first.md`
- `.claude/library/meta/critical-thinking.md`
- `.claude/library/process/self-verification.md`

## Process

1. Identify the audit target and success criteria.
2. Read affected files and direct consumers; inspect tests, history, lessons or
   registry only when they can resolve a relevant uncertainty.
3. Separate facts from assumptions.
4. List findings first, ordered by severity.
5. For each finding, include file/line evidence, impact, and concrete fix direction.
6. Add open questions and residual risk.
7. If no blocking issues are found, say that directly and note test gaps.

Do not produce a generic summary before findings.
An audit request alone does not authorize repairs, installs or persisted
reports/tasks/lessons. A requested report may be saved without implying code
changes. Existing authorized remediation remains a separate scope.
