"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { defaultCatalog, sha256, catalogHash, resolveLibraryRoot, inspectSafePath, libraryStatus, readChecked } = require("./writing-library-store.js");

const INDEX_SCHEMA_VERSION = 1;
const OWNED_FILES = ["contents.json", "examples.json", "manifest.json"];
const EXAMPLE_MARKERS = /(?:пример|например|до\s*\/\s*после|было\s*\/\s*стало|вместо|плохо\s*\/\s*хорошо|хорошо\s*\/\s*плохо|небрежно\s+бережно|что\s+написали\s+как\s+поняли|(?:^|\n)\s*(?:нет\s+да|было\s+стало|неудачно\s+удачно)|example|before\s*\/\s*after)/iu;
// Reviewed against these pinned editions and the following non-TOC page.
// Keep chapter contents separate from alphabetical indexes and example tables.
const REVIEWED_PDF_CONTENTS = { "write-short": [4], "business-correspondence": [4], "game-as-business": [4, 5, 6, 7] };
const TOC_MARKERS = /(?:^|[^\p{L}\p{N}])(?:содержание|оглавление|table\s+of\s+contents|contents)(?=$|[^\p{L}\p{N}])/iu;
const TOC_TITLE_LINE = /(?:^|\n)\s*(?:содержание|оглавление|table\s+of\s+contents|contents)\s*[.:]?\s*(?:\n|$)/iu;

function safeJson(file) {
  inspectSafePath(file, { fileRequired: true });
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function unitRecords(text, format) {
  const pattern = format === "pdf" ? /^\[PDF page (\d+)\]\s*$/gmu
    : format === "epub" ? /^\[EPUB section ([^\]\r\n]+)\]\s*$/gmu : /^#{1,6}\s+(.+)$/gmu;
  const markers = [...text.matchAll(pattern)];
  return markers.map((match, index) => {
    const contentStart = match.index + match[0].length;
    const contentEnd = markers[index + 1]?.index ?? text.length;
    const raw = text.slice(contentStart, contentEnd);
    const leading = raw.length - raw.trimStart().length;
    const trailing = raw.length - raw.trimEnd().length;
    const startCharacter = contentStart + leading;
    const endCharacter = Math.max(startCharacter, contentEnd - trailing);
    const body = text.slice(startCharacter, endCharacter);
    const locator = format === "pdf" ? `PDF page ${match[1]}` : format === "epub" ? `EPUB section ${match[1]}` : `Section ${match[1]}`;
    const heading = format === "markdown" ? match[0].trim() : null;
    const preview = body.slice(0, 260);
    const lines = body.split(/\r?\n/u).filter((line) => line.trim());
    const numberedLines = lines.filter((line) => /\s\d{1,3}\s*$/u.test(line)).length;
    const tocMarker = TOC_MARKERS.test(`${heading || ""}\n${body.slice(0, 1200)}`);
    const pdfPage = format === "pdf" ? Number(match[1]) : null;
    const explicitToc = TOC_TITLE_LINE.test(format === "markdown" ? match[1].trim() : body.slice(0, 1200));
    const frontMatterTocMarker = format === "pdf" && pdfPage <= 20 && tocMarker;
    const toc = explicitToc || frontMatterTocMarker || (format === "pdf" && pdfPage <= 20 && lines.length >= 15 && numberedLines >= 8 && numberedLines / lines.length >= 0.4);
    return { locator, heading, headingStartCharacter: format === "markdown" ? match.index : null,
      headingEndCharacter: format === "markdown" ? match.index + match[0].length : null,
      label: heading || locator, startCharacter, endCharacter, preview,
      previewStartCharacter: startCharacter, previewEndCharacter: startCharacter + preview.length,
      previewSha256: sha256(preview), unitSha256: sha256(body), kind: "literal-source-unit-navigation",
      toc, tocKind: explicitToc ? "explicit-toc-heading" : frontMatterTocMarker ? "pdf-front-matter-toc-marker-candidate"
        : toc ? "pdf-front-matter-toc-layout-candidate" : null, body };
  });
}

function readZipEntries(bytes) {
  const min = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= min; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("Invalid EPUB ZIP directory");
  const count = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid EPUB ZIP member record");
    const flags = bytes.readUInt16LE(offset + 8); const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20); const fileSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28); const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32); const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (flags & 0x1) throw new Error("Encrypted EPUB ZIP members are not supported");
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Invalid EPUB ZIP local member record");
    const localNameLength = bytes.readUInt16LE(localOffset + 26); const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    const read = () => {
      const data = method === 0 ? Buffer.from(compressed) : method === 8 ? zlib.inflateRawSync(compressed) : null;
      if (!data || data.length !== fileSize) throw new Error(`Unsupported/corrupt EPUB ZIP member: ${name}`);
      return data;
    };
    entries.set(name, read);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function xmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "u"));
  return match ? match[2].replace(/&amp;/gu, "&") : null;
}

