# Fresh Primary Sources For Substantive Nonfiction

## Discovery And Ownership

Run `node scripts/writing-library.js status` from any installed template project.
The same machine library resolves to
`~/.local/share/agent-project-template/writing-library` on Windows/Linux/macOS;
`AGENT_WRITING_LIBRARY` or `--root` can select an absolute external path. No global
agent configuration is edited. The template is the canonical source of scripts
and rules; the machine store is the canonical local book copy. Setup/sync ship
only metadata and code and never import, move, delete or bundle books.

For a first machine import, with user authority, run:

```text
node scripts/writing-library.js import --manifest <supplied-manifest.json>
```

Exactly the six catalog editions and pinned text caches are required. Import
checks hashes and locator counts before writes, stages/validates the store,
and refuses overwrite of a stale/incomplete store. A repeated valid import
reuses it with zero copies. Other commands are read-only. Downloads and older
copies remain untouched. Import never downloads sources or installs extractors.
The supplied extraction has hash-bound provenance but has not been independently
re-extracted; inspect the original when typography, images or extraction quality
could affect meaning. A different edition needs an explicitly reviewed catalog
update, not a text cache from another book.

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

1. Assign a unique current `request-id` and describe the artifact/reader job.
   `select --task <task>` shows applicability; `retrieve` also selects sources.
2. Retrieve a bounded packet before drafting/review:

   ```text
   node scripts/writing-library.js retrieve --request-id <active-request-id> --task <current-artifact-task> --query <relevant-Russian-keywords>
   ```

   Build an editorial question, not merely topical keywords: "what must the
   recipient know to act?", "which reader context enables this explanation?",
   "how does this claim become verifiable?" Use corresponding Russian terms.
   Books are Russian: English task wording usually needs source-language query
   terms. Retrieval ranks literal primary passages by lexical query matches, not semantic relevance, model
   summaries or the first characters of every book. Defaults: one passage/source,
   at most 24,000 characters total; configurable 1–3/source and 3,500–48,000 total.
   Review the returned content, not only the receipt. If it is not relevant or
   context is incomplete, refine keywords, read neighboring page/sections in the
   verified text/original and retrieve additional focused packets. One hit is
   not proof of sufficient coverage; a no-match is blocked, not an empty success.
   An exact primary location may be selected with, for example,
   `--locators "write-short@PDF page 31,clear-understood@EPUB section OPS/ch1-26.xhtml"`.
   These are starting anchors: read enough neighboring context when necessary.
   `--sources` allows focused reading; `pendingSourceIds` must be covered before
   claiming the task's source reading is complete.
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
   node scripts/writing-library.js verify-application --request-id <active-request-id> --task <same-task> --packet <packet.json> --application <application.json> --artifact <draft-file>
   ```

   Verification rereads hashes/passages and rejects another request, task, edition
   or changed draft. Use a full-coverage packet for this check; focused packets
   are additional reading, not complete verification. The command verifies
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

Extraction/index reuse avoids repeated parsing and per-project copies. Only
task-relevant passages enter context, not full books. Disk caching is not prompt
caching: Codex/server prefix-cache availability and token savings are not
guaranteed. A read receipt proves tool access to bytes, not model comprehension.
Application notes and independent review provide stronger behavioral evidence.
Book methods do not establish current technical facts, legal rules, markets,
prices or platform algorithms; verify those with current primary sources.
