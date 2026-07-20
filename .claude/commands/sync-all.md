---
name: sync-all
description: "Sync template to all projects that have .template-manifest.json. Scans ~/Documents by default."
---

# /sync-all [directory] --plan-dir <outside-projects-directory>

Syncs the current template to all projects found in the specified directory (default: ~/Documents).

## Steps

1. **Scan** for projects with `.template-manifest.json`:
   ```bash
   node scripts/sync-all.js [directory] --plan-dir <review-directory>
   ```

2. **For each project found**:
   - Read `.template-manifest.json` → current template version
   - Compare with this template's version
   - Build one digest-bound preview plan per project
   - Never apply in the preview run
   - Report: previewed / conflict / failed

3. **Present summary table**:
   ```
   Sync Results:
   ✓ ProjectA: v2.3.0 → v2.4.0 (updated)
   ✓ ProjectB: v2.4.0 (already current)
   ⚠ ProjectC: v2.2.0 → v2.4.0 (conflicts in 2 files)
   ✗ ProjectD: failed (not a git repo)

   Summary: 1 updated, 1 current, 1 conflict, 1 failed
   ```

## Options
- `--apply` — apply only the exact plans already present in `--plan-dir`
- Preview is the default and writes only to the explicit plan directory
- Default directory: `~/Documents`
- Skips: the template itself, archived projects
