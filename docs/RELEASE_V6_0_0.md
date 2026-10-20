# v6.0.0 - Native workflow evidence and task-directed reading

This major release turns eligible Luna delegation and substantive nonfiction
grounding into a native Codex workflow with request-bound acceptance evidence.
It also raises the runtime requirement to Node 24+ with working node:sqlite.
Verify the exact tag, successful release workflow and downloaded asset checksum
before treating this source snapshot as a published release.

## What changes

- Bounded nontrivial work routes to Luna High when the host supports the
  declared dispatch contract. The parent defines scope, integrates the result
  and owns acceptance. A requested profile is checked against parent-linked
  native runtime metadata. Tiny work, explicit user opt-out and concrete
  unavailable-host fallbacks remain visible.
- Seven native Codex lifecycle hooks track the logical request, reading,
  completed children and exact output application. Existing Bash safety checks
  remain behind the native runner. Hook trust belongs to each host/project;
  shipping configuration does not activate or approve hooks on another machine.
- Edition-bound section maps select complete primary reading by the task's
  editorial problem. A local derived index provides literal contents and copied
  example contexts. The planned packet default and ceiling are 96,000
  characters; host output limits still require reading large local packets in
  bounded parts. Automatic multi-packet reading is not included.
- Material authored nonfiction uses a separate writing_editor running on
  observed Luna High. Its review is bound to the request, source packet and
  exact draft. Changed drafts invalidate that review. An already reviewed file
  can be delivered with a narrow acknowledgement and exact link without a
  duplicate final review. Extra claims and changed/missing files remain gated.
- Privacy transfers require an exact positive file allowlist. Contradictory
  lesson entries are retired with their successors preserved; source retrieval
  alone is no longer presented as proof that writing principles were applied.
- Setup checks the runtime before creating a project. Windows manifest hashing
  uses concrete file paths and .NET SHA-256, propagates failures and records both
  native-workflow documents. Release packaging requires the Linux and native
  Windows gates on the same commit, including fresh setup.bat and manifest-byte
  verification.

## Upgrade requirements

This is a major upgrade because the minimum runtime and default agent operating
contract change. Existing projects are not updated by publishing this release.

1. Install Node 24+ with working node:sqlite and retain Bash/Git Bash for shared
   shell safety checks. Runtime preflight rejects unsupported environments.
2. Confirm the major upgrade for each consumer. Preserve its dirty work,
   project-owned instructions, AgentOS graph and user/IDE settings. Use the
   target release checkout's updater with an external reviewed plan, as defined
   in [the canonical update protocol](TEMPLATE_RELEASES.md#canonical-agent-update-protocol).
   Merge applicable changes into preserved project-owned hot instructions.
3. Review and trust the seven exact project hook definitions through the host's
   hook UI, reload as required by that host, then verify actual lifecycle events
   in an ordinary new chat. Trust state is not part of the release payload.
4. Import the six exact catalog editions and pinned text caches once into the
   external machine library when they are not already available. Books, full
   text caches, copied study excerpts and native transcripts are not bundled.
   Missing or stale sources block grounded writing; CI fixture tests do not
   replace this machine setup. Follow the [library setup and manifest format](../.claude/library/technical/writing-source-grounding.md#discovery-and-ownership):
   run `node scripts/writing-library.js status`, import the supplied source
   manifest with `node scripts/writing-library.js import --manifest /absolute/path/to/manifest.json`
   when required, then rerun `status` and require `state: ready`.
5. Check effective worker model/effort and native editor completion on the
   destination host. Unsupported dispatch or missing runtime metadata must be
   reported as a limitation, not counted as verified Luna execution.

The native updater preserves project ownership and rolls back failed writes.
For an unwanted upgrade, retain the reviewed prior release and restore the
consumer's pre-upgrade snapshot, including project-owned overlays. Do not
silently downgrade or overwrite conflicts.

## Evidence and limits

The integrated local repair candidate passed 210/210 checks and structural
validation with zero errors/warnings on 2026-10-20, before release metadata was
advanced. Native CLI/Desktop scenarios, persisted hook trust, real primary
reading and independent editor outcomes are recorded in
[local workflow acceptance](NATIVE_WORKFLOW_ACCEPTANCE.md). A fresh native
Windows installation matched all 463 manifest digests; an isolated update and
injected-failure rollback preserved 35 project-owned files.

Those observations are bounded local evidence. They do not prove universal
semantic comprehension, comparative speed/token savings, support for every
host, or downstream adoption. The release workflow must validate the immutable
v6.0.0 commit on Linux and Windows before packaging and publication. Its run,
published release metadata and downloaded archive/checksum are the publication
evidence; this document does not pre-approve those pending results.
