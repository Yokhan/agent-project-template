#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { validateDocument } = require('./validate-lessons');

const active = [
  '### 2026-01-01 - Active example',
  '**Status**: ACTIVE',
].join('\n');
assert.deepEqual(validateDocument(active, 'fixture'), []);

const legacy = '### 2026-01-01 - Legacy example\n**Rule**: Old entries remain readable.';
assert.deepEqual(validateDocument(legacy, 'fixture'), []);

const unknownStatus = '### 2026-01-01 - Bad status\n**Status**: SUPERSEDED by newer entry';
assert(validateDocument(unknownStatus, 'fixture').some((issue) => issue.includes('invalid status')));

const missingSuccessor = [
  '### 2026-01-01 - Incomplete retirement',
  '**Status**: RETIRED',
  '**Retired**: 2026-01-02',
  '**Retirement reason**: Guidance changed.',
].join('\n');
assert(validateDocument(missingSuccessor, 'fixture').some((issue) => issue.includes('needs a successor')));

const completeRetirement = [
  '### 2026-01-01 - Complete retirement',
  '**Status**: RETIRED',
  '**Retired**: 2026-01-02',
  '**Retirement reason**: Guidance changed.',
  '**Successor**: `tasks/lessons.md`, newer rule.',
].join('\n');
assert.deepEqual(validateDocument(completeRetirement, 'fixture'), []);

process.stdout.write('PASS: lesson lifecycle acceptance cases\n');
