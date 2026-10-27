# Fresh Primary Sources For Substantive Nonfiction

## Discovery And Ownership

Run `node scripts/writing-library.js status` from any installed template project.
The same machine library resolves to
`~/.local/share/agent-project-template/writing-library` on Windows/Linux/macOS;
`AGENT_WRITING_LIBRARY` or `--root` can select an absolute external path. No global
agent configuration is edited. The template is the canonical source of scripts
and rules; the machine store is the canonical local book copy. Setup/sync ship
only metadata and code; public Git/setup/sync/release payloads never bundle books.
Authorized first-machine provisioning is a separate explicit operation.

For an authorized user of the pinned private source repository, run:

```text
node scripts/writing-library.js provision
```

This requires GitHub CLI (`gh`) authenticated as that user with access to
`Yokhan/agent-project-template-library`. The template pins one immutable commit
in `_reference/writing-library-source.json`. Provisioning verifies the remote
file set and edition hashes, imports all six originals and text caches into the
external machine store, and builds the local contents/examples index. Existing
valid sources are reused. Temporary download inputs use managed scratch;
credentials and book bodies must never enter logs or the public template.

An invitation alone is not active access: the recipient must accept it and
authenticate on their own machine. On missing access, report the blocked source
setup. Do not claim writing readiness or replace primary reading with summaries.
See `docs/WRITING_LIBRARY_SETUP.md` for setup and acceptance.

For an offline first-machine import from supplied exact files, with user authority, run:

```text
node scripts/writing-library.js import --manifest <supplied-manifest.json>
```

Exactly the six catalog editions and pinned text caches are required. Import
checks hashes and locator counts before writes, stages/validates the store,
and refuses overwrite of a stale/incomplete store. A repeated valid import
reuses it with zero copies. The separate explicit `index` command writes only
derived local study references as described below; other commands are read-only. Downloads and older
copies remain untouched. Import never downloads sources or installs extractors.
The supplied extraction has hash-bound provenance but has not been independently
re-extracted; inspect the original when typography, images or extraction quality
could affect meaning. A different edition needs an explicitly reviewed catalog
update, not a text cache from another book.

### Import Manifest

The supplied JSON must contain a `sources` array with exactly one entry for each
of the six catalog editions. Each entry has these fields:

| Field | Value |
| --- | --- |
| `sha256` | The edition's `originalSha256` from `writing-library-catalog.json` |
| `local_path` | Absolute path to that original file outside the project/store |
| `text_path` | Absolute path to its supplied, already extracted UTF-8 text cache outside the project/store |

For example, one entry has the shape
`{"sha256":"<catalog originalSha256>","local_path":"/absolute/book.pdf","text_path":"/absolute/book.txt"}`.
Place all six entries in `{"sources":[...]}` and replace the example values with
the actual paths and catalog hashes. The required source IDs are `write-short`,
`clear-understood`, `business-correspondence`, `social-media`, `game-as-business`
and `project-resolution`; matching uses the original hash, not a guessed title.
Import also checks each cache against the catalog's `textSha256` and unit
locators. It does not produce a new extraction for a different edition.

Run `node scripts/writing-library.js status` after import and require
`state: ready`. A non-ready result includes the missing or mismatched inputs;
resolve those inputs rather than changing catalog hashes to accept other bytes.

## Select By The Artifact's Real Job

Check applicability of all six; read only the relevant sources, never all six
by default. General substantive nonfiction uses `write-short` and
`clear-understood`; add correspondence/social/game/project sources by purpose.
The CLI's deterministic selection is a navigation aid. Confirm meaning as an
agent and revise an ambiguous task to describe the actual artifact. Nonfiction
work must not be reclassified as fiction/code to bypass a missing library.

| Source ID | When useful | Starting primary locations, not sufficient coverage for every task |
| --- | --- | --- |
| `write-short` | Informational, technical, business and sales prose | PDF pages 31–38 method; 165–168 informativeness; 176–182 syntax; 233–263 purpose/structure; 280–284 explanation; 335–342 company text |
| `clear-understood` | Context, explanation, persuasion | EPUB `OPS/ch1-5.xhtml` context; `ch1-17/-18` examples; `ch1-22` facts; `ch1-26` explanation order |
| `business-correspondence` | Letters, support, complaints, negotiation | PDF pages 30–34 recipient attention; 52–54 care; 209–211 complaints; 225–230 outreach |
| `social-media` | Content, marketing, social distribution and sales | EPUB `OPS/ch1-4/-5.xhtml` strategy; `ch1-6` reader action; `ch1-16/-17/-18` genres; `ch1-27/-28/-29` metrics |
| `game-as-business` | Commercial games, studios, production and publishing | PDF pages 17–24 product/platform; 98–106 planning; 173–177 prototype/slice; 225–227 publisher contact |
| `project-resolution` | Project planning, useful versions, uncertainty and acceptance; mandatory with commercial-game process work | Named Markdown sections/chapters 1–4, 7–8, 14 and 17 as relevant |

