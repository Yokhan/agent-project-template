# /self-check — Architecture & Code Health Verification

Run a comprehensive self-check of Agent OS. Report findings, don't fix silently.

## Steps

1. **File sizes** — Check all `.rs` files in `desktop/src-tauri/src/`. Flag any over 375 lines.

2. **Cargo check** — Run `cargo check` in `desktop/src-tauri/`. Report errors and warnings.

3. **Dead code** — Grep for `#[allow(dead_code)]`, unused imports, unreachable patterns.

4. **Security** — Verify:
   - No `cmd /C` or shell wrappers in commands (should use `Command::new("bash")` or `Command::new("claude")` directly)
   - All project paths go through `state.validate_project()`
   - No `--dangerously-skip-permissions`
   - Permission profiles whitelisted to `["restrictive", "balanced", "permissive"]`

5. **Consistency** — Check:
   - All Tauri commands in `commands/*.rs` are registered in `lib.rs`
   - All `invoke('command_name')` calls in `index.html` match registered commands
   - All signals in index.html are used (not orphaned)

6. **Template sync** — Verify `sync-template.sh` patterns cover all syncable directories

7. **Config** — Check `n8n/config.json` has required fields: `documents_dir`, `orchestrator_project`

8. **Permissions** — Verify all 3 permission profiles exist in `n8n/dashboard/permissions/`

9. **Dependencies** — Check `Cargo.toml` for unused deps, `package.json` for missing deps

10. **Report** — Summarize: X passed, Y warnings, Z errors. List each finding with file:line.
