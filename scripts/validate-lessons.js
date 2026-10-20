#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const VALID_STATUSES = new Set(['ACTIVE', 'PROMOTED', 'RETIRED']);
const ENTRY_HEADING = /^### \d{4}-\d{2}-\d{2} [-—] .+$/;

function validateDocument(markdown, label) {
  const lines = markdown.split(/\r?\n/);
  const issues = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!ENTRY_HEADING.test(lines[i])) continue;
    let end = i + 1;
    while (end < lines.length && !lines[end].startsWith('### ')) end += 1;
    const section = lines.slice(i + 1, end).join('\n');
    const statusMatch = section.match(/^\*\*Status\*\*:\s*(.+?)\s*$/m);
    if (!statusMatch) continue; // Legacy entries without lifecycle metadata remain readable.
    const status = statusMatch[1];
    const location = `${label}:${i + 1}`;
    if (!VALID_STATUSES.has(status)) {
      issues.push(`${location}: invalid status ${JSON.stringify(status)}; expected ACTIVE, PROMOTED, or RETIRED`);
      continue;
    }
    if (status === 'RETIRED') {
      if (!/^\*\*Retired\*\*:\s*\d{4}-\d{2}-\d{2}\s*$/m.test(section)) {
        issues.push(`${location}: RETIRED entry needs a retirement date`);
      }
      if (!/^\*\*Retirement reason\*\*:\s*\S.+$/m.test(section)) {
        issues.push(`${location}: RETIRED entry needs a reason`);
      }
      if (!/^\*\*Successor\*\*:\s*\S.+$/m.test(section)) {
        issues.push(`${location}: RETIRED entry needs a successor`);
      }
    }
  }
  return issues;
}

function main(paths) {
  const targets = paths.length ? paths : ['tasks/lessons.md', ...(
    fs.existsSync('brain/03-knowledge/lessons-archive.md') ? ['brain/03-knowledge/lessons-archive.md'] : [])];
  const issues = [];
  for (const path of targets) {
    issues.push(...validateDocument(fs.readFileSync(path, 'utf8'), path));
  }
  if (issues.length) {
    for (const issue of issues) process.stderr.write(`FAIL: ${issue}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`PASS: lesson lifecycle metadata is valid in ${targets.join(', ')}\n`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { VALID_STATUSES, validateDocument };
