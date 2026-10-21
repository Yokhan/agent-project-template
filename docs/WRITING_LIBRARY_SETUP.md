# Connect the private writing library

A template clone contains the reading rules, catalog and scripts. The originals
and extracted text live in a separate private repository:
`Yokhan/agent-project-template-library`. The public template pins its exact commit
in `_reference/writing-library-source.json`; it does not follow the latest branch.

## First machine setup

1. Accept the private repository invitation under the intended GitHub account.
   This personal repository grants the standard collaborator role with write
   access. GitHub does not offer a read-only collaborator role here; see
   [personal repository permissions](https://docs.github.com/en/enterprise-cloud%40latest/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository).
2. Ensure GitHub CLI is installed and that `gh auth status` confirms that account.
   If authentication is missing, the user signs in with `gh auth login`; agents
   must not copy another user's credentials or print tokens.
3. From an installed template project, run:

   ```text
   node scripts/writing-library.js provision
   node scripts/writing-library.js status
   node scripts/writing-library.js index-status
   ```

The agent runs provisioning as part of an authorized project setup. Require
`state: ready` from both library and index checks before reporting source-backed
writing readiness. Missing repository access is a setup blocker with a concrete
next action, not permission to skip primary reading.

Provisioning imports four writing books, the game-production book, and the
project-resolution guide, together with their pinned text caches. The current
catalog requires all six. It verifies exact file paths, source hashes and cache
provenance before an atomic import, then derives contents and examples locally.
It never executes scripts from the private repository. A valid existing library
is reused; a stale or incomplete destination is preserved and reported.

## Storage and cleanup

The shared machine store is
`~/.local/share/agent-project-template/writing-library`. `--root` or
`AGENT_WRITING_LIBRARY` can select an absolute external store. Keep it outside
project Git checkouts. Projects share this store rather than duplicating books.
After normal completion, managed scratch holding temporary download inputs is
reclaimed; the durable library and local study index are preserved. Forced
termination can leave protected run scratch or a sibling `.<store>-import-*`
staging directory from the atomic importer. Inspect the exact staged data for
recovery before cleanup; automatic scratch sweeps do not delete book-store
staging. POSIX foreground interruptions retain scratch as described in
[supported environments](SUPPORTED_ENVIRONMENTS.md#managed-disposable-runs).

Manual offline import remains available through the manifest format in
[source grounding](../.claude/library/technical/writing-source-grounding.md#import-manifest).
Public CI uses synthetic fixtures and does not receive private books or tokens.
An owner-authenticated import proves the delivery path for that account; access
and execution under another person's account must be verified separately.
