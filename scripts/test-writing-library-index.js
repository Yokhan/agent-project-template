"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { sha256, catalogHash } = require("./lib/writing-library-store.js");
const { buildLibraryIndex, libraryIndexStatus, listContents, searchExamples } = require("./lib/writing-library-index.js");

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "writing-library-index-test-"));
try {
  const root = path.join(fixture, "writing-library");
  fs.mkdirSync(path.join(root, "originals"), { recursive: true });
  fs.mkdirSync(path.join(root, "text"), { recursive: true });
  const original = Buffer.from("synthetic fixture source");
  const longExample = `Пример полного фрагмента.${" Длинное описание до и после.".repeat(100)}`;
  const text = Buffer.from(`[PDF page 1]\nСодержание\nРаздел 1. Примеры\n\n[PDF page 2]\nДо / после: было неясно, стало понятно.\n\nПример исправления фразы.\n\n[PDF page 3]\n${longExample}\n`);
  const catalog = { schemaVersion: 1, catalogId: "fixture", sources: [{ id: "fixture-source", title: "Fixture",
    originalFile: "fixture.pdf", originalSha256: sha256(original), textSha256: sha256(text), format: "pdf", units: 3 }] };
  fs.writeFileSync(path.join(root, "originals", "fixture.pdf"), original);
  fs.writeFileSync(path.join(root, "text", "fixture-source.txt"), text);
  fs.writeFileSync(path.join(root, "manifest.json"), `${JSON.stringify({ schemaVersion: 1, catalogId: catalog.catalogId,
    catalogSha256: catalogHash(catalog), sources: [{ id: "fixture-source", originalSha256: catalog.sources[0].originalSha256,
      textSha256: catalog.sources[0].textSha256, provenance: { method: "user-supplied-preextracted-text",
        originalSha256: catalog.sources[0].originalSha256, textSha256: catalog.sources[0].textSha256, importManifestSha256: "a".repeat(64) } }] }, null, 2)}\n`);
  const options = { root, catalog };
  const built = buildLibraryIndex(options);
  assert.strictEqual(built.state, "ready");
  assert.strictEqual(built.sourceCount, 1);
  assert.strictEqual(built.unitCount, 3);
  assert.strictEqual(libraryIndexStatus(options).state, "ready");
  const content = listContents({ ...options, sourceId: "fixture-source" });
  assert.strictEqual(content.contents[0].units.length, 3);
  assert.strictEqual(content.contents[0].tocBlocks[0].text, "Содержание\nРаздел 1. Примеры");
  const result = searchExamples("до / после", { ...options, limit: 1 });
  assert.strictEqual(result.examples.length, 1);
  assert(result.examples[0].text.startsWith("До / после: было неясно, стало понятно."));
  assert.equal(result.examples[0].locator, "PDF page 2", "an exact example label outranks repeated scattered query words");
  assert.strictEqual(result.examples[0].verified, false);
  assert.strictEqual(text.toString("utf8").slice(result.examples[0].startCharacter, result.examples[0].endCharacter), result.examples[0].text);
  const longResult = searchExamples("длинное", options).examples[0];
  assert.strictEqual(longResult.text, longExample);
  assert(longResult.text.length > 1200);
  fs.appendFileSync(path.join(built.indexPath, "examples.json"), " ");
  assert.strictEqual(libraryIndexStatus(options).state, "blocked");
  assert.strictEqual(buildLibraryIndex(options).state, "ready");
  assert.strictEqual(libraryIndexStatus(options).state, "ready");
  process.stdout.write("writing-library-index fixture checks passed\n");
  const mdRoot = path.join(fixture, "markdown-library");
  fs.mkdirSync(path.join(mdRoot, "originals"), { recursive: true });
  fs.mkdirSync(path.join(mdRoot, "text"), { recursive: true });
  const mdToc = Array.from({ length: 22 }, (_, i) => `${i + 1}. [Раздел ${i + 1}](#section-${i + 1})`).join("\n");
  const mdBytes = Buffer.from(`# Содержание\n${mdToc}\n\n# Глава\nПример объяснения.\n`);
  const mdSource = { ...catalog.sources[0], originalFile: "fixture.md", format: "markdown", units: 2,
    originalSha256: sha256(mdBytes), textSha256: sha256(mdBytes) };
  const mdCatalog = { ...catalog, sources: [mdSource] };
  fs.writeFileSync(path.join(mdRoot, "originals", "fixture.md"), mdBytes);
  fs.writeFileSync(path.join(mdRoot, "text", "fixture-source.txt"), mdBytes);
  fs.writeFileSync(path.join(mdRoot, "manifest.json"), JSON.stringify({ schemaVersion: 1,
    catalogSha256: catalogHash(mdCatalog), sources: [{ id: mdSource.id, originalSha256: mdSource.originalSha256,
      textSha256: mdSource.textSha256, provenance: { method: "user-supplied-preextracted-text",
        originalSha256: mdSource.originalSha256, textSha256: mdSource.textSha256, importManifestSha256: "b".repeat(64) } }] }));
  const mdOptions = { root: mdRoot, catalog: mdCatalog };
  buildLibraryIndex(mdOptions);
  const mdContents = listContents(mdOptions).contents[0];
  const authoredToc = mdContents.tocBlocks.find(block => block.kind === "literal-toc-block");
  assert.equal(authoredToc.text, mdToc, "a Markdown TOC heading retains the entire authored contents beyond the navigation preview");
  assert.equal(mdBytes.toString("utf8").slice(authoredToc.startCharacter, authoredToc.endCharacter), mdToc);
} finally {
  const resolved = path.resolve(fixture);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("writing-library-index-test-")) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
