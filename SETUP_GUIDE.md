# Как развернуть проект

> Версия: 2.5.1 | 2026-03-25
>
> При выпуске новой версии: перечитать этот файл, обновить устаревшие шаги,
> проверить все команды. Добавить в чеклист релиза.

---

## Что нужно

- **Claude Code** (CLI) — установлен и авторизован
- **Git** — установлен
- **Python 3** — для скриптов настройки
- **Bash** — на Windows через Git Bash или WSL

---

## Быстрый старт (5 минут)

```bash
git clone https://github.com/Yokhan/agent-project-template.git my-project
cd my-project
bash scripts/bootstrap-mcp.sh --install
claude
```

В чате Claude Code:
```
/setup-project
```

Готово. Отвечайте на вопросы — Claude настроит всё сам.

---

## Что делает каждый шаг

### 1. bootstrap-mcp.sh --install

Скрипт делает три вещи:
1. **Находит** установленные MCP-серверы (Engram, CodeGraphContext, Obsidian, Godot, Figma)
2. **Устанавливает** недостающие обязательные (Engram — Go binary, скачивает под вашу ОС)
3. **Создаёт** `.mcp.json` — файл, который Claude Code читает при запуске

Флаги:
```
--install     Установить недостающие серверы (Engram)
--check       Проверить, что всё работает
--zed         Также настроить Zed AI chat panel
--dry-run     Показать, что изменится, не трогая файлы
```

### 2. /setup-project

11 фаз автоматической настройки:
1. Спрашивает стек, название, тип проекта
2. Создаёт структуру папок
3. Настраивает линтер, форматтер, тесты
4. Создаёт документацию, шаблоны, reference
5. Заполняет CLAUDE.md
6. Генерирует агентские оверлеи под стек

---

## MCP-серверы

MCP-серверы — плагины, которые дают Claude дополнительные возможности.

| Сервер | Зачем | Обязателен? |
|--------|-------|-------------|
| **Engram** | Память между сессиями. Без неё Claude каждый раз начинает с нуля | **Да** |
| CodeGraphContext | Граф зависимостей кода. Полезен для проектов > 50 файлов | Нет |
| Obsidian MCP | Прямой доступ к Obsidian-хранилищу (brain/) | Нет |
| Godot | Управление Godot-проектами | Нет |
| Figma | Работа с Figma | Нет |

### Engram — обязательный сервер

Engram хранит контекст между сессиями. Все функции памяти шаблона идут через него.

**Автоустановка** (рекомендуется):
```bash
bash scripts/bootstrap-mcp.sh --install
```

**Ручная установка:**
1. Скачайте бинарник: https://github.com/Gentleman-Programming/engram/releases
2. Положите в PATH (`~/.local/bin/`)
3. Добавьте: `claude mcp add engram -- engram mcp`

**Что если Engram не установлен?**
Шаблон работает, но с ограничениями:
- Память пишется в файл `tasks/.memory-fallback.md` вместо БД
- Поиск по памяти работает через grep по файлам
- Когда Engram появится — записи импортируются из файла

---

## Claude Code vs Zed AI Chat

Это **два разных** способа работы с Claude. Конфиги у них разные.

| | Claude Code (CLI/терминал) | Zed AI Chat (панель) |
|---|---|---|
| Конфиг MCP | `.mcp.json` в корне проекта | `settings.json` в папке Zed |
| Формат | `mcpServers: {}` | `context_servers: {}` |
| Настройка | `bootstrap-mcp.sh` | `bootstrap-mcp.sh --zed` |

Если используете **Claude Code в терминале Zed** — это Claude Code, конфиг `.mcp.json`.
Если используете **встроенный чат Zed** — это Zed AI, конфиг `context_servers`.

Можно использовать оба одновременно:
```bash
bash scripts/bootstrap-mcp.sh --install --zed
```

---

## Проверка здоровья

```bash
bash scripts/bootstrap-mcp.sh --check
```

Проверяет:
- Engram установлен и отвечает
- `.mcp.json` валидный
- Zed настроен (если в Zed)

Расширенная проверка шаблона:
```bash
bash scripts/check-drift.sh
```

8 проверок: документы, размеры файлов, секреты, архитектура, шаблон.

---

## Хуки — что происходит автоматически

| Когда | Что делает |
|-------|-----------|
| Начало сессии | Создаёт лог, показывает задачи и уроки, проверяет Engram |
| Конец сессии | Записывает статистику |
| Перед сжатием контекста | Сохраняет снимок состояния |
| После редактирования | Форматирует код, проверяет размер и синтаксис |
| Перед редактированием | Блокирует правку main-ветки и секретов |

Хуки настроены в `.claude/settings.json`. Проект-специфичные хуки — в `.claude/settings.local.json`.

---

## Основные команды

```
/setup-project     — настройка (один раз)
/implement         — план → код → тесты
/sprint            — автономная работа по списку
/review            — ревью изменений
/commit            — коммит
/status            — здоровье проекта
/hotfix            — быстрый фикс
/retrospective     — анализ за неделю
/update-template   — обновить шаблон
```

---

## Обновление шаблона

### Один проект
```bash
bash scripts/sync-template.sh --from /path/to/agent-project-template
```

### Все проекты
```bash
bash scripts/sync-all.sh ~/Documents
```

Обновляет: `.claude/`, `scripts/`, `CLAUDE.md`.
Не трогает: `src/`, `docs/`, `brain/`, `tasks/`, `.mcp.json`.

---

## Структура после настройки

```
my-project/
├── .claude/           ← Агенты, правила, скиллы, хуки
├── .mcp.json          ← MCP-серверы (генерируется скриптом)
├── brain/             ← Obsidian-хранилище
├── tasks/             ← Текущая задача, очередь, уроки
├── docs/              ← Архитектура, API, схема данных
├── src/               ← Код
├── scripts/           ← Автоматизация
├── CLAUDE.md          ← Главный конфиг Claude
└── SETUP_GUIDE.md     ← Этот файл
```

---

## Если что-то не работает

| Проблема | Решение |
|----------|---------|
| Claude не видит MCP | `bash scripts/bootstrap-mcp.sh --check` |
| Engram не найден | `bash scripts/bootstrap-mcp.sh --install` |
| Zed не видит серверы | `bash scripts/bootstrap-mcp.sh --install --zed` |
| Хуки не работают | `bash scripts/test-hooks.sh` |
| Форматирование не работает | Установите: `npm i -g prettier` / `pip install black` |
| «Template outdated» | `/update-template` |
| Файл > 375 строк | Разбейте. 375 — лимит рабочей памяти Claude |
| lessons.md > 50 записей | `/retrospective` — правила промоутятся |
| `.mcp.json` битый | Удалите, запустите `bootstrap-mcp.sh` заново |
