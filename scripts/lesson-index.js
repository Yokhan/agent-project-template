#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_OUTPUT_CHARS = 6000;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const SOURCES = Object.freeze({
  lessons: "tasks/lessons.md",
  current: "tasks/current.md",
  strategy: "tasks/change-strategy.json",
});

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!["--query", "--limit"].includes(key) || !value || options[key] !== undefined) {
      throw new Error("Usage: node scripts/lesson-index.js --query <text> [--limit 1..10]");
    }
    options[key] = value;
  }
  if (typeof options["--query"] !== "string" || !options["--query"].trim() || options["--query"].length > 300) {
    throw new Error("--query is required and must contain 1 to 300 characters");
  }
  const limit = options["--limit"] === undefined ? DEFAULT_LIMIT : Number(options["--limit"]);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error("--limit must be an integer from 1 to 10");
  return { query: options["--query"].trim(), limit };
}

function canonicalRoot(root) {
  const resolved = path.resolve(root);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Project root must be a canonical local directory");
  return fs.realpathSync(resolved);
}

function readSource(root, relative, optional, gaps) {
  const absolute = path.join(root, relative);
  const segments = relative.split(/[\\/]+/u);
  let current = root;
  try {
    for (let index = 0; index < segments.length; index++) {
      current = path.join(current, segments[index]);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        gaps.push({ source: relative, code: "symlink-refused", detail: "Source path contains a symbolic link." });
        return null;
      }
      if (index < segments.length - 1 && !stat.isDirectory()) {
        gaps.push({ source: relative, code: "invalid-parent", detail: "A source parent is not a directory." });
        return null;
      }
      if (index === segments.length - 1 && !stat.isFile()) {
        gaps.push({ source: relative, code: "not-a-file", detail: "Source is not a regular file." });
        return null;
      }
    }
  } catch (error) {
    if (error.code === "ENOENT" && optional) return null;
    if (error.code === "ENOENT") gaps.push({ source: relative, code: "missing", detail: "Expected project source is missing." });
    else gaps.push({ source: relative, code: "read-failed", detail: `Source could not be inspected (${error.code || "error"}).` });
    return null;
  }
  try {
    const stat = fs.statSync(absolute);
    if (stat.size > MAX_SOURCE_BYTES) {
      gaps.push({ source: relative, code: "oversized", detail: `Source exceeds the ${MAX_SOURCE_BYTES}-byte read limit.` });
      return null;
    }
    const bytes = fs.readFileSync(absolute);
    return { text: bytes.toString("utf8"), sha256: sha256(bytes) };
  } catch (error) {
    gaps.push({ source: relative, code: "read-failed", detail: `Source could not be read (${error.code || "error"}).` });
    return null;
  }
}

function fieldValue(block, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const expression = new RegExp(`^\\*\\*${escaped}\\*\\*:\\s*(.*)$`, "imu");
  const match = expression.exec(block);
  if (!match) return "";
  const rest = block.slice(match.index + match[0].length);
  const nextField = rest.search(/^\*\*[^*]+\*\*:/mu);
  const continuation = (nextField >= 0 ? rest.slice(0, nextField) : rest).split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  return [match[1].trim(), ...continuation].filter(Boolean).join(" ").slice(0, 1200);
}

