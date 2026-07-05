const INTENT_THRESHOLD = 2;

const INTENT_GROUPS = {
  api: [
    [/contract|schema|protocol|payload|request|response|integration/i, /контракт|схем|протокол|запрос|ответ|интеграц/i],
    [/consumer|client|backward compat|compatibility|versioned/i, /клиент|потребител|совместим|версир/i],
    [/status code|error shape|pagination|rate limit|field/i, /код.*статус|ошибк.*форм|пагинац|лимит|пол/i],
  ],
  bugfix: [
    [/stuck|hang|freeze|loop|blank|wrong|unexpected|does not/i, /завис|зацикл|бел\w*\s+экран|неверн|неожидан|не\s+может/i],
    [/after update|after deploy|after change|repro|steps|symptom/i, /после\s+обнов|после\s+релиз|после\s+депло|воспроиз|симптом/i],
    [/restore|recover|rollback|regress|worked before/i, /вернуть|откат|раньше\s+работ|регресс/i],
  ],
  design: [
    [/looks|visual|trust|polish|premium|cheap|clutter|hierarchy/i, /выгляд|довер|полиров|дешев|кустар|перегруж|иерарх/i],
    [/screen|page|surface|layout|state|empty|loading|error/i, /страниц|поверхност|состояни|пуст|загруз|ошибк/i],
    [/mobile|desktop|responsive|touch|viewport|overflow/i, /мобил|десктоп|адаптив|тап|вьюпорт|переполн/i],
  ],
  "design-system": [
    [/system|tokens|component|primitive|variant|storybook/i, /систем|токен|компонент|примитив|вариант|сторибук/i],
    [/spacing|typography|radius|motion|color|state/i, /отступ|типограф|радиус|скругл|движен|цвет|состояни/i],
    [/reuse|composition|contract|library|foundation/i, /переиспольз|композиц|контракт|библиотек|фундамент/i],
  ],
  docs: [
    [/explain|guide|manual|article|email|copy|message|wording/i, /объясн|инструкц|гайд|стат|письм|сообщен|формулиров|текст/i],
    [/reader|audience|tone|clarity|understand|rewrite/i, /читател|аудитор|тон|ясност|поня|перепиш/i],
    [/publish|readme|documentation|release note/i, /опублик|ридми|документац|релизн\w*\s+замет/i],
  ],
  feature: [
    [/enable|allow|support|add ability|new flow|capability/i, /возможност|разреш|поддерж|нов\w*\s+флоу|функц/i],
    [/user can|should be able|workflow|use case/i, /пользователь\s+может|должен\s+уметь|сценар|кейс/i],
    [/module|service|handler|screen|component/i, /модул|сервис|обработчик|экран|компонент/i],
  ],
  figma: [
    [/figma|design file|frame|prototype|mock/i, /фигм|макет|прототип|фрейм/i],
    [/sync|capture|code connect|inspect/i, /синхр|захват|инспект/i],
  ],
  lessons: [
    [/repeat|again|same mistake|postmortem|retro|lesson|promote/i, /повтор|снова|та\s+же\s+ошибк|постмортем|ретро|урок|вывод/i],
    [/rule|validator|template behavior|prevent next time|guard/i, /правил|валидатор|поведен|предотврат|защит/i],
    [/downstream|project experience|recent work/i, /даунстрим|проектн\w*\s+опыт|последн\w*\s+работ/i],
  ],
  marketing: [
    [/positioning|offer|value prop|why buy|message|claim/i, /позиционир|оффер|ценностн|почему\s+покуп|сообщен|месседж|обещан/i],
    [/funnel|journey|lead|campaign|channel|distribution|icp|segment|customer|buyer|user/i, /воронк|путь|лид|кампан|канал|дистрибуц|сегмент|аудитор|пользовател|клиент|покупател/i],
    [/cac|ltv|roas|conversion|revenue|retention|activation|purchase/i, /cac|ltv|roas|конверс|выруч|удержан|активац|покуп|деньг/i],
    [/proof|trust|brand|awareness|demand|sales/i, /доказател|довер|бренд|узнаваем|спрос|продаж/i],
  ],
  mermaid: [
    [/diagram|map|flow|board|architecture picture|sequence/i, /диаграм|карта|схем|поток|борд|последовательн/i],
    [/mermaid|mmd|graph|control board/i, /мермейд|граф|контрольн\w*\s+борд/i],
  ],
  migration: [
    [/move data|schema change|backfill|rollback|dry run|cutover/i, /перенос\w*\s+данн|измен\w*\s+схем|бэкфилл|откат|dry.?run|переключ/i],
    [/database|table|column|storage|migration/i, /баз\w*\s+данн|таблиц|колонк|хранилищ|миграц/i],
    [/compatibility|downtime|backup|restore/i, /совместим|простой|бэкап|восстанов/i],
  ],
  openai: [
    [/model|responses api|reasoning effort|structured outputs|tool calling/i, /модел|responses api|reasoning|структурн\w*\s+вывод|tool/i],
    [/openai|codex|gpt|api/i, /openai|codex|gpt|опенаи|апи/i],
    [/current|latest|docs|migration/i, /актуальн|последн|док|миграц/i],
  ],
  "product-goal": [
    [/outcome|goal|quality bar|done right|production ready|final/i, /исход|цель|планк\w*\s+кач|нормальн|продакшн|финал/i],
    [/revenue|retention|loyalty|activation|conversion|support load|kpi/i, /выруч|удержан|лояльн|активац|конверс|нагрузк\w*\s+поддерж|kpi|деньг/i],
    [/user value|customer value|business result|product owner|customer|user/i, /ценност\w*\s+польз|ценност\w*\s+клиент|бизнес.*результ|владелец\s+продукт|пользовател|клиент/i],
  ],
  "product-ux": [
    [/start|return|complete|continue|abandon|drop|stuck/i, /начина|возвращ|заверш|продолж|броса|отвалива|застрева/i],
    [/user path|journey|flow|entry|exit|dead end|next action/i, /путь\s+польз|сценар|флоу|вход|выход|тупик|следующ\w*\s+действ/i],
    [/session|account|login|dashboard|service|value/i, /сесси|аккаунт|логин|кабинет|сервис|ценност/i],
  ],
  release: [
    [/release|publish|tag|changelog|version bump|github release/i, /релиз|опубликов|выпуст|выкат|тег\b|подн\w*\s+верс|ченджлог/i],
    [/commit|push|remote|artifact|archive|asset/i, /коммит|пуш|remote|артефакт|архив|asset/i],
    [/verify release|workflow|tag points|latest release/i, /провер\w*\s+релиз|воркфлоу|tag.*указывает|latest\s+release/i],
  ],
  review: [
    [/evaluate|inspect|audit|critique|check|verify|assess/i, /провер|аудит|оцени|разбер|посмотр|инспект|верифиц/i],
    [/finding|risk|issue|gap|regression|evidence/i, /находк|риск|проблем|дыра|регресс|доказател/i],
  ],
  security: [
    [/unauthorized|credential|token|secret|private data|leak|exposure/i, /чуж\w*\s+данн|токен|секрет|приватн|утеч|экспоз/i],
    [/access|permission|impersonate|steal|bypass|inject/i, /доступ|прав|выдат|укра|обход|инъекц|получ/i],
    [/user data|account|session|auth|trust boundary/i, /данн\w*\s+польз|аккаунт|сесси|аутентиф|границ\w*\s+довер/i],
  ],
  strategy: [
    [/strategy|terrain|center of gravity|asymmetry|timing|constraint/i, /стратег|ландшафт|центр\s+тяжест|асимметр|тайминг|огранич/i],
    [/sun tzu|stratagem|art of war|competitive|alternative/i, /сунь|цзы|стратагем|конкурент|альтернатив/i],
    [/tradeoff|contradiction|triz|plan|roadmap|sequence/i, /компромисс|противореч|триз|план|роадмап|последовательн/i],
  ],
  template: [
    [/agent behavior|instruction|routing|context|source of truth|template/i, /поведен\w*\s+агент|инструкц|роутинг|контекст|источник\s+правд|шаблон/i],
    [/agents file|claude file|skill|subagent|hook|sync/i, /агентск\w*\s+файл|claude|скилл|сабагент|хук|синхрон/i],
    [/downstream|starter|release infrastructure|validator/i, /даунстрим|стартер|релизн\w*\s+инфраструктур|валидатор/i],
  ],
  testing: [
    [/coverage|assert|fixture|regression guard|test gap/i, /покрыт|ассерт|фикстур|регрессионн\w*\s+защит|тестов\w*\s+дыр/i],
    [/unit|integration|e2e|smoke|snapshot/i, /юнит|интеграц|e2e|смоук|снапшот/i],
    [/prove|verify behavior|quality gate/i, /доказ|провер\w*\s+поведен|гейт\s+кач/i],
  ],
};

function normalizeTask(task) {
  return task
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}#+./-]+/gu, " ")
    .trim();
}

function doesGroupMatch(group, normalizedTask) {
  return group.some((pattern) => pattern.test(normalizedTask));
}

function getIntentMatch(mode, task) {
  const groups = INTENT_GROUPS[mode] || [];
  const normalizedTask = normalizeTask(task);
  const matchedGroups = groups.filter((group) => doesGroupMatch(group, normalizedTask));
  const threshold = Math.min(INTENT_THRESHOLD, groups.length || INTENT_THRESHOLD);
  return {
    isMatch: matchedGroups.length >= threshold,
    score: matchedGroups.length,
    threshold,
  };
}

module.exports = {
  getIntentMatch,
  normalizeTask,
};
