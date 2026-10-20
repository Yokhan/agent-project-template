#!/usr/bin/env node
"use strict";

const assert = require("assert");
const path = require("path");
const { defaultCatalog, sha256, libraryStatus } = require("./lib/writing-library-store.js");
const { readingMap, planReading, listReadingTopics, validateReadingMap } = require("./lib/writing-reading-plan.js");
const { retrievePlannedPacket, verifyApplication } = require("./lib/writing-library-retrieve.js");

function main() {
  const status = libraryStatus();
  const listed = listReadingTopics();
  assert.strictEqual(listed.state, "navigation-only");
  const sourceIds = defaultCatalog.sources.map(({ id }) => id).sort();
  assert.strictEqual(readingMap.schemaVersion, 1);
  assert.strictEqual(readingMap.catalogId, defaultCatalog.catalogId);
  assert.deepStrictEqual(Object.keys(readingMap.editions).sort(), sourceIds, "map carries one pinned text edition for each source");
  assert(readingMap.editions && Object.values(readingMap.editions).every((hash) => /^[a-f0-9]{64}$/u.test(hash)));
  for (const source of defaultCatalog.sources) assert.strictEqual(readingMap.editions[source.id], source.textSha256, `${source.id} edition map binding`);
  assert.deepStrictEqual([...new Set(listed.topics.map(({ sourceId }) => sourceId))].sort(), sourceIds);
  assert.strictEqual(new Set(listed.topics.map(({ id }) => id)).size, listed.topics.length, "topic identifiers are unique");
  assert(listed.topics.every(({ id, sourceId, label, question, locators }) => id && sourceIds.includes(sourceId) && label && question &&
    Array.isArray(locators) && locators.length > 0 && locators.every((locator) => typeof locator === "string" && locator.length > 0)),
  "every navigation topic has a source, editorial question, and locator");
  assert(listed.topics.every((topic) => !Object.hasOwn(topic, "text")), "map navigation must not copy book passages");

  const tasks = {
    complaint: "Напиши письмо-ответ клиенту на жалобу о задержке",
    explanation: "Объясни, как работает кэш",
    sales: "Напиши продающее описание услуги",
    project: "Напиши бизнес-план проекта миграции данных",
  };
  const plans = Object.fromEntries(Object.entries(tasks).map(([key, task]) => [key, planReading(task)]));
  const englishProjectTask = "Write a project migration guide";
  const englishPlan = planReading(englishProjectTask);
  assert.strictEqual(englishPlan.topics.length, new Set(englishPlan.topics.map(({ sourceId, id }) => `${sourceId}/${id}`)).size);
  for (const [key, plan] of Object.entries(plans)) {
    assert.strictEqual(plan.state, status.state === "ready" ? "ready" : "blocked", `${key} route state reflects local cache availability`);
    assert.deepStrictEqual(plan.topics.map(({ id }) => id), planReading(tasks[key]).topics.map(({ id }) => id), `${key} topic routing is deterministic`);
  }
  assert(plans.complaint.topics.some(({ id }) => id === "complaint-response"));
  assert(plans.complaint.topics.some(({ id }) => id === "reader-respect"));
  assert(plans.explanation.topics.some(({ id }) => id === "explanation-order"));
  assert(plans.explanation.topics.some(({ id }) => id === "facts-and-measures"));
  assert(plans.sales.topics.some(({ id }) => id === "sales-copy"));
  assert(plans.sales.topics.some(({ id }) => id === "context"));
  assert(plans.project.topics.some(({ id }) => id === "project-purpose"));
  assert(plans.project.topics.some(({ id }) => id === "complete-result"));
  const exampleTask = "Объясни с примером, как работает кэш";
  const examplePlan = planReading(exampleTask);
  assert(examplePlan.topics.some(({ id }) => id === "examples"));
  assert(!examplePlan.topics.some(({ id }) => id === "facts-and-measures"), "explicit example work selects the example section in place of generic evidence reading");
  const counterexampleTask = "Объясни на контрпримере, почему кэш не является базой данных";
  const counterexamplePlan = planReading(counterexampleTask);
  assert(counterexamplePlan.topics.some(({ id }) => id === "explain-from-both-sides"));
  assert(!counterexamplePlan.topics.some(({ id }) => id === "examples"));
  const bothExampleKindsTask = "Объясни пример и контрпример для кэша";
  const bothExampleKindsPlan = planReading(bothExampleKindsTask);
  assert(bothExampleKindsPlan.topics.some(({ id }) => id === "examples") && bothExampleKindsPlan.topics.some(({ id }) => id === "explain-from-both-sides"));
  const valueTask = "Напиши продающее описание услуги на 45–60 слов, сохрани пользу и преимущества для клиента при сокращении";
  const valuePlan = planReading(valueTask);
  assert(valuePlan.topics.some(({ id }) => id === "reader-value"));
  assert(valuePlan.topics.some(({ id }) => id === "sales-copy"));
  assert(valuePlan.topics.some(({ id }) => id === "basic-style-rhythm"));
  const gamePlan = planReading("Напиши план производства коммерческой игры");
  assert.strictEqual(gamePlan.state, status.state === "ready" ? "ready" : "blocked");
  assert(gamePlan.topics.some(({ id }) => id === "game-production-plan"));
  const prototypePlan = planReading("Напиши план вертикального среза коммерческой игры");
  assert(prototypePlan.topics.some(({ id }) => id === "game-vertical-slice"));
  for (const plan of Object.values(plans)) assert(plan.topics.some(({ id }) => id === "basic-style-rhythm"), "Russian nonfiction includes the basic style layer");
  assert.deepStrictEqual(plans.sales.topics.find(({ id }) => id === "basic-style-rhythm").locators, ["PDF page 182", "PDF page 183"]);
  assert.strictEqual(new Set(Object.values(plans).map(({ planSha256 }) => planSha256)).size, 4, "task-specific plans must differ");
  const missingStore = planReading(tasks.explanation, { root: path.join(__dirname, ".missing-writing-library-for-test") });
  assert.strictEqual(missingStore.state, "blocked");
  assert(missingStore.pendingTopics.length > 0);
  assert.throws(() => retrievePlannedPacket(tasks.explanation, { root: path.join(__dirname, ".missing-writing-library-for-test") }), /source-grounding-blocked/);

  if (status.state === "ready") {
    assert.strictEqual(validateReadingMap().state, "ready", "every mapped locator must resolve in its pinned local edition");
    const bothExampleKindsPacket = retrievePlannedPacket(bothExampleKindsTask);
    const bothExampleKindsCharacters = bothExampleKindsPacket.passages.reduce((sum, passage) => sum + passage.text.length, 0);
    assert(bothExampleKindsCharacters > 48000 && bothExampleKindsCharacters <= 96000,
      "the real example-and-counterexample plan that exceeds 48000 fits the 96000 default with complete sections");
    assert.throws(() => retrievePlannedPacket(bothExampleKindsTask, { maxCharacters: 48000 }), /packet budget cannot include complete planned section/,
      "an explicit 48000-character budget still blocks when it cannot cover all complete planned sections");
    assert.strictEqual(retrievePlannedPacket(bothExampleKindsTask, { maxCharacters: 96000 }).state, "retrieved-not-yet-applied",
      "the planned retrieval accepts the inclusive 96000-character ceiling");
    assert.throws(() => retrievePlannedPacket(bothExampleKindsTask, { maxCharacters: 96001 }), /3500\.\.96000/);
    const bothArtifact = Buffer.from("Example and counterexample task draft for the expanded reading packet.");
    const bothApplication = { requestId: bothExampleKindsPacket.requestId, packetId: bothExampleKindsPacket.packetId,
      artifactSha256: sha256(bothArtifact), principles: bothExampleKindsPacket.passages.map(({ sourceId, passageSha256 }) => ({
        sourceId, passageSha256, principle: "Explain by comparing a grounded example and counterexample.",
        effect: "The draft includes both complete mapped sections and keeps their claims tied to the source." })) };
    assert.strictEqual(verifyApplication(bothExampleKindsTask, bothExampleKindsPacket, bothApplication, bothArtifact,
      { requestId: bothExampleKindsPacket.requestId }).state, "application-record-verified",
    "the enlarged packet digest and source application remain verifiable");
    const valuePacket = retrievePlannedPacket(valueTask);
    assert(valuePacket.passages.reduce((sum, passage) => sum + passage.text.length, 0) <= 96000, "45–60 word value-preservation packet fits the default bound");
    const requestStartedAt = new Date(Date.now() - 1000).toISOString();
    const packet = retrievePlannedPacket(tasks.explanation, { plan: plans.explanation, requestId: "reading-plan-check", requestStartedAt });
    assert.strictEqual(packet.state, "retrieved-not-yet-applied");
    assert(packet.passages.every((passage) => passage.startCharacter === 0 && passage.endCharacter === passage.text.length), "planned retrieval includes complete selected sections");
    assert.strictEqual(packet.plannedCoverage.length, plans.explanation.targets.length);
    assert(packet.passages.reduce((sum, passage) => sum + passage.text.length, 0) <= 96000, "planned packet stays within its default bound");
    const artifact = Buffer.from("Explanation draft for the task-bound reading-plan check.");
    const application = { requestId: packet.requestId, packetId: packet.packetId, artifactSha256: sha256(artifact),
      principles: packet.passages.map(({ sourceId, passageSha256 }) => ({ sourceId, passageSha256,
        principle: "Explain the current idea with its evidence and dependencies.", effect: "The draft states the reader context and ordered explanation." })) };
    assert.strictEqual(verifyApplication(tasks.explanation, packet, application, artifact,
      { requestId: packet.requestId, requestStartedAt }).state, "application-record-verified");
    const englishPacket = retrievePlannedPacket(englishProjectTask, { requestId: "english-project-map", requestStartedAt });
    const englishApplication = { requestId: englishPacket.requestId, packetId: englishPacket.packetId, artifactSha256: sha256(artifact),
      principles: englishPacket.passages.map(({ sourceId, passageSha256 }) => ({ sourceId, passageSha256,
        principle: "Order the migration guide around the reader task.", effect: "The guide separates prerequisites, action and acceptance." })) };
    assert.strictEqual(verifyApplication(englishProjectTask, englishPacket, englishApplication, artifact,
      { requestId: englishPacket.requestId, requestStartedAt }).state, "application-record-verified");
    const queryPacket = retrievePlannedPacket(tasks.sales, { requestId: "reading-plan-query", query: "социальные сети аудитория",
      navigationSourceIds: ["social-media"] });
    assert.strictEqual(queryPacket.readerPlan.planSha256, plans.sales.planSha256, "query retrieval retains the required task plan");
    assert.strictEqual(queryPacket.plannedCoverage.length, plans.sales.targets.length, "query retrieval retains all planned topic coverage");
    assert(queryPacket.navigation.passageIds.length > 0, "a useful query hit is added as separate navigation context");
    assert(queryPacket.passages.some(({ navigationOnly }) => navigationOnly));
    const queryArtifact = Buffer.from("Sales draft with the retained task plan and a query-selected passage.");
    const queryApplication = { requestId: queryPacket.requestId, packetId: queryPacket.packetId, artifactSha256: sha256(queryArtifact),
      principles: queryPacket.passages.map(({ sourceId, passageSha256 }) => ({ sourceId, passageSha256,
        principle: "Use evidence for this task and reader.", effect: "The copy retains a supported claim and a clear next step." })) };
    assert.strictEqual(verifyApplication(tasks.sales, queryPacket, queryApplication, queryArtifact,
      { requestId: queryPacket.requestId }).state, "application-record-verified");

    const changedPlan = structuredClone(plans.explanation);
    changedPlan.targets.pop();
    assert.throws(() => retrievePlannedPacket(tasks.explanation, { plan: changedPlan }), /planned reading target mismatch/);
    const missingContext = structuredClone(packet);
    missingContext.passages = missingContext.passages.filter((passage) => !passage.topicIds.includes("context"));
    assert.throws(() => verifyApplication(tasks.explanation, missingContext, application, artifact,
      { requestId: packet.requestId, requestStartedAt }), /digest/);
    const planRemoved = structuredClone(packet);
    delete planRemoved.readerPlan;
    delete planRemoved.plannedCoverage;
    assert.throws(() => verifyApplication(tasks.explanation, planRemoved, application, artifact,
      { requestId: packet.requestId, requestStartedAt }), /digest/);
    const digestTamper = structuredClone(packet);
    digestTamper.readerPlan.targets[0].locator = "invented locator";
    assert.throws(() => verifyApplication(tasks.explanation, digestTamper, application, artifact,
      { requestId: packet.requestId, requestStartedAt }), /digest/);
    assert.throws(() => retrievePlannedPacket(tasks.sales, { maxCharacters: 3500 }), /packet budget cannot include complete planned section/);
    console.log("Writing reading plan: map structure and deterministic task routing passed; local primary-edition locator, packet, digest, and bound acceptance passed");
  } else {
    console.log(`Writing reading plan: map structure and deterministic task routing passed; SKIP local book acceptance (${status.issues.join("; ")})`);
  }
}

main();
