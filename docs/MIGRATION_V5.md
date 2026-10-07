# Migration To v5.0.1

v5 changes the default operating contract, not ownership of downstream products.
Confirm a major upgrade before applying; `5.0.0 -> 5.0.1` is a compatible patch.
The earlier `4.10.0` development
candidate was not published separately; its work is incorporated into v5.

## What Changes

- AI-agent-first deployment: the agent verifies the exact release, classifies
  the workspace, uses its updater and checks readiness. Existing project work,
  user defaults and AgentOS task graphs remain authoritative.
- Agree on the final result and approximate waves; the parent derives the
  detailed nearest-wave plan. Waves are successive usable versions of the same
  product toward that result. Research and technical migrations are enabling
  checkpoints, not product waves. When constraints change, reassess the target
  and remaining waves together. Internal steps remain autonomous; material
  promise/constraint/wave changes need approval.
  Universal per-task full-future skeleton and 1% ceremony are no longer required.
- Role-aware Sol/Luna/Astra recommendations are distinct from host capability,
  effective runtime profiles and model-quality evidence. No user-level model
  default is overwritten; optional higher effort is not a default.
- Substantive nonfiction, including explanatory answers, requires fresh
  relevant primary passages and task/draft-bound records. Actual fiction/lore
  prose is exempt, not game-business documents or production plans.

## Agent-Executed Upgrade

Follow `docs/TEMPLATE_RELEASES.md#canonical-agent-update-protocol`. Verify the
non-draft/non-prerelease exact `v5.0.1` release, its tag commit and checksums.
Never infer publication from this file. Reuse a verified external canonical
checkout or obtain the exact tag; do not sync the template repository into itself.
For a generated project, run the target checkout's native updater explicitly:

```bash
node /absolute/release-checkout/scripts/sync-template.js /absolute/release-checkout /absolute/project --plan-file /absolute/outside-project/v5.plan.json
node /absolute/release-checkout/scripts/sync-template.js /absolute/release-checkout /absolute/project --plan-file /absolute/outside-project/v5.plan.json --apply
```

Inspect and accept the external preview before apply. Apply compares the whole
plan digest; changed inputs must be re-previewed. For legacy projects without a
manifest, use that updater's explicit `--bootstrap` path. Stop on ambiguous
ownership, protected conflicts or conflicting remotes. Keep project-owned
CLAUDE/spec/tasks/brain/design and `project-*` overlays; review their old policy
wording without replacing accepted product plans. Because AGENTS/CLAUDE may
contain retained project-specific instructions, semantically merge the v5 active
contract into those entrypoints: preserve project facts, AgentOS authority and
approved plans, but remove contradictory universal 1%/per-task approval ritual.
Do not merely leave old hot-memory policy overriding the updated shared rules.

After apply, confirm manifest `template_version: 5.0.1`, actual diff, preserved
overlays, conflict resolution and relevant project/agent/routing/text checks.
Check entrypoint semantic consistency and run library status plus a fresh bounded
primary retrieval for a relevant nonfiction artifact. Verify its request/draft
binding, applicability and concrete principle effects; check actual fiction stays
separate. Missing sources must report blocked grounding, not a passing writing gate.
Default MCP bootstrap uses the full pinned ten-tool profile; smaller profiles
are explicit opt-ins. Trusted-project config discovery is not proof all servers
or custom roles ran. Record exact runtime evidence separately.

## One External Library

Books and extracted full text are neither release assets nor sync payload.
Setup/sync discover, but do not create/download, the library. On a new machine
nonfiction source-grounding remains blocked until exact user-supplied originals
and pinned cache are imported once outside Git. Existing store users need only
discovery/status verification; no per-project copy or book symlink/hardlink.
See `SETUP_GUIDE.md#общая-библиотека-источников` for import and recovery.

Report project/MCP readiness and library readiness separately. A missing/stale
source is not permission to claim memory-grounded writing. Packet bindings prove
access/provenance, not comprehension or editorial quality; lexical retrieval
needs relevance review. Token savings/prompt caching are not guaranteed.

## Known Limits And Rollback

Optional Spec Kit remains pinned to `v0.8.13`. Its local integrity check passes,
but the 2026-10-06 upstream check found `v1.1.1` and returned stale; updating it
is separate work. Comparative model-quality benchmarking remains separate from
runtime smoke evidence. Historical migration rows are not v5 rollout proof.

Roll out one reviewed canary before widening. Record the old tag, accepted plan
and pre-upgrade project diff/backup. If rollback is needed, inspect a preview
from the verified previous release; downgrade needs explicit approval. Do not
reset or overwrite user work, delete source originals/store, or mass-apply to
other projects. Publication and downstream rollout require their own evidence.
