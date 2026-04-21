# Debug Recovery Log

Purpose: persistent handoff log for crash/debug sessions. Before each test attempt, record the hypothesis, exact command/script target, and expected signal. After the attempt, record the result.

## 2026-04-21 13:02 MSK

Context restored after chat crash.

Known state:
- Project: `C:\Users\iohan\Documents\agent-project-template`
- User said previous task was "agent template in docs" and current goal is to find the launch failure.
- Screenshot error from Zed: `Failed to Launch` and `Server exited with status exit code: 0xffffffff`
- Dirty files already present when resumed:
  - `.claude/hooks/session-start.sh`
  - `tasks/current.md`
  - `tasks/lessons.md`
  - `.claude/settings.local.json`
  - multiple `brain/...`, `tasks/...`, and `tmp-*` repro files

Recovered evidence:
- `tasks/current.md` shows latest work touched `.claude/hooks/session-start.sh`, `tasks/current.md`, and `tasks/lessons.md` at `2026-04-21 12:30-12:31`.
- Temporary repro files indicate prior debugging focused on `.claude/hooks/session-start.sh`.
- `tmp-gitbash-session-start.out` includes a lesson already captured:
  - `grep -c ... || echo 0` inside command substitution can produce `0` twice (`"0\n0"`) when grep finds zero matches.
  - That can later trigger `[ "$VAR" -gt 0 ]` / `-lt` parse errors and write to stderr.
  - The lesson notes that Codex ACP in Zed may treat any hook stderr as launch failure.

Current code suspicion in `.claude/hooks/session-start.sh`:
- These lines still use the broken pattern and likely need replacement:
  - `REGISTRY_ENTRIES=$(grep -cE ... || echo 0)`
  - `QUEUED=$(grep -c ... || echo 0)`
  - `LESSON_COUNT=$(grep -c ... || echo 0)`
  - `has_name=$(head -10 "$agent_file" | grep -c "^name:" ... || echo 0)`
  - `has_model=$(head -10 "$agent_file" | grep -c "^model:" ... || echo 0)`
  - `FALLBACK_COUNT=$(grep -c ... || echo 0)`

Next planned attempt:
- Before running the next reproduction, append the exact command and hypothesis here.

## 2026-04-21 13:04 MSK

Attempt 1
- Hypothesis: Zed launch failure comes from stderr emitted by `.claude/hooks/session-start.sh` under Git Bash.
- Command target: run `.claude/hooks/session-start.sh` from project root via `C:\Program Files\Git\bin\bash.exe` and capture stdout/stderr/exit code.
- Expected signal: non-empty stderr, especially `integer expression expected` or similar parse error from count variables.
- Result: wrapper command failed before hook execution due to quoting error in PowerShell -> Git Bash handoff (`unexpected EOF while looking for matching ')'`).
- Conclusion: not a valid signal for the original bug; need a wrapper script or simpler bash invocation.

## 2026-04-21 13:05 MSK

Attempt 2
- Hypothesis: `.claude/hooks/session-start.sh` itself emits stderr under Git Bash when count variables receive malformed values.
- Command target: create `tmp-run-session-start.sh`, run the hook from project root, capture `tmp-attempt2.stdout` and `tmp-attempt2.stderr`, then inspect exit code.
- Expected signal: hook exits 0 but writes parse errors to stderr; that would match a launch failure in Zed if stderr is treated as fatal.
- Result: hook executed successfully under Git Bash from project root (`exit=0`, `stderr_bytes=0`).
- Conclusion: current workspace state does not reproduce the failure by a plain direct run; the issue may depend on a specific file state, wrapper behavior, encoding, or Zed-specific launch path.

## 2026-04-21 13:08 MSK

Attempt 3
- Hypothesis: the old `grep -c ... || echo 0` pattern is reproducible right now via `tasks/queue.md`, because the file exists but contains zero `## Queued:` headings.
- Command target: run `tmp-repro-queue-old.sh` and compare with `tmp-repro-queue-new.sh`.
- Expected signal: old script produces a duplicated zero value and an `integer expression expected`-style error; new script stays clean.
- Result: hypothesis confirmed.
  - Old repro output: `QUEUED=<0\n0>` followed by `integer expression expected` on numeric comparison.
  - New repro output: `QUEUED=<0>` with no error.
