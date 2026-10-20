#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const SAFE_CLASSES = new Set(['public', 'sanitized', 'operational']);

function readManifest(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || !Array.isArray(parsed.files)) {
    throw new Error(`${file}: expected an object with a files array`);
  }
  const entries = new Map();
  for (const item of parsed.files) {
    if (!item || typeof item.path !== 'string' || !isExactRelativePath(item.path)) {
      throw new Error(`${file}: each entry needs an exact normalized relative path`);
    }
    if (entries.has(item.path)) throw new Error(`${file}: duplicate path ${item.path}`);
    entries.set(item.path, item);
  }
  return entries;
}

function isExactRelativePath(value) {
  return value.length > 0
    && !value.includes('\\')
    && !value.includes('*')
    && !value.startsWith('/')
    && !/^[A-Za-z]:/.test(value)
    && value.split('/').every((part) => part && part !== '.' && part !== '..');
}

function validateTransfer(intended, allowlist, candidates) {
  const errors = [];
  const candidateSet = new Set(candidates);
  if (candidateSet.size !== candidates.length) errors.push('candidate paths contain duplicates');
  if (candidateSet.size !== intended.size || [...intended.keys()].some((path) => !candidateSet.has(path))) {
    errors.push('candidate paths must exactly match the intended file set');
  }

  for (const path of candidates) {
    if (!isExactRelativePath(path)) {
      errors.push(`invalid exact relative path: ${path}`);
      continue;
    }
    const planned = intended.get(path);
    const approved = allowlist.get(path);
    if (!planned) errors.push(`not in intended set: ${path}`);
    if (!approved) errors.push(`not explicitly allowlisted: ${path}`);
    for (const [label, entry] of [['intended', planned], ['allowlist', approved]]) {
      if (!entry) continue;
      if (!SAFE_CLASSES.has(entry.classification)) {
        errors.push(`${label} classification is unknown or sensitive for ${path}`);
      }
      if (entry.approved !== true) errors.push(`${label} approval is not explicit for ${path}`);
    }
    if (planned && approved && planned.classification !== approved.classification) {
      errors.push(`classification mismatch for ${path}`);
    }
  }
  return errors;
}

function main(argv) {
  let intendedFile;
  let allowlistFile;
  const candidates = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--intended') intendedFile = argv[++i];
    else if (arg === '--allowlist') allowlistFile = argv[++i];
    else if (arg === '--candidate') candidates.push(argv[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!intendedFile || !allowlistFile || candidates.length === 0) {
    throw new Error('usage: node scripts/check-transfer-allowlist.js --intended FILE --allowlist FILE --candidate PATH [--candidate PATH ...]');
  }

  const errors = validateTransfer(readManifest(intendedFile), readManifest(allowlistFile), candidates);
  if (errors.length) {
    for (const error of errors) process.stderr.write(`BLOCKED: ${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`PASS: ${candidates.length} exact candidate path(s) are explicitly allowlisted. No files were read or transferred.\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`BLOCKED: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { isExactRelativePath, readManifest, validateTransfer };
