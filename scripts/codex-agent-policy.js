"use strict";

const path = require("path");

// Capabilities are not defaults or permission to spend an unbounded budget.
const EFFORT_LEVELS = Object.freeze(["low", "medium", "high", "xhigh", "max"]);
const MODEL_CAPABILITIES = Object.freeze({
  "gpt-6.1-sol": Object.freeze({ efforts: EFFORT_LEVELS }),
  "gpt-6.1-terra": Object.freeze({ efforts: Object.freeze(["none", ...EFFORT_LEVELS]) }),
  "gpt-6-luna": Object.freeze({ efforts: Object.freeze(["none", ...EFFORT_LEVELS]) }),
  "gpt-6-astra": Object.freeze({ efforts: EFFORT_LEVELS }),
});

const AGENT_POLICY = Object.freeze({
  version: "5.0.2",
  parent: Object.freeze({
    modelSource: "user-or-ide",
    recommendedModel: "gpt-6.1-sol",
    baselineEffort: "high",
    effortCeiling: "max",
    recommendedEffortCeiling: "high",
  }),
  fanout: Object.freeze({
    maxChildren: 3,
    maxDepth: 1,
    maxAutomaticWaves: 1,
    notifyUser: true,
    readOnlyFirst: true,
    requireRuntimeProfileEvidence: true,
    writePolicy: "exact-non-overlapping-files-only",
  }),
  profiles: Object.freeze({
    scout: Object.freeze({
      file: "scout.toml",
      model: "gpt-6.1-terra",
      effort: "medium",
      sandboxMode: "read-only",
    }),
    log_analyst: Object.freeze({
      file: "log-analyst.toml",
      model: "gpt-6.1-terra",
      effort: "medium",
      sandboxMode: "read-only",
    }),
    summarizer: Object.freeze({
      file: "summarizer.toml",
      model: "gpt-6.1-terra",
      effort: "medium",
      sandboxMode: "read-only",
    }),
    pr_explorer: Object.freeze({
      file: "pr-explorer.toml",
      model: "gpt-6.1-terra",
      effort: "medium",
      sandboxMode: "read-only",
    }),
    docs_researcher: Object.freeze({
      file: "docs-researcher.toml",
      model: "gpt-6.1-terra",
      effort: "medium",
      sandboxMode: "read-only",
    }),
    tester: Object.freeze({
      file: "tester.toml",
      model: "gpt-6.1-terra",
      effort: "medium",
      sandboxMode: "read-only",
    }),
    writing_editor: Object.freeze({
      file: "writing-editor.toml",
      model: "gpt-6.1-terra",
      effort: "medium",
      sandboxMode: "read-only",
    }),
    implementer: Object.freeze({
      file: "implementer.toml",
      model: "gpt-6.1-terra",
      effort: "medium",
      sandboxMode: "workspace-write",
    }),
    reviewer: Object.freeze({
      file: "reviewer.toml",
      model: "gpt-6.1-sol",
      effort: "high",
      sandboxMode: "read-only",
    }),
    design_reviewer: Object.freeze({
      file: "design-reviewer.toml",
      model: "gpt-6.1-sol",
      effort: "high",
      sandboxMode: "read-only",
    }),
    product_reviewer: Object.freeze({
      file: "product-reviewer.toml",
      model: "gpt-6.1-sol",
      effort: "high",
      sandboxMode: "read-only",
    }),
    security_reviewer: Object.freeze({
      file: "security-reviewer.toml",
      model: "gpt-6.1-sol",
      effort: "high",
      sandboxMode: "read-only",
    }),
    systems_reviewer: Object.freeze({
      file: "systems-reviewer.toml",
      model: "gpt-6.1-sol",
      effort: "high",
      sandboxMode: "read-only",
    }),
    architecture_consultant: Object.freeze({
      file: "architecture-consultant.toml",
      model: "gpt-6-astra",
      effort: "medium",
      sandboxMode: "read-only",
    }),
  }),
});

const OPT_OUT_PATTERN =
  /(?:\b(?:do not|don't|dont|never)\s+(?:(?:use|spawn|run|call)\s+)?(?:any\s+)?(?:sub-?agents?|delegation|fan-?out|swarm)\b|\b(?:do not|don't|dont|never)\s+delegate\b|\bwithout\s+(?:(?:using|any)\s+)?(?:sub-?agents?|delegation|fan-?out|swarm)\b|\bno\s+(?:sub-?agents?|delegation|fan-?out|swarm)\b|(?:без|не\s+(?:используй|запускай|вызывай|делегируй))\s+(?:любых\s+)?(?:субагент[\p{L}]*|сабагент[\p{L}]*|делегац[\p{L}]*|фан-?аут[\p{L}]*|swarm|ро[йяе][\p{L}]*|рой[\p{L}]*)|не\s+делегируй)/iu;