- Conclusion: the uncommitted diff in `.claude/hooks/session-start.sh` is a valid fix for a real hook failure mode.

## 2026-04-21 13:09 MSK

Attempt 4
- Hypothesis: with the current patched working tree, the actual Codex launch path `bash scripts/codex-hook-adapter.sh session-start` now runs cleanly and would no longer trip Zed on hook stderr.
- Command target: run the adapter exactly as configured in `.codex/hooks.json`, capture stdout/stderr/exit code.
- Expected signal: `exit=0`, empty stderr.
- Result: adapter path confirmed clean on current tree (`bash scripts/codex-hook-adapter.sh session-start` -> `exit=0`, empty stderr).
- Conclusion: the launch failure is consistent with the previously broken hook code, and the current uncommitted patch appears to resolve it for the real Codex entrypoint.

## 2026-04-21 13:13 MSK

Attempt 5
- Hypothesis: after the broader scrub, no executable script path in the template still uses the broken `grep -c ... || echo 0` pattern, and changed scripts remain syntactically valid.
- Command target:
  - search repository for remaining `grep -c ... || echo 0` occurrences,
  - run `bash -n` on changed scripts,
  - rerun `bash scripts/codex-hook-adapter.sh session-start`.
- Expected signal:
  - remaining matches only in temp repro files, lessons, or explanatory docs,
  - syntax clean,
  - adapter still exits 0 with empty stderr.
- Result:
  - repository search now finds the broken pattern only in historical/repro text: `tmp-head-session-start.sh`, `tmp-repro-queue-old.sh`, `tasks/lessons.md`, and `tasks/debug-recovery-log.md`.
  - changed executable scripts pass `bash -n`.
  - adapter rerun stays clean (`exit=0`, `stderr_bytes=0`).
- Conclusion: executable template paths are scrubbed for this bug class, and the Codex session-start path is currently healthy.

## 2026-04-21 13:20 MSK

New issue reported by user
- Claude now launches.
- Codex in Zed still fails with `Error Loading codex-acp` and `Internal error: "server shut down unexpectedly"`.
- Requirement from user: be careful and keep persistent recovery logging before each test attempt.

Next investigation scope
- Inspect Codex-specific config and launch path (`.codex/config.toml`, `.codex/hooks.json`, Zed-related settings/log hints).
- Then run only targeted reproductions, each pre-logged here.

## 2026-04-21 13:23 MSK

Attempt 6
- Hypothesis: `codex-acp` fails at startup because project `.codex/config.toml` uses unsupported `approval_policy = "auto-edit"`.
- Evidence already present in `Zed.log`: `unknown variant auto-edit, expected one of untrusted, on-failure, on-request, reject, never`.
- Command target: confirm locally via Codex CLI/config parser if possible, then patch project `.codex/config.toml` to a compatible value and revalidate.
- Expected signal: parser rejects current config; after patch, config loads and ACP gets past immediate startup failure.

## 2026-04-21 13:27 MSK

Config fix plan
- Root cause isolated from `Zed.log`: project `.codex/config.toml` contains `approval_policy = "auto-edit"`, which Codex ACP rejects.
- Compatibility target: use a currently supported policy. Based on local `codex --help`, supported values are `untrusted`, `on-failure`, `on-request`, `reject`, `never`.
- Chosen replacement: `on-request`.
  - Reason: local help describes it as the interactive policy where the model decides when to ask for approval.
  - It is also the policy used by Codex `--full-auto` alias together with `workspace-write`, which matches the current project intent better than deprecated `on-failure`.
- Next step: patch `.codex/config.toml`, then run one targeted parse/startup validation.

## 2026-04-21 13:29 MSK

Attempt 7
- Hypothesis: after changing project `.codex/config.toml` to `approval_policy = "on-request"`, Codex ACP should get past the previous config parse failure.
- Command target: inspect local `codex debug`/related help to find the narrowest command that forces config loading without starting a full interactive session.
- Expected signal: choose a low-risk parse validation path before attempting any heavier ACP launch.
- Result: local help shows `codex debug prompt-input` as the narrowest likely config-loading path without starting a full interactive session.
- Conclusion: use `codex debug prompt-input` next as the minimal parse validation.

