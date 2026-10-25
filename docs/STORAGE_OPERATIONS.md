# Coordinating bulk storage operations

The native hook coordinates declared bulk copies within one project. Before a
snapshot or materialization, claim its canonical source, complete input digest
and purpose. A concurrent identical claim returns `busy`; a verified published
result returns `reuse` with its existing target, even when a caller proposes a
different revision directory. Only `writer` permits a new allocation.

This is cooperative coordination, not a filesystem sandbox. Arbitrary scripts
can allocate files without declaring them. Published outputs must remain
immutable by producer convention; this registry does not change filesystem
permissions. Mutable working directories must not be shared as published outputs.
It neither deletes legacy data nor converts files to hardlinks or archives.

## Lifecycle

Use the session and logical request identifiers supplied by the native hook.
Write a small local input JSON file, then invoke:

```text
node scripts/storage-operation.js claim --root PROJECT --input claim.json
```

`claim.json` contains `source` (existing canonical input), `digest` (lowercase
SHA-256 over every input affecting the result), `purpose`, a new `target` beneath
the project root, positive `reserveBytes` for peak additional payload, `session`
and `request`. Input identity is the producer's responsibility. Reading a
protected baseline is allowed; allocating over it or an overlapping path is not.
New targets cannot overlap the source, another operation, a pin/protection, or
the registry itself. Existing nonempty targets are refused.

Before returning `writer`, the command first commits a private owner-fenced
pending claim in the project database, then commits a reservation to the
per-user volume registry, then rechecks and commits the project lifecycle row
with one unissued writer grant while removing the pending claim. A final local
compare-and-set consumes that grant before returning `writer`; every claim path
uses the same grant. Each database transaction ends before a transaction begins
in the other database. This avoids a cross-database write transaction. The
pending row begins as intent and does not reserve capacity. If the process stops
after global commit, an exact matching claim can validate the funded reservation
and recover the unissued grant. Other pending intents are neither promoted nor
counted as debt. Project status may show pending IDs and request metadata but
never raw tokens or grant state. Status itself does not recover or mutate claims.

The project registry remains the source of truth for operation ownership,
targets, manifests, pins, protections and lifecycle state. The global registry
stores only the project root, operation ID and generation, target, volume
identity, byte count, reserved state, creation time and SHA-256 of the owner
token. It never stores the raw token or payload contents. Each new global
reservation samples available bytes again after acquiring the registry's
`BEGIN IMMEDIATE` lock, then subtracts all unreleased reservations for that
volume and applies the free-space floor.

Keep the returned `id`, `token` and `generation` local. On `busy`, wait for or
inspect that operation; do not manufacture another digest to force a copy. On
`reuse`, use the returned target without modifying it. Tokens are omitted from
status and hook context. They are ownership fences against accidental cross-chat
updates, not security credentials against an agent with local database access.

After the writer finishes, invoke `publish` with those owner fields, `session`,
`request` and a `manifest` array of `{path,size,sha256}` for every output file.
Paths are relative, slash-separated. The registry hashes the complete tree and
rejects mismatches, links, extra files or payload exceeding the reserved bytes.
Reuse verifies that manifest again. Large outputs above 20,000 files or a 1 MiB
manifest require a separately designed producer contract.

Use `pin` with `resourceId` or an existing `path` to record a consumer. Use
`protect` with existing `path`, `reason`, `session` and `request` for legacy paths
that must survive consolidation. Neither command scans all project references;
the consumer must identify its inputs. Use `status --root PROJECT` for public
metadata, or add `--session ID --request ID` for scoped unfinished writes.

On failure, invoke `abandon` with the writer's owner fields. Files and its space
reservation remain. `release` removes only owned metadata and refuses a writer
or abandoned operation while its target exists. It never removes files. Pins
and protections are released only with their own token and owner identifiers.
No timestamp expires ownership, deletes data, or transfers a writer lease.
Interrupted owners require explicit reconciliation; there is no automatic
takeover or claim that an old directory is unused.

Retry the exact matching `claim` after a crash before its one-time grant is
consumed. It first checks for a committed reservation; if none exists, it must
pass ordinary capacity admission. It recovers the writer only when session,
request, source, digest, purpose, target, byte count, generation and token hash
match. A crash after the grant CAS commits but before the response arrives is
ambiguous: a retry returns `busy` and never reissues that grant. An explicit
owner-fenced `reconcile` can release the operation when its target is absent,
using its ID, generation, session and request even if the response token was
lost. `reconcile` also handles a reservation left by an older client without a
pending journal; it requires the saved token and confirms the target is absent.
For an existing project operation, reconciliation requires the same owner fence
and either a verified `ready` manifest or an absent target. Status never
reconciles or writes; keep an orphan reservation if its project evidence cannot
be recovered.