function cleanTitle(heading) {
  return heading.replace(/^###\s+/u, "").replace(/^\[?\d{4}-\d{2}-\d{2}\]?\s*(?:[-—–:]\s*)?/u, "").trim() || "Untitled lesson";
}

function lessonCandidates(source, gaps) {
  const lines = source.text.split(/\r?\n/u);
  const headings = [];
  for (let line = 0; line < lines.length; line++) {
    if (/^###\s+\[?\d{4}-\d{2}-\d{2}\]?(?:\s|$)/u.test(lines[line])) headings.push(line);
  }
  const results = [];
  let retired = 0;
  for (let index = 0; index < headings.length; index++) {
    const start = headings[index];
    const end = headings[index + 1] === undefined ? lines.length : headings[index + 1];
    const block = lines.slice(start, end).join("\n");
    const statusText = fieldValue(block, "Status").toUpperCase();
    const status = ["ACTIVE", "PROMOTED", "RETIRED"].includes(statusText) ? statusText : "LEGACY-UNCLASSIFIED";
    if (status === "RETIRED") { retired++; continue; }
    const error = fieldValue(block, "Error");
    const cause = fieldValue(block, "Root cause");
    const rule = fieldValue(block, "Rule") || fieldValue(block, "Fix") || fieldValue(block, "Guideline") || "No rule field recorded; inspect the source entry.";
    const summary = [error && `Error: ${error}`, cause && `Root cause: ${cause}`].filter(Boolean).join(" ") ||
      fieldValue(block, "Applies to") || rule;
    let destination = "";
    if (status === "PROMOTED") {
      destination = fieldValue(block, "Promoted to") || fieldValue(block, "Destination") || fieldValue(block, "Successor");
      if (!destination) {
        const inferred = /(?:moved|promoted|see|successor|destination)\s+(?:to\s+)?[`“"]?((?:\.claude|\.agents|docs|brain)\/[^\s`”"]+)/iu.exec(block);
        destination = inferred?.[1] || "Destination not recorded in this lesson.";
      }
    }
    results.push({
      source: SOURCES.lessons,
      line: start + 1,
      sha256: source.sha256,
      title: cleanTitle(lines[start]),
      status,
      rule,
      summary,
      ...(destination ? { destination } : {}),
    });
  }
  return { results, retired };
}

function sectionAt(lines, start) {
  let end = start + 1;
  while (end < lines.length && !/^#{1,2}\s+/u.test(lines[end])) end++;
  return lines.slice(start, end).join("\n");
}

function currentCandidates(source) {
  const lines = source.text.split(/\r?\n/u);
  const titleLine = lines.findIndex(line => /^#\s+\S/u.test(line));
  if (titleLine < 0) return [];
  const marker = /<!--\s*PROGRESSIVE_STATUS\s*([\s\S]*?)-->/u.exec(source.text)?.[1] || "";
  const state = /^\s*status:\s*([\w-]+)/imu.exec(marker)?.[1]?.toLowerCase() || "unclassified";
  const status = state === "active" ? "ACTIVE" : "LEGACY-UNCLASSIFIED";
  const headerSection = lines.slice(titleLine + 1).findIndex(line => /^##\s+/u.test(line));
  const headerEnd = headerSection < 0 ? lines.length : titleLine + 1 + headerSection;
  const headerText = lines.slice(titleLine + 1, headerEnd).filter(line => line.trim() && !/^<!--/u.test(line)).slice(0, 4).join(" ");
  const candidates = [{
    source: SOURCES.current,
    line: titleLine + 1,
    sha256: source.sha256,
    title: lines[titleLine].replace(/^#\s+/u, "").trim(),
    status,
    rule: "Current-task navigation only; confirm live ownership and source state before acting.",
    summary: headerText || "Current task header; inspect the source for the full active handoff.",
  }];
  const sections = [];
  for (let line = titleLine + 1; line < lines.length; line++) if (/^##\s+/u.test(lines[line])) sections.push(line);
  const nearest = sections.find(line => /^##\s+(?:Active\b|Current Step\b|Current Goal\b)/iu.test(lines[line])) ||
    sections.find(line => /^##\s+Approved result\b/iu.test(lines[line]));
  if (nearest !== undefined) {
    const block = sectionAt(lines, nearest);
    const heading = lines[nearest].replace(/^##\s+/u, "").trim();
    const body = block.split(/\r?\n/u).slice(1).filter(line => line.trim()).slice(0, 6).join(" ");
    candidates.push({
      source: SOURCES.current,
      line: nearest + 1,
      sha256: source.sha256,
      title: heading,
      status,
      rule: "Use as a pointer to the active goal; the complete approved contract remains in tasks/current.md.",
      summary: body || "Active goal section; inspect the source for the full text.",
    });
  }
  return candidates;
}

function strategyCandidate(source, gaps) {
  let value;
  try { value = JSON.parse(source.text); }
  catch {
    gaps.push({ source: SOURCES.strategy, code: "invalid-json", detail: "Optional change strategy is not valid JSON." });
    return [];
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    gaps.push({ source: SOURCES.strategy, code: "invalid-shape", detail: "Optional change strategy must contain a JSON object." });
    return [];
  }
  const recommendation = value.recommendation && typeof value.recommendation === "object" ? value.recommendation : {};
  const envelope = value.approval?.envelope && typeof value.approval.envelope === "object" ? value.approval.envelope : {};
  const current = envelope.current === true;
  const title = recommendation.option_id || value.title || "Change strategy decision";
  const summary = [envelope.outcome, envelope.scope, recommendation.reason].filter(item => typeof item === "string" && item.trim()).join(" ");
  const rule = recommendation.reason || recommendation.rejected_alternative || "Review the optional change-strategy source before acting.";
  return [{ source: SOURCES.strategy, line: 1, sha256: source.sha256, title, status: current ? "ACTIVE" : "LEGACY-UNCLASSIFIED", rule, summary: summary || rule }];
}

function tokens(value) {
  return [...new Set((String(value).toLocaleLowerCase("ru-RU").match(/[\p{L}\p{N}]+/gu) || []).filter(token => token.length > 1))];
}

function matchScore(queryTokens, item) {
  const fields = [[item.title, 3], [item.rule, 2], [item.summary, 1], [item.status, 1], [item.destination || "", 1]];
  let score = 0;
  for (const token of queryTokens) {
    let best = 0;
    for (const [field, weight] of fields) {
      if (tokens(field).includes(token)) best = Math.max(best, weight);
    }
    score += best;
  }
  return Number((score / (3 * queryTokens.length)).toFixed(3));
}

function shorten(value, max) {
  const string = String(value || "").replace(/\s+/gu, " ").trim();
  return string.length > max ? { text: string.slice(0, max - 1).trimEnd() + "…", omitted: true } : { text: string, omitted: false };
}

function renderCandidate(item, score) {
  const title = shorten(item.title, 130);
  const rule = shorten(item.rule, 210);
  const summary = shorten(item.summary, 150);
  const destination = item.destination ? shorten(item.destination, 130) : null;
  return {
    source: item.source,
    line: item.line,
    sha256: item.sha256,
    title: title.text,
    status: item.status,
    rule: rule.text,
    matchScore: score,
    summary: summary.text,
    ...(destination ? { destination: destination.text } : {}),
    ...(title.omitted || rule.omitted || summary.omitted || destination?.omitted ? { omitted: true } : {}),
  };
}

function fitOutput(output) {
  const encoded = () => JSON.stringify(output);
  if (encoded().length <= MAX_OUTPUT_CHARS) return output;
  const fields = ["summary", "rule", "destination", "title"];
  for (let index = output.results.length - 1; index >= 0 && encoded().length > MAX_OUTPUT_CHARS; index--) {
    const item = output.results[index];
    for (const field of fields) {
      if (typeof item[field] !== "string") continue;
      let max = Math.max(48, item[field].length - 64);
      while (item[field].length > max && encoded().length > MAX_OUTPUT_CHARS) {
        item[field] = item[field].slice(0, max - 1).trimEnd() + "…";
        item.omitted = true;
        max = Math.max(48, max - 64);
      }
    }
  }
  while (encoded().length > MAX_OUTPUT_CHARS && output.results.length > 0) {
    output.results.pop();
    output.omittedResults++;
  }
  output.omitted = output.omittedResults > 0 || output.results.some(item => item.omitted === true);
  return output;
}

function collect(root, query, limit = DEFAULT_LIMIT) {
  if (typeof query !== "string" || !query.trim() || query.length > 300) throw new Error("query must contain 1 to 300 characters");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error("limit must be an integer from 1 to 10");
  const canonical = canonicalRoot(root);
  const gaps = [];
  const lessons = readSource(canonical, SOURCES.lessons, false, gaps);
  const current = readSource(canonical, SOURCES.current, false, gaps);
  const strategy = readSource(canonical, SOURCES.strategy, true, gaps);
  const candidates = [];
  let excludedRetired = 0;
  if (lessons) {
    const parsed = lessonCandidates(lessons, gaps);
    candidates.push(...parsed.results);
    excludedRetired = parsed.retired;
  }
  if (current) candidates.push(...currentCandidates(current));
  if (strategy) candidates.push(...strategyCandidate(strategy, gaps));
  const queryTokens = tokens(query);
  if (!queryTokens.length) throw new Error("query must contain at least one letter or number");
  const ranked = candidates.map(item => ({ item, score: matchScore(queryTokens, item) }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.source.localeCompare(right.item.source) || left.item.line - right.item.line);
  const results = ranked.slice(0, limit).map(entry => renderCandidate(entry.item, entry.score));
  const output = {
    query: query.trim(),
    summary: ranked.length ? `Found ${ranked.length} matching navigation entries; retired lessons are excluded. Verify each source before applying it.` : "No matching navigation entries; inspect the bounded project sources directly.",
    results,
    omittedResults: Math.max(0, ranked.length - results.length),
    excludedRetired,
    gaps,
  };
  return fitOutput(output);
}

function run(argv, root = process.cwd()) {
  const options = parseArgs(argv);
  return collect(root, options.query, options.limit);
}

if (require.main === module) {
  try { process.stdout.write(JSON.stringify(run(process.argv.slice(2))) + "\n"); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
}

module.exports = { parseArgs, collect, run, MAX_SOURCE_BYTES, MAX_OUTPUT_CHARS };
