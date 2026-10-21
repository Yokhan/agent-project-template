# v6.1.1 Release Candidate Notes

`v6.1.1` is the prepared compatible-patch target. It is not a published
release: exact-commit CI, the tag, and release assets are still pending. Verify the exact GitHub Release before using this version.

## Why this patch is needed

The immutable `v6.1.0` tag points to `88e6bdd`. Its exact-tag Windows workflow
failed in run [39652334813](https://github.com/Yokhan/agent-project-template/actions/runs/39652334813):
the generated-project setup assertion found that `docs/WRITING_LIBRARY_SETUP.md`
was missing from the setup manifest. No GitHub Release was published for
`v6.1.0`; that tag remains failure evidence and must not be moved or rolled out.

Both setup adapters now record the tracked files they successfully copied and
generate the manifest from that exact set. The shared generator applies canonical
file categories and hashes the actual destination bytes. Untracked source and
starter files remain excluded. Windows uses `call npm.cmd` so installation returns
to the batch script for the build and completion steps. The earlier
preflight for `88e6bdd` passed run
[39651182625](https://github.com/Yokhan/agent-project-template/actions/runs/39651182625),
but it does not prove the fix or replace exact-tag release gates.

## Carried v6.1 behavior

The patch target retains the v6.1.0 feature set and its documented limits:

- Managed disposable outputs, Windows process-family supervision, and cleanup
  evidence for owned runs.
- Optional per-project reusable caches with sampled limits; this is not a hard
  disk quota. Global tool caches, browser binaries, MCP databases, unknown
  files, and active leases are outside the cleanup boundary. Custom scripts must
  write to the documented `AGENT_RUN_*` paths to receive cleanup.
- POSIX support remains a declared foreground-process contract. Descendant
  containment is not claimed and that runtime scope was not verified on the
  Windows development host.
- The shared writing library remains an external private source. Books and text
  caches are excluded from the public template; destination access, hook trust,
  and source availability require their own setup and verification.

See [v6.1.0 feature and lifecycle notes](RELEASE_V6_1_0.md) for the original
feature record and platform details. The current release checklist records
which v6.1.1 gates remain open.

## Acceptance

Fresh full Windows setup passed on 2026-10-21 using Windows PowerShell 5.1:
all 539 copied-file entries matched the manifest, every SHA-256 and canonical
category matched, the manifest had no BOM, context-router built, and the batch
script reached completion. A separate Unix fixture verified exact copied-set
parity, hashes, categories, ignored starter scaffolding and exclusion of untracked
documents, untracked starter files and generated local settings. Native-exit and
manifest regression checks passed.

The 215-check aggregate baseline predates this patch. Local acceptance used an
explicit lower free-space floor for bounded fixtures because this host has less
than the default 2 GiB reserve; the production default remains unchanged. Full
aggregate acceptance requires the clean Linux/Windows CI hosts. Exact-commit CI,
exact-tag release gates, and downloaded checksum/metadata/file-set/canonical
archive verification remain required before calling v6.1.1 published.