const RUSSIAN_EXECUTION_REQUEST_PATTERN = new RegExp([
  String.raw`(?:сделай|делай|добавь|исправь|обнови|измени|создай|напиши|перепиши|отредактируй|доработай|улучши|поправь|сверстай|внедри|реализуй|выпусти|опубликуй|выкат(?:и|ай)|встав(?:ь|ляй)|подключ(?:и|ай)|передел(?:ай|ывай)|перегенер(?:и|ируй)|сгенерируй|генер(?:и|ируй)|перерис(?:уй|овывай)|пересозд(?:ай|авай)|собери|разработай|сохрани|выдели|растяни|подправь|нарисуй|задеплой|задеплойте|внос(?:и|ите)|подним(?:ай|ите))(?!\p{L})`,
  String.raw`давай(?:-ка)?\s+(?:(?:попробуем|попробуй)\s+)?(?:сделаем|сделать|подключим|перегенерировать|сгенерировать|перерисовать|пересоздать)(?!\p{L})`,
  String.raw`давай-ка\s+ты\s+.{0,50}?сделаешь(?!\p{L})`,
  String.raw`(?:может\s+ты\s+сделаешь|можешь\s+сделать|(?:ты|вы)\s+бы\s+сделал)(?!\p{L})`,
  String.raw`(?:можем\s+попробовать|можно)\s+(?!ли(?!\p{L})).{0,100}?(?:сделать|сгенерировать|растянуть|выделить|вставить|подключить|подправить|заменить|заменять|нарисовать|задеплоить)(?!\p{L})`,
  String.raw`(?:тебе\s+)?(?:нужно|надо|следует|пора)\s+.{0,120}?(?:сделать|вставить|подключить|переделать|перегенерить|перегенерировать|сгенерировать|перерисовать|пересоздать|собрать|разработать|заменить|заменять|сохранить|подправить|подправлять|растянуть|выделить|нарисовать|задеплоить)(?!\p{L})`,
  String.raw`(?:хочу|хочется|хотелось\s+бы)\s+.{0,120}?(?:сделать|сгенерировать|стало\s+базой|стала\s+базой|перерисовать|добавить|ввести)(?!\p{L})`,
  String.raw`задеплоишь(?!\p{L})`,
].join("|"), "iu");
const MUTATION_PATTERN = new RegExp(
  String.raw`\b(?:add|refactor|build|change|create|deploy|edit|fix|harden|improve|implement|migrate|patch|polish|publish|release|remediate|revise|rewrite|tag|tighten|update|write)\b|(?:добавь|добавьте|отрефакторь|отрефакторьте|выпусти|выпустите|исправь|исправьте|измени|измените|мигрируй|мигрируйте|обнови|обновите|опубликуй|опубликуйте|реализуй|реализуйте|релизь|создай|создайте|тегируй|тегируйте|выкати|выкатите|запиши|запишите|напиши|напишите|перепиши|перепишите|отредактируй|отредактируйте|доработай|доработайте|улучши|улучшите|поправь|поправьте|сверстай|сверстайте|внедри|внедрите)(?!\p{L})|${RUSSIAN_EXECUTION_REQUEST_PATTERN.source}`,
  "iu",
);
const READ_ONLY_PATTERN =
  /\b(?:read[ -]?only|inspect|review|audit|analy[sz]e|evaluate|explain|report|research|look up)\b|без\s+изменений|только\s+чтение|проверь|проверять|проверить|убедись|аудит|разбери|оцени|посмотри|изучи|объясни|отч[её]т|выясни|узнай|почему|в\s+чем\s+причин|не\s+работает|ошибк/iu;
const RESEARCH_REQUEST_PATTERN =
  /\b(?:research|investigate|explore|understand|analy[sz]e|review|audit|inspect|evaluate|report|explain|look up|plan)\b|исследуй|изучи|разбер|анализ|провер(?:ь|и|ять|ить)|аудит|оцени|посмотри|отч[её]т|выясни(?:ть)?|узнай|спланируй|планируй|не\s+работает|ошибк.{0,80}почему|почему.{0,80}(?:не\s+работает|ошибк|падает)|в\s+чем\s+(?:причин|дело)|что\s+происходит|убедись|что\s+можешь.{0,80}(?:выдел|подсвет|сгенерир)|так\s+можно\s+сделать|можно\s+ли.{0,100}(?:сделать|подключить|совместить|имитировать)|хочу.{0,160}(?:во\s+всех\s+вариант|базой|основой)/iu;
const FEEDBACK_DISCOVERY_PATTERN =
  /не\s+работает|ошибк|сбо[йя]|сломал|не\s+совпадает|не\s+хватает|косяч|гряз[ьи]|разрыв|не\s+нравится|не\s+то|хуже|не\s+премиальн|не\s+современн|не\s+понятн|не\s+красив|нужна\s+другая/iu;
const REPORTED_INSTRUCTION_PATTERN =
  /^\s*(?:(?:ну|так|окей|слушай|а|да)(?!\p{L})[\s,]*)*(?:проверь|оцени|разбери|проанализируй|прочитай|провалидируй)\s+(?:формулировк[\p{L}]*|фраз[\p{L}]*|пример[\p{L}]*|текст[\p{L}]*|инструкц[\p{L}]*|команд[\p{L}]*|цитат[\p{L}]*)/iu;
