---
name: sprint
description: "Work through an approved task list autonomously when the user asks for a sprint or autonomous work loop."
---

# Sprint

Use only when the user asks for autonomous work. Continue within the accepted
scope; a sprint request does not authorize unrelated tasks or routine commits.

## Loop

1. Restore the active task list and its owner. If there is no task to execute or
   the intent is materially unclear, ask what to work on.
2. Select one approved task and make a concise plan when its scope, risk, or
   dependencies warrant one.
3. Implement a useful, bounded result; run focused checks after coherent changes.
4. Review the diff and compare the result with the original request. Report
   evidence and remaining gaps; do not use self-assessed confidence as proof.
5. Update the active task artifact only when state must survive interruption or
   the project workflow requires it. Keep the handoff compact.

Do not turn technical tasks or experiment batches into product waves. For
substantial staged product work, follow
`.claude/library/process/plan-first.md`; for all verification cadence, follow
`.claude/library/process/self-verification.md`.

Stop on user interruption, a required approval gate, a material unresolved
decision, or blocked external state. After two failed approaches, stop local
variants and re-diagnose the cause and affected boundary before choosing a new
approach. Preserve user data and work; do not force-push, delete data, or make
irreversible changes without authorization.

Commit, persistent metrics, retrospective notes, and lesson records are not
automatic sprint steps. Use them only when requested or required by the active
project workflow; record reusable lessons when the project maintains that
process.
