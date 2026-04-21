# Lessons Learned

Self-improvement log for AI agent sessions. After EVERY user correction or discovered mistake, add an entry below using the format shown in the example. Read this file at the start of every session to avoid repeating past mistakes.

When this file exceeds 50 entries, run `/weekly` to promote recurring patterns into permanent project rules (`.claude/rules/project-*.md`) and archive promoted entries to `brain/03-knowledge/lessons-archive.md`.

---

## Entry Format

```
### [YYYY-MM-DD] — [Brief descriptive title]
**Track**: BUG | KNOWLEDGE | PATTERN | PROCESS
**Severity**: P0 | P1 | P2 | P3
**Error**: What went wrong (observable symptom)
**Root cause**: Why it happened (the actual underlying issue)
**Rule**: Concrete, actionable prevention rule for the future
**Applies to**: [agent name / skill name / general]
**Category**: [security | architecture | testing | workflow | tooling | performance | ux | general]
**Status**: ACTIVE | PROMOTED | RETIRED
```

### Tracks
- **BUG**: Code broke, tests failed, regression. Something was WRONG.
- **KNOWLEDGE**: Didn't know something. API quirk, wrong syntax, tool behavior.
- **PATTERN**: Recurring anti-pattern spotted. Not a single bug, but a tendency.
- **PROCESS**: The workflow itself failed. Skipped a step, wrong ceremony level.

### Severity
- **P0**: Would cause data loss, security breach, or production outage
- **P1**: Significant user-facing bug or architectural mistake
- **P2**: Minor bug, wrong pattern, suboptimal approach
- **P3**: Style issue, minor inefficiency, cosmetic

### Status
- **ACTIVE**: Currently relevant, check during sessions
- **PROMOTED**: Moved to `.claude/rules/project-*.md` via `/weekly`
- **RETIRED**: No longer relevant, archived to `brain/03-knowledge/lessons-archive.md`

> Old entries without Track/Severity/Status fields remain valid. Add new fields when editing old entries.

---

## Entries

### 2026-03-17 — Example: Hallucinated npm package name
**Error**: Recommended `@utils/smart-merge` package which does not exist on npm.
**Root cause**: Generated a plausible-sounding package name from training data without verifying it exists. No verification step was performed before recommending.
**Rule**: Before recommending ANY external package, verify it exists by running `npm view <package>` or checking the official registry. If unable to verify, state confidence as LOW and flag it explicitly.
**Applies to**: researcher, implementer, general
**Category**: tooling

### 2026-04-21 — grep -c || echo 0 breaks Codex ACP in Zed
**Track**: BUG
**Severity**: P1
**Error**: Codex agent refused to start in Zed for this project (worked in other projects).
**Root cause**: `session-start.sh` had pattern `VAR=$(grep -c "pattern" file || echo 0)`. When grep finds 0 matches it outputs `0` but exits with code 1, so `|| echo 0` also fires — variable becomes `"0\n0"` (two zeros separated by newline). Downstream `[ "$VAR" -gt 0 ]` fails with `integer expression expected`, writing to stderr. Codex ACP treats any stderr from hooks as a failure and refuses to start the session.
**Rule**: Never use `$(grep -c ... || echo 0)`. Use `$(grep -c ... 2>/dev/null) || VAR=0` instead — the `||` must be OUTSIDE the subshell so it assigns a clean fallback without capturing grep's stdout.
**Applies to**: All bash scripts, hooks, session-start
**Category**: tooling
**Status**: ACTIVE

### 2026-04-21 — Broad codex-acp cleanup can kill the live chat
**Track**: PROCESS
**Severity**: P1
**Error**: A recovery command meant to clean stale codex-acp.exe processes killed the active Zed Codex chat and locked the session.
**Root cause**: The kill filter matched every codex-acp.exe plus every powershell.exe whose command line launched codex-acp.exe. In Zed, the live chat uses that same chain: Zed.exe -> powershell.exe -> codex-acp.exe. A broad cleanup therefore kills the current transport, not just stale or orphaned agents.
**Rule**: Never mass-kill codex-acp.exe from inside a live Zed Codex session. This can happen accidentally whenever a cleanup command targets all codex-acp.exe processes or all PowerShell launchers containing codex-acp.exe in the command line. If cleanup is required, first identify the active Zed-owned chain and exclude it, or close the chat/editor before killing ACP processes.
**Applies to**: Codex ACP debugging, Zed recovery work
**Category**: workflow
**Status**: ACTIVE

