#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { inspectPath, readFileState, sha256 } = require("./sync-template-core.js");

function ensureParents(projectRoot, relativePath, createdDirectories) {
  const parts = relativePath.split("/").slice(0, -1);
  let current = projectRoot;
  let relative = "";
  for (const part of parts) {
    relative = relative ? `${relative}/${part}` : part;
    current = path.join(current, part);
    const inspected = inspectPath(projectRoot, relative, { requireFile: false });
    if (!inspected.info) {
      fs.mkdirSync(current, { mode: 0o700 });
      createdDirectories.push(current);
    }
    const info = fs.lstatSync(current);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Unsafe destination parent: ${relative}`);
  }
}

function writeAtomic(projectRoot, relativePath, content, mode, createdDirectories) {
  ensureParents(projectRoot, relativePath, createdDirectories);
  const inspected = inspectPath(projectRoot, relativePath);
  const temporary = `${inspected.path}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  try {
    fs.writeFileSync(temporary, content, { flag: "wx", mode });
    inspectPath(projectRoot, relativePath);
    fs.renameSync(temporary, inspected.path);
    try { fs.chmodSync(inspected.path, mode); } catch (error) {
      if (process.platform !== "win32") throw error;
    }
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

function sourceContent(result, action) {
  if (result.contents.has(action.path)) return result.contents.get(action.path);
  const source = inspectPath(result.templateRoot, action.path, { allowMissing: false });
  return fs.readFileSync(source.path);
}

function verifyPreconditions(result) {
  if (readFileState(result.projectRoot, ".template-manifest.json").hash !== result.plan.target.manifestBefore) {
    throw new Error("Target manifest changed after preview");
  }
  for (const action of result.plan.actions) {
    if (readFileState(result.projectRoot, action.path).hash !== action.before) {
      throw new Error(`Target changed after preview: ${action.path}`);
    }
  }
}

function applyPlan(result) {
  if (result.plan.conflicts.length) throw new Error("Plan contains conflicts; no files were written");
  verifyPreconditions(result);
  const journalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "template-sync-journal-"));
  const journal = [];
  const createdDirectories = [];
  let writes = 0;
  const injectAfter = Number.parseInt(process.env.TEMPLATE_SYNC_FAIL_AFTER_WRITES || "0", 10);

  try {
    const writable = result.plan.actions.filter((action) => action.type === "write");
    for (const action of writable) {
      const destination = inspectPath(result.projectRoot, action.path);
      const backup = path.join(journalRoot, `${journal.length}.bin`);
      if (destination.info) fs.copyFileSync(destination.path, backup, fs.constants.COPYFILE_EXCL);
      journal.push({ path: action.path, backup: destination.info ? backup : null, mode: destination.info?.mode & 0o777 });
      const content = sourceContent(result, action);
      if (sha256(content) !== action.after) throw new Error(`Source changed after preview: ${action.path}`);
      const sourceMode = action.special ? 0o600 : (inspectPath(result.templateRoot, action.path, { allowMissing: false }).info.mode & 0o777);
      writeAtomic(result.projectRoot, action.path, content, destination.info ? destination.info.mode & 0o777 : sourceMode, createdDirectories);
      writes += 1;
      if (injectAfter > 0 && writes === injectAfter) throw new Error(`Injected failure after write ${writes}`);
    }

    const manifestPath = inspectPath(result.projectRoot, ".template-manifest.json");
    const manifestBackup = path.join(journalRoot, `${journal.length}.bin`);
    if (manifestPath.info) fs.copyFileSync(manifestPath.path, manifestBackup, fs.constants.COPYFILE_EXCL);
    journal.push({ path: ".template-manifest.json", backup: manifestPath.info ? manifestBackup : null, mode: manifestPath.info?.mode & 0o777 });
    writeAtomic(result.projectRoot, ".template-manifest.json", Buffer.from(result.manifestText), manifestPath.info ? manifestPath.info.mode & 0o777 : 0o600, createdDirectories);
    if (readFileState(result.projectRoot, ".template-manifest.json").hash !== result.plan.manifestAfter) {
      throw new Error("Manifest verification failed");
    }
    return { writes: writes + 1 };
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of [...journal].reverse()) {
      try {
        if (entry.backup) writeAtomic(result.projectRoot, entry.path, fs.readFileSync(entry.backup), entry.mode || 0o600, createdDirectories);
        else {
          const target = inspectPath(result.projectRoot, entry.path);
          if (target.info) fs.unlinkSync(target.path);
        }
      } catch (rollbackError) { rollbackErrors.push(`${entry.path}: ${rollbackError.message}`); }
    }
    for (const directory of [...createdDirectories].reverse()) {
      try { fs.rmdirSync(directory); } catch (rollbackError) {
        if (rollbackError.code !== "ENOTEMPTY" && rollbackError.code !== "ENOENT") rollbackErrors.push(`${directory}: ${rollbackError.message}`);
      }
    }
    if (rollbackErrors.length) throw new Error(`${error.message}; rollback errors: ${rollbackErrors.join("; ")}`);
    throw new Error(`${error.message}; all writes rolled back`);
  } finally {
    fs.rmSync(journalRoot, { recursive: true, force: true });
  }
}

module.exports = { applyPlan, verifyPreconditions, writeAtomic };
