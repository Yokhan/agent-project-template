# Agent Project Template v6.1.1

[v6.1.1](https://github.com/Yokhan/agent-project-template/releases/tag/v6.1.1) is published as a stable, non-draft release from
`f2c313f7a02f26007de67ca253153925105ad6a1`. All six [preflight jobs](https://github.com/Yokhan/agent-project-template/actions/runs/39656474228) and the
[exact-tag release workflow](https://github.com/Yokhan/agent-project-template/actions/runs/39657696286) passed.

The downloaded archive contains 577 allowlisted files (1,106,030 bytes).
SHA-256: `02a6a6247a618657c8f49753afc266b394807125861e828b973042ffba5fc68d`. SHA256SUMS, metadata, exact file set and
the canonical local Git archive match; the archives are byte-identical.

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
the verified v6.1.1 publication.

## Acceptance

Fresh full Windows setup passed on 2026-10-21 using Windows PowerShell 5.1:
all 539 copied-file entries matched the manifest, every SHA-256 and canonical
category matched, the manifest had no BOM, context-router built, and the batch
script reached completion. A separate Unix fixture verified exact copied-set
parity, hashes, categories, ignored starter scaffolding and exclusion of untracked
documents, untracked starter files and generated local settings. Native-exit and
manifest regression checks passed.

The earlier 215-check aggregate is baseline evidence. Final-commit Linux and
Windows preflight each passed all 215 checks. Local acceptance used an
explicit lower free-space floor for bounded fixtures because this host has less
than the default 2 GiB reserve; the production default remains unchanged. Full
aggregate acceptance passed on clean Linux/Windows CI hosts. Exact-tag Linux and
Windows gates, including fresh Windows setup and the full pinned toolchain, passed
before packaging/publication. The public assets were independently downloaded and
verified. No downstream project was updated.
