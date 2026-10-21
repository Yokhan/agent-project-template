"use strict";

const fs = require("fs");
const path = require("path");

const PROFILES = ["test", "command", "vite", "tsc", "cargo", "browser"];
function rejectOptions(args, names) {
  for (const arg of args) if (names.some(name => arg.toLowerCase() === name.toLowerCase() || arg.toLowerCase().startsWith(name.toLowerCase() + "="))) {
    throw new Error(`Managed output ownership conflicts with ${arg.split("=")[0]}; remove that option`);
  }
}
function toolEntry(command, args) {
  const binary = path.basename(command).toLowerCase().replace(/\.(?:exe|cmd)$/u, "");
  if (binary === "node") {
    if (!args[0] || args[0].startsWith("-")) return { binary, script: null, arguments: args };
    return { binary: path.basename(args[0]).toLowerCase(), script: args[0], arguments: args.slice(1) };
  }
  return { binary, script: null, arguments: args };
}
function prepareProfile(workspace, options) {
  const { profile = "test", command, cwd, cacheMode = "ephemeral", getCache } = options;
  if (!PROFILES.includes(profile)) throw new Error(`Unknown managed profile: ${profile}`);
  if (!["ephemeral", "shared"].includes(cacheMode)) throw new Error("Cache mode must be ephemeral or shared");
  const args = [...options.args];
  const env = { ...(options.env || process.env) };
  const paths = Object.fromEntries(["build", "browser", "copies", "archives", "logs"].map(kind => [kind, workspace.allocate(kind)]));
  const cache = kind => cacheMode === "shared" ? getCache(kind) : workspace.allocate(kind);
  // Windows environment names are case-insensitive; remove inherited aliases.
  for (const key of Object.keys(env)) if (["npm_config_cache", "node_compile_cache", "cargo_target_dir", "cargo_build_build_dir"].includes(key.toLowerCase())) delete env[key];
  Object.assign(env, {
    TEMP: workspace.temp, TMP: workspace.temp, TMPDIR: workspace.temp,
    AGENT_MANAGED_TEMP: workspace.root, AGENT_RUN_OUTPUT: paths.build,
    AGENT_RUN_BROWSER_DIR: paths.browser, AGENT_RUN_COPY_DIR: paths.copies,
    AGENT_RUN_ARCHIVE_DIR: paths.archives, AGENT_RUN_LOG_DIR: paths.logs,
    npm_config_cache: cache("npm-cache"), NODE_COMPILE_CACHE: cache("node-compile"),
  });
  const entry = toolEntry(command, args);
  if (["test", "command"].includes(profile)) {
    if (["cargo", "vite", "vite.js", "tsc", "tsc.js"].includes(entry.binary) &&
        (entry.binary !== "cargo" || ["build", "test", "check", "run", "doc"].includes(entry.arguments[0]))) {
      throw new Error("Select the matching managed build profile so output paths are explicitly owned");
    }
    if (["npm", "pnpm", "yarn"].includes(entry.binary) && entry.arguments.some(arg => /^(?:build|build:.*)$/u.test(arg))) {
      throw new Error("A package build script needs an explicit tool profile or a project command consuming AGENT_RUN_OUTPUT; arbitrary compound scripts are not rewritten");
    }
    if (["chrome", "chromium", "msedge", "chrome-headless-shell"].includes(entry.binary)) throw new Error("Select --profile browser for an isolated browser profile");
  }
  if (profile === "vite") {
    if (!["vite", "vite.js", "vite.mjs"].includes(entry.binary) || entry.arguments[0] !== "build") throw new Error("vite profile requires a direct vite build command (or node /path/vite.js build)");
    rejectOptions(args, ["--outDir", "--watch", "-w", "--profile", "--app", "--configLoader"]);
    args.push("--outDir", paths.build, "--emptyOutDir", "--configLoader", "runner");
  }
  if (profile === "tsc") {
    if (!["tsc", "tsc.js"].includes(entry.binary) || !entry.script) throw new Error("tsc profile requires node /path/typescript/lib/tsc.js; use the actual installed compiler");
    rejectOptions(args, ["--build", "-b", "--watch", "-w", "--outDir", "--outFile", "--declarationDir", "--tsBuildInfoFile", "--generateTrace", "--generateCpuProfile"]);
    const script = path.resolve(cwd, entry.script);
    const compiler = require(path.join(path.dirname(script), "typescript.js"));
    const parsed = compiler.parseCommandLine(entry.arguments);
    if (parsed.errors.length) throw new Error("TypeScript command line is invalid");
    let config = parsed.options;
    if (!parsed.fileNames.length || parsed.options.project) {
      let project = path.resolve(cwd, parsed.options.project || "tsconfig.json");
      if (fs.existsSync(project) && fs.statSync(project).isDirectory()) project = path.join(project, "tsconfig.json");
      if (fs.existsSync(project)) {
        const loaded = compiler.getParsedCommandLineOfConfigFile(project, {}, { ...compiler.sys, onUnRecoverableConfigFileDiagnostic() {} });
        if (!loaded || loaded.errors.length) throw new Error("Cannot safely resolve TypeScript output configuration");
        config = { ...loaded.options, ...parsed.options };
      }
    }
    if (config.generateTrace || config.generateCpuProfile || config.watch) throw new Error("TypeScript trace, profiling and watch outputs require a separate owned adapter");
    args.push("--outDir", paths.build);
    if (config.incremental || config.composite) args.push("--tsBuildInfoFile", path.join(paths.build, "state.tsbuildinfo"));
    if (config.outFile) args.push("--outFile", path.join(paths.build, path.basename(config.outFile)));
    if (config.declarationDir) args.push("--declarationDir", path.join(paths.build, "declarations"));
  }
  if (profile === "cargo") {
    if (entry.binary !== "cargo" || !["build", "test", "check", "run", "doc"].includes(entry.arguments[0])) throw new Error("cargo profile supports direct cargo build/test/check/run/doc commands");
    rejectOptions(args, ["--target-dir", "--artifact-dir", "--out-dir", "--build-plan", "--config"]);
    if (args.includes("--")) throw new Error("cargo runtime argument forwarding needs a separate project adapter");
    env.CARGO_TARGET_DIR = paths.build;
    env.CARGO_BUILD_BUILD_DIR = path.join(paths.build, "intermediate");
    // Registry downloads are disposable/shared-owned; user credentials/toolchains
    // are never copied. Private registries must supply their normal process env.
    for (const key of Object.keys(env)) if (key.toLowerCase() === "cargo_home") delete env[key];
    env.CARGO_HOME = cache("cargo-home");
    args.push("--target-dir", paths.build);
  }
  if (profile === "browser") {
    if (!["chrome", "chromium", "msedge", "chrome-headless-shell"].includes(entry.binary)) throw new Error("browser profile supports a direct Chromium/Chrome/Edge executable");
    rejectOptions(args, ["--user-data-dir", "--disk-cache-dir", "--profile-directory", "--crash-dumps-dir", "--log-file", "--screenshot", "--print-to-pdf"]);
    fs.mkdirSync(path.join(paths.browser, "Default"), { recursive: true });
    fs.writeFileSync(path.join(paths.browser, "Default", "Preferences"), JSON.stringify({ download: { default_directory: paths.build, prompt_for_download: false, directory_upgrade: true }, savefile: { default_directory: paths.build } }), { flag: "wx" });
    args.push("--user-data-dir=" + paths.browser, "--disk-cache-dir=" + path.join(paths.browser, "cache"),
      "--crash-dumps-dir=" + path.join(paths.logs, "crashes"), "--no-first-run", "--no-default-browser-check");
  }
  return { command, args, env, paths, profile, cacheMode };
}
module.exports = { PROFILES, prepareProfile, toolEntry };
