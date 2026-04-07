# Current Task — Three Template Changes

## 1. Project Self-Scan + Living Spec

Every project must scan itself at session start and maintain PROJECT_SPEC.md.

### Add rule: `.claude/library/process/context-first.md`
- At session start: scan project structure, read recent git log (5 commits), check PROJECT_SPEC.md freshness
- If PROJECT_SPEC.md exists and older than 7 days → warn
- If doesn't exist → generate on first session

### PROJECT_SPEC.md (auto-generated, project root):
- What this project IS (1-2 sentences)
- Stack and key dependencies
- File structure map
- What it provides (APIs, URLs, exports)
- What it depends on (other projects, services)
- Current state (from tasks/current.md + git log)
- Last scan date

### Update session-start.sh:
- Check PROJECT_SPEC.md freshness → warn if stale

---

## 2. Mandatory Research Before Execution

### Add rule: `.claude/library/process/research-first.md`
Before ANY task that modifies code/content:
1. READ relevant files + their neighbors, imports, tests
2. CHECK git log for recent changes to those files
3. CHECK tasks/current.md and tasks/lessons.md
4. CHECK PROJECT_SPEC.md for dependencies
5. If cross-project → CHECK ecosystem.md
6. State what you found BEFORE starting work

### Update implementer.md:
- Mandatory "Research Phase" before implementation
- Agent must output what it read and found before coding

### Update pipelines:
- Every pipeline starts with Research step

---

## 3. Writer Agent Fix (from previous task)

### Update writer.md:
- Before ANY text: search project for constitution.md, style guides, customer passports, BAN-LIST
- Load platform-specific rules if specified
- Opus model mandatory

### Add rule: `.claude/rules/project-writing.md`
- BAN-LIST enforcement
- Anti-AI patterns
- Platform adaptation
- Human voice verification

---

## Success Criteria

- [x] context-first.md rule created
- [x] research-first.md rule created
- [x] plan-first.md rule created (added: mandatory planning with file architecture)
- [x] PROJECT_SPEC.md template in template root
- [x] session-start.sh updated (PROJECT_SPEC.md freshness check)
- [x] implementer.md has research phase + planning phase
- [x] writer.md has pre-write protocol (constitution, style guide, BAN-LIST, customer passport search)
- [x] writing.md rule created (universal, syncs to all projects)
- [x] All 3 pipelines updated with Research step (feature, bugfix, security-patch)
- [x] CLAUDE.md updated with new rules references + PROJECT_SPEC.md in context

---

_Last updated: 2026-03-26_

## Session End — 2026-04-04 22:46
Modified files:
n8n/build-dashboard.py
n8n/workflows/dashboard.json

## Session End — 2026-04-04 22:52
Modified files:
brain/01-daily/2026-04-04.md

## Session End — 2026-04-04 22:56
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-04 23:37
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-04 23:42
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-04 23:45
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-04 23:54
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 00:31
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 00:35
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 00:43
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 00:43
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 00:49
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 00:57
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 00:57
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 01:01
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 12:00
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 12:18
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 12:22
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 12:29
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 12:36
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 12:52
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 13:00
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 13:07
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 14:57
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 15:27
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 15:31
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 15:39
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 18:27
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 18:42
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 18:47
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 18:50
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 18:55
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 19:05
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 19:35
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 20:01
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-05 20:01
Modified files:
brain/01-daily/2026-04-04.md
tasks/current.md

## Session End — 2026-04-06 09:29
Modified files:
brain/01-daily/2026-04-06.md

## Session End — 2026-04-06 09:29
Modified files:
brain/01-daily/2026-04-06.md
tasks/current.md

## Session End — 2026-04-06 09:30
Modified files:
brain/01-daily/2026-04-06.md

## Session End — 2026-04-06 09:52
Modified files:
brain/01-daily/2026-04-06.md
tasks/current.md

## Session End — 2026-04-06 09:52
Modified files:
brain/01-daily/2026-04-06.md

## Session End — 2026-04-06 09:58
Modified files:
brain/01-daily/2026-04-06.md

## Session End — 2026-04-06 09:58
Modified files:
brain/01-daily/2026-04-06.md

## Session End — 2026-04-06 13:45
Modified files:
brain/01-daily/2026-04-06.md

## Session End — 2026-04-06 13:46
Modified files:
brain/01-daily/2026-04-06.md

## Session End — 2026-04-06 13:51
Modified files:
brain/01-daily/2026-04-06.md
tasks/current.md

## Session End — 2026-04-06 13:52
Modified files:
brain/01-daily/2026-04-06.md

## Session End — 2026-04-06 13:53
Modified files:
brain/01-daily/2026-04-06.md
tasks/current.md

## Session End — 2026-04-06 18:39
Modified files:
brain/01-daily/2026-04-06.md

## Session End — 2026-04-06 19:10
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-06 20:08
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
desktop/src-tauri/Cargo.lock
desktop/src-tauri/Cargo.toml
tasks/current.md

## Session End — 2026-04-06 20:15
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
desktop/src-tauri/Cargo.lock
desktop/src-tauri/Cargo.toml
tasks/current.md

## Session End — 2026-04-06 20:26
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
desktop/src-tauri/Cargo.lock
desktop/src-tauri/Cargo.toml
tasks/current.md

## Session End — 2026-04-06 20:52
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
desktop/src-tauri/Cargo.lock
desktop/src-tauri/Cargo.toml
tasks/current.md

## Session End — 2026-04-06 21:00
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
desktop/src-tauri/Cargo.lock
desktop/src-tauri/Cargo.toml
tasks/current.md

## Session End — 2026-04-06 21:15
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
desktop/src-tauri/Cargo.lock
desktop/src-tauri/Cargo.toml
tasks/current.md

## Session End — 2026-04-06 22:24
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 14:17
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 14:29
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 14:42
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 15:00
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 15:06
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 15:17
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 15:42
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 15:53
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 16:08
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 16:39
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 16:54
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 17:13
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 17:23
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 19:48
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 19:57
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 20:14
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 20:26
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 20:45
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 20:55
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 21:04
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 21:15
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 21:23
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md

## Session End — 2026-04-07 22:37
Modified files:
brain/01-daily/2026-04-06.md
desktop/package.json
tasks/current.md
