---
name: codex-coverage
description: "Analyze measured test coverage, identify consequential untested behavior, and recommend focused checks without silently editing tests."
---

# Codex Coverage

Read `.claude/skills/coverage/SKILL.md` and
`.claude/library/technical/testing.md`. Coverage analysis is read-only unless
the user or accepted task explicitly includes test implementation. Use only
project-configured coverage commands whose required tools are already
available; do not install dependencies or run commands that may fetch them.

Report the measured scope and metric, command/result, important gaps, focused
test recommendations, and what remains unverified. Follow
`.claude/library/process/self-verification.md` for check selection and
integration ownership.
