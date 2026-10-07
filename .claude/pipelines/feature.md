# Feature Workflow

This file is a lightweight route into the shared feature process in
`docs/AGENT_PIPELINES.md`. That document and the shared process rules define
the gates; this wrapper does not add a competing plan or approval protocol.

## Orient

- Identify the requested behavior, relevant project constraints, and owner of
  the active plan or task graph. Preserve AgentOS or other project-owned
  artifacts.
- Inspect affected code, direct consumers, tests, recent changes, and relevant
  lessons as appropriate to the scope. Use the project router when it changes
  which workflow or specialist rules apply.
- For a small feature, proceed as a task with focused acceptance evidence; do
  not invent a product roadmap.
- For substantial staged product work, agree on the final outcome and
  approximate useful versions of the same product, then plan the nearest
  version. Keep implementation tasks, internal routes, and experiments distinct
  from product waves. Use
  `.claude/library/process/plan-first.md#product-wave-semantics--source-of-truth`.

## Execute

Choose only the research, planning, implementation, review, or handoff steps
that materially help this feature. Keep each step inside the accepted scope.
Delegate only independent work with a bounded contract and useful parallel
value; the parent owns integration and acceptance. Routine in-scope choices do
not need another approval. Stop for a required project gate or a decision that
would materially change the accepted result, constraints, risk, or ownership.

Add or update focused checks for the changed behavior. Follow
`.claude/library/process/self-verification.md` for cadence and ownership; do not
run a broad suite after every batch or duplicate an aggregate’s included checks.
At the appropriate integration or release boundary, run any required broad
acceptance gate and record its exact scope and result.

## Closeout

Inspect the diff and report the user-visible result, checks and evidence,
remaining gaps, and next dependency if one exists. Label enabling work as such.
Do not claim an unverified product outcome, require a confidence score, or
commit unless the user or active project workflow authorizes it.
