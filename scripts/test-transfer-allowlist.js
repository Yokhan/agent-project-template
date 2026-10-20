#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { validateTransfer } = require('./check-transfer-allowlist');

function manifest(...files) {
  return new Map(files.map((entry) => [entry.path, entry]));
}

const safe = { path: 'docs/summary.md', classification: 'sanitized', approved: true };
assert.deepEqual(validateTransfer(manifest(safe), manifest({ ...safe }), [safe.path]), []);

const unknown = { path: 'exports/maybe-private.json', classification: 'unknown', approved: true };
assert(validateTransfer(manifest(unknown), manifest({ ...unknown }), [unknown.path])
  .some((error) => error.includes('unknown or sensitive')));

const clinical = { path: 'records/patient-notes.txt', classification: 'clinical_raw', approved: true };
assert(validateTransfer(manifest(clinical), manifest({ ...clinical }), [clinical.path])
  .some((error) => error.includes('unknown or sensitive')));

assert(validateTransfer(manifest(safe), manifest(), [safe.path])
  .some((error) => error.includes('not explicitly allowlisted')));
assert(validateTransfer(manifest(safe), manifest({ ...safe }), ['extra.txt'])
  .some((error) => error.includes('exactly match')));
assert(validateTransfer(manifest(safe), manifest({ ...safe }), ['../summary.md'])
  .some((error) => error.includes('invalid exact relative path')));

process.stdout.write('PASS: transfer allowlist acceptance cases\n');
