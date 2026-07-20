You are updating this project from a released version of agent-project-template.

## Usage

`/update-template [release-tag-or-template-path]`

Follow `docs/TEMPLATE_RELEASES.md#canonical-agent-update-protocol` as the source
of truth. Do not invent an update path from stale examples or memory.

## Process

### Step 1: Classify And Resolve

- If `PROJECT_SPEC.md` identifies `agent-project-template`, this is source-release
  work. Do not sync the template into itself.
- Otherwise require `.template-manifest.json`, or use the legacy bootstrap
  fallback from the release SOT.
- Read the installed version from `.template-manifest.json`.
- Explicit user tag > AgentOS-approved tag > verified latest stable release.
- Never use bare `--from-git`, `main`, a README badge, or memory as the target for
  a normal update.
- If installed equals target, report `Already up to date` and stop.

### Step 2: Verify Source And Preview

- Run `git remote get-url template`; do not silently replace a conflicting remote.
- Inspect `git status --short` and project-owned `project-*` overlays.
- Preview the exact target:

```bash
node <release-checkout>/scripts/sync-template.js <release-checkout> <project> --plan-file <outside-project-plan.json>
```

Stop for remote/SOT conflicts, downgrade or major-version jumps, dirty ownership
ambiguity, changed product boundaries, or plan conflicts.

### Step 3: Account For Local State

- Ensure current work is committed or explicitly accounted for.
- The updater never hides work in a stash or claims a committed-baseline tag is
  a backup of dirty files. Apply journals and rolls back only its own writes.

### Step 4: Execute Sync

```bash
node <release-checkout>/scripts/sync-template.js <release-checkout> <project> --plan-file <outside-project-plan.json> --apply
```

- Use the exact plan file accepted during preview.
- If local sync is missing/broken, use the target release checkout's script with
  `--project-dir`; never patch the stale script ad hoc.

### Step 5: Validate

- Verify `.template-manifest.json.template_version` equals target without `v`.
- Check actual diff, preserved `project-*`, and every reported conflict.
- Run text policy, Codex agent/skill validation, routing smoke, and project tests
  when present.

### Step 6: Review And Commit

- Report installed -> target, repository URL, exact tag, preview/apply evidence,
  checks, preserved overlays, conflicts, and remaining doubt.
- Suggest `chore: sync template from vX.Y.Z to vA.B.C`.
- Say a GitHub Release is published/live only after checking the authoritative
  release or workflow state.

## Legacy Bootstrap

```bash
node <release-checkout>/scripts/sync-template.js <release-checkout> <project> --bootstrap --plan-file <outside-project-plan.json>
node <release-checkout>/scripts/sync-template.js <release-checkout> <project> --bootstrap --plan-file <outside-project-plan.json> --apply
```

## Invariants

- Project-owned files and `project-*` overlays are preserved.
- Normal updates use a verified release tag, never an implicit branch.
- Preview and apply use the same digest-bound source, target preconditions, repository, and tag.
- No success claim is valid without post-sync version and verification evidence.
