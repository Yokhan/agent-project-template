---
name: coverage
description: "Analyze measured test coverage, identify consequential untested behavior, and recommend focused tests."
---

# Test Coverage Analysis

This skill is for analysis and recommendations. A request to inspect coverage
does not by itself authorize writing or changing tests. Implement tests only
when the user separately asks for that work or the accepted task already
includes it.

## Process

1. Inspect the project’s test scripts, coverage configuration, and available
reports. Run a coverage command only when the repository already defines a
relevant command and its required tools are installed. Do not install packages,
invoke a package runner that may fetch them, or change project configuration to
produce a report without authorization.
2. Identify uncovered statements, branches, or paths from the actual report.
   State which coverage measure and scope it represents; coverage shows
   execution, not whether behavior was asserted correctly.
3. Prioritize by failure impact, public contract, complexity, recent defects or
   changes, and likelihood that a focused test would detect a meaningful bug.
   Do not impose generic percentage targets or assume directory names encode
   risk.
4. Recommend test scenarios and their expected contract. Prefer public
   behavior, important error paths, and meaningful boundaries over incidental
   implementation details. Mutation testing is an optional follow-up when it
   answers a concrete question and the project already supports it.
5. Report the command and result, tool/configuration, measured scope, highest-
   value gaps, suggested checks, and any limits. If measurement could not run,
   say so and keep source inspection distinct from measured coverage.

Follow `.claude/library/technical/testing.md` for test design and
`.claude/library/process/self-verification.md` for verification cadence. Broad
coverage or suite runs belong at the parent/integration boundary when the
changed risk warrants them; do not repeat an aggregate’s included checks.
