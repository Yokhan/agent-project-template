#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const AGENTS_ROOT = ".codex/agents";
const CODEX_CONFIG = ".codex/config.toml";
const MAX_AGENT_LINES = 80;
const MAX_DESCRIPTION_CHARS = 220;
const TEMPLATE_AGENT_MODEL = "gpt-5.3-codex-spark";
const REQUIRED_AGENTS = [
  "pr_explorer",
  "reviewer",
  "security_reviewer",
  "tester",
  "docs_researcher",
  "design_reviewer",
  "implementer",
];
const WRITE_CAPABLE_AGENTS = new Set(["implementer"]);

const state = {
  checks: 0,
  errors: [],
  warnings: [],
};

function addError(message) {
  state.errors.push(message);
}

function addWarning(message) {
  state.warnings.push(message);
}

function getAgentFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".toml"))
    .map((entry) => path.join(root, entry.name));
}

function parseTopLevelToml(content) {
  const fields = {};
  const lines = content.split(/\r?\n/);
  let multilineKey = null;
  let multilineValue = [];

  for (const line of lines) {
    if (multilineKey) {
      if (line.trim() === '"""') {
        fields[multilineKey] = multilineValue.join("\n").trim();
        multilineKey = null;
        multilineValue = [];
        continue;
      }
      multilineValue.push(line);
      continue;
    }

    const multiline = line.match(/^([A-Za-z0-9_]+)\s*=\s*"""$/);
    if (multiline) {
      multilineKey = multiline[1];
      continue;
    }

    const scalar = line.match(/^([A-Za-z0-9_]+)\s*=\s*"([^"]*)"$/);
    if (scalar) {
      fields[scalar[1]] = scalar[2].trim();
    }
  }

  return fields;
}

function hasInstruction(text, pattern) {
  return pattern.test(String(text || "").toLowerCase());
}

function validateAgentMode(filePath, fields) {
  const name = fields.name || path.basename(filePath, ".toml");
  const sandboxMode = fields.sandbox_mode || "";

  if (!fields.model) {
    addError(`${filePath}: missing required field model`);
  } else if (fields.model !== TEMPLATE_AGENT_MODEL) {
    addError(
      `${filePath}: template agents must use ${TEMPLATE_AGENT_MODEL}, found ${fields.model}`,
    );
  }

  if (!fields.model_reasoning_effort) {
    addError(`${filePath}: missing required field model_reasoning_effort`);
  }

  if (!sandboxMode) {
    addError(`${filePath}: missing required field sandbox_mode`);
    return;
  }

  if (name === "implementer") {
    if (sandboxMode !== "workspace-write") {
      addError(`${filePath}: implementer must use workspace-write`);
    }
    if (!hasInstruction(fields.developer_instructions, /assigned scope/)) {
      addError(`${filePath}: implementer must restate the assigned scope`);
    }
    if (
      !hasInstruction(
        fields.developer_instructions,
        /do not touch files outside/,
      )
    ) {
      addError(`${filePath}: implementer must forbid out-of-scope edits`);
    }
    return;
  }

  if (WRITE_CAPABLE_AGENTS.has(name)) {
    addError(`${filePath}: unexpected write-capable agent name ${name}`);
  }

  if (sandboxMode !== "read-only") {
    addError(`${filePath}: ${name} must stay read-only`);
  }

  if (!hasInstruction(fields.developer_instructions, /do not edit/)) {
    addError(`${filePath}: read-only agent instructions must say not to edit`);
  }
}

function validateAgent(filePath) {
  state.checks += 1;
  const fileName = path.basename(filePath);
  if (fileName.startsWith("project-")) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const fields = parseTopLevelToml(content);
  const lineCount = content.split(/\r?\n/).length;

  for (const field of ["name", "description", "developer_instructions"]) {
    if (!fields[field]) {
      addError(`${filePath}: missing required field ${field}`);
    }
  }

  if (fields.description && fields.description.length > MAX_DESCRIPTION_CHARS) {
    addWarning(
      `${filePath}: description exceeds ${MAX_DESCRIPTION_CHARS} characters`,
    );
  }

  if (fields.name && !/^[a-z][a-z0-9_]*$/.test(fields.name)) {
    addError(`${filePath}: name must use lowercase snake_case`);
  }

  const expectedFile = fields.name
    ? `${fields.name.replaceAll("_", "-")}.toml`
    : "";
  if (expectedFile && fileName !== expectedFile) {
    addWarning(`${filePath}: filename usually matches name as ${expectedFile}`);
  }

  if (fields.sandbox_mode === "danger-full-access") {
    addError(`${filePath}: template agents must not use danger-full-access`);
  }

  if (content.includes("approval_policy")) {
    addError(
      `${filePath}: approval_policy belongs to user/session config, not template agents`,
    );
  }

  if (lineCount > MAX_AGENT_LINES) {
    addWarning(`${filePath}: exceeds ${MAX_AGENT_LINES} lines`);
  }

  validateAgentMode(filePath, fields);
}

function validateRequiredAgents(agentFiles) {
  const names = new Set(
    agentFiles
      .map(
        (filePath) => parseTopLevelToml(fs.readFileSync(filePath, "utf8")).name,
      )
      .filter(Boolean),
  );

  for (const name of REQUIRED_AGENTS) {
    state.checks += 1;
    if (!names.has(name)) {
      addError(`missing required Codex agent: ${name}`);
    }
  }
}

function validateAgentConfig() {
  state.checks += 1;
  if (!fs.existsSync(CODEX_CONFIG)) {
    addError(`${CODEX_CONFIG}: missing`);
    return;
  }

  const content = fs.readFileSync(CODEX_CONFIG, "utf8");
  if (!content.includes("[agents]")) {
    addError(`${CODEX_CONFIG}: missing [agents] section`);
  }
  const maxDepth = content.match(/max_depth\s*=\s*(\d+)/);
  if (!maxDepth || Number(maxDepth[1]) !== 1) {
    addError(
      `${CODEX_CONFIG}: expected max_depth = 1 to prevent recursive fan-out`,
    );
  }
  const maxThreads = content.match(/max_threads\s*=\s*(\d+)/);
  if (!maxThreads) {
    addError(`${CODEX_CONFIG}: missing agents.max_threads`);
  } else {
    const count = Number(maxThreads[1]);
    if (count < 2 || count > 8) {
      addError(`${CODEX_CONFIG}: max_threads must stay between 2 and 8`);
    }
  }

  if (
    /^(model|model_reasoning_effort|approval_policy|sandbox_mode)\s*=/m.test(
      content,
    )
  ) {
    addError(`${CODEX_CONFIG}: contains user/IDE-owned defaults`);
  }
}

function main() {
  const agentFiles = getAgentFiles(AGENTS_ROOT);
  if (agentFiles.length === 0) {
    addError(`no Codex agents found under ${AGENTS_ROOT}`);
  }

  for (const agentFile of agentFiles) {
    validateAgent(agentFile);
  }
  validateRequiredAgents(agentFiles);
  validateAgentConfig();

  console.log(`Codex agents checked: ${state.checks}`);
  for (const warning of state.warnings) {
    console.log(`WARNING: ${warning}`);
  }
  for (const error of state.errors) {
    console.error(`ERROR: ${error}`);
  }

  if (state.errors.length > 0) {
    process.exit(1);
  }
}

main();
