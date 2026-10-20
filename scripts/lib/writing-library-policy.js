"use strict";

const { defaultCatalog } = require("./writing-library-store.js");

const PATTERNS = {
  correspondence: /\b(?:email|letter|message|support reply|incident update|correspondence|negotiat\w*)\b|письм|переписк|сообщен|переговор|претензи|отклик/iu,
  social: /\b(?:social media|blog|content strategy|campaign|marketing|promotion|distribution)\b|соцсет|блог|контент|маркет|продвиж|реклам|дистрибуц/iu,
  game: /\b(?:game development|game business|game production|gamedev|game studio|commercial game|game release|game monetiz\w*)\b|геймдев|игр[а-яё]*\s+(?:как\s+бизнес|студи|бизнес|разработ|релиз|продаж)|коммерческ[а-яё]*\s+игр|(?:разработ|производств|релиз)[а-яё]*\s+игр/iu,
  project: /\b(?:project|roadmap|production|launch|release|business plan|architecture|migration)\b|проект|дорожн[а-яё]*\s+карт|план[а-яё]*\s+(?:разработ|производств|запуск|релиз)|производств|запуск|релиз|бизнес-план|архитектур|миграц/iu,
};

function selectLibrarySources(task, intent = {}, kind = "auto") {
  if (!["auto", "nonfiction", "fiction", "mixed", "code", "small-chat"].includes(kind)) throw new Error(`Unknown artifact kind: ${kind}`);
  const excluded = ["code", "small-chat"].includes(kind) || (kind === "auto" && !intent.isWriting);
  const fiction = kind === "fiction" || (kind === "auto" && intent.primaryMode === "literary");
  const applies = !excluded && !fiction;
  const matched = Object.fromEntries(Object.entries(PATTERNS).map(([id, pattern]) => [id, pattern.test(task)]));
  const artifactJob = String(task).split(/[:\n]/u)[0];
  const serviceOffer = /\b(?:service description|offer description|sales description)\b|описан[а-яё]*\s+услуг|рекламн[а-яё]*\s+объявлен/iu.test(artifactJob);
  const bookProductionPlan = /\b(?:novel publication|book production|publication plan)\b|(?:план|спланир)[а-яё]*[^.!?\n]{0,60}(?:работ[а-яё]*\s+над\s+роман|публикац|выпуск[а-яё]*\s+книг)/iu.test(task);
  const choices = {
    "write-short": [applies, "reader utility, truthful and concrete informational text"],
    "clear-understood": [applies, "reader context, explanation and distinction between facts and inference"],
    "business-correspondence": [applies && (intent.primaryMode === "communication" || matched.correspondence), "recipient action, context and boundaries"],
    "social-media": [applies && (intent.primaryMode === "marketing" || matched.social || serviceOffer), "business purpose, audience, distribution and meaningful metrics"],
    "game-as-business": [applies && matched.game, "commercial game/team/production decisions"],
    "project-resolution": [applies && (matched.project || matched.game || bookProductionPlan), "whole useful versions, uncertainty checks and acceptance"],
  };
  const applicability = defaultCatalog.sources.map(({ id }) => ({ id, relevant: choices[id][0], reason: choices[id][0] ? choices[id][1]
    : excluded ? "code-only or small-chat: no substantive writing artifact" : fiction ? "actual narrative artifact: informational editing method excluded; project planning remains separately in scope"
      : "not relevant to this artifact's reader job" }));
  return { kind: excluded ? (kind === "auto" ? "not-writing" : kind) : fiction ? "fiction" : kind === "mixed" ? "mixed" : "nonfiction",
    required: applies, sourceIds: applicability.filter(({ relevant }) => relevant).map(({ id }) => id), applicability };
}

module.exports = { selectLibrarySources };