Actual narrative fiction/lore prose is excluded from informational book editing.
Plans for writing a novel or building a game, commercial pitches, technical
books and sales descriptions are nonfiction artifacts. For a mixed request,
retrieve separately for each nonfiction artifact; use lore/story SOTs for the
fiction artifact. The creative project's planning/production quality bar stays.
Code-only changes and small acknowledgements may skip source reading; substantive
explanations, descriptions and business answers may not.

## Retrieve, Read, Apply, Review

### Literal Local Contents And Examples

Build copied references from the six verified editions on the current machine:

```text
node scripts/writing-library.js index
node scripts/writing-library.js index-status
node scripts/writing-library.js contents --source write-short
node scripts/writing-library.js examples --source write-short --query "синтаксис ритм действие" --limit 3
```

The derived index stays under the machine library, outside Git. It copies actual
contents blocks and literal example-bearing excerpts with source, locator,
character offsets and hashes. Full unit navigation covers the entire cache;
page previews are explicitly navigation, not invented chapter headings. A copied
example candidate is not an independently verified before/after pair. PDF text
extraction can flatten columns: consult the original when layout determines
meaning. The index is edition-bound, read-only to consumers and rebuilt only by
the explicit command. Missing/stale or tampered references cannot count as fresh
reading. Originals and pinned text caches remain unchanged.

Before drafting, inspect the applicable contents and examples to check whether
the mapped topics cover the writing problem. Read relevant literal context,
including neighboring text where needed; use a focused `refresh --query` for
additional packet context. Then reapply source notes and review exact output.
The copied references improve navigation; they do not demonstrate comprehension
or replace the primary-reading/application/editorial checks.

The edition-bound editorial section map is `writing-reading-map.json`. It maps
reader jobs, evidence, explanation, Russian syntax/rhythm and specialized book
methods to actual primary locations. It is a finite navigation map, not a
summary of every idea in the corpus. Project-approved voice/examples still
take precedence. Select by the task's editorial problem, not just its subject:

```text
node scripts/writing-library.js map
node scripts/writing-library.js plan --task <artifact-reader-job> --kind nonfiction
node scripts/writing-library.js read --task <artifact-reader-job> --request-id <active-request-id> --request-started-at <ISO-8601-turn-start> --kind nonfiction
```

`read` retrieves complete mapped units, including mapped neighboring pages, up
to 96,000 characters by default and at most 96,000 with an explicit limit. The packet binds the edition/map/plan, selected topics,
full unit boundaries, receipts and output application. A missing mapped target,
incomplete unit or insufficient budget blocks; a page/section count is not a
quality score. Check whether the context answers the actual editorial questions
and extend it when needed. `--query` adds focused lexical navigation within
remaining space; it never removes mapped requirements and reports unfulfilled
supplementary searches explicitly. Do not call a partial packet complete reading.
Extend the map only after inspecting the actual edition.

Explicit `retrieve` below remains available for additional focused reading. Its
chunked legacy packet is not sufficient for the native mapped-reading gate.
Native `codex-turn refresh` uses `read` semantics and invalidates old draft/editor
bindings.

1. Assign a unique current `request-id` and describe the artifact/reader job.
   `select --task <task>` shows applicability; `retrieve` also selects sources.
2. Read the mapped packet before drafting/review; use explicit focused retrieval
   for further context when needed:

   ```text
   node scripts/writing-library.js retrieve --request-id <active-request-id> --request-started-at <ISO-8601-turn-start> --task <current-artifact-task> --query <relevant-Russian-keywords>
   ```

   Build an editorial question, not merely topical keywords: "what must the
   recipient know to act?", "which reader context enables this explanation?",
   "how does this claim become verifiable?" Use corresponding Russian terms.
   Books are Russian: English focused query wording usually needs source-language query
   terms. Retrieval ranks literal primary passages by lexical query matches, not semantic relevance, model
   summaries or the first characters of every book. Explicit `retrieve` defaults: one passage/source,
   at most 24,000 characters total; configurable 1–3/source and 3,500–96,000 total.
   Review the returned content, not only the receipt. If it is not relevant or
   context is incomplete, refine keywords, read neighboring page/sections in the
   verified text/original and retrieve additional focused packets. One hit is
   not proof of sufficient coverage; a no-match is blocked, not an empty success.
   An exact primary location may be selected with, for example,
   `--locators "write-short@PDF page 31,clear-understood@EPUB section OPS/ch1-26.xhtml"`.
   These are starting anchors: read enough neighboring context when necessary.
   `--sources` allows focused reading; `pendingSourceIds` must be covered before
   claiming the task's source reading is complete. Retrieval records `retrievedAt`
   and binds it and each receipt timestamp into the packet digest. On application
   verification, packets and receipts must be no older than 24 hours by default;
   pass `--max-age-ms <positive-integer>` to choose another bound. Supply the
   current turn's `--request-started-at` to reject packets and receipts created
   before that request. Timestamps must be valid ISO 8601 values with a timezone.
