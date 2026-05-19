---
name: codex-debug
description: "Systematically debug failures: reproduce, isolate, diagnose root cause, patch minimally, add regression coverage, verify, and log lessons. Trigger on bug, crash, failing test, regression, broken, почини, or не работает."
---

# Codex Debug

Read `.claude/skills/debug/SKILL.md` for deeper methodology when needed.

## Process

1. State the observed failure and expected behavior.
2. Reproduce the failure or explain why it cannot be reproduced.
3. Read the failing code path, callers, tests, recent history, and lessons.
4. Diagnose root cause before editing.
5. Patch the root cause with the smallest reasonable change.
6. Add or update a regression test or smoke check.
7. Run relevant checks.
8. Log reusable bug patterns to `tasks/lessons.md`.

Stop after two failed attempts and present options.