## 2026-04-21 13:30 MSK

Attempt 8
- Hypothesis: with `approval_policy = "on-request"`, `codex debug prompt-input` should load the project config successfully instead of failing on parse.
- Command target: run local `codex debug prompt-input` from the project root.
- Expected signal: no config parse error mentioning `auto-edit`; command either succeeds or fails later for a different reason.
- Result: `cmd /c codex debug prompt-input` completed successfully from the project root after the config change.
- Conclusion: project Codex config now parses correctly; the previous immediate startup failure on `approval_policy = "auto-edit"` is resolved locally.

## 2026-04-21 13:31 MSK

Attempt 9
- Hypothesis: after the config fix, `codex-acp` itself should now be able to start, or at least fail for a different reason than project config parsing.
- Command target: inspect Zed registry entry / installed package for `codex-acp`, identify its executable command, and run the narrowest direct startup/help probe outside the Zed UI.
- Expected signal: no more `error loading config ... auto-edit` failure.
- Result: Zed registry confirms `codex-acp` 0.10.0 binary path on this machine.
- Conclusion: direct binary probe is possible.

## 2026-04-21 13:33 MSK

Attempt 10
- Hypothesis: after the project config fix, direct `codex-acp` startup/help probe should no longer fail on `approval_policy = auto-edit`.
- Command target:
  - run `codex-acp.exe --help` from the project root,
  - if needed, run the binary without args under a short timeout to observe immediate stderr/exit behavior.
- Expected signal: no config parse error about `auto-edit`; binary either prints help or stays alive waiting for stdio.
- Result so far:
  - `codex-acp.exe --help` works.
  - Direct no-arg probe did not emit the old config parse error and finished quickly.
- Conclusion: the binary itself is executable and no longer obviously dies on project config load.

## 2026-04-21 13:34 MSK

Attempt 11
- Hypothesis: direct `codex-acp.exe` startup from the project root now exits cleanly or waits for stdio, without config parse stderr.
- Command target: run the binary once with stdout/stderr redirected and capture explicit exit code.
- Expected signal: empty stderr or at least no `unknown variant auto-edit` / config parsing failure.
- Result: direct `codex-acp.exe` run from the project root produced empty stdout/stderr; no config parse error surfaced.
- Note: explicit exit code from `Start-Process` did not come back populated in this wrapper, so I will verify process state before concluding.

## 2026-04-21 13:35 MSK

Attempt 12
- Hypothesis: the direct probe either exited quietly or left a running `codex-acp` process waiting on stdio.
- Command target: inspect live `codex-acp` processes and clean up only if one was left behind by the probe.
- Expected signal: either no process remains, or a single probe process can be terminated cleanly.
- Result: there are 7 live `codex-acp` processes, including older instances from 2026-04-20 and earlier today.
- Conclusion: stale/orphaned ACP processes may also be interfering with Zed reload behavior even after the config fix.

## 2026-04-21 13:36 MSK

Attempt 13
- Hypothesis: multiple stale `codex-acp` processes are leftovers from failed Zed launches and may block or confuse a fresh attach.
- Command target: inspect their command lines and parent PIDs to determine whether they are active Zed children or stale orphans.
- Expected signal: if they are stale/orphaned, terminate them so Zed can spawn one clean instance on next reload.
- Result: current process tree shows a mix of stale `codex-acp` instances (dead parents) and current Zed-launched ones hanging under wrapper PowerShell processes.
- Conclusion: a clean ACP restart is justified.

## 2026-04-21 13:39 MSK

Attempt 14
- Hypothesis: terminating only `codex-acp.exe` and its dedicated wrapper PowerShell launchers will clear stale ACP state without affecting the editor itself.
- Command target:
  - stop all `codex-acp.exe` processes,
  - stop `powershell.exe` instances whose command line launches `codex-acp.exe`,
  - verify process count drops to zero.
- Expected signal: no `codex-acp` processes remain; Zed stays running and can spawn a fresh clean ACP on next open/reload.