const EXPLICIT_FOLLOWUP_ACTION_PATTERN =
  /(?:[.!?;]\s*|(?:и|а\s+потом|затем)\s+)(?:пожалуйста\s+)?(?:сделай|делай|добавь|исправь|обнови|измени|создай|напиши|перепиши|отредактируй|доработай|улучши|поправь|сверстай|внедри|реализуй|выпусти|опубликуй|вставь|подключи|переделай|сгенерируй|перерисуй|сохрани|выдели|растяни|подправь|нарисуй|задеплой)(?!\p{L})/iu;
const REPORTED_COLON_FOLLOWUP_ACTION_PATTERN =
  /[.!?;]\s*(?:(?:и|а\s+потом|затем|потом)\s+)?(?:пожалуйста\s+)?(?:сделай|делай|добавь|исправь|обнови|измени|создай|напиши|перепиши|отредактируй|доработай|улучши|поправь|сверстай|внедри|реализуй|выпусти|опубликуй|вставь|подключи|переделай|сгенерируй|перерисуй|сохрани|выдели|растяни|подправь|нарисуй|задеплой)(?!\p{L})/iu;
const NEGATED_MUTATION_PATTERN =
  /\b(?:do not|don't|dont|never)\s+(?:edit|modify|change|patch|write)(?:\s+(?:files?|code))?\b|не\s+(?:редактир|изменя|патч|прав|трогай)|не\s+(?:делай|сделай|встав(?:ь|ляй)|подключ(?:и|ай)|передел(?:ай|ывай)|перегенер(?:и|ируй)|сгенерируй|генер(?:и|ируй)|перерис(?:уй|овывай)|пересозд(?:ай|авай)|собери|разработай|сохрани|выдели|растяни|подправь|нарисуй|задеплой)(?!\p{L})|не\s+(?:нужно|надо)\s+.{0,80}?(?:сделать|вставить|подключить|переделать|перегенерировать|сгенерировать|перерисовать|пересоздать|разработать|заменить|заменять|сохранить|подправить|растянуть|выделить|нарисовать|задеплоить)(?!\p{L})|без\s+(?:правок|изменений)/iu;
const PARALLEL_VALUE_PATTERN =
  /\b(?:parallel|independent lanes?|compare|cross-check|deep audit|comprehensive audit|across (?:modules|systems|sources|projects)|multiple (?:modules|sources|projects)|swarm|release announcement.{0,40}diagrams?)\b|параллел|независим[\p{L}]*\s+(?:поток|провер|аудит)|сравни|глубок[\p{L}]*\s+аудит|комплексн[\p{L}]*\s+аудит|нескольк[\p{L}]*\s+(?:модул|источник|проект)|(?:через|используя)\s+рой|сайт[\p{L}]*\s+релиз.{0,40}диаграм/iu;

function getAgentProfile(name) {
  return AGENT_POLICY.profiles[name] || null;
}

function getAgentProfiles() {
  return Object.entries(AGENT_POLICY.profiles).map(([name, profile]) => ({
    name,
    ...profile,
  }));
}

function stripFanoutOptOut(task) {
  const pattern = new RegExp(OPT_OUT_PATTERN.source, `${OPT_OUT_PATTERN.flags}g`);
  return String(task || "").replace(pattern, " ").replace(/\s+/g, " ").replace(/\s+([.!?])/g, "$1").trim();
}

function stripQuotedOrCodeText(task) {
  return String(task || "")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/`[^`\r\n]*`/gu, " ")
    .replace(/«[^»]*»|“[^”]*”|„[^“]*“|"[^"\r\n]*"|'[^'\r\n]*'/gu, " ")
    .replace(/^\s*>.*$/gmu, " ");
}

function isImplementationRequest(task) {
  const text = String(task || "");
  const actionText = stripQuotedOrCodeText(text);
  const leadingTask = text.replace(/^\s*(?:(?:ну|так|окей|слушай|теперь|а|да)(?!\p{L})[\s,]*)+/iu, "");
  const reportedLead = actionText.match(REPORTED_INSTRUCTION_PATTERN);
  if (reportedLead) {
    const colonAfterLead = actionText.slice(reportedLead[0].length).match(/^\s*:/u);
    const colonIndex = colonAfterLead
      ? reportedLead[0].length + colonAfterLead[0].lastIndexOf(":")
      : -1;
    const hasReportedFollowup = colonIndex >= 0
      ? REPORTED_COLON_FOLLOWUP_ACTION_PATTERN.test(actionText.slice(colonIndex + 1))
      : EXPLICIT_FOLLOWUP_ACTION_PATTERN.test(actionText);
    if (!hasReportedFollowup) return false;
  }
  // A route name or a supplied worker contract never grants write authority.
  if (NEGATED_MUTATION_PATTERN.test(actionText) ||
      /\bread[ -]?only\b|только\s+чтени[ея]/iu.test(actionText)) return false;
  // "What can/should be done?" asks for a judgment, not execution.
  if (/^\s*что\s+(?:можно|нужно|надо)(?!\p{L})/iu.test(leadingTask)) return false;
  if (/(?:^|[\s,])так\s+можно(?!\p{L}).{0,160}\?/iu.test(text)) return false;
  // Explanations can contain imperative-looking conjunctions as their subject
  // ("explain the build and deploy pipeline"). They do not authorize writes.
  if (/^\s*(?:explain|describe|report|research|how\b|why\b|объясни|опиши|расскажи|спланируй|планируй|как\s|почему\s)/iu.test(leadingTask)) {
    return /[.;!]\s*(?:please\s+)?(?:implement|fix|change|create|update|write)\b/iu.test(actionText) ||
      /[.;!]\s*(?:пожалуйста\s+)?(?:сделай|делай|исправь|реализуй|обнови|измени|создай|напиши|сверстай|внедри|вставь|подключи|переделай|сгенерируй|перерисуй|сохрани|выдели|растяни|подправь|нарисуй|задеплой)(?!\p{L})/iu.test(actionText);
  }
  // In an audit/question, "fix" can name the thing being inspected. Require
  // an actual action clause instead of interpreting that noun as permission.
  if (READ_ONLY_PATTERN.test(text) || /^(?:how\b|why\b|как\s|почему\s)/iu.test(text.trim())) {
    // A conjunction alone is ambiguous ("audit the build and fix process").
    // Require an explicit action object in English mixed audit/write requests.
    return /(?:^|[.;!,?]\s*)(?:please\s+)?(?:add|refactor|build|change|create|deploy|fix|harden|implement|migrate|patch|publish|release|remediate|update|write)\b/iu.test(actionText) ||
      /\b(?:and|then)\s+(?:please\s+)?(?:add|refactor|build|change|create|deploy|fix|harden|implement|migrate|patch|publish|release|remediate|update|write)\s+(?:the|a|an|this|that|these|those|our|my)\s+/iu.test(actionText) ||
      RUSSIAN_EXECUTION_REQUEST_PATTERN.test(actionText);
  }
  return MUTATION_PATTERN.test(actionText);
}

function isResearchRequest(task) {
  const text = String(task || "");
  if (isImplementationRequest(text)) return false;
  if (RESEARCH_REQUEST_PATTERN.test(text)) return true;
  // Substantive correction feedback can need source inspection before Sol
  // decides whether it implies a bounded write or a product judgment.
  return text.length >= 120 && FEEDBACK_DISCOVERY_PATTERN.test(text);
}

function validateResourceRequest({ model, effort, budget, reason, hostCapabilities } = {}) {
  const capabilities = MODEL_CAPABILITIES[model];
  if (!capabilities) return { isValid: false, reason: "unknown-model-capabilities" };
  if (!capabilities.efforts.includes(effort)) {
    return { isValid: false, reason: "unsupported-effort" };
  }
  if ((effort === "max" || effort === "xhigh") &&
      (!reason || !budget || !Number.isFinite(budget.maxAttempts) || budget.maxAttempts < 1 ||
       !Number.isFinite(budget.maxTokens) || budget.maxTokens < 1)) {
    return { isValid: false, reason: "escalated-effort-requires-reason-and-bounded-budget" };
  }
  if (hostCapabilities && !hostCapabilities[model]?.includes(effort)) {
    return { isValid: false, reason: "host-does-not-support-requested-profile" };
  }
  return { isValid: true, reason: "supported-within-budget",
    hostStatus: hostCapabilities ? "verified" : "unverified",
    budgetEnforcement: "caller-owned" };
}

function validateWorkerContract(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("worker contract must be an object");
  }
  for (const field of ["scope", "acceptance", "evidenceRefs"]) {
    if (value[field] !== undefined && (!Array.isArray(value[field]) ||
        value[field].some((item) => typeof item !== "string" || !item.trim()))) {
      throw new Error(`worker contract ${field} must be an array of nonempty strings`);
    }
  }
  for (const field of ["role", "requestedEffort", "reason", "orchestrator"]) {
    if (value[field] !== undefined && typeof value[field] !== "string") {
      throw new Error(`worker contract ${field} must be a string`);
    }
  }
  for (const field of ["integration", "strategy", "deepRisk"]) {
    if (value[field] !== undefined && typeof value[field] !== "boolean") {
      throw new Error(`worker contract ${field} must be a boolean`);
    }
  }
  if (value.assignments !== undefined) {
    if (!value.assignments || typeof value.assignments !== "object" || Array.isArray(value.assignments)) {
      throw new Error("worker contract assignments must be a role-to-contract object");
    }
    Object.values(value.assignments).forEach(validateWorkerContract);
  }
  if (value.hostCapabilities !== undefined) {
    if (!value.hostCapabilities || typeof value.hostCapabilities !== "object" || Array.isArray(value.hostCapabilities) ||
        Object.values(value.hostCapabilities).some((efforts) => !Array.isArray(efforts) || efforts.some((effort) => typeof effort !== "string"))) {
      throw new Error("hostCapabilities must map model IDs to arrays of efforts");
    }
  }
  if (value.budget !== undefined && (!value.budget || typeof value.budget !== "object" || Array.isArray(value.budget))) {
    throw new Error("worker contract budget must be an object");
  }
  if (value.hostDispatchCapabilities !== undefined && (!Array.isArray(value.hostDispatchCapabilities) ||
      value.hostDispatchCapabilities.some((mode) => !["native-custom-role", "explicit-model-contract"].includes(mode)))) {
    throw new Error("hostDispatchCapabilities must list supported dispatch schemas");
  }
  if (value.scope?.some((scope) => isUnsafeWriteScope(normalizeWriteScope(scope)))) {
    throw new Error("worker contract scope must stay within canonical relative paths");
  }
  return value;
}

function getResourceRecommendation(input = {}) {
  const options = validateWorkerContract(input);
  const role = options.role || "orchestrator";
  const profile = getAgentProfile(role);
  const isBounded = Boolean(options.scope?.length && options.acceptance?.length);
  const workerRoles = new Set(["implementer", "tester", "docs_researcher", "scout", "log_analyst", "summarizer", "pr_explorer"]);
  const requiresJudgment = role !== "architecture_consultant" &&
    (options.integration || options.strategy || (workerRoles.has(role) && !isBounded));
  const recommendedModel = requiresJudgment || !profile
    ? AGENT_POLICY.parent.recommendedModel : profile.model;
  const defaultEffort = role === "architecture_consultant" && options.deepRisk
    ? "high" : requiresJudgment || !profile ? "high" : profile.effort;
  const recommendedEffort = options.requestedEffort || defaultEffort;
  const resourceRequest = validateResourceRequest({
    model: recommendedModel, effort: recommendedEffort, reason: options.reason,
    budget: options.budget, hostCapabilities: options.hostCapabilities,
  });
  const nativeRole = options.hostDispatchCapabilities?.includes("native-custom-role") &&
    profile?.model === recommendedModel && profile?.effort === recommendedEffort;
  const dispatchStrategy = requiresJudgment || !profile ? "parent-owned-work" :
    nativeRole ? "native-custom-role" : "explicit-model-contract";
  const dispatchReady = isBounded && !requiresJudgment && Boolean(profile) && resourceRequest.isValid &&
    (!options.requestedEffort || resourceRequest.hostStatus === "verified") &&
    Boolean(options.hostDispatchCapabilities?.includes(dispatchStrategy));
  const instructionsSource = profile ? `.codex/agents/${profile.file}` : null;
  return {
    role, recommendedModel, recommendedEffort,
    resourceRequest,
    reason: requiresJudgment ? "integration-strategy-or-unbounded-work" :
      role === "architecture_consultant" ? "bounded-architecture-decision" : "role-default",
    scope: options.scope || [], acceptance: options.acceptance || [],
    evidenceRefs: options.evidenceRefs || [],
    escalationCondition: "after-two-failed-attempts-reassess-cause-and-scope; architecture-conflict-consult-astra",
    orchestrator: options.orchestrator || "codex-parent",
    dispatch: {
      owner: requiresJudgment || !profile ? "orchestrator" : "worker",
      customRole: nativeRole ? role : null,
      strategy: dispatchStrategy,
      capabilityStatus: options.hostDispatchCapabilities?.includes(dispatchStrategy) ? "verified" : "unverified",
      instructionsSource,
      requestedSandbox: profile?.sandboxMode || null,
      sandboxStatus: "inherited-or-unverified",
      callContract: dispatchReady && dispatchStrategy === "explicit-model-contract" ? {
        tool: "collaboration.spawn_agent", model: recommendedModel, reasoning_effort: recommendedEffort,
        fork_turns: "none", task_name: role,
        message: `Bounded role contract: ${JSON.stringify({ role, scope: options.scope || [], acceptance: options.acceptance || [], evidenceRefs: options.evidenceRefs || [], instructionsSource, requestedSandbox: profile?.sandboxMode })}. Parent must read the developer_instructions from instructionsSource and include them verbatim before dispatch. Do not write outside scope; read-only roles must not change files. Return acceptance evidence and material unknowns.`,
      } : dispatchReady && dispatchStrategy === "native-custom-role" ? {
        tool: "spawn_agent", agent_type: role,
        message: `Bounded role contract: ${JSON.stringify({ role, scope: options.scope || [], acceptance: options.acceptance || [], evidenceRefs: options.evidenceRefs || [] })}. Stay within scope and return acceptance evidence and material unknowns.`,
      } : null,
      ready: dispatchReady,
    },
    runtimeStatus: "recommendation-only",
    effectiveModel: null, effectiveEffort: null, childThreadId: null,
    completionEvidence: [],
  };
}

function isLikelySmallTask(task) {
  const trimmed = stripFanoutOptOut(task);
  // Match the whole request, not a keyword anywhere in a compound task.
  const boundedEdit = /^(?:fix|check|inspect|update|change|format)\s+(?:a\s+)?(?:typo|spelling|one line|single line|one comment|single comment|label)(?:\s+in\s+(?:README(?:\.md)?|[\w.-]+\.(?:md|txt)))?[.!]?$/iu;
  const boundedRussianEdit = /^(?:исправь|проверь|обнови)\s+(?:опечатку|одну строку|один комментарий)(?:\s+в\s+(?:README(?:\.md)?|[\w.-]+\.(?:md|txt)))?[.!]?$/iu;
  const boundedStatus = trimmed.length <= 160 &&
    /^(?:(?:write|draft|give|report|send)\b|(?:напиши|составь|дай|подготовь)(?=\s|$))/iu.test(trimmed) &&
    /\b(?:status|update)\b|статус|обновлени/iu.test(trimmed);
  const definition = /^(?:what is|что такое)\s+[\p{L}\p{N}_.-]{1,50}[?]?$/iu;
  const typoQuestion = /^how do I fix a typo[?]?$/iu;
  return boundedEdit.test(trimmed) || boundedRussianEdit.test(trimmed) || boundedStatus ||
    definition.test(trimmed) || typoQuestion.test(trimmed);
}

function hasParallelValue(task, candidates, modes) {
  if (PARALLEL_VALUE_PATTERN.test(task)) return true;
  if (/\bindependent(?:\s+(?:bounded|read[ -]only|review)){0,4}\s+(?:lanes?|evidence packets?)\b/iu.test(task)) return true;
  return task.trim().length >= 220 && candidates.length >= 2 && modes.length >= 2;
}

function getFanoutDecision(options) {
  const task = options.task || "";
  const risk = options.risk || "LOW";
  const candidates = Array.from(new Set(options.candidates || []));
  const modes = Array.from(new Set(options.modes || []));
  const isExplicitReadOnly = NEGATED_MUTATION_PATTERN.test(task) ||
    (READ_ONLY_PATTERN.test(task) && !MUTATION_PATTERN.test(task));
  const isStateChanging = options.isStateChanging ??
    (MUTATION_PATTERN.test(task) && !isExplicitReadOnly);

  const optOutTask = task.replace(/\b(?:child|multiple)\s+agents\b/giu, "subagents")
    .replace(/(?:дочерн[\p{L}]*|нескольк[\p{L}]*)\s+агент[\p{L}]*/giu, "субагентов");
  if (OPT_OUT_PATTERN.test(optOutTask)) {
    return createDecision("skip", "explicit-user-opt-out", []);
  }
  if (options.availableSlots !== undefined &&
    (!Number.isSafeInteger(options.availableSlots) || options.availableSlots < 0)) {
    return createDecision("skip", "invalid-host-child-slots", []);
  }
  if (candidates.length === 0) {
    return createDecision("skip", "no-specialist-candidates", []);
  }
  if (isLikelySmallTask(task)) {
    return createDecision("skip", "xs-direct-task", []);
  }

  const ranked = rankCandidates(candidates, modes, options.priorityCandidates || []);
  const availableSlots = options.availableSlots === undefined
    ? AGENT_POLICY.fanout.maxChildren : options.availableSlots;
  // Required verification must not be displaced by a writable implementer.
  const needsVerification = (risk === "HIGH" || risk === "CRITICAL") && isStateChanging;
  const verifier = needsVerification && ranked[0] === "implementer" && ranked.find((name) =>
    /reviewer|tester/.test(name) && getAgentProfile(name)?.sandboxMode === "read-only");
  const ordered = verifier ? [verifier, ...ranked.filter((name) => name !== verifier)] : ranked;
  const selected = ordered.slice(0, Math.min(AGENT_POLICY.fanout.maxChildren, availableSlots));
  if (selected.length === 0) return createDecision("skip", "host-has-no-child-slots", [], ranked);
  if ((risk === "HIGH" || risk === "CRITICAL") && isStateChanging) {
    return createDecision("required", "high-risk-independent-verification", selected, ranked);
  }
  if (selected.includes("implementer") && options.workerContract) {
    const contract = validateWorkerContract(options.workerContract);
    const assignment = contract.role === "implementer" ? contract : contract.assignments?.implementer;
    if (assignment?.scope?.length && assignment?.acceptance?.length &&
        !assignment.integration && !assignment.strategy && isImplementationRequest(task)) {
      return createDecision("recommended", "bounded-implementation-delegation", selected, ranked);
    }
  }
  if (selected.length >= 2 && hasParallelValue(task, selected, modes)) {
    return createDecision("recommended", "parallel-independent-lanes-available", selected, ranked);
  }
  return createDecision("conditional", "parallel-value-not-yet-proven", selected, ranked);
}

function getDelegationDecision({
  task, workflowDepth, implementationRequested, implementationCandidate,
  writingAuthoringRequested = false, unresolvedArchitecture, blockEdits, risk, fanout, workerContracts, workerContract,
}) {
  const optOutTask = String(task || "").replace(/\b(?:child|multiple)\s+agents\b/giu, "subagents")
    .replace(/(?:дочерн[\p{L}]*|нескольк[\p{L}]*)\s+агент[\p{L}]*/giu, "субагентов");
  if (OPT_OUT_PATTERN.test(optOutTask)) {
    return { required: false, state: "skip", reason: "explicit-user-opt-out", nextAction: "Continue with the parent only, as requested.", candidateRoles: [] };
  }
  if (workflowDepth === "direct" || isLikelySmallTask(task)) {
    return { required: false, state: "skip", reason: "xs-direct-task", nextAction: "Complete the small task directly.", candidateRoles: [] };
  }
  if (!implementationRequested && !["HIGH", "CRITICAL"].includes(risk) &&
      isNarrowReadOnlyInspection(task)) {
    return { required: false, state: "skip", reason: "narrow-read-only-inspection", nextAction: "Complete the focused read-only inspection directly.", candidateRoles: [] };
  }

  let candidateRoles = [];
  if (implementationRequested) {
    if (blockEdits || unresolvedArchitecture) {
      return { required: false, state: "parent-owned", reason: blockEdits ? "change-strategy-blocks-writes" : "architecture-decision-required", nextAction: "Resolve the parent-owned decision gate before assigning implementation.", candidateRoles: [] };
    }
    if (!implementationCandidate || !fanout.candidates.some(({ name }) => name === "implementer")) {
      return { required: false, state: "parent-owned", reason: fanout.reason || "no-viable-implementer", nextAction: "Keep implementation with the parent under the active routing constraints.", candidateRoles: [] };
    }
    candidateRoles = ["implementer"];
  } else {
    const researchIntent = isResearchRequest(task);
    if (isImplementationRequest(task) || !researchIntent) {
      return { required: false, state: "skip", reason: "no-delegable-execution-or-research", nextAction: "Continue with the parent route.", candidateRoles: [] };
    }
    candidateRoles = fanout.candidates
      .filter(({ name }) => {
        const profile = getAgentProfile(name);
        return profile?.model === "gpt-6.1-terra" && profile.sandboxMode === "read-only";
      })
      .map(({ name }) => name);
    if (!candidateRoles.length) {
      return { required: false, state: "parent-owned", reason: "no-viable-terra-research-role", nextAction: "Keep research with the parent because no suitable read-only Terra role is available.", candidateRoles: [] };
    }
  }

  const contract = workerContract || {};
  const assignments = contract.assignments || {};
  const boundedRoles = candidateRoles.filter((role) => {
    const assignment = assignments[role] || (contract.role === role ? contract : {});
    return assignment.scope?.length && assignment.acceptance?.length &&
      !assignment.integration && !assignment.strategy;
  });
  if (boundedRoles.length) {
    const readyRoles = boundedRoles.filter((role) => workerContracts.some((worker) =>
      worker.role === role && worker.dispatch.ready));
    if (readyRoles.length) {
      return { required: true, state: "ready", reason: "bounded-worker-contract-and-host-capability-verified", nextAction: writingAuthoringRequested
        ? "Dispatch the Terra Medium implementer to write the scoped draft artifact; the parent integrates it, obtains the distinct writing_editor review, and routes required revisions back through the artifact."
        : "Dispatch a candidate using its returned call contract; keep integration and acceptance with the parent.", candidateRoles: readyRoles };
    }
  }

  const blocked = candidateRoles.find((role) => workerContracts.some((worker) =>
    worker.role === role && worker.dispatch.policyReason));
  if (blocked) {
    const policyReason = workerContracts.find((worker) => worker.role === blocked).dispatch.policyReason;
    return { required: false, state: "parent-owned", reason: policyReason, nextAction: "Keep the work with the parent until the routing policy gate is resolved.", candidateRoles: [] };
  }
  return {
    required: true,
    state: "prepare-contract",
    reason: "worker-scope-acceptance-or-host-capability-missing",
    nextAction: writingAuthoringRequested
      ? "Derive the exact request-scoped draft artifact, source/fact inputs and acceptance; reroute for the Terra Medium implementer to author it, then send that exact artifact to the distinct writing_editor and route revisions back through the artifact."
      : "Derive exact scope and acceptance from the task and repository, add evidence references and supported host dispatch capabilities, then reroute. Do not guess the worker scope.",
    candidateRoles,
  };
}

function isNarrowReadOnlyInspection(task) {
  const text = String(task || "");
  if (!READ_ONLY_PATTERN.test(text) || isImplementationRequest(text) || PARALLEL_VALUE_PATTERN.test(text) ||
      /\b(?:multiple|several|across|comprehensive|deep|independent)\b|нескольк[\p{L}]*|комплексн[\p{L}]*|глубок[\p{L}]*/iu.test(text)) {
    return false;
  }
  const filePaths = text.match(/(?:^|\s)(?:\.\.\/|\.\/)?[\w.-]+(?:\/[\w.-]+)*\.(?:[cm]?[jt]sx?|md|json|ya?ml|toml|py|go|rs|css|html)\b/giu) || [];
  if (filePaths.length === 1) return true;
  return /\b(?:one|single|this)\s+(?:file|document|module)\b|один\s+(?:файл|документ|модуль)/iu.test(text);
}

function rankCandidates(candidates, modes, priorityCandidates = []) {
  const priorityByMode = {
    security: ["security_reviewer", "tester"],
    openai: ["docs_researcher"],
    template: ["systems_reviewer", "tester"],
    migration: ["systems_reviewer", "tester"],
    bugfix: ["scout", "tester", "reviewer", "log_analyst"],
    testing: ["log_analyst", "tester", "reviewer"],
    docs: ["summarizer", "reviewer"],
    review: ["scout", "reviewer", "tester", "summarizer"],
    release: ["security_reviewer", "tester", "reviewer"],
    strategy: ["systems_reviewer", "product_reviewer"],
    product: ["product_reviewer"],
    "product-ux": ["product_reviewer", "design_reviewer"],
    design: ["design_reviewer"],
    "design-system": ["design_reviewer"],
  };
  const orderedModes = Object.keys(priorityByMode).filter((mode) => modes.includes(mode));
  const preferred = orderedModes.flatMap((mode) => priorityByMode[mode]);
  return Array.from(new Set([...priorityCandidates, ...preferred, ...candidates])).filter((name) =>
    candidates.includes(name),
  );
}

function createDecision(status, reason, candidates, inventory = candidates) {
  return {
    status,
    reason,
    candidates: candidates.map((name) => ({
      name,
      profile: getAgentProfile(name),
    })),
    candidateInventory: inventory.map((name) => name),
    maxChildren: AGENT_POLICY.fanout.maxChildren,
    maxDepth: AGENT_POLICY.fanout.maxDepth,
    maxAutomaticWaves: AGENT_POLICY.fanout.maxAutomaticWaves,
    notifyUser: AGENT_POLICY.fanout.notifyUser,
    readOnlyFirst: AGENT_POLICY.fanout.readOnlyFirst,
    requireRuntimeProfileEvidence: AGENT_POLICY.fanout.requireRuntimeProfileEvidence,
    writePolicy: AGENT_POLICY.fanout.writePolicy,
    independenceGate:
      "delegate useful bounded work without duplication; sequential implementation is valid; parallel writes require independent scopes",
  };
}

function formatAgentProfiles(candidates) {
  return candidates.map(({ name, profile }) => {
    if (!profile) return `${name}:project-defined`;
    return `${name}:${profile.model}@${profile.effort}`;
  });
}

function normalizeWriteScope(scope) {
  const normalized = String(scope || "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "");
  return normalized
    ? path.posix.normalize(normalized).replace(/\/$/, "").toLocaleLowerCase("en-US")
    : "";
}

function doScopesOverlap(left, right) {
  if (!left || !right) return false;
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function isUnsafeWriteScope(scope) {
  return scope === "." || scope === "/" || scope === ".." || scope.startsWith("../") ||
    path.posix.isAbsolute(scope) || /^[a-z]:/iu.test(scope) || /[?*\[\]{}]/u.test(scope);
}

function validateWriteAssignments(assignments = []) {
  const normalized = assignments.map(({ agent, files = [] }) => ({
    agent,
    files: files.map(normalizeWriteScope).filter(Boolean),
  }));
  const missingScopes = normalized
    .filter(({ files }) => files.length === 0)
    .map(({ agent }) => agent);
  const invalidScopes = normalized.flatMap(({ agent, files }) =>
    files.filter(isUnsafeWriteScope).map((scope) => ({ agent, scope })),
  );
  const conflicts = [];
  for (let left = 0; left < normalized.length; left += 1) {
    for (let right = left + 1; right < normalized.length; right += 1) {
      collectWriteConflicts(normalized[left], normalized[right], conflicts);
    }
  }
  return {
    isValid:
      missingScopes.length === 0 && invalidScopes.length === 0 && conflicts.length === 0,
    missingScopes,
    invalidScopes,
    conflicts,
  };
}

function collectWriteConflicts(left, right, conflicts) {
  for (const leftScope of left.files) {
    for (const rightScope of right.files) {
      if (doScopesOverlap(leftScope, rightScope)) {
        conflicts.push({
          agents: [left.agent, right.agent],
          scopes: [leftScope, rightScope],
        });
      }
    }
  }
}

module.exports = {
  AGENT_POLICY,
  EFFORT_LEVELS,
  MODEL_CAPABILITIES,
  formatAgentProfiles,
  getAgentProfile,
  getAgentProfiles,
  getDelegationDecision,
  getFanoutDecision,
  getResourceRecommendation,
  isLikelySmallTask,
  isImplementationRequest,
  isResearchRequest,
  stripFanoutOptOut,
  validateResourceRequest,
  validateWorkerContract,
  validateWriteAssignments,
};
