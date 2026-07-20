#!/usr/bin/env node
"use strict";

const path = require("path");

const ROOT_FILES = new Set([
  ".editorconfig", ".env.example", ".gitattributes", ".gitignore", ".mcp.json",
  "AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md", "DESIGN.md", "Makefile",
  "PROJECT_SPEC.md", "README.md", "SECURITY.md", "SETUP_GUIDE.md",
  "design-policy.ignore", "ecosystem.md", "upgrade-project.sh",
]);

function normalizeRelative(rawPath) {
  const normalized = String(rawPath || "").replaceAll("\\", "/");
  const clean = path.posix.normalize(normalized);
  if (!normalized || clean === "." || clean !== normalized || clean.startsWith("../") ||
      path.posix.isAbsolute(clean) || /^[A-Za-z]:/u.test(clean) || /[\r\n|\0]/u.test(clean)) {
    throw new Error(`Unsafe template path: ${rawPath}`);
  }
  return clean;
}

function isSourceOnlyPath(relativePath) {
  return relativePath === "setup.sh" ||
    relativePath === "setup.bat" ||
    relativePath === ".github/workflows/release-template.yml" ||
    relativePath.startsWith("templates/");
}

function isPayloadPath(rawPath) {
  const file = normalizeRelative(rawPath);
  if (isSourceOnlyPath(file) || file === ".claude/settings.local.json") return false;
  if (ROOT_FILES.has(file)) return true;
  if (/^\.codex\/(?:config\.toml|hooks\.json|agents\/[^/]+\.toml)$/u.test(file)) return true;
  if (/^\.agents\/skills\/[^/]+\/(?:SKILL\.md|agents\/openai\.yaml|references\/[^/]+\.md)$/u.test(file)) return true;
  if (/^\.claude\/(?:settings\.json|settings\.local\.json\.example)$/u.test(file)) return true;
  if (/^\.claude\/(?:docs|rules|library|agents|skills|commands|hooks|pipelines)\//u.test(file)) return true;
  if (/^scripts\/(?:[^/]+\.(?:sh|js|cmd)|lib\/[^/]+\.(?:sh|js))$/u.test(file)) return true;
  if (/^mcp-servers\/context-router\/(?:package(?:-lock)?\.json|tsconfig\.json|src\/[^/]+\.ts)$/u.test(file)) return true;
  if (/^tests\/(?:rules\/[^/]+\.test\.md|fixtures\/(?:design-policy\/(?:pass|fail)|writing-tools|change-strategy)\/)/u.test(file)) return true;
  if (/^brain\/03-knowledge\/communication\/[^/]+\.md$/u.test(file)) return true;
  if (file.startsWith("docs/") || file.startsWith("_reference/") || file.startsWith("integrations/spec-kit/")) return true;
  if (file === ".vscode/extensions.json") return true;
  if (file === ".github/workflows/validate-template.yml" || file === ".github/ci.yml.template") return true;
  return false;
}

function getCategory(relativePath) {
  if (relativePath === "CLAUDE.md" || relativePath === "DESIGN.md" ||
      relativePath === "design-policy.ignore" || relativePath === "PROJECT_SPEC.md" ||
      relativePath === "ecosystem.md" || relativePath.startsWith("tasks/") ||
      relativePath.startsWith("brain/")) return "project";
  if (relativePath === ".gitignore" || relativePath === ".codex/config.toml" ||
      relativePath === ".mcp.json" || relativePath.startsWith(".vscode/")) return "hybrid";
  return "template";
}

module.exports = { getCategory, isPayloadPath, isSourceOnlyPath, normalizeRelative };
