# v6.4.2 Candidate - Same-Session Notice Classification

Status: prepared candidate; not published. v6.4.1 remains the latest verified
stable release. Do not use v6.4.2 for consumer rollout until exact-commit preflight, exact-tag
Linux/Windows CI and release asset checks pass.

## Change

An exact notice with `--run run_<12-lowercase-hex-id>` can arrive during the same
actual Orca turn as a supported unresolved task. The previous exact-plain
classifier treated that notice as a replacement logical request even when it
belonged to the active turn. The v6.4.2 patch adjusts the notice classifier so
that the same-turn run notice stays attached to its active logical request.

The supported unresolved same-session ledger remains available. Closed tasks
are not reopened, genuine human text remains distinct from notices, and
historical child/editor receipts already displaced by earlier behavior are not
migrated. This patch includes no timer, watcher, native activation or
model/effort-policy change.

## Evidence and limits

The patch makes a one-line classifier correction. Focused synthetic same-turn
actual-hooks-branch assertions passed (39 assertions). This is source/fixture
evidence only; native Orca activation and full candidate CI remain unverified.

Parent-owned release gates remain: exact-commit Linux and Windows preflight,
followed by exact-tag Linux and Windows CI, then verification of the downloaded
checksum, release metadata and canonical archive.
Publication and rollout require those fresh gates. The prior v6.4.1 archive
receipt is historical evidence and does not substitute for v6.4.2 checks.