3. Keep the current packet/receipts in task context or ignored `.session-cache/`.
   Record each applicable primary principle and its concrete effect on the
   artifact: e.g. which empty claim becomes a verified property, which omitted
   context enables the recipient's action, which metric matches the reader stage.
   Do not reproduce lengthy book quotations in deliverables or public logs.
4. Bind the application record to the actual artifact bytes. Schema:

   ```json
   {"requestId":"active-request-id","packetId":"packet digest","artifactSha256":"current artifact hash",
    "principles":[{"sourceId":"write-short","passageSha256":"passage digest","principle":"specific reading-derived rule","effect":"observable change/check in this artifact"}]}
   ```

   With local packet, application record and artifact files, run:

   ```text
   node scripts/writing-library.js verify-application --request-id <active-request-id> --request-started-at <ISO-8601-turn-start> --task <same-task> --packet <packet.json> --application <application.json> --artifact <draft-file>
   ```

   Verification rereads hashes/passages and rejects another request, stale packet,
   task, edition or changed draft. It also checks that the covered and pending
   source lists match the packet passages and requires every applicable source
   before application can verify. Use a full-coverage packet for this check;
   focused packets are valid additional reading, not complete application verification. The command verifies
   records and binding, not semantic understanding or quality. Check that source
   principles actually improve the artifact; choose self-check or independent
   review under the policy in `writing.md`. Hashes cannot replace that judgment.
   Chat-only artifacts can retain the same bindings/notes in task context;
   do not invent a CLI verification if none ran. A reviewer obtains fresh relevant
   reading for its current review task rather than checking yesterday's box.

Missing/stale library: report `source-grounding-blocked` and its cause. No fallback
to "I remember the book", static profile, summary or unverified other edition.
If the worker cannot run Node/read the store, the coordinator supplies the fresh
literal primary packet with receipts; if that is unavailable, report the gap.

## Cost And Evidence Limits

For a substantive authored nonfiction artifact or material rewrite, obtain an
independent editorial pass on the completed draft. Brief explanations/status,
literal typo fixes and explicit no-agent requests can self-check; being short
does not exempt an authored ad or letter. Review the meaning/reader purpose,
structure, supported claims/customer value, natural language, tone and rhythm,
plus mode-specific requirements. The editor must give exact draft evidence and
source-derived decisions for the selected topics, with actionable corrections.
Do not invent defects for appearances or approve by default.

In native Codex, create the editor assignment with `codex-turn editorial-assignment`
and use the distinct read-only `writing_editor` role (GPT-6 Luna High). Wait for its
actual JSON result. `codex-turn review-accept` binds that native child result,
parent-correlated runtime, current reading and exact draft. An outstanding finding
blocks acceptance. A changed draft requires a fresh editorial pass. Writer-created
JSON and an old approval cannot stand in for that execution. When required review
is unavailable, report the acceptance gap rather than calling self-check independent.
Other hosts must use their real separate reviewer and report their evidence limits;
do not fabricate native Codex events.

Extraction/index reuse avoids repeated parsing and per-project copies. Only
task-relevant passages enter context, not full books. Disk caching is not prompt
caching: Codex/server prefix-cache availability and token savings are not
guaranteed. A read receipt proves tool access to bytes, not model comprehension.
Application notes and independent review provide stronger behavioral evidence.
Book methods do not establish current technical facts, legal rules, markets,
prices or platform algorithms; verify those with current primary sources.

For product or service prose, name the reader's concrete situation, promised
after-state and supplied product facts that support each claim. Keep those facts
intact when shortening or polishing. A form submission is not a confirmed
appointment unless the user receives the promised confirmation; describe the
step the visitor can actually complete. Identify the exact target surface and
environment when discussing examples or acceptance evidence. A Storybook
preview, served-site render and native-device run describe different surfaces
and must not be blended into one claim.

Give an independent editor the reader scenario, source facts, approved
voice/style examples and actual output surface together. Ask the editor to check
the reader's decision, factual boundaries, voice and promised outcome. A review
receipt establishes that a review occurred, not that the prose is true or the
product fulfilled its promise. Missing outcome evidence can be reported as an
explicit gap or partial handoff; it does not create a universal repeat-review
loop.
