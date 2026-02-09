# Глубокий Архитектурный Обзор Notehub.md

**Дата:** 9 февраля 2026
**Ветка:** `capacitor/0.1`
**Версия:** 0.1.6
**Аналитик:** Claude Opus 4.6

---

## Оглавление

- [I. Цели Анализа](#i-цели-анализа)
- [II. Архитектурная Карта](#ii-архитектурная-карта)
- [III. Анализ Гибкости API](#iii-анализ-гибкости-api)
- [IV. Выявленные Проблемы (Новые)](#iv-выявленные-проблемы-новые)
- [V. Проблемы Масштабируемости](#v-проблемы-масштабируемости)
- [VI. Безопасность и Изоляция](#vi-безопасность-и-изоляция)
- [VII. Качество Кода](#vii-качество-кода)
- [VIII. Сравнение с Obsidian/Emacs](#viii-сравнение-с-obsidianemacs)
- [IX. Рекомендации](#ix-рекомендации)
- [X. Заключение](#x-заключение)

---

## I. Цели Анализа

Этот отчёт фокусируется на **гибкости API** для сторонних разработчиков и на **архитектурных проблемах**, которые могут помешать проекту достичь уровня расширяемости Emacs/Obsidian. В отличие от предыдущих отчётов, здесь проводится сквозной анализ — от байта в ядре до UX при создании плагина.

---

## II. Архитектурная Карта

### 2.1 Топология Монорепозитория

```
notehub.md_0.1.x/
├── packages/
│   ├── core/           ← Микроядро: EventBus + ApiBus + Plugin Registry (~600 LOC)
│   ├── api/            ← Публичный SDK: NotehubPlugin + PluginContext (~160 LOC)
│   ├── cli/            ← nhp CLI: create + build команды
│   └── plugins/
│       ├── system/     ← 12 системных (bootloader, fs-manager, synapse, keymap, ...)
│       ├── ui/         ← 8 UI (theme-manager, layout-manager, settings-manager, ...)
│       └── features/   ← 8+ функциональных (editor, explorer, vault-picker, ...)
├── apps/
│   ├── desktop/        ← Tauri (Windows/Mac/Linux) + Vite + React
│   └── capacitor/      ← Capacitor (Android/iOS) + Vite + React
├── scripts/            ← build-android-release, link-plugins, create-plugin
├── custom/plugins/     ← Папка для пользовательских плагинов (пока пуста)
└── artifacts/          ← Граф зависимостей (graph.mmd, graph.html)
```

### 2.2 Поток Данных при Загрузке

```
main.tsx (Host App)
  │
  ├── 1. new NotehubCore()          ← Создание ядра
  ├── 2. import plugin-registry.json ← JSON с манифестами всех плагинов
  ├── 3. switch(packageName) {...}   ← ❌ ЖЁСТКИЙ switch для каждого плагина
  ├── 4. core.registerPlugin(p)      ← Регистрация в реестре ядра
  ├── 5. new Bootloader(core)        ← Топологическая сортировка зависимостей
  ├── 6. bootloader.load(plugins)    ← Параллельная загрузка волнами
  └── 7. core.callOnReady()          ← Фаза "все загружены"
```

### 2.3 Двойственность Интерфейсов Плагинов

| | IPlugin (внутренний) | NotehubPlugin (внешний) |
|---|---|---|
| **Файл** | `core/src/types.ts` | `api/src/plugin.ts` |
| **Метод загрузки** | `load(app: NotehubCore)` | `onload(ctx: PluginContext)` |
| **Доступ к ядру** | Полный (`app.api`, `app.events`, `app.getPlugin()`) | Изолированный (`ctx.registerApi`, `ctx.invokeApi`, `ctx.subscribe`) |
| **Авто-очистка** | Ручная (boilerplate в `unload()`) | Автоматическая через `PluginContextImpl.cleanup()` |
| **Кто использует** | 28 встроенных плагинов | Внешние `.nhp` плагины |

---

## III. Анализ Гибкости API

### 3.1 Что Можно Сделать Прямо Сейчас (Сильные Стороны)

**Для внешних плагинов (`NotehubPlugin`) доступно:**

1. **Регистрация произвольных API** — `ctx.registerApi('my:method', handler)` работает, любой плагин может вызвать `ctx.invokeApi('my:method', ...args)`. Это **ключевое преимущество** — plugin-to-plugin коммуникация работает без изменений ядра.

2. **Система хуков (before/after/around)** — через `ctx.unsafe.hook()` можно перехватить любой API вызов. Поддержка приоритетов и условий.

3. **Полный Editor API** — 13 методов для работы с текстом, курсором, выделением. Плюс `editor:unsafe_get-view` для прямого доступа к CodeMirror.

4. **Зоновая система UI** — `zone:register` для внедрения компонентов в предопределённые области. `dom:wait-for-zone` для продвинутых сценариев с React Portals.

5. **Cancelable Events** — `EventContext.preventDefault()` и `stopPropagation()` с приоритетами.

6. **API Discovery** — `api:list`, `api:has`, `api:info` для runtime-интроспекции.

7. **Settings API** — плагины могут регистрировать вкладки, группы и элементы настроек через Settings Manager.

8. **Portal System** — `editor:register-portal` для регистрации inline-виджетов в редакторе через regex-матчинг.

9. **Command System** — `command:register` с контекстами, горячими клавишами и палитрой команд.

### 3.2 Критические Пробелы в Гибкости

#### Пробел 1: Нет Системы «Contribution Points» (Точек Расширения)

В Obsidian/VS Code плагины декларативно расширяют UI через «contribution points». В Notehub.md плагин **не может**:

- Добавить пункт в контекстное меню Explorer (без прямого вызова `context-menu:register`, которое нетипизировано для внешних плагинов)
- Добавить вкладку в боковую панель (Sidebar)
- Добавить свой тип файла в Explorer (сейчас жёстко `.md`)
- Зарегистрировать собственный «View» (альтернативный редактор для определённого типа файла)
- Добавить декоратор в строку состояния (status bar)

**Текущее состояние:** Зоновая система (`zone:register`) поддерживает это частично, но:
- Нет списка доступных Zone ID в типах (нет автодополнения)
- `ZoneId` enum определён, но не экспортирован в `@notehub.md/api`
- Нет `data-nh-zone` атрибутов в текущем рендере `LayoutManager` (обещано в отчёте о прогрессе, но не реализовано в коде `layout-manager/src/index.tsx:455` — там даже стоит `@ts-ignore`)

#### Пробел 2: Editor Заблокирован на Markdown

**`editor/src/index.tsx:258-260`:**
```typescript
if (!path.endsWith('.md')) {
    this.log('info', `Ignoring non-markdown file: ${path}`);
    return;
}
```

Плагин жёстко игнорирует все не-markdown файлы. Нет возможности:
- Зарегистрировать свой обработчик для `.json`, `.yaml`, `.csv`
- Расширить поддерживаемые форматы
- Создать альтернативный вид отображения

**Для Emacs-подобной гибкости нужен** механизм «file type handlers» или «view providers».

#### Пробел 3: Layout System Негибок

Текущий Layout Manager позволяет:
- Регистрировать layout-компоненты (`layout:register-component`)
- Переключать активный layout (`layout:set`)

**Чего не хватает:**
- Плагин не может **модифицировать** существующий layout (добавить панель, изменить пропорции)
- Нет «slot»/«panel» API для динамического добавления панелей
- Workbench layout жёстко определён в коде плагина `workbench`, а не как композиция зон

#### Пробел 4: Нет Системы Зависимостей между Внешними Плагинами

Внешние плагины (`.nhp`) не могут:
- Объявлять зависимости друг на друга в `manifest.json`
- Гарантировать порядок загрузки
- Проверять наличие других плагинов типизированно

**Текущий workaround:** `ctx.invokeApi('api:has', 'some-plugin:method')` — runtime проверка без типов.

#### Пробел 5: Нет Storage/Persistence API для Плагинов

Внешние плагины **не имеют** стандартного способа хранить данные. Нет:
- `ctx.storage.get(key)` / `ctx.storage.set(key, value)` — изолированное хранилище
- Плагин вынужден использовать `ctx.invokeApi('fs:write-text-file', ...)` и сам управлять путями

---

## IV. Выявленные Проблемы (Новые)

### 4.1 КРИТИЧЕСКИЕ

#### Проблема K1: Гигантский `switch` в `main.tsx` — Анти-Паттерн

**Файлы:** `apps/desktop/src/main.tsx:67-133`, `apps/capacitor/src/main.tsx:67-133`

Каждый встроенный плагин прописан в `switch(packageName)` вручную. При добавлении нового плагина нужно:
1. Создать пакет в `packages/plugins/`
2. Добавить в `plugin-registry.json` (через `scripts/link-plugins.ts`)
3. **Вручную** добавить `case` в `switch` **в каждом** хост-приложении (desktop + capacitor)

**Проблемы:**
- Дублирование: один и тот же `switch` с ~30 case повторяется в `desktop/src/main.tsx` и `capacitor/src/main.tsx` (отличие: `fs-driver-tauri` vs `fs-driver-capacitor`)
- Хрупкость: забыв добавить `case`, плагин молча не загрузится
- Немасштабируемость: при 100+ плагинах `switch` станет неуправляемым

**Рекомендация:** Использовать Vite `import.meta.glob` для автоматического обнаружения плагинов:
```typescript
const pluginModules = import.meta.glob('/../../packages/plugins/**/src/index.{ts,tsx}');
```
Или генерировать `switch` автоматически через `scripts/link-plugins.ts`.

#### Проблема K2: `IPlugin.load()` Принимает `any`

**Файл:** `core/src/types.ts:43`

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
load(app: any): Promise<void> | void;
```

Все три метода жизненного цикла (`load`, `onReady`, `unload`) типизированы как `any`. Комментарий объясняет: «to avoid circular generic dependencies». Но это **уничтожает** все преимущества TypeScript для 28 встроенных плагинов:
- Нет автодополнения при `app.api.invoke()`
- Нет проверки типов при `app.events.on()`
- Каждый плагин вынужден кастовать: `load(app: NotehubCore)`

**Рекомендация:** Использовать прямой импорт `NotehubCore` — циклическая зависимость между файлами одного пакета не проблема для TypeScript.

#### Проблема K3: EventBus Типизация — Иллюзия

**Файл:** `core/src/buses/EventBus.ts`

`EventBus<TEvents extends EventMap>` генерик выглядит типобезопасным, но:

1. **`NotehubCore` создаётся без generic:** `new NotehubCore()` → `EventBus<EventMap>` → `EventMap = Record<string, unknown>` → все события типизированы как `unknown`.

2. **Нигде нет централизованной карты событий.** В отличие от `NotehubApiMap` (которая является «конституцией» API), для событий нет аналога. Каждый плагин эмитит события с произвольными строковыми именами и произвольными payload'ами.

3. **`PluginContext.subscribe<T>` — ручной каст:** `ctx.subscribe<{ path: string }>('file:selected', handler)` — `T` не проверяется, разработчик может написать любой тип.

**Влияние:** Ошибки в payload'ах событий обнаруживаются только в runtime.

**Рекомендация:** Создать `NotehubEventMap` по аналогии с `NotehubApiMap`:
```typescript
export interface NotehubEventMap {
    'explorer:file-selected': { path: string };
    'editor:file-opened': { path: string; content: string };
    'config:reloaded': {};
    'fs:deleted': { path: string; isDirectory: boolean };
    'fs:renamed': { oldPath: string; newPath: string };
    // ...
}
```

#### Проблема K4: Отсутствие Обработки Ошибок в `ApiBus.invoke()`

**Файл:** `core/src/buses/ApiBus.ts:250-327`

`invoke()` **не ловит** ошибки из `before`/`around`/`after` хуков отдельно от основного хендлера. Если хук бросает исключение, весь вызов API падает. При этом:
- `before` хук мог уже модифицировать `args` — побочные эффекты не откатываются
- `around` хук мог уже выполнить часть работы
- Вызывающий код получает непредсказуемое исключение из чужого хука

**Рекомендация:** Оборачивать хуки в try-catch с логированием и опцией `continueOnError`.

### 4.2 ВЫСОКИЙ ПРИОРИТЕТ

#### Проблема V1: `PluginContextImpl` Не Передаёт Manifest из Файла

**Файл:** `synapse/src/logic/PluginLoader.ts:221`

```typescript
context = new PluginContextImpl(this.app, manifest.id);
```

Конструктор вызывается **без** `manifestInfo`, поэтому `ctx.manifest.name` всегда будет равен `pluginId`, а `ctx.manifest.version` — `'0.0.0'`. Данные из `manifest.json` (имя, версия) теряются.

**Исправление:** Передать манифест:
```typescript
context = new PluginContextImpl(this.app, manifest.id, {
    name: manifest.name,
    version: manifest.version
});
```

#### Проблема V2: `subscribe()` в `PluginContextImpl` Не Поддерживает `EventContext`

**Файл:** `synapse/src/logic/PluginContextImpl.ts:173-190`

```typescript
subscribe<T = unknown>(event: string, handler: (payload: T) => void): void {
    const callback = handler as (payload: unknown) => void;
    this.app.events.on(event, callback);
```

`EventBus.on()` ожидает `EventCallback<T> = (payload: T, context: EventContext) => void`, но `PluginContext.subscribe()` принимает `(payload: T) => void` — **без `EventContext`**.

Внешние плагины **не могут:**
- Отменить событие через `context.preventDefault()`
- Остановить пропагацию через `context.stopPropagation()`
- Использовать приоритеты (нет параметра `options` в `subscribe`)

Это делает **фазу 4 (EventBus 2.0) бесполезной для внешних плагинов**.

#### Проблема V3: Утечка Памяти в EditorPlugin при Переключении Файлов

**Файл:** `editor/src/index.tsx:115-116`

```typescript
app.events.on('editor:file-opened', handleFileOpened);
app.events.on('editor:file-closed', handleFileClosed);
```

Эти подписки создаются в `useEffect` компонента `EditorSlotWrapper`, но:
- При перемонтировании компонента (layout change) cleanup вызывается, OK
- Но `controller.subscribeSettings(setSettings)` в строке 119 создаёт подписку на контроллер, который живёт дольше компонента

Если `EditorSlotWrapper` перемонтируется, `setSettings` из старого рендера может пытаться обновить размонтированный компонент.

#### Проблема V4: `log()` Helper Во Всех Плагинах — Boilerplate

Каждый из 28 встроенных плагинов дублирует один и тот же паттерн:

```typescript
private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (this.app) {
        this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
    }
}
```

Это:
- ~10 строк × 28 плагинов = ~280 строк дублирования
- Шаблонный строковый литерал `` `logger:${level}` `` — потенциально не типобезопасен (typo → runtime error)
- `invoke()` возвращает Promise, который **игнорируется** (fire-and-forget) — если логгер не зарегистрирован, ошибка тихо проглатывается

### 4.3 СРЕДНИЙ ПРИОРИТЕТ

#### Проблема С1: 29 Использований `as any` в Коде

Распределение по файлам:

| Файл | Кол-во | Причина |
|---|---|---|
| `explorer/ExplorerController.ts` | 4 | Нетипизированные API вызовы |
| `synapse/PluginContextImpl.ts` | 3 | Перехват settings-регистраций |
| `floating-toolbar/index.tsx` | 3 | Нетипизированные компоненты |
| `context-menu/index.tsx` | 2 | Нетипизированные providers |
| `fs-driver-tauri/index.ts` | 2 | Tauri API несовместимости |
| Остальные | 15 | Разные причины |

Большинство `as any` — следствие того, что API контракт (`NotehubApiMap`) не покрывает все реально используемые методы.

#### Проблема С2: 6 Использований `@ts-ignore`

| Файл | Строка | Причина |
|---|---|---|
| `titlebar/TitleBarController.ts` | 94 | Tauri API |
| `fs-driver-capacitor/index.ts` | 103 | `directory: undefined` |
| `config-manager/index.ts` | 68, 76 | Tauri appDataDir/appConfigDir |
| `layout-manager/index.tsx` | 455 | Неизвестно (TODO?) |
| `context-manager/index.ts` | 315 | Tauri internals check |

Каждый `@ts-ignore` — потенциальная бомба при обновлении Tauri.

#### Проблема С3: Только 4 Тест-файла на Весь Проект

```
packages/plugins/features/editor/src/cm/portals/__tests__/PortalRegistry.test.ts
packages/plugins/features/editor/src/cm/portals/__tests__/PortalWidget.test.ts
packages/plugins/features/editor/src/cm/portals/__tests__/view-plugin.test.ts
packages/plugins/system/synapse/src/logic/__tests__/PluginContextImpl.test.ts
```

**Покрытие тестами:**
- Ядро (`NotehubCore`, `ApiBus`, `EventBus`) — **0 тестов**
- Bootloader — **0 тестов**
- FsManager — **0 тестов**
- EditorController — **0 тестов**
- Все 28 плагинов кроме portal и context — **0 тестов**

Это критически для проекта, претендующего на уровень Obsidian.

#### Проблема С4: 119 Прямых `console.log/warn/error` Вызовов

Многие модули используют `console.log` напрямую вместо Logger API. Это:
- Обходит систему логирования (уровни, фильтрация, форматирование)
- Не может быть перенаправлено в файл или UI
- Загрязняет консоль в production

Особенно заметно в `NotehubCore` (18 `console.log`) и `cli/commands` (61 вызов).

#### Проблема С5: Нет Механизма Версионирования API

`NotehubApiMap` не имеет версии. При обновлении API:
- Нет способа пометить метод как deprecated
- Нет семантического версионирования API
- Внешние плагины могут сломаться при обновлении ядра без предупреждения

---

## V. Проблемы Масштабируемости

### 5.1 `ApiBus` — Производительность при Большом Количестве Хуков

**Файл:** `core/src/buses/ApiBus.ts:256-270`

При каждом вызове `invoke()`:
1. Все хуки фильтруются через `Array.filter()` по 3 категориям
2. Каждая категория сортируется через `Array.sort()`
3. Для каждого хука проверяется `condition()` (потенциально async)

При N хуков на метод → O(N log N) на каждый вызов. Для часто вызываемых методов (например, `editor:get-content` при каждом нажатии клавиши) это может стать проблемой.

**Рекомендация:** Кэшировать отсортированные списки хуков, инвалидируя при добавлении/удалении.

### 5.2 `EventBus.on()` — Сортировка при Каждой Подписке

**Файл:** `core/src/buses/EventBus.ts:79-86`

```typescript
existing.push(record);
existing.sort((a, b) => b.priority - a.priority);
```

При каждом вызове `on()` весь массив пересортировывается. При 100+ подписчиках на событие → O(N log N) на каждую подписку.

**Рекомендация:** Использовать бинарную вставку (insertion sort) для добавления в уже отсортированный массив → O(N).

### 5.3 Дублирование Кода между Desktop и Capacitor

`apps/desktop/src/main.tsx` и `apps/capacitor/src/main.tsx` — ~95% идентичный код. Отличия:
- Строка 7: `import { open } from '@tauri-apps/plugin-shell'` vs отсутствие
- Строка 77-79: `@notehub/fs-driver-tauri` vs `@notehub/fs-driver-capacitor`

**Рекомендация:** Извлечь общую логику в пакет `@notehub/app-bootstrap`, параметризованный FS-драйвером.

---

## VI. Безопасность и Изоляция

### 6.1 Внешние Плагины Имеют Неограниченный Доступ

`PluginContextImpl` предоставляет:
- `registerApi(name, handler)` — **любое** имя, без namespace enforcement
- `invokeApi(name, ...args)` — вызов **любого** зарегистрированного метода
- `unsafe.hook(method, position, handler)` — перехват **любого** API

Злонамеренный плагин может:
1. Перехватить `fs:write-text-file` через `before` хук и модифицировать содержимое файлов
2. Перехватить `config:get` и подменить настройки
3. Зарегистрировать API с именем системного метода (если тот ещё не зарегистрирован)
4. Слушать все события (включая `fs:deleted`, `editor:file-opened`) для сбора данных

### 6.2 Нет CSP или Sandboxing для Внешних Плагинов

Внешние плагины загружаются через SystemJS и выполняются в **том же** контексте, что и хост:
- Полный доступ к `window`, `document`, `localStorage`
- Возможность загрузки произвольных скриптов
- Доступ к Tauri API через `window.__TAURI__`
- Нет ограничений на network requests (fetch/XHR)

### 6.3 Рекомендация: Уровни Доверия

```
Уровень 1 (Full Trust):   Встроенные плагины (IPlugin)
Уровень 2 (Sandboxed):    Внешние плагины (NotehubPlugin) — текущий уровень
Уровень 3 (Restricted):   Коммьюнити плагины — iframe/worker sandbox
```

Для MVP текущий подход приемлем, но для production нужен как минимум:
- Namespace enforcement: `ctx.registerApi('my-plugin-id:method')` — только свой namespace
- Permission system: плагин запрашивает доступ к `fs`, `network`, `settings`
- CSP headers в Tauri для ограничения fetch из плагинов

---

## VII. Качество Кода

### 7.1 Архитектурные Паттерны (Положительные)

| Паттерн | Реализация | Оценка |
|---|---|---|
| Microkernel | `NotehubCore` — ~222 LOC, только шины и реестр | 10/10 |
| Plugin Isolation | `PluginContextImpl` с auto-cleanup | 8/10 |
| Contract-First | `NotehubApiMap` — типизация API | 9/10 |
| Dependency Resolution | Bootloader с топологической сортировкой | 9/10 |
| Shared Dependencies | SystemJS scope с React, core, api | 8/10 |
| Hook System | Before/After/Around с приоритетами | 9/10 |

### 7.2 Code Smells

1. **Boilerplate в `unload()`**: Каждый встроенный плагин вручную вызывает `app.api.unregister(...)` для каждого зарегистрированного метода. 20-30 строк чистого boilerplate.

2. **Fire-and-forget `invoke()`**: Паттерн `app.api.invoke('logger:info', ...)` без `await` — Promise игнорируется. Если логгер упадёт, ошибка потеряется.

3. **Строковые литералы для API имён**: `'fs:read-text-file'`, `'editor:get-content'` — строки разбросаны по всему коду. Одна опечатка = runtime error. Нет enum/const для переиспользования.

4. **`EditorPlugin.load()` — 250+ строк**: Один метод регистрирует 18 API методов, команды, события. Нарушение SRP.

### 7.3 Положительные Аспекты Кода

1. **Отличная документация**: JSDoc комментарии на каждом публичном API, файловые заголовки с описанием архитектуры.

2. **Чистая иерархия зависимостей**: `core` → `api` → `plugins` — нет циклических зависимостей между пакетами.

3. **Корректная обработка FS**: `FsManager` с write locks для предотвращения race conditions.

4. **Graceful degradation**: Bootloader продолжает загрузку, если один плагин падает.

---

## VIII. Сравнение с Obsidian/Emacs

### 8.1 Что Есть у Obsidian, Чего Нет у Notehub

| Возможность | Obsidian | Notehub.md | Зазор |
|---|---|---|---|
| Plugin Marketplace | Есть (community plugins) | Нет | Большой |
| Custom Views | `registerView()` + `WorkspaceLeaf` | Нет аналога | Большой |
| File Type Handlers | `registerExtension()` | Жёстко `.md` | Критический |
| Ribbon Actions | `addRibbonIcon()` | `zone:register('ribbon', ...)` | Средний |
| Status Bar Items | `addStatusBarItem()` | Нет типизированного API | Средний |
| Settings Tab | `addSettingTab()` | `settings:register-tab` | ✅ Паритет |
| Command Palette | `addCommand()` | `command:register` | ✅ Паритет |
| Editor Extensions | CodeMirror ViewPlugin | `editor:register-portal` | Частичный |
| CSS Snippets | Поддержка `.css` файлов | Injection через NHP | Частичный |
| Plugin Dependencies | Через manifest + optional | Только для встроенных | Большой |
| Hot Reload | Ctrl+Shift+I → Console | Нет | Средний |
| Mobile Support | Official iOS/Android | Capacitor (в разработке) | Прогресс |

### 8.2 Что Есть у Emacs, Чего Нет у Обоих

| Возможность | Emacs | Notehub.md |
|---|---|---|
| Полная перепрограммируемость | Всё — функция | Ограничено API контрактом |
| REPL/Live Evaluation | `eval-expression` | Нет |
| Minor/Major Modes | Произвольные наборы keybinding | Только `context` в commands |
| Advice System | `defadvice` (before/after/around) | ✅ Hook System — близкий аналог |
| Buffer-local Variables | Состояние привязано к буферу | Нет |
| Customization Groups | Иерархия `defcustom` | `settings:register-group` |

### 8.3 Уникальные Преимущества Notehub.md

1. **Типобезопасность**: TypeScript контракты — то, чего нет ни у Obsidian (plain JS), ни у Emacs (Elisp)
2. **Cross-platform из коробки**: Tauri + Capacitor
3. **Микроядерная чистота**: Ядро — 222 LOC. Obsidian Core — закрытый монолит
4. **Hook System с приоритетами и условиями** — более мощный, чем Obsidian monkey-patching

---

## IX. Рекомендации

### Приоритет 0: Фундамент (Блокирующие для Экосистемы)

#### R1: Создать `NotehubEventMap`

Аналогично `NotehubApiMap`, определить все события с типизированными payload'ами. Это даст:
- Автодополнение при подписке
- Проверку типов payload'ов
- Документацию всех событий в одном месте

#### R2: Обновить `PluginContext.subscribe()` для поддержки `EventContext`

```typescript
subscribe<T = unknown>(
    event: string,
    handler: (payload: T, context: EventContext) => void,
    options?: { priority?: number }
): void;
```

Без этого вся работа над EventBus 2.0 бесполезна для внешних плагинов.

#### R3: Передавать manifest info в `PluginContextImpl`

Одна строка исправления, но важная для экосистемы — плагины должны знать свой name и version.

#### R4: Убрать `any` из `IPlugin` интерфейса

Заменить `load(app: any)` на `load(app: NotehubCore)`. Циклической зависимости нет — оба типа в одном пакете.

### Приоритет 1: Гибкость (Критично для Emacs-подобности)

#### R5: File Type Handler System

```typescript
'editor:register-handler': (config: {
    extensions: string[];
    viewFactory: (ctx: { path: string; content: string }) => React.ReactNode;
    priority?: number;
}) => void;
```

Позволит плагинам обрабатывать любые типы файлов.

#### R6: View/Panel Registration System

```typescript
'workspace:register-view': (config: {
    id: string;
    name: string;
    icon: string;
    factory: () => React.ReactNode;
    defaultLocation: 'left' | 'right' | 'bottom';
}) => void;
```

Позволит плагинам добавлять панели (backlinks, outline, git, terminal).

#### R7: Status Bar API

```typescript
'statusbar:add-item': (config: {
    id: string;
    component: React.FC;
    position: 'left' | 'right';
    priority?: number;
}) => () => void;
```

#### R8: Автоматическая Генерация `switch` в `main.tsx`

Скрипт `link-plugins` должен генерировать не только `plugin-registry.json`, но и файл с динамическими импортами, устраняя ручной `switch`.

### Приоритет 2: Качество

#### R9: Юнит-тесты для Ядра

Минимальный набор:
- `ApiBus`: register, invoke, hooks (before/after/around), priority, condition
- `EventBus`: on, emit, priority, preventDefault, stopPropagation
- `NotehubCore`: registerPlugin, init, shutdown
- `Bootloader`: dependency resolution, parallel loading, failure handling

#### R10: Базовый Класс для Встроенных Плагинов

```typescript
abstract class SystemPlugin implements IPlugin {
    protected app!: NotehubCore;
    abstract readonly manifest: PluginManifest;

    protected log(level: 'info' | 'warn' | 'error', msg: string) { ... }

    private _registeredApis: string[] = [];
    protected registerApi(name: string, handler: Function) {
        this.app.api.register(name, handler);
        this._registeredApis.push(name);
    }

    async unload() {
        this._registeredApis.forEach(n => this.app.api.unregister(n));
    }
}
```

Устранит ~280 строк boilerplate и риск забытого `unregister`.

#### R11: Извлечь Общий Bootstrap в Shared Package

Устранит дублирование между `desktop/main.tsx` и `capacitor/main.tsx`.

### Приоритет 3: Экосистема (Долгосрочное)

#### R12: Plugin Storage API

```typescript
interface PluginContext {
    storage: {
        get<T>(key: string): Promise<T | undefined>;
        set(key: string, value: unknown): Promise<void>;
        delete(key: string): Promise<void>;
        list(): Promise<string[]>;
    };
}
```

Реализация: `config-manager` + namespace по `pluginId`.

#### R13: Namespace Enforcement для Внешних Плагинов

API регистрация только с префиксом `pluginId:`:
```typescript
registerApi(name: string, handler: Function) {
    if (!name.startsWith(`${this.pluginId}:`)) {
        throw new Error(`API name must start with "${this.pluginId}:"`);
    }
    // ...
}
```

#### R14: Hot Reload для Разработки Плагинов

CLI `nhp dev` → watcher → автоматический `synapse:unload-plugin` + `synapse:load-plugin`.

---

## X. Заключение

### Что Хорошо

Notehub.md имеет **отличный архитектурный фундамент**:
- Чистое микроядро (222 LOC)
- Мощная система хуков (before/after/around с приоритетами и условиями)
- Contract-first подход с `NotehubApiMap`
- Автоматическая очистка ресурсов для внешних плагинов
- Работающая динамическая загрузка через SystemJS

### Что Мешает Стать «Emacs для Markdown»

1. **Event типизация** — иллюзия безопасности без `NotehubEventMap`
2. **Внешние плагины отрезаны** от ключевых возможностей EventBus 2.0 (нет `EventContext` в `subscribe()`)
3. **Editor заблокирован на `.md`** — нет file type handlers
4. **Нет View/Panel system** — плагины не могут добавлять панели
5. **Нет Storage API** — плагины не могут хранить данные
6. **Нет тестов** — 4 файла тестов на 28+ плагинов
7. **Ручной `switch` в host apps** — хрупкий, немасштабируемый

### Числовая Оценка Гибкости

| Аспект | Текущая | Цель (Obsidian) | Цель (Emacs) |
|---|---|---|---|
| API расширяемость | 7/10 | 9/10 | 10/10 |
| UI расширяемость | 4/10 | 8/10 | 9/10 |
| File type support | 2/10 | 8/10 | 10/10 |
| Plugin isolation | 6/10 | 8/10 | N/A |
| Developer Experience | 5/10 | 8/10 | 7/10 |
| Type safety | 6/10 | 9/10 | N/A |
| Test coverage | 1/10 | 7/10 | 8/10 |

### Итого

Проект находится на правильном пути. Ядро спроектировано грамотно. Основные инвестиции нужны в:
1. **Типизацию событий** (R1, R2, R4)
2. **Точки расширения UI** (R5, R6, R7)
3. **Тестирование** (R9)
4. **Developer Experience** (R8, R10, R11, R14)

---

*Конец отчёта*