For an interrupted operation, first run `status --root PROJECT --session OWNER
--request REQUEST` and inspect its ID, state, target and reservation. Check the
original chat and its owned process/job before concluding that its writer has
stopped; age alone is insufficient. The original owner can use its saved token
and generation to `abandon`. If the target is already absent, that owner can
`release` the metadata. If files remain, preserve them and review their consumers
and an exact cleanup list separately. When the owner/token cannot be recovered,
keep the reservation and report the blocked operation: this CLI has no
administrative takeover command. Do not edit or erase the live database to clear it.

## Concurrency, hooks and limits

SQLite WAL transactions serialize claim/reservation changes, while status reads
project and volume metadata without creating or migrating either registry.
Same-resource competitors receive the existing target. Admission measures the
nearest existing ancestor of the requested target, not the project root. Windows
uses the host name and volume GUID returned by `GetVolumePathNameW` and
`GetVolumeNameForVolumeMountPointW`; POSIX uses the host name and `st_dev`.
UNC paths and unresolved Windows volume identities fail closed. The per-user
registry at `~/.local/share/agent-project-template/storage-coordination/registry.sqlite`
keeps one 2 GiB floor and all unreleased reservations for each measured volume.
Reservations for the same host/volume share one serialized capacity check.

Admission is cooperative metadata for declared bulk operations that use this
version of the command and its shared per-user registry. It does not cover all
managed-temp work, older or otherwise nonparticipating clients, other users, or
unrelated programs, and it is not an OS quota. Those writers can still consume
space without a reservation.
Available space can also change externally. POSIX `st_dev` does not identify
physical capacity across remounts or pooled filesystems, and the check does not
claim a universal hard quota. Each claim backfills all pending claims and
writing or abandoned operations in its current project, preserving their
original IDs, targets, generations and owner fences. It imports known debt even
when the volume is already over capacity; new claims then fail until owners
publish or release their operations. The command does not scan or adopt unknown
projects.

SessionStart and UserPromptSubmit provide bounded coordination context.
PostToolUse refreshes it when a registry exists. PreToolUse recognizes normal
`robocopy`, recursive `Copy-Item`/`cp`, inline Node/Python copy calls and small
copy scripts in `.session-cache`. Such commands require this request's active
claim and its exact absolute destination. Copy scripts must receive the explicit
`--target ABSOLUTE_PATH` argument; they remain responsible for honoring it.
Only simple direct copy forms with modeled flags are authorized; job files,
destination-changing `cp` options and compound shell commands are refused.
Read-only inventories
and normal managed-temp invocations retain their existing behavior. This is
bounded command recognition, not a general shell parser or proof of script
behavior. Managed-temp remains responsible for disposable build/test scratch.

Stop refuses only unfinished writers owned by the current session and logical
request. A neighbor's writer is preserved and does not block this request.
Abandoning an operation settles the request without pretending its residual
files were cleaned. Unknown files are never swept by this registry.

The project database lives in `.session-cache/storage-operations/registry.sqlite`;
the per-user volume database is under `~/.local/share/agent-project-template/`.
Both have bounded rows and an 8 MiB checked metadata budget. A full registry
fails visibly; it does not prune records or user resources automatically. Do
not delete either live registry to bypass admission or ownership checks.

## Verification and rollout

Run the focused project and volume registry tests through `managed-temp`. The
project test covers lifecycle owner fences, path overlaps and manifest
integrity. The volume test uses isolated metadata and separate project roots to
check serialized admission, token hashing and conservative release. The
cross-project live scenario uses real child processes and the measured host
volume without allocating the reserved payload; run it separately when its
acceptance evidence is required. These tests prove command behavior; real
trusted native events establish host activation separately.

For a targeted local repair, back up the existing handler and copy only the
reviewed registry, CLI, adapter and handler changes. Preserve dirty project work
and retain a hash-bound rollback receipt outside scratch. This is not a template
release or a full downstream sync. Existing referenced release directories and
media stay in place until their consumers and replacement paths are verified.