### 2026-04-21 — Не хардкодить model/effort в проектном .codex/config.toml
**Track**: KNOWLEDGE
**Severity**: P2
**Error**: Проектный `.codex/config.toml` содержал `model = "codex-5.4"` и `model_reasoning_effort = "high"`. Имя модели было неправильным (правильно `gpt-5.4`), а хардкод модели/effort в проектном конфиге перебивал UI-настройки Zed и не давал менять модель/effort из интерфейса.
**Root cause**: При настройке шаблона агент выдумал имя модели (`codex-5.4` вместо `gpt-5.4`) и захардкодил настройки, которые должны быть user-level, в project-level конфиг.
**Rule**: В проектном `.codex/config.toml` хардкодить только project-specific настройки: `approval_policy`, `sandbox_mode`, `project_doc_max_bytes`, `[features]`. Модель, effort, verbosity — оставлять на уровне Zed UI / `~/.codex/config.toml`. Имена моделей всегда проверять по документации (developers.openai.com/codex/models).
**Applies to**: All agents configuring Codex, template setup
**Category**: tooling
**Status**: ACTIVE

### 2026-04-21 — Example blocks can poison markdown counters
**Track**: BUG
**Severity**: P2
**Error**: `context-restore.sh` and `session-metrics.sh` reported 2 research-cache entries when only 1 real entry existed.
**Root cause**: The scripts counted generic headings like `## [` and matched the example block in `tasks/.research-cache.md`, not just real dated entries.
**Rule**: When counting structured markdown records that include examples, match the concrete data shape, not the generic heading prefix. For date-ledger files, prefer a dated pattern such as `^## \\[[0-9]{4}-[0-9]{2}-[0-9]{2}\\]`.
**Applies to**: Shell scripts parsing markdown ledgers
**Category**: tooling
**Status**: ACTIVE

### 2026-04-21 — Validation greps can self-match comments and examples
**Track**: BUG
**Severity**: P2
**Error**: `validate-template.sh` flagged `grep -P` and here-strings even when the only matches were explanatory comments or echo strings inside the validator itself.
**Root cause**: Broad grep-based safety scans were run over the validator source without excluding self-documenting matches, so the checker interpreted its own examples as real violations.
**Rule**: When a validator scans the repository for unsafe patterns, exclude the validator's own explanatory strings or narrow the scan to executable usage. A rule checker that self-matches produces false blockers and erodes trust.
**Applies to**: Shell validators and repo-wide grep checks
**Category**: tooling
**Status**: ACTIVE

### 2026-03-31 — Minimum analysis depth
**Error**: Agent reported services as "working" based on HTTP 200 without checking actual user experience.
**Rule**: Minimum analysis = browser walkthrough of full user journey + marketer lens evaluation. Reference: PersonalAssistant/brain/02-projects/personal-strategy/content/funnel-deep-audit-v2.md — this is what proper analysis looks like.
**Applies to**: All agents doing project health checks or status reports

### 2026-04-21 вЂ” Bootstrap payload must come from an allowlist, not repo-wide copy
**Track**: BUG
**Severity**: P1
**Error**: `setup.sh` leaked maintainer-only directories and local debug artifacts into generated projects, while `setup.bat` omitted Codex and MCP-related files and created a different project shape.
**Root cause**: Both setup entrypoints drifted independently. Unix copied the repo wholesale and tried to delete a few known exclusions after the fact; Windows hardcoded an older copy list, version string, and manifest schema.
**Rule**: Generated-project bootstrap must use an explicit shared allowlist mindset. Never `cp -r` the whole template repo into a child project and hope cleanup removes the right leftovers; never hardcode counts, versions, or shipped surface in only one platform entrypoint.
**Applies to**: setup.sh, setup.bat, release checklist
**Category**: tooling
**Status**: ACTIVE

### 2026-04-21 - Session-start should summarize handoff, not dump raw markdown
**Track**: BUG
**Severity**: P2
**Error**: `context-restore.sh` showed the first 30 lines of `tasks/current.md`, which stopped being useful once the handoff grew past one screen and buried the actual next step.
**Root cause**: Session-start assumed the handoff file would remain manually curated for a fixed `head` window, but the file also became a working note and plan scratchpad during recovery.
**Rule**: Recovery/session-start output must come from a purpose-built summary script with compact defaults and machine-readable mode. Do not depend on `head` over mutable markdown as the long-term context surface.
**Applies to**: context-restore.sh, session-start.sh, handoff tooling
**Category**: workflow
**Status**: ACTIVE

### 2026-04-21 - Top-level allowlists are too coarse for mixed scaffold and live history
**Track**: BUG
**Severity**: P1
**Error**: Working-tree setup smoke copied maintainer knowledge notes from `brain/03-knowledge/research/` and audit logs from `tasks/audit/` into generated child projects.
**Root cause**: The bootstrap allowlist was defined at broad directory level (`brain/*`, `tasks/*`), but those trees mix reusable scaffold with live maintainer history.
**Rule**: For mixed scaffold/history trees, use starter overlays plus explicit subdirectory exclusions. A top-level allowlist is not enough when some subpaths are live notebook or audit output.
**Applies to**: setup.sh, setup.bat, release smoke checklist
**Category**: tooling
**Status**: ACTIVE

