"use strict";

const crypto = require("crypto");
const { classifyWritingIntent } = require("./writing-intent.js");
const { getAgentProfile } = require("../codex-agent-policy.js");

const CORE_CRITERIA = Object.freeze([
  { id: "meaning-purpose", label: "Meaning and purpose" },
  { id: "structure", label: "Structure and progression" },
  { id: "claims-value", label: "Claims, evidence, and reader value" },
  { id: "natural-language", label: "Natural language and idiom" },
  { id: "tone-rhythm", label: "Tone and rhythm" },
]);

const PLACEHOLDER_PATTERN = /^(?:x|y|tbd|todo|lorem ipsum|placeholder|n\/a|(?:criterion|finding|assessment)\s*\d+|pass|ok|fine|looks good|заполнитель|плейсхолдер|потом заполнить)[.!?\s]*$/iu;
const MATERIAL_CONTENT_PATTERN = /\b(?:substantive|material|full|complete|article|guide|manual|documentation|landing page|sales copy|campaign|book|chapter|scene|story|proposal|report|release notes?|email|announcement|support reply|rewrite|revise|draft|compose|create|write|edit|polish|ad|advertisement|letter|message)\b|существен|содержательн|полноценн|стат[ья]|гайд|руководств|инструкц|документац|лендинг|продающ|кампан|книг|глав[а-яё]*|сцен[а-яё]*|рассказ|предложен|отч[её]т|релизн[а-яё]*\s+замет|письм|объявлен|рекламн[а-яё]*|ответ[а-яё]*\s+поддерж|перепиш|доработ|созда|напиш|отредакт|улучш[а-яё]*\s+текст/iu;
const BRIEF_TASK_PATTERN = /\b(?:(?:brief|short|quick)\s+(?:(?:technical|status)\s+)?(?:status update|status explanation|explanation)|status update|status explanation|literal edit|typo|spelling|grammar only)\b|(?:кратко|коротко)\s+объясни|кратк(?:о|ий|ая|ое)\s+(?:(?:техническ|статусн)[а-яё]*\s+)?(?:объяснен|статус)|коротк(?:о|ий|ая|ое)\s+(?:(?:техническ|статусн)[а-яё]*\s+)?(?:объяснен|статус)|статусн(?:ое|ый)\s+(?:объяснен|сообщен)|только\s+(?:опечатк|орфограф|грамматик)|буквальн(?:ая|ый)\s+правк/iu;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function requiredText(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function artifactDigest(artifactBytes) {
  if (typeof artifactBytes !== "string" && !Buffer.isBuffer(artifactBytes) && !(artifactBytes instanceof Uint8Array)) {
    throw new Error("Exact artifact bytes are required");
  }
  return sha256(artifactBytes);
}

function readingBinding(packet, readingMap) {
  if (!packet && !readingMap) throw new Error("A reading packet or explicit reading-map record is required");
  const packetId = packet?.packetId || null;
  if (packet && (!/^[a-f0-9]{64}$/u.test(packetId || "") || packet.requestId == null)) {
    throw new Error("Reading packet requires a request-bound packetId");
  }
  const map = readingMap ?? packet?.readingPlan ?? (packet?.planId ? { planId: packet.planId } : null);
  if (!map) throw new Error("A reading-map identity is required");
  const packetSha256 = packet ? sha256(stableJson(packet)) : null;
  const mapSha256 = sha256(stableJson(map));
  return {
    packetId,
    packetSha256,
    mapSha256,
    sha256: sha256(stableJson({ packetId, packetSha256, mapSha256 })),
  };
}

function expectedSourceApplications(packet, readingMap) {
  const mappedTargets = readingMap?.targets || packet?.readerPlan?.targets || [];
  const targets = new Map();
  for (const target of mappedTargets) {
    if (!target.sourceId || !target.topicId) continue;
    const key = `${target.sourceId}\0${target.topicId}`;
    const current = targets.get(key) || { sourceId: target.sourceId, topicId: target.topicId, passageSha256s: [] };
    const matching = (packet?.passages || []).filter((passage) => passage.sourceId === target.sourceId &&
      (!target.locator || passage.locator === target.locator) && passage.topicIds?.includes(target.topicId));
    for (const passage of matching) if (!current.passageSha256s.includes(passage.passageSha256)) current.passageSha256s.push(passage.passageSha256);
    targets.set(key, current);
  }
  if (targets.size) return [...targets.values()];
  const sourceIds = packet?.selection?.sourceIds || packet?.coveredSourceIds || [...new Set((packet?.passages || []).map(({ sourceId }) => sourceId))];
  return [...new Set(sourceIds)].map((sourceId) => ({
    sourceId,
    topicId: null,
    passageSha256s: [...new Set((packet?.passages || []).filter((passage) => passage.sourceId === sourceId).map(({ passageSha256 }) => passageSha256))],
  }));
}

function isSmallMechanicalTask(task, intent) {
  const value = String(task || "").trim();
  if (/^(?:fix|correct|change|replace|capitalize|format|перепиши|исправь|замени|поправь|отформатируй)(?=\s|$)/iu.test(value) &&
      /(?:typo|spelling|grammar|capitalization|punctuation|one word|single word|одну опечатку|опечатк|орфограф|пунктуац|одно слово|только регистр)/iu.test(value)) return true;
  const authoredArtifact = /\b(?:ad|advertisement|letter|email|article|guide|manual|documentation|landing page|sales copy|chapter|proposal|report)\b|письм|объявлен|реклам|стать[яюи]|руководств|документац|лендинг|глав[ау]|предложен|отч[её]т|описан[а-яё]*\s+услуг/iu.test(value.split(/[:\n]/u)[0]);
  if (authoredArtifact) return false;
  if (BRIEF_TASK_PATTERN.test(value)) return true;
  return intent.action === "edit" && value.length < 110 && !MATERIAL_CONTENT_PATTERN.test(value);
}

function editorialPolicy(task, options = {}) {
  const intent = classifyWritingIntent(task);
  const discoveryOnly = /^(?:research|inspect|find|look up|изучи|найди|проверь|исследуй)(?=\s|$)/iu.test(String(task).trim()) &&
    !/\b(?:write|draft|compose|rewrite|edit)\b|напиши|составь|перепиши|отредактируй/iu.test(task);
  const reasons = [];
  let level = "self_check";
  if (options.optOut) {
    reasons.push("user-opt-out");
  } else if (options.explicitIndependent === true) {
    level = "independent";
    reasons.push("explicit-user-request");
  } else if (discoveryOnly || !intent.isWriting || !["create", "edit", "review", "plan"].includes(intent.action)) {
    reasons.push("not-a-writing-deliverable");
  } else if (isSmallMechanicalTask(task, intent)) {
    reasons.push("brief-or-mechanical-task");
  } else {
    level = "independent";
    reasons.push(intent.action === "edit" ? "material-rewrite" : "substantive-writing-deliverable");
  }
  if (level === "independent" && options.reviewerAvailable === false) {
    level = "unavailable";
    reasons.push("reviewer-unavailable");
  }
  return {
    level,
    independentRequired: level === "independent",
    selfCheckAllowed: level === "self_check",
    intent,
    reasons,
  };
}

function buildEditorialAssignment(input = {}) {
  const task = requiredText(input.task, "task");
  const requestId = requiredText(input.requestId, "requestId");
  const artifactSha256 = artifactDigest(input.artifactBytes);
  const reading = readingBinding(input.packet, input.readingMap);
  if (input.packet?.requestId && input.packet.requestId !== requestId) throw new Error("Reading packet requestId mismatch");
  const policy = editorialPolicy(task, input.policyOptions);
  if (policy.level !== "independent") throw new Error(`Independent editorial assignment is not required: ${policy.level}`);
  const criteria = [...CORE_CRITERIA];
  if (policy.intent.specializations.includes("technical")) {
    criteria.push({ id: "technical-accuracy", label: "Technical accuracy and procedural completeness" });
  }
  if (policy.intent.primaryMode === "marketing") criteria.push({ id: "offer-claims", label: "Offer, proof, and commercial claims" });
  if (policy.intent.primaryMode === "literary") criteria.push({ id: "narrative-function", label: "Narrative function, causality, and continuity" });
  const artifactText = Buffer.from(input.artifactBytes).toString("utf8");
  const packet = input.packet;
  const applications = expectedSourceApplications(packet, input.readingMap ?? packet?.readerPlan);
  const assignment = {
    schemaVersion: 1,
    kind: "writing-editorial-assignment",
    requestId,
    artifactSha256,
    packetId: reading.packetId,
    packetSha256: reading.packetSha256,
    readingMapSha256: reading.mapSha256,
    readingBindingSha256: reading.sha256,
    task,
    artifactText,
    artifactPurpose: input.artifactPurpose || policy.intent.primaryMode || "writing",
    outputLanguage: input.outputLanguage || policy.intent.outputLanguage || "unspecified",
    criteria,
    readingContext: {
      packetId: reading.packetId,
      sourceIds: [...new Set(packet?.passages?.map(({ sourceId }) => sourceId) || [])],
      passages: (packet?.passages || []).map(({ sourceId, title, locator, passageSha256, text }) => ({ sourceId, title, locator, passageSha256, text })),
      readingMap: input.readingMap ?? packet?.readerPlan ?? packet?.readingPlan ?? (packet?.planId ? { planId: packet.planId } : null),
      expectedTopics: applications.filter(({ topicId }) => topicId).map(({ sourceId, topicId }) => ({ sourceId, topicId })),
    },
    expectedSourceApplications: applications,
    responseContract: "Return one JSON review object as the exact final response, with no markdown fences. Assess every criterion against the supplied draft. Cite an exact excerpt and a useful location in each assessment. Findings must identify severity, the observed problem, its effect, and a concrete correction. Do not rewrite the draft before reporting findings. Do not identify yourself; the parent attaches reviewer identity and runtime evidence. Never approve by default.",
    reviewRecordShape: {
      schemaVersion: 1,
      kind: "writing-editorial-review",
      requestId,
      artifactSha256,
      packetId: reading.packetId,
      packetSha256: reading.packetSha256,
      readingMapSha256: reading.mapSha256,
      readingBindingSha256: reading.sha256,
      assignmentSha256: "copy assignmentSha256 from this assignment",
      assessments: [{ criterionId: "one assigned criterion id", outcome: "pass or finding", judgment: "specific criterion judgment", evidence: { location: "draft location", excerpt: "exact draft excerpt" } }],
      findings: [{ id: "unique id", criterionId: "assigned criterion id", severity: "critical, major, moderate, or minor", problem: "observed defect", impact: "reader or product effect", correction: "actionable correction", evidence: { location: "draft location", excerpt: "exact draft excerpt" } }],
      sourceApplications: [{ sourceId: "selected source id", topicId: "selected topic id when mapped; omit for legacy source-only packets", passageSha256: "exact current packet passage hash", principle: "paraphrased principle relevant to this topic", observedEffect: { criterionId: "assigned criterion id", effect: "specific effect visible in the draft", location: "draft location", excerpt: "exact draft excerpt" } }],
      decision: "pass, revision_required, or rejected",
    },
    grounding: {
      inspectPacketAndMap: true,
      russianEditorialProfile: policy.intent.outputLanguage === "ru" || policy.intent.outputLanguage === "mixed",
      reviewMeaningStructureClaimsNaturalnessToneRhythm: true,
      doNotInferQualityFromSchemaOrLength: true,
      sourceApplicationsAreRecordCompletenessNotSemanticProof: true,
    },
  };
  assignment.assignmentSha256 = sha256(stableJson(assignment));
  return assignment;
}

function substantive(value, name) {
  const text = requiredText(value, name);
  if (PLACEHOLDER_PATTERN.test(text)) throw new Error(`${name} is generic or placeholder text`);
  return text;
}

function verifyReviewEvidence(evidence, review, context) {
  if (!evidence || typeof evidence !== "object") throw new Error("Parent-verified reviewer evidence is required for an independent review");
  const requiredTrue = ["completedDistinctChild", "runtimeProfileCorrelated", "resultMatchesReview"];
  for (const key of requiredTrue) if (evidence[key] !== true) throw new Error(`Reviewer evidence missing ${key}`);
  const reviewerId = requiredText(evidence.reviewerId, "reviewerEvidence.reviewerId");
  const authorId = requiredText(evidence.authorId, "reviewerEvidence.authorId");
  if (reviewerId === authorId) throw new Error("Self-review cannot be accepted as independent");
  if (evidence.requestId !== context.requestId || evidence.artifactSha256 !== context.artifactSha256 ||
      evidence.readingBindingSha256 !== context.readingBindingSha256) throw new Error("Reviewer evidence binding mismatch");
  if (!/^[a-f0-9]{64}$/u.test(evidence.reviewSha256 || "") || evidence.reviewSha256 !== sha256(stableJson(review))) {
    throw new Error("Reviewer evidence does not match the exact review record");
  }
  const expectedProfile = getAgentProfile("writing_editor");
  if (evidence.reviewerRole !== "writing_editor") {
    throw new Error("Independent review requires an observed writing_editor child role");
  }
  if (!expectedProfile || evidence.model !== expectedProfile.model || evidence.effort !== expectedProfile.effort) {
    throw new Error("Correlated reviewer must match the writing_editor model and effort profile");
  }
  return { reviewerId, authorId, model: evidence.model, effort: evidence.effort };
}

function verifyEditorialReview(task, review, options = {}) {
  const requestId = requiredText(options.requestId, "requestId");
  const artifactSha256 = artifactDigest(options.artifactBytes);
  const reading = readingBinding(options.packet, options.readingMap);
  if (options.packet?.requestId && options.packet.requestId !== requestId) throw new Error("Reading packet requestId mismatch");
  if (!review || review.schemaVersion !== 1 || review.kind !== "writing-editorial-review") throw new Error("Unsupported editorial review record");
  if (review.requestId !== requestId) throw new Error("Review requestId mismatch");
  if (review.artifactSha256 !== artifactSha256) throw new Error("Draft changed or review belongs to another artifact");
  if (review.packetId !== reading.packetId || review.packetSha256 !== reading.packetSha256 ||
      review.readingMapSha256 !== reading.mapSha256 || review.readingBindingSha256 !== reading.sha256) {
    throw new Error("Review reading packet/map binding mismatch");
  }
  const assignment = buildEditorialAssignment({ task, requestId, artifactBytes: options.artifactBytes,
    packet: options.packet, readingMap: options.readingMap, artifactPurpose: options.artifactPurpose,
    outputLanguage: options.outputLanguage, policyOptions: { explicitIndependent: true } });
  const { assignmentSha256, ...assignmentBody } = assignment;
  if (assignmentSha256 !== sha256(stableJson(assignmentBody)) || review.assignmentSha256 !== assignmentSha256) {
    throw new Error("Review assignment or criteria mismatch");
  }
  const criterionIds = assignment.criteria.map(({ id }) => id);
  const assessments = review.assessments;
  if (!Array.isArray(assessments) || assessments.length !== criterionIds.length) throw new Error("Every assigned editorial criterion must be assessed exactly once");
  const seen = new Set();
  const text = Buffer.from(options.artifactBytes).toString("utf8");
  for (const assessment of assessments) {
    if (!criterionIds.includes(assessment.criterionId) || seen.has(assessment.criterionId)) throw new Error("Missing, duplicate, or unknown criterion assessment");
    seen.add(assessment.criterionId);
    if (!["pass", "finding"].includes(assessment.outcome)) throw new Error(`Invalid outcome for criterion ${assessment.criterionId}`);
    substantive(assessment.judgment, `Assessment ${assessment.criterionId} judgment`);
    const location = substantive(assessment.evidence?.location, `Assessment ${assessment.criterionId} location`);
    const excerpt = substantive(assessment.evidence?.excerpt, `Assessment ${assessment.criterionId} excerpt`);
    if (!text.includes(excerpt)) throw new Error(`Assessment ${assessment.criterionId} excerpt is not present in the exact draft`);
    if (location.length > 120 || PLACEHOLDER_PATTERN.test(location)) throw new Error(`Assessment ${assessment.criterionId} location is not concrete`);
  }
  const findings = review.findings;
  if (!Array.isArray(findings)) throw new Error("findings must be an array");
  const findingIds = new Set();
  for (const finding of findings) {
    if (!finding.id || findingIds.has(finding.id) || !["critical", "major", "moderate", "minor"].includes(finding.severity)) {
      throw new Error("Each finding needs a unique id and valid severity");
    }
    findingIds.add(finding.id);
    if (!criterionIds.includes(finding.criterionId) || !assessments.some(({ criterionId, outcome }) => criterionId === finding.criterionId && outcome === "finding")) {
      throw new Error(`Finding ${finding.id} is not tied to an observed criterion assessment`);
    }
    substantive(finding.problem, `Finding ${finding.id} problem`);
    substantive(finding.impact, `Finding ${finding.id} impact`);
    substantive(finding.correction, `Finding ${finding.id} correction`);
    const excerpt = substantive(finding.evidence?.excerpt, `Finding ${finding.id} excerpt`);
    substantive(finding.evidence?.location, `Finding ${finding.id} location`);
    if (!text.includes(excerpt)) throw new Error(`Finding ${finding.id} excerpt is not present in the exact draft`);
  }
  const findingAssessments = assessments.filter(({ outcome }) => outcome === "finding");
  for (const assessment of findingAssessments) {
    if (!findings.some(({ criterionId }) => criterionId === assessment.criterionId)) throw new Error(`Finding assessment lacks an actionable finding: ${assessment.criterionId}`);
  }
  const expectedApplications = expectedSourceApplications(options.packet, options.readingMap ?? options.packet?.readerPlan);
  const sourceApplications = review.sourceApplications;
  if (!Array.isArray(sourceApplications) || sourceApplications.length !== expectedApplications.length) {
    throw new Error("Every selected reading topic or legacy source must have one source application");
  }
  const applicationKeys = new Set();
  for (const application of sourceApplications) {
    const expected = expectedApplications.find(({ sourceId, topicId }) => sourceId === application.sourceId && (topicId || null) === (application.topicId || null));
    if (!expected) throw new Error(`Source application does not match a selected topic/source: ${application.sourceId}/${application.topicId || "legacy"}`);
    const key = `${application.sourceId}\0${application.topicId || ""}`;
    if (applicationKeys.has(key)) throw new Error("Duplicate source application for a selected topic/source");
    applicationKeys.add(key);
    if (!expected.passageSha256s.includes(application.passageSha256)) throw new Error(`Source application passage does not match the current packet: ${application.sourceId}/${application.topicId || "legacy"}`);
    const passage = options.packet?.passages?.find(({ sourceId, passageSha256 }) => sourceId === application.sourceId && passageSha256 === application.passageSha256);
    if (!passage) throw new Error(`Source application passage is absent from the current packet: ${application.sourceId}`);
    const principle = substantive(application.principle, `Source application ${key} principle`);
    if (passage.text?.includes(principle)) throw new Error(`Source application ${key} principle must be paraphrased in the editor's own words`);
    const effect = application.observedEffect;
    if (!effect || !criterionIds.includes(effect.criterionId)) throw new Error(`Source application ${key} must reference an assigned criterion`);
    substantive(effect.effect, `Source application ${key} observed effect`);
    substantive(effect.location, `Source application ${key} location`);
    const excerpt = substantive(effect.excerpt, `Source application ${key} excerpt`);
    if (!text.includes(excerpt)) throw new Error(`Source application ${key} excerpt is not present in the exact draft`);
  }
  if (!["pass", "revision_required", "rejected"].includes(review.decision)) throw new Error("Review decision must be pass, revision_required, or rejected");
  if (review.decision === "pass" && findings.length) throw new Error("A review with unresolved findings cannot pass");
  if (["revision_required", "rejected"].includes(review.decision) && findings.length === 0) throw new Error(`${review.decision} requires at least one actionable finding`);
  if (review.decision === "pass" && findings.some(({ severity }) => severity === "critical" || severity === "major")) {
    throw new Error("Critical or major findings cannot be passed");
  }
  if (review.decision === "pass" && ["revision_required", "rejected"].includes(options.previousReview?.decision) && options.previousReview.artifactSha256 === artifactSha256) {
    throw new Error("Unchanged problematic draft cannot be accepted as revised");
  }
  const provenance = verifyReviewEvidence(options.reviewerEvidence, review, {
    requestId, artifactSha256, readingBindingSha256: reading.sha256,
  });
  return {
    state: review.decision === "pass" ? "independent-review-passed" : review.decision,
    requestId,
    artifactSha256,
    packetId: reading.packetId,
    packetSha256: reading.packetSha256,
    readingMapSha256: reading.mapSha256,
    readingBindingSha256: reading.sha256,
    criterionCount: criterionIds.length,
    findingCount: findings.length,
    sourceApplicationCount: sourceApplications.length,
    reviewer: provenance,
    limit: "validates request/draft/reading bindings, complete evidence-shaped assessments, findings, verdict consistency, and parent-attested reviewer provenance; semantic quality remains the independent reviewer's judgment",
  };
}

module.exports = { editorialPolicy, buildEditorialAssignment, verifyEditorialReview, sha256, stableJson };