function extractEpubNavigation(originalBytes, source) {
  const entries = readZipEntries(originalBytes);
  const containerName = "META-INF/container.xml";
  const container = entries.get(containerName)?.().toString("utf8");
  const opfPath = container?.match(/<rootfile\b[^>]*\bfull-path\s*=\s*(["'])(.*?)\1/u)?.[2];
  if (!opfPath || !entries.has(opfPath)) throw new Error(`EPUB package document is missing: ${source.id}`);
  const opf = entries.get(opfPath)().toString("utf8");
  const itemTags = opf.match(/<item\b[^>]*>/gu) || [];
  const ncxTag = itemTags.find((tag) => xmlAttribute(tag, "media-type") === "application/x-dtbncx+xml");
  const href = ncxTag && xmlAttribute(ncxTag, "href");
  if (!href) return [];
  const memberPath = path.posix.normalize(path.posix.join(path.posix.dirname(opfPath), decodeURIComponent(href)));
  const readMember = entries.get(memberPath);
  if (!readMember) throw new Error(`EPUB NCX member is missing: ${source.id}`);
  const memberBytes = readMember();
  const text = memberBytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(memberBytes)) throw new Error(`Invalid UTF-8 EPUB NCX member: ${source.id}`);
  const entriesOut = [];
  const labels = [...text.matchAll(/<navLabel\b[^>]*>[\s\S]*?<text\b[^>]*>([\s\S]*?)<\/text>[\s\S]*?<\/navLabel>[\s\S]*?<content\b[^>]*\bsrc\s*=\s*(["'])(.*?)\2[^>]*>/giu)];
  for (const label of labels) entriesOut.push({ label: label[1].replace(/<[^>]+>/gu, "").replace(/&amp;/gu, "&").trim(), target: label[3] });
  return [{ sourceId: source.id, locator: memberPath, memberPath, originalPath: source.originalPath,
    originalSha256: source.originalSha256, memberSha256: sha256(memberBytes), text,
    entries: entriesOut.map((item) => ({ ...item, labelKind: "derived-label-from-literal-epub-ncx" })),
    kind: "literal-epub-ncx", label: "verbatim original EPUB NCX navigation TOC", verified: true,
    completeness: "complete-original-ncx-member" }];
}

function exampleRecords(unit, source) {
  if (!EXAMPLE_MARKERS.test(unit.body)) return [];
  return [{ sourceId: source.id, title: source.title, locator: unit.locator,
    originalPath: path.join(source.root, "originals", source.originalFile), originalSha256: source.originalSha256,
    textSha256: source.textSha256, startCharacter: unit.startCharacter, endCharacter: unit.endCharacter, text: unit.body,
    textSha256ForExcerpt: sha256(unit.body), passageSha256: sha256(unit.body),
    label: "literal-source-example-candidate", verified: false,
    reason: "Complete literal source unit contains an example marker; before/after alignment and instructional accuracy are not independently verified. PDF line layout may be flattened." }];
}

function buildData(options = {}) {
  const catalog = options.catalog || defaultCatalog;
  const status = libraryStatus(options);
  if (status.state !== "ready") throw new Error(`writing-library-index-blocked: ${status.issues.join("; ")}`);
  const contents = { schemaVersion: INDEX_SCHEMA_VERSION, catalogId: catalog.catalogId, catalogSha256: status.catalogSha256, contents: [] };
  const examples = { schemaVersion: INDEX_SCHEMA_VERSION, catalogId: catalog.catalogId, catalogSha256: status.catalogSha256, examples: [] };
  let unitCount = 0;
  for (const source of catalog.sources) {
    const cachePath = path.join(status.root, "text", `${source.id}.txt`);
    const text = readChecked(cachePath, source.textSha256).toString("utf8");
    const units = unitRecords(text, source.format);
    unitCount += units.length;
    const storedUnits = units.map(({ body, toc, tocKind, ...unit }) => unit);
    const reviewedPages = defaultCatalog.sources.some(item => item.id === source.id && item.textSha256 === source.textSha256)
      ? REVIEWED_PDF_CONTENTS[source.id] : null;
    const tocUnits = reviewedPages ? units.filter(unit => reviewedPages.includes(Number(unit.locator.replace("PDF page ", ""))))
      .map(unit => ({ ...unit, tocKind: "edition-reviewed-pdf-contents-range" })) : units.filter(({ toc }) => toc);
    const tocGroups = [];
    for (const unit of tocUnits) {
      const previous = tocGroups[tocGroups.length - 1];
      const adjacentPdfPages = source.format === "pdf" && previous &&
        Number(unit.locator.replace("PDF page ", "")) === Number(previous.lastLocator.replace("PDF page ", "")) + 1;
      if (adjacentPdfPages) {
        previous.endCharacter = unit.endCharacter; previous.lastLocator = unit.locator;
        previous.tocKinds.push(unit.tocKind);
      } else tocGroups.push({ startCharacter: unit.startCharacter, endCharacter: unit.endCharacter,
        firstLocator: unit.locator, lastLocator: unit.locator, tocKinds: [unit.tocKind] });
    }
    const tocBlocks = tocGroups.map((group) => {
      const raw = text.slice(group.startCharacter, group.endCharacter);
      const firstPage = group.firstLocator.match(/^PDF page (\d+)$/u)?.[1];
      const lastPage = group.lastLocator.match(/^PDF page (\d+)$/u)?.[1];
      const locators = group.firstLocator === group.lastLocator ? group.firstLocator
        : firstPage && lastPage ? `PDF pages ${firstPage}–${lastPage}` : `${group.firstLocator}–${group.lastLocator}`;
      const reviewed = group.tocKinds.every(kind => kind === "edition-reviewed-pdf-contents-range");
      const verified = reviewed || group.tocKinds.every((kind) => kind === "explicit-toc-heading");
      return { sourceId: source.id, locator: locators, startCharacter: group.startCharacter, endCharacter: group.endCharacter,
        text: raw, textSha256: sha256(raw), kind: "literal-toc-block",
        label: verified ? "literal source contents section" : "literal PDF contents-page range candidate; layout not independently verified",
        verified, layoutVerified: false, completeness: reviewed ? "reviewed-pinned-cache-contents-range" : verified ? "partial-unknown-continuation" : "candidate-range" };
    });
    if (source.format === "epub") {
      const originalPath = path.join(status.root, "originals", source.originalFile);
      const originalBytes = readChecked(originalPath, source.originalSha256);
      const originalSource = { ...source, originalPath };
      tocBlocks.push(...extractEpubNavigation(originalBytes, originalSource));
    }
    if (source.format === "markdown") {
      for (const unit of units.filter(({ heading }) => heading)) {
        const headingBytes = text.slice(unit.headingStartCharacter, unit.headingEndCharacter);
        tocBlocks.push({ sourceId: source.id, locator: unit.locator, startCharacter: unit.headingStartCharacter,
          endCharacter: unit.headingEndCharacter, text: headingBytes, textSha256: sha256(headingBytes),
          kind: "literal-markdown-heading-index", label: "literal markdown source heading navigation; not a separate authored TOC",
          verified: true, completeness: "all-source-headings-included" });
      }
    }
    contents.contents.push({ sourceId: source.id, title: source.title, originalPath: path.join(status.root, "originals", source.originalFile),
      originalSha256: source.originalSha256, textSha256: source.textSha256, format: source.format, units: storedUnits, tocBlocks });
    for (const unit of units) examples.examples.push(...exampleRecords(unit, { ...source, root: status.root }));
  }
  return { contents, examples, sourceCount: catalog.sources.length, unitCount, status };
}

function writeAtomic(file, value) {
  inspectSafePath(file);
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.${path.basename(file)}-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`);
  inspectSafePath(temporary);
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function indexPaths(options = {}) {
  const root = resolveLibraryRoot(options);
  inspectSafePath(root, { outsideGit: true });
  const directory = path.join(root, "study");
  inspectSafePath(directory, { outsideGit: true });
  return { root, directory, contentsPath: path.join(directory, "contents.json"), examplesPath: path.join(directory, "examples.json"), manifestPath: path.join(directory, "manifest.json") };
}

function buildLibraryIndex(options = {}) {
  const built = buildData(options);
  const paths = indexPaths(options);
  fs.mkdirSync(paths.directory, { recursive: true, mode: 0o700 });
  inspectSafePath(paths.directory, { outsideGit: true });
  const contentsBytes = Buffer.from(`${JSON.stringify(built.contents, null, 2)}\n`);
  const examplesBytes = Buffer.from(`${JSON.stringify(built.examples, null, 2)}\n`);
  const manifest = { schemaVersion: INDEX_SCHEMA_VERSION, catalogId: built.status.catalogId, catalogSha256: built.status.catalogSha256,
    sources: built.status.sources, derivedFiles: { "contents.json": sha256(contentsBytes), "examples.json": sha256(examplesBytes) },
    sourceTextFidelity: "literal character offsets into pinned pre-extracted text caches; PDF layout may be flattened" };
  writeAtomic(paths.contentsPath, built.contents);
  writeAtomic(paths.examplesPath, built.examples);
  writeAtomic(paths.manifestPath, manifest);
  return { state: "ready", root: paths.root, indexPath: paths.directory, sourceCount: built.sourceCount, unitCount: built.unitCount };
}

function libraryIndexStatus(options = {}) {
  const catalog = options.catalog || defaultCatalog;
  const root = resolveLibraryRoot(options);
  let paths;
  const result = { state: "blocked", root, indexPath: path.join(root, "study"), sourceCount: 0, unitCount: 0, issues: [] };
  try {
    paths = indexPaths(options);
    const sourceStatus = libraryStatus(options);
    if (sourceStatus.state !== "ready") throw new Error(`writing-library-index-blocked: ${sourceStatus.issues.join("; ")}`);
    const manifest = safeJson(paths.manifestPath);
    const contentsBytes = fs.readFileSync(inspectSafePath(paths.contentsPath, { fileRequired: true }));
    const examplesBytes = fs.readFileSync(inspectSafePath(paths.examplesPath, { fileRequired: true }));
    if (manifest.schemaVersion !== INDEX_SCHEMA_VERSION || manifest.catalogId !== catalog.catalogId || manifest.catalogSha256 !== sourceStatus.catalogSha256 ||
        manifest.derivedFiles?.["contents.json"] !== sha256(contentsBytes) || manifest.derivedFiles?.["examples.json"] !== sha256(examplesBytes) ||
        JSON.stringify(manifest.sources) !== JSON.stringify(sourceStatus.sources)) throw new Error("Study index is stale or tampered; run explicit buildLibraryIndex to rebuild");
    const contents = JSON.parse(contentsBytes.toString("utf8"));
    const examples = JSON.parse(examplesBytes.toString("utf8"));
    if (contents.schemaVersion !== INDEX_SCHEMA_VERSION || examples.schemaVersion !== INDEX_SCHEMA_VERSION ||
        contents.catalogSha256 !== sourceStatus.catalogSha256 || examples.catalogSha256 !== sourceStatus.catalogSha256 ||
        contents.contents?.length !== catalog.sources.length || !Array.isArray(examples.examples)) throw new Error("Study index schema/catalog mismatch");
    const expected = buildData(options);
    if (JSON.stringify(contents) !== JSON.stringify(expected.contents) || JSON.stringify(examples) !== JSON.stringify(expected.examples)) {
      throw new Error("Study index does not match current literal source offsets; run explicit buildLibraryIndex to rebuild");
    }
    let unitCount = 0;
    for (const entry of contents.contents) {
      if (!catalog.sources.some((source) => source.id === entry.sourceId)) throw new Error(`Unknown study source: ${entry.sourceId}`);
      unitCount += entry.units.length;
    }
    result.state = "ready"; result.sourceCount = catalog.sources.length; result.unitCount = unitCount;
  } catch (error) { result.issues.push(error.message); }
  return result;
}

function listContents(options = {}) {
  const status = libraryIndexStatus(options);
  if (status.state !== "ready") return status;
  const contents = safeJson(path.join(status.indexPath, "contents.json"));
  const filtered = options.sourceId ? contents.contents.filter((item) => item.sourceId === options.sourceId) : contents.contents;
  if (options.sourceId && !filtered.length) return { ...status, state: "blocked", issues: [`Unknown source: ${options.sourceId}`] };
  return { ...status, contents: filtered };
}

function searchExamples(query, options = {}) {
  const status = libraryIndexStatus(options);
  if (status.state !== "ready") return { ...status, examples: [] };
  if (!String(query || "").trim()) return { ...status, state: "blocked", examples: [], issues: ["A nonempty example query is required"] };
  const index = safeJson(path.join(status.indexPath, "examples.json"));
  const tokens = [...new Set(String(query).toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])];
  const phrase = String(query).toLocaleLowerCase().replace(/\s+/gu, " ").trim();
  const limit = options.limit ?? 8;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return { ...status, state: "blocked", examples: [], issues: ["limit must be an integer from 1 to 50"] };
  const matches = index.examples.filter((item) => !options.sourceId || item.sourceId === options.sourceId).map((item, index) => {
    const haystack = `${item.text} ${item.locator} ${item.title}`.toLocaleLowerCase();
    const exactPhrase = haystack.replace(/\s+/gu, " ").includes(phrase);
    const score = tokens.reduce((sum, token) => sum + Math.min(5, haystack.split(token).length - 1), 0) + (exactPhrase ? 50 : 0);
    return { item, score, index };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map(({ item }) => item);
  return { ...status, examples: matches };
}

module.exports = { buildLibraryIndex, libraryIndexStatus, listContents, searchExamples, INDEX_SCHEMA_VERSION };
