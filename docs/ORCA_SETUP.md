# Orca setup

The root `orca.yaml` runs `node scripts/orca-setup.js --prepare-router` when Orca
requests project setup and waits for setup before agent startup. The preflight
verifies Node.js 24 with working `node:sqlite`, locates Bash without running
hooks, checks the native hook configuration and required files, reads shared
writing-library readiness, and checks the template-owned context-router source,
dependencies and build output.

The check writes `.session-cache/orca-setup/latest.json`, which is ignored by
Git. `--json` prints the same receipt. Missing writing-library material remains
an optional readiness state. Context-router dependencies/build are prepared
automatically only on Orca setup when missing. If local SDK, Zod or TypeScript
files are missing or do not resolve, preparation uses the pinned lock file with
`npm ci --ignore-scripts`, then builds. If those dependencies are ready and only
`dist/index.js` is missing, it builds without reinstalling. npm uses the
managed-temp run's disposable cache; its process supervision and measured
scratch cleanup are included in the setup receipt. The router's own
`node_modules` may be replaced by `npm ci` when dependencies need repair; its
`dist` output remains in place and is rebuilt when missing.

Run `node scripts/orca-setup.js --check` for a network-free health check. To
explicitly prepare the router outside Orca setup, run
`node scripts/orca-setup.js --prepare-router`. Router preparation can access the
network through npm. It installs only the context-router's pinned dependencies;
it does not install product dependencies or copy books, and does not trust hooks
or change model, approval or sandbox settings.

The preflight checks hook files and command references only; it does not prove
that Orca activated or trusted the hooks. Model runtime metadata also remains
unverified. Existing or customized `orca.yaml` files are classified as hybrid:
the template updater preserves local changes and reports a conflict when both
the project and template changed the file.