### 2026-04-21 - Git Bash from PowerShell can uppercase drive letters and break shared helper sourcing
**Track**: BUG
**Severity**: P1
**Error**: Real downstream migration on Windows failed with `scripts/sync-template.sh: line ...: _node: command not found` even though Node.js was installed.
**Root cause**: Some scripts computed `SCRIPT_DIR` as `/C/...` when launched through Git Bash from PowerShell. That path failed the `[ -f "$SCRIPT_DIR/lib/platform.sh" ]` check, so shared helpers were never sourced and `_node` disappeared.
**Rule**: Any shell script that sources shared helpers from its own directory must normalize `/C/...` to `/c/...` before testing or sourcing sibling paths. Do not assume Git Bash path casing is stable across launchers.
**Applies to**: sync-template.sh, sync-all.sh, scan-project.sh, check-drift.sh, audit-reuse.sh, codex-hook-adapter.sh, sync-agents.sh
**Category**: tooling
**Status**: ACTIVE

### 2026-04-21 - Bootstrap payload must come from git-tracked files only
**Track**: BUG
**Severity**: P1
**Error**: Even after moving away from repo-wide copy, `setup.sh` and `setup.bat` could still ship brand-new untracked files placed under project-facing roots such as `docs/` or `scripts/`.
**Root cause**: Bootstrap built its candidate payload from `git ls-files` plus recursive working-tree scans of shipped directories. That reintroduced leakage through the back door: anything untracked but present under an allowed root became eligible for copy.
**Rule**: Child-project bootstrap must derive shipped payload from git-tracked files only. Starter overlays are the only allowed non-index exception. Never union tracked payload with recursive working-tree discovery for shipped roots.
**Applies to**: setup.sh, setup.bat, bootstrap smoke, release checklist
**Category**: tooling
**Status**: ACTIVE

### 2026-04-21 - Release guards must validate tracked state, not local overrides
**Track**: BUG
**Severity**: P2
**Error**: Fresh trust-hardening checks initially failed because `.claude/settings.local.json` existed locally in the maintainer workspace, even though it was correctly untracked and would not ship.
**Root cause**: The new validator looked at filesystem presence instead of tracked release state. That confused local working files with template payload and produced a false blocker.
**Rule**: For shipped-surface and trust checks, validate tracked state (`git ls-files`, tracked grep, generated smoke) rather than raw file presence in the maintainer workspace.
**Applies to**: validate-template.sh, check-drift.sh, release hardening
**Category**: testing
**Status**: ACTIVE

### 2026-04-21 - Work reports should be written in the client's world
**Track**: STYLE
**Severity**: P2
**Error**: Final closeout was technically accurate but written too much from the implementer's world: long lists of files, infra terms, and process detail before the user-visible outcome.
**Root cause**: Closeout style optimized for engineering traceability instead of client comprehension. The message answered "what changed in the repo" better than "what changed for me".
**Rule**: Final work reports must start from result and effect, not process. Default structure: `Что было → Что стало → Что это даёт → Чего ожидать дальше`. Technical details are secondary and only stay when they help the reader verify or decide.
**Applies to**: All agents writing task closeouts
**Category**: general
**Status**: ACTIVE

### 2026-04-21 - Orchestrators must call the template contract, not fork it
**Track**: PATTERN
**Severity**: P1
**Error**: `AgentOS` could create or update child projects through stale embedded copies of `setup.sh` and `sync-template.sh`, even after the template repo itself had moved on.
**Root cause**: The management app was treated as a second implementation of template bootstrap/update logic instead of an orchestrator over the canonical template repo.
**Rule**: If another project manages template-derived repos, it must call the template's exported scripts and consume shipped project artifacts (`.template-manifest.json`, `tasks/current.md`, `PROJECT_SPEC.md`, `scripts/check-drift.sh`). Do not maintain a forked bootstrap/update implementation inside the orchestrator.
**Applies to**: Template orchestration projects, AgentOS compatibility work
**Category**: architecture
**Status**: ACTIVE

### 2026-04-21 - Windows orchestration must resolve Git Bash explicitly
**Track**: BUG
**Severity**: P1
**Error**: `AgentOS` runtime paths that shell out with `silent_cmd("bash")` can fail on Windows even when Git Bash is installed, because `bash` is not guaranteed to be in `PATH`.
**Root cause**: The code assumed Unix-like shell tooling is globally discoverable. In practice, Windows often has Git Bash at a fixed install path but not exported into the PowerShell or GUI app environment.
**Rule**: Any Windows app that relies on Bash scripts must resolve Git Bash explicitly (`PATH` first, then common Git for Windows install locations) instead of assuming `bash` exists in the process environment.
**Applies to**: AgentOS, Windows orchestration tooling
**Category**: tooling
**Status**: ACTIVE
