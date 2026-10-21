# Agent Project Template v6.1.0

This is the release note for the prepared v6.1.0 candidate. It does not prove
that a tag, CI run, GitHub Release, or downloadable archive exists. v6.0.0
remains the latest verified stable release until the exact v6.1.0 commit passes
the Linux and Windows release workflow and its published assets are verified.
The v6.0.0 release record and upgrade requirements remain unchanged.

## What changes

This compatible minor adds managed lifecycles for disposable test, build, copy,
archive, log and browser outputs. Each operation registers an owned run before
launching its command. The supervisor collects exit status, removes owned
scratch after completion, and records the bytes it observed removed or
retained. The release does not promise to clean every cache or temporary file
created by arbitrary tools.

Windows runs use a native process job with kill-on-close behavior to contain
owned descendants when work completes, fails, is interrupted, or its wrapper
exits. POSIX has a narrower declared `foreground` process contract: it does not
claim full descendant containment. That path has not been runtime-verified on
the Windows development host and still requires the release CI run.

Default run outputs are disposable. Reusable project caches are opt-in with
`--cache shared`; the owner tracks active leases and samples an approximate
10 GiB per-project budget, then makes inactive entries eligible for cleanup
after seven idle days. These sampled limits are not hard quotas and do not bound
machine-wide disk use. Active leases, unknown files, browser binaries, MCP
databases, toolchain caches, and the external shared writing library are outside
the cleanup boundary. Custom scripts must direct their outputs to the documented
`AGENT_RUN_OUTPUT`, `AGENT_RUN_BROWSER_DIR`, `AGENT_RUN_COPY_DIR`,
`AGENT_RUN_ARCHIVE_DIR`, and `AGENT_RUN_LOG_DIR` paths. Explicitly retained
exports require a new destination on the same volume; existing destinations are
refused.

The result report is compact and records run identity, exit status, cleanup
outcome, and observed byte counts. It does not store command arguments or raw
logs. These reports are evidence of the managed operation, not proof that
unregistered external caches were removed.

## Local acceptance evidence

Authorized users can provision the pinned private writing library through
`node scripts/writing-library.js provision`. Originals and text caches stay in
the private repository and the shared external machine store. Public setup/sync
ships the descriptor and importer; it does not include the books. The separate
operation verifies the exact source commit and file hashes before import and
builds the local contents/examples index. See [library setup](WRITING_LIBRARY_SETUP.md).

The cleanup candidate at `d2a1ddc` passed Linux and Windows preflight
[39646790758](https://github.com/Yokhan/agent-project-template/actions/runs/39646790758),
including full toolchains. Private-library provisioning is a subsequent source
change. Owner-authenticated provisioning into a fresh isolated store passed all
six sources and 12 source/cache hashes, local index readiness, task-directed
reading, repeat reuse without network, preserved existing library and complete
owned scratch cleanup. Final-commit CI and recipient-account access remain
separate checks.

The Windows local aggregate passed 214/214 checks on 2026-10-21. Real Vite,
TypeScript and offline Cargo profile builds each ran three times. The Playwright
profile passed three browser runs and closed its owned processes. Ordinary
native hooks ran without a per-request trust bypass. Windows tests verified
process-job membership and kill-on-close behavior, including abrupt nested CLI
exit cleanup.

The direct Chromium `--dump-dom` probe timed out; its owned timeout cleanup
completed, but the probe itself did not pass. POSIX foreground behavior has not
been verified locally. Linux and Windows CI, the exact-tag release workflow,
and checksum-bound published archive verification remain required. No
publication or downstream rollout is claimed by this document.

For current install and sync commands, see [the template release protocol](TEMPLATE_RELEASES.md).
