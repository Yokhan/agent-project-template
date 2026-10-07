"use strict";

const fs = require("fs");
const path = require("path");

function markdownFilesForSkill(skillDir) {
  const files = [];
  const skillFile = path.join(skillDir, "SKILL.md");
  if (fs.existsSync(skillFile) && fs.statSync(skillFile).isFile()) {
    files.push(skillFile);
  }

  const referencesDir = path.join(skillDir, "references");
  if (!fs.existsSync(referencesDir) || !fs.statSync(referencesDir).isDirectory()) {
    return files;
  }

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(entryPath);
      }
    }
  }

  visit(referencesDir);
  return files;
}

function maskCodeExamples(content) {
  const lines = content.split(/(?<=\n)/);
  let fence = null;
  return lines.map((line) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) {
        fence = fenceMatch[1][0];
      } else if (fenceMatch[1][0] === fence) {
        fence = null;
      }
      return line.replace(/[^\r\n]/g, " ");
    }
    if (fence) {
      return line.replace(/[^\r\n]/g, " ");
    }

    // Keep offsets and line numbers stable while omitting inline-code examples.
    return line.replace(/(`+)(.*?)\1/g, (span) =>
      span.replace(/[^\r\n]/g, " "),
    );
  }).join("");
}

function isPlaceholderTarget(target) {
  return /(?:\.\.\.|…|\{[^}]*\}|\$[A-Za-z_][\w]*|%[A-Za-z_][\w]*%|<[^>]*>|\bpath\/to\/|\bYOUR_[A-Z0-9_]+\b|\byour-[\w-]+)/i.test(target);
}

function shouldIgnoreTarget(target) {
  const trimmed = target.trim();
  return (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ||
    isPlaceholderTarget(trimmed)
  );
}

function destinationFromMarkdown(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">");
    return end < 0 ? trimmed : trimmed.slice(1, end);
  }
  return (trimmed.match(/^(?:\\.|[^\s])+/) || [""])[0].replace(/\\([\\`*_{}\[\]()#+.!<>|])/g, "$1");
}

function markdownDestinations(content) {
  const masked = maskCodeExamples(content);
  const found = [];
  const inline = /!?\[[^\]\r\n]*\]\(\s*(<[^>]*>|(?:\\.|[^\s)])+)(?:\s+[^)]*)?\s*\)/g;
  const definitions = /^\s{0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)(?:\s+.*)?$/gm;

  for (const match of masked.matchAll(inline)) {
    found.push({ target: destinationFromMarkdown(match[1]), offset: match.index });
  }
  for (const match of masked.matchAll(definitions)) {
    found.push({ target: destinationFromMarkdown(match[1]), offset: match.index });
  }
  return found;
}

function validateSkillLinks(skillsRoot) {
  const errors = [];
  if (!fs.existsSync(skillsRoot)) {
    return errors;
  }

  const skillDirs = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("project-"))
    .map((entry) => path.join(skillsRoot, entry.name));

  for (const skillDir of skillDirs) {
    const skillName = path.basename(skillDir);
    for (const markdownFile of markdownFilesForSkill(skillDir)) {
      const content = fs.readFileSync(markdownFile, "utf8");
      for (const { target, offset } of markdownDestinations(content)) {
        if (shouldIgnoreTarget(target)) {
          continue;
        }

        // Query and fragment components do not name part of the local file path.
        const fileTarget = target.split(/[?#]/, 1)[0];
        if (!fileTarget) {
          continue;
        }

        let decodedTarget;
        try {
          decodedTarget = decodeURIComponent(fileTarget);
        } catch {
          decodedTarget = fileTarget;
        }
        const resolved = path.resolve(path.dirname(markdownFile), decodedTarget);
        let isFile = false;
        try {
          isFile = fs.statSync(resolved).isFile();
        } catch {
          // A missing or inaccessible destination is reported uniformly below.
        }
        if (!isFile) {
          const line = content.slice(0, offset).split(/\r?\n/).length;
          errors.push(
            `${skillName}/${path.relative(skillDir, markdownFile)}:${line}: local Markdown link target does not exist as a file: ${target}`,
          );
        }
      }
    }
  }
  return errors;
}

module.exports = { validateSkillLinks };
