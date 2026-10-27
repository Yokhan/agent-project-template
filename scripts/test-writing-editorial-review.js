"use strict";

const assert = require("assert");
const { buildEditorialAssignment, verifyEditorialReview, editorialPolicy, sha256, stableJson } = require("./lib/writing-editorial-review.js");
const { getAgentProfile } = require("./codex-agent-policy.js");

const task = "Write a substantive Russian informational guide explaining the backup recovery procedure.";
const requestId = "editorial-request-1";
const artifact = "## Восстановление\nСначала проверьте резервную копию. Затем восстановите данные и сравните результат с исходным состоянием.";
const packet = { requestId, packetId: "a".repeat(64), passages: [{
  sourceId: "write-short", title: "Writing principles", locator: "PDF page 31", passageSha256: "b".repeat(64),
  text: "Сначала определите задачу читателя и расположите действия в понятном порядке.",
}] };
const readingMap = { planId: "writing-plan-1", selectedSourceIds: ["write-short"] };

function assignmentFor(bytes = artifact, selectedPacket = packet, selectedMap = readingMap) {
  return buildEditorialAssignment({ task, requestId, artifactBytes: bytes, packet: selectedPacket, readingMap: selectedMap });
}

function reviewFor(bytes = artifact, options = {}) {
  const selectedPacket = options.packet || packet;
  const selectedMap = options.readingMap || selectedPacket.readerPlan || readingMap;
  const assignment = assignmentFor(bytes, selectedPacket, selectedMap);
  const assessments = assignment.criteria.map(({ id }) => ({
    criterionId: id,
    outcome: options.finding && id === "claims-value" ? "finding" : "pass",
    judgment: options.finding && id === "claims-value" ? "The effect of this instruction is not demonstrated in the draft." : "The excerpt supports this criterion for the reader's stated task.",
    evidence: { location: "Section Восстановление, paragraph 1", excerpt: "Сначала проверьте резервную копию." },
  }));
  const findings = options.finding ? [{
    id: "claim-1", criterionId: "claims-value", severity: "major",
    problem: "The instruction says to compare the result but does not define what counts as a match.",
    impact: "The reader cannot decide whether recovery succeeded.",
    correction: "Name the fields or checksums that must match and state what to do when they differ.",
    evidence: { location: "Section Восстановление, paragraph 1", excerpt: "сравните результат с исходным состоянием" },
  }] : [];
  return {
    schemaVersion: 1,
    kind: "writing-editorial-review",
    requestId,
    artifactSha256: sha256(bytes),
    packetId: assignment.packetId,
    packetSha256: assignment.packetSha256,
    readingMapSha256: assignment.readingMapSha256,
    readingBindingSha256: assignment.readingBindingSha256,
    assignmentSha256: assignment.assignmentSha256,
    assessments,
    findings,
    sourceApplications: assignment.expectedSourceApplications.map((expected) => ({
      sourceId: expected.sourceId,
      ...(expected.topicId ? { topicId: expected.topicId } : {}),
      passageSha256: expected.passageSha256s[0],
      principle: "Arrange the explanation so the reader can act in dependency order.",
      observedEffect: {
        criterionId: "structure",
        effect: "The opening gives the reader a concrete first action before the later recovery steps.",
        location: "Section Восстановление, paragraph 1",
        excerpt: "Сначала проверьте резервную копию.",
      },
    })),
    decision: options.finding ? "revision_required" : "pass",
  };
}

function evidenceFor(review, authorId = "writer-parent", reviewerId = "child-writing-editor") {
  return {
    completedDistinctChild: true,
    runtimeProfileCorrelated: true,
    resultMatchesReview: true,
    reviewerId,
    reviewerRole: "writing_editor",
    authorId,
    model: getAgentProfile("writing_editor").model,
    effort: getAgentProfile("writing_editor").effort,
    requestId,
    artifactSha256: review.artifactSha256,
    readingBindingSha256: review.readingBindingSha256,
    reviewSha256: sha256(stableJson(review)),
  };
}

function verify(review, bytes = artifact, extra = {}) {
  return verifyEditorialReview(task, review, {
    requestId, artifactBytes: bytes, packet, readingMap,
    reviewerEvidence: evidenceFor(review),
    ...extra,
  });
}

assert.equal(editorialPolicy(task).level, "independent");
assert.equal(editorialPolicy("Give me a brief technical status explanation in two sentences.").level, "self_check");
assert.equal(editorialPolicy("Write a short technical status explanation for the team.").level, "self_check");
assert.equal(editorialPolicy("Кратко объясни, почему сборка не доказывает вход пользователя.").level, "self_check");
assert.equal(editorialPolicy("Write a short ad for a software product.").level, "independent");
assert.equal(editorialPolicy("Write a short support letter to a customer.").level, "independent");
assert.equal(editorialPolicy("Write a complete customer support letter with a short explanation of the migration.").level, "independent");
assert.equal(editorialPolicy("Напиши подробное руководство по миграции и краткое объяснение причин сбоя.").level, "independent");
assert.equal(editorialPolicy("Сократи описание услуги.").level, "independent");
assert.equal(editorialPolicy("Fix the typo in this one word.").level, "self_check");
assert.equal(editorialPolicy(task, { optOut: true }).level, "self_check");
assert.equal(editorialPolicy(task, { reviewerAvailable: false }).level, "unavailable");

const passed = reviewFor();
assert.equal(assignmentFor().artifactText, artifact);
assert.equal(assignmentFor().readingContext.passages[0].text, packet.passages[0].text);
assert.equal(verify(passed).state, "independent-review-passed");
const variableDraft = `${artifact}\nЗначение x равно 3.`;
assert.equal(verify(reviewFor(variableDraft), variableDraft).state, "independent-review-passed");

const revision = reviewFor(artifact, { finding: true });
assert.equal(verify(revision).state, "revision_required");
assert.equal(verify(revision, artifact, { previousReview: revision }).state, "revision_required");
assert.throws(() => verify(passed, artifact, { previousReview: revision }), /Unchanged problematic draft/);
assert.throws(() => verify(passed, artifact, { previousReview: { ...revision, decision: "rejected" } }), /Unchanged problematic draft/);

const changedArtifact = `${artifact}\nПри расхождении остановитесь и устраните причину перед повторной проверкой.`;
const updatedReview = reviewFor(changedArtifact);
assert.equal(verify(updatedReview, changedArtifact, { previousReview: revision }).state, "independent-review-passed");
assert.throws(() => verify(passed, changedArtifact), /Draft changed/);
assert.throws(() => verify(passed, artifact, { readingMap: { ...readingMap, planId: "changed-plan" } }), /reading packet\/map binding/);
assert.throws(() => verify(passed, artifact, { packet: { ...packet, passages: [] } }), /reading packet\/map binding/);

const missingCriterion = structuredClone(passed);
missingCriterion.assessments.pop();
assert.throws(() => verify(missingCriterion), /assessed exactly once/);

const missingSourceApplication = structuredClone(passed);
missingSourceApplication.sourceApplications = [];
assert.throws(() => verify(missingSourceApplication), /Every selected reading topic or legacy source/);

const wrongPassageApplication = structuredClone(passed);
wrongPassageApplication.sourceApplications[0].passageSha256 = "c".repeat(64);
assert.throws(() => verify(wrongPassageApplication), /passage does not match the current packet/);

const mappedPlan = { planId: "mapped-plan", targets: [
  { sourceId: "write-short", topicId: "reader-purpose", locator: "PDF page 31" },
  { sourceId: "write-short", topicId: "reader-purpose", locator: "PDF page 32" },
  { sourceId: "write-short", topicId: "step-order", locator: "PDF page 32" },
] };
const mappedPacket = { ...packet, packetId: "c".repeat(64), readerPlan: mappedPlan, passages: [
  { sourceId: "write-short", title: "Writing principles", locator: "PDF page 31", passageSha256: "d".repeat(64), topicIds: ["reader-purpose"], text: "Назовите конкретную задачу читателя." },
  { sourceId: "write-short", title: "Writing principles", locator: "PDF page 32", passageSha256: "e".repeat(64), topicIds: ["reader-purpose", "step-order"], text: "Ставьте действия в порядке их выполнения." },
] };
const mappedReview = reviewFor(artifact, { packet: mappedPacket, readingMap: mappedPlan });
assert.equal(mappedReview.sourceApplications.length, 2, "duplicate source/topic targets collapse to one application");
assert.equal(verify(mappedReview, artifact, { packet: mappedPacket, readingMap: mappedPlan }).sourceApplicationCount, 2);
const missingMappedTopic = structuredClone(mappedReview);
missingMappedTopic.sourceApplications.pop();
assert.throws(() => verify(missingMappedTopic, artifact, { packet: mappedPacket, readingMap: mappedPlan }), /Every selected reading topic or legacy source/);

const selfEvidence = evidenceFor(passed, "same-session", "same-session");
assert.throws(() => verifyEditorialReview(task, passed, {
  requestId, artifactBytes: artifact, packet, readingMap, reviewerEvidence: selfEvidence,
}), /Self-review/);

const mismatchedRequest = { ...passed, requestId: "old-request" };
assert.throws(() => verify(mismatchedRequest), /requestId mismatch/);

const genericAssessment = structuredClone(passed);
genericAssessment.assessments[0].judgment = "Looks good.";
assert.throws(() => verify(genericAssessment), /generic or placeholder/);

const fakeEvidence = evidenceFor(passed);
fakeEvidence.resultMatchesReview = false;
assert.throws(() => verifyEditorialReview(task, passed, {
  requestId, artifactBytes: artifact, packet, readingMap, reviewerEvidence: fakeEvidence,
}), /resultMatchesReview/);

for (const [model, effort] of [["gpt-6.1-sol", "high"], ["gpt-6-luna", "medium"], ["gpt-6.1-terra", "high"], ["unverified", "high"]]) {
  const wrongProfile = evidenceFor(passed);
  wrongProfile.model = model;
  wrongProfile.effort = effort;
  assert.throws(() => verifyEditorialReview(task, passed, {
    requestId, artifactBytes: artifact, packet, readingMap, reviewerEvidence: wrongProfile,
  }), /must match the writing_editor model and effort profile/);
}

for (const reviewerRole of ["implementer", "default", undefined]) {
  const wrongRole = { ...evidenceFor(passed), reviewerRole };
  assert.throws(() => verifyEditorialReview(task, passed, {
    requestId, artifactBytes: artifact, packet, readingMap, reviewerEvidence: wrongRole,
  }), /observed writing_editor child role/);
}

assert.equal(editorialPolicy("Research the GPT-5.6 release announcement and diagrams").level, "self_check");
assert.equal(editorialPolicy("Изучи объявления конкурентов без изменения текста").level, "self_check");
console.log("writing-editorial-review focused checks passed");
