# Глубокий Архитектурный Анализ Системы Плагинов Notehub.md

**Дата:** 07 февраля 2026  
**Автор:** Архитектурный анализ системы  
**Версия проекта:** 0.1.6

---

## Оглавление

- [I. Введение](#i-введение)
- [II. Текущая Архитектура](#ii-текущая-архитектура)
- [III. Анализ Сильных Сторон](#iii-анализ-сильных-сторон)
- [IV. Выявленные Ограничения](#iv-выявленные-ограничения)
- [V. Рекомендации по Улучшению](#v-рекомендации-по-улучшению)
- [VI. Дорожная Карта Внедрения](#vi-дорожная-карта-внедрения)
- [VII. Заключение](#vii-заключение)

---

## I. Введение

### Цель Анализа

Провести глубокое исследование архитектуры системы плагинов Notehub.md с целью выявления потенциальных улучшений, которые обеспечат **максимальную гибкость** и позволят разработчикам плагинов создавать практически любую функциональность.

### Контекст

Notehub.md — это расширяемая платформа для работы с заметками, построенная на принципах:
- **Микроядерной архитектуры**: ядро минимально, вся логика — в плагинах
- **Изоляции плагинов**: плагины не знают друг о друге напрямую
- **Contract-first**: интерфейсы определяются до реализации
- **Разделения Host/Guest**: платформозависимая логика (Flutter) отделена от бизнес-логики (React)

---

## II. Текущая Архитектура

### 2.1 Структура Монорепозитория

```
notehub.md/
├── packages/
│   ├── api/              # @notehub.md/api - публичный SDK для плагинов
│   ├── core/             # @notehub/core - микроядро
│   ├── cli/              # @notehub/cli - инструменты разработки
│   └── plugins/          # 37 встроенных плагинов
│       ├── system/       # 14 системных (bootloader, fs-manager, synapse...)
│       ├── features/     # 9 функциональных (editor, explorer, vault-picker...)
│       ├── ui/           # 7 UI компонентов (theme-manager, dialog-manager...)
│       └── portals/      # 3 портала (кастомные компоненты)
└── apps/
    ├── desktop/          # Tauri приложение
    └── capacitor/        # Capacitor (mobile)
```

### 2.2 Ядро: NotehubCore

**Файл**: [`packages/core/src/index.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/core/src/index.ts)

```typescript
class NotehubCore<TEvents extends EventMap = EventMap> {
    public readonly events: EventBus<TEvents>;  // Pub/Sub шина
    public readonly api: ApiBus;                 // RPC шина
    private pluginRegistry: Map<string, IPlugin>;
}
```

**Принципы работы:**
1. Регистрация плагинов через `registerPlugin(plugin)`
2. Загрузка через `Bootloader` (разрешение зависимостей, параллельная инициализация)
3. Два канала коммуникации:
   - **EventBus** — асинхронные события (`note:saved`, `config:changed`)
   - **ApiBus** — синхронные/асинхронные вызовы методов (`fs:read-file`, `editor:insert-text`)

### 2.3 Система Коммуникации

#### ApiBus — Регистрация и Вызов API

**Файл**: [`packages/core/src/buses/ApiBus.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/core/src/buses/ApiBus.ts)

**Ключевые возможности:**

```typescript
// Регистрация API метода
api.register<K extends ApiMethodName>(
    name: K,
    handler: (...args: ApiMethodArgs<K>) => ReturnType<NotehubApiMap[K]>
)

// Вызов API метода
api.invoke<K extends ApiMethodName>(
    method: K,
    ...args: ApiMethodArgs<K>
): Promise<ApiMethodAwaitedResult<K>>

// Система хуков (before/after/around)
api.hook('fs:write-text-file', 'before', async (args) => {
    args[1] = await formatMarkdown(args[1]);
    return args;
});
```

**Преимущества:**
- ✅ Полная типобезопасность через TypeScript
- ✅ Система хуков для перехвата и модификации вызовов
- ✅ Автоматическая очистка при выгрузке плагина

**Ограничения:**
- ⚠️ Все API должны быть заранее зарегистрированы в контракте
- ⚠️ Невозможно вызвать произвольный метод

#### EventBus — Pub/Sub Коммуникация

**Файл**: [`packages/core/src/buses/EventBus.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/core/src/buses/EventBus.ts)

```typescript
class EventBus<TEvents extends EventMap> {
    on<K extends keyof TEvents>(event: K, callback: EventCallback<TEvents[K]>)
    emit<K extends keyof TEvents>(event: K, payload?: TEvents[K])
    once<K extends keyof TEvents>(event: K, callback: EventCallback<TEvents[K]>)
}
```

**Преимущества:**
- ✅ Слабая связанность компонентов
- ✅ Асинхронная обработка событий
- ✅ Promise.allSettled — один сломанный обработчик не ломает всю цепочку

**Ограничения:**
- ⚠️ Нет приоритизации обработчиков
- ⚠️ Нет возможности отменить событие (cancelable events)

### 2.4 Интерфейсы Плагинов

#### Внутренние Плагины (IPlugin)

**Файл**: [`packages/core/src/types.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/core/src/types.ts)

```typescript
interface IPlugin {
    readonly manifest: PluginManifest;
    load(app: NotehubCore): Promise<void> | void;
    onReady?(app: NotehubCore): Promise<void> | void;
    unload(app: NotehubCore): Promise<void> | void;
}
```

Плагины имеют **полный доступ** к `NotehubCore`, включая `app.api`, `app.events`, `app.getPlugin()`.

#### Внешние Плагины (NotehubPlugin)

**Файл**: [`packages/api/src/plugin.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/api/src/plugin.ts)

```typescript
abstract class NotehubPlugin {
    abstract onload(ctx: PluginContext): Promise<void> | void;
    abstract onunload(): Promise<void> | void;
}

interface PluginContext {
    registerApi(name: string, handler: (...args: unknown[]) => unknown): void;
    invokeApi<T>(name: string, ...args: unknown[]): Promise<T>;
    subscribe<T>(event: string, handler: (payload: T) => void): void;
}
```

Внешние плагины получают **изолированный контекст** (`PluginContext`) без прямого доступа к ядру.

### 2.5 Bootloader — Оркестрация Загрузки

**Файл**: [`packages/plugins/system/bootloader/src/index.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/system/bootloader/src/index.ts)

**Основные задачи:**
1. Разрешение зависимостей между плагинами (граф зависимостей)
2. Параллельная загрузка плагинов без зависимостей
3. Обработка ошибок загрузки (failed/loaded/skipped)

```typescript
interface LoadablePlugin {
    manifest: PluginManifest;
    init: (app: NotehubCore) => Promise<void>;
}

const result = await api.invoke('bootloader.load', plugins);
```

**Преимущества:**
- ✅ Топологическая сортировка
- ✅ Параллелизм где возможно
- ✅ Детальная отчетность об ошибках

### 2.6 Synapse — Динамическая Загрузка

**Файл**: [`packages/plugins/system/synapse/src/logic/ScopeInitializer.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/system/synapse/src/logic/ScopeInitializer.ts)

**Назначение**: Загрузка внешних плагинов через SystemJS

**Механизм:**
1. Регистрация shared scope в SystemJS
2. Предоставление React, ReactDOM, @notehub/core, @notehub/api
3. Загрузка плагина из URL / Blob / файла

```typescript
// SystemJS делает доступными зависимости хоста
System.set('react', { ...React, default: React, __esModule: true });
System.set('@notehub/api', { ...NotehubApi, default: NotehubApi });

// Загрузка плагина
const module = await System.import('blob:...');
const PluginClass = module.default;
```

**Преимущества:**
- ✅ Плагины не бандлят React повторно (экономия памяти)
- ✅ Поддержка ESM модулей
- ✅ Blob URL для динамической компиляции

**Ограничения:**
- ⚠️ Проблемы с JSX runtime (`react/jsx-runtime` не мапится)
- ⚠️ Import map не работает из Blob URL в некоторых случаях

### 2.7 Контракт API (NotehubApiMap)

**Файл**: [`packages/api/src/contract.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/api/src/contract.ts) (840 строк, 66 типов)

**Структура:**
```typescript
interface NotehubApiMap {
    // File System
    'fs:read-file': (path: string) => Promise<Uint8Array>;
    'fs:write-text-file': (path: string, content: string) => Promise<void>;
    
    // Layout & Zones
    'layout:set-active': (name: string, props: Record<string, unknown>) => void;
    'zone:register': (zoneId: string, component: string, priority: number) => void;
    
    // Theme
    'theme:register': (id: string, palette: ThemePalette) => void;
    'theme:get-current': () => string;
    
    // Commands
    'command:register': (id: string, def: CommandDefinition) => void;
    'command:execute': (id: string, ...args: unknown[]) => Promise<void>;
    
    // ... ~50+ других API методов
}
```

**Ключевая особенность**: Централизованная спецификация **всех** доступных API.

---

## III. Анализ Сильных Сторон

### 3.1 Архитектура

| Аспект | Оценка | Комментарий |
|--------|--------|-------------|
| **Изоляция плагинов** | 9/10 | Отличное разделение внутренних/внешних плагинов |
| **Микроядро** | 10/10 | Ядро содержит только шины, вся логика в плагинах |
| **Contract-first** | 8/10 | Контракты определены, но жесткие |
| **Типобезопасность** | 10/10 | Полная поддержка TypeScript generics |
| **Загрузка плагинов** | 9/10 | Разрешение зависимостей, параллелизм |

### 3.2 Уникальные Преимущества

1. **Система хуков в ApiBus** — позволяет перехватывать вызовы методов (before/after/around), что уникально для такого типа архитектуры

2. **Автоматическая очистка** — все регистрации (API, события, подписки) автоматически удаляются при выгрузке плагина

3. **SharedScope через SystemJS** — внешние плагины получают те же инстансы React/Core, что и host (экономия памяти, отсутствие дублирования)

4. **Bootloader с графом зависимостей** — правильный порядок загрузки гарантирован

---

## IV. Выявленные Ограничения

### 4.1 Критические Ограничения

#### 🔴 Ограничение 1: Жесткий API Контракт

**Проблема**: Все методы должны быть заранее объявлены в `NotehubApiMap`. Это создает барьер:
- Плагин не может добавить новый API метод, который смогут вызывать другие плагины
- Невозможно расширить функциональность без изменения Core

**Пример кейса**:
Плагин "AI Assistant" хочет предоставить метод `ai:complete-text`. Другой плагин "Smart Editor" хочет использовать этот метод. **Сейчас это невозможно** без добавления типа в контракт Core.

**Влияние**: Снижает автономность разработчиков плагинов.

#### 🔴 Ограничение 2: Отсутствие "Escape Hatches"

**Проблема**: Нет способа обойти ограничения API для продвинутых сценариев.

**Примеры дефицита API**:
- 📝 **Editor API**: нет методов для манипуляции текстом (`editor:get-selection`, `editor:replace-selection`, `editor:insert-text`)
- 🎨 **DOM Access**: нет стабильных селекторов для UI элементов
- 🔧 **CodeMirror Access**: нет доступа к нативному EditorView

**Последствия**:
- Плагин для форматирования кода не может вставить текст
- Плагин для кастомных виджетов не может найти место для рендера
-плагин для custom decorations не может обратиться к CodeMirror напрямую

#### 🔴 Ограничение 3: JSX Runtime для Внешних Плагинов

**Проблема**: CLI создает плагины с `jsx: "react-jsx"`, но SystemJS не предоставляет `react/jsx-runtime`.

**Ошибка**:
```
Unable to resolve bare specifier 'react/jsx-runtime'
```

**Решение**: Требует либо изменения шаблона CLI, либо добавления import map для `react/jsx-runtime`.

### 4.2 Средние Ограничения

#### 🟡 Ограничение 4: Недокументированная Система Зон

**Проблема**: 
- Нет списка доступных Zone ID (`editor-footer`, `status-bar`, `sidebar-left`?)
- Нет визуальной схемы Layout
- Нет типизации зон в TypeScript

**Последствия**: Разработчик плагина не знает, "куда" он может встроить свой UI.

#### 🟡 Ограничение 5: Нет Приоритизации Событий

**Проблема**: EventBus обрабатывает подписчиков в порядке регистрации, но нельзя указать приоритет.

**Кейс**: Плагин валидации должен обработать событие `note:before-save` **раньше** плагина автосохранения.

#### 🟡 Ограничение 6: Нет Cancelable Events

**Проблема**: Невозможно отменить событие из подписчика.

**Кейс**: Плагин "Read-only Mode" хочет заблокировать событие `note:save`.

**Текущее решение**: Нужно использовать хук `before` на ApiBus, что неинтуитивно.

### 4.3 Минорные Ограничения

#### 🟢 Ограничение 7: Внутренние Плагины Имеют Полный Доступ

**Проблема**: `IPlugin` получает полный `NotehubCore`, что нарушает изоляцию.

**Риск**: Внутренний плагин может вызвать `app.getPlugin('другой-плагин')` и обратиться напрямую, минуя шины.

**Рекомендация**: Мигрировать внутренние плагины на `PluginContext`.

#### 🟢 Ограничение 8: CLI Конфигурация Vite Жесткая

**Проблема**: `nhp build` не позволяет переопределить `external` зависимости через пользовательский `vite.config.ts`.

**Кейс**: Плагин хочет использовать библиотеку, которая не входит в Core (например, `chart.js`).

---

## V. Рекомендации по Улучшению

### 5.1 Стратегия "Escape Hatches" (Максимальный Приоритет)

> **Принцип**: Когда Core API недостаточно, дайте разработчику доступ к "движку".

#### Рекомендация 1.1: Expose CodeMirror EditorView

**Добавить API метод:**
```typescript
'editor:unsafe_get-view': () => EditorView | null
```

**Обоснование**:
- Вместо добавления десятков методов (`insertText`, `replaceSelection`, `addDecoration`...), отдать сам объект CodeMirror
- Разработчик сможет использовать **любую** возможность CodeMirror
- Явная маркировка `unsafe_` предупреждает о ломающих изменениях

**Пример использования:**
```typescript
const view = await ctx.invokeApi<EditorView>('editor:unsafe_get-view');
if (view) {
    view.dispatch({
        changes: { from: pos, insert: "**bold**" }
    });
}
```

#### Рекомендация 1.2: Expose React UI Components

**Сделать доступным:**
```typescript
import { Button, Modal, Input, Card } from '@notehub/ui';
```

**Механизм**: Регистрация в SystemJS shared scope (уже частично реализовано в Synapse).

**Преимущества**:
- Плагины выглядят нативно
- Автоматическая поддержка тем
- Не нужно создавать свои компоненты

#### Рекомендация 1.3: Стабильные DOM Селекторы

**Добавить data-атрибуты:**
```html
<div data-nh-zone="editor-footer">
<div data-nh-zone="sidebar-left">
<div data-nh-zone="status-bar">
```

**API хелпер:**
```typescript
'dom:wait-for-zone': (zoneId: string) => Promise<HTMLElement>
```

**Кейс**: Плагин может найти зону и использовать `ReactDOM.createPortal` для рендера.

### 5.2 Динамический API Контракт

#### Рекомендация 2.1: Разрешить Регистрацию Собственных API

**Текущее состояние**: `ctx.registerApi(name, handler)` работает, но TypeScript не знает об этом API.

**Улучшение**: Разрешить плагинам расширять контракт:

```typescript
// В плагине AI
interface AiApiExtension {
    'ai:complete-text': (prompt: string) => Promise<string>;
    'ai:summarize': (text: string) => Promise<string>;
}

ctx.registerApiExtension<AiApiExtension>({
    'ai:complete-text': async (prompt) => { ... },
    'ai:summarize': async (text) => { ... }
});

// Другой плагин может использовать
const result = await ctx.invokeApi<string>('ai:complete-text', 'Hello');
```

**Альтернатива**: Использовать namespace для плагинов:
```typescript
'plugin:{plugin-id}:{method-name}': ...
```

#### Рекомендация 2.2: Улучшить Систему Хуков

**Добавить:**
1. **Middleware цепочки** — несколько плагинов могут обрабатывать один API
2. **Conditional hooks** — хук срабатывает только при условии
3. **Priority hooks** — контроль порядка выполнения

**Пример:**
```typescript
api.hook('fs:write-text-file', 'before', 
    { priority: 10, condition: (args) => args[0].endsWith('.md') },
    async (args) => { /* форматирование markdown */ }
);
```

### 5.3 Улучшение EventBus

#### Рекомендация 3.1: Cancelable Events

**Механизм:**
```typescript
interface CancelableEvent<T> {
    payload: T;
    preventDefault(): void;
    defaultPrevented: boolean;
}

emit<K extends keyof TEvents>(
    event: K, 
    payload: TEvents[K], 
    options?: { cancelable: boolean }
): Promise<{ prevented: boolean }>
```

**Использование:**
```typescript
const result = await events.emit('note:before-save', { noteId }, { cancelable: true });
if (result.prevented) {
    console.log('Save was cancelled by a plugin');
}
```

#### Рекомендация 3.2: Event Priorities

**Механизм:**
```typescript
on<K extends keyof TEvents>(
    event: K,
    callback: EventCallback<TEvents[K]>,
    options?: { priority: number } // default: 0, higher = earlier
)
```

### 5.4 Улучшение Документации и DX

#### Рекомендация 4.1: Визуальная Карта Зон

Создать интерактивную диаграмму UI с названиями всех зон:

```
┌─────────────────────────────────────┐
│  [titlebar]                         │
├──────────┬────────────────┬─────────┤
│ [sidebar]│  [editor]      │[panel]  │
│  -left   │   [header]     │ -right  │
│          │   [content]    │         │
│          │   [footer]     │         │
├──────────┴────────────────┴─────────┤
│  [status-bar]                       │
└─────────────────────────────────────┘
```

**Добавить команду разработчика**: `Show Zone IDs` — подсветка всех зон в runtime.

#### Рекомендация 4.2: TypeScript Enum для Зон

```typescript
export enum ZoneId {
    SIDEBAR_LEFT = 'sidebar-left',
    SIDEBAR_RIGHT = 'sidebar-right',
    EDITOR_HEADER = 'editor-header',
    EDITOR_FOOTER = 'editor-footer',
    STATUS_BAR = 'status-bar',
    TITLEBAR = 'titlebar',
}
```

#### Рекомендация 4.3: Исправить JSX Runtime

**Вариант А (быстрый)**: Изменить шаблон CLI
```typescript
// tsconfig.template.json
{
    "compilerOptions": {
        "jsx": "react", // вместо "react-jsx"
    }
}
```

**Вариант Б (правильный)**: Добавить `react/jsx-runtime` в SystemJS shared scope
```typescript
System.set('react/jsx-runtime', {
    jsx: React.createElement,
    jsxs: React.createElement,
    Fragment: React.Fragment
});
```

### 5.5 Дополнительные Editor API

**Добавить в контракт:**
```typescript
interface EditorApi {
    'editor:get-selection': () => string;
    'editor:replace-selection': (text: string) => void;
    'editor:insert-text': (text: string, offset?: number) => void;
    'editor:get-cursor': () => { line: number; ch: number };
    'editor:set-cursor': (line: number, ch: number) => void;
    'editor:get-line': (lineNumber: number) => string;
    'editor:replace-range': (from: Pos, to: Pos, text: string) => void;
}
```

### 5.6 Namespace "Unsafe" для Внутренних API

**Добавить:**
```typescript
interface UnsafeContext {
    app: NotehubCore;           // Полный доступ к ядру
    window: Window;              // Browser window
    fs: IFileSystem;             // Прямой доступ к FS без проверок
}

interface PluginContext {
    // ... существующие методы ...
    readonly unsafe: UnsafeContext;
}
```

**Маркировка**: `ctx.unsafe.*` явно показывает разработчику риски.

### 5.7 Мигрировать Внутренние Плагины на PluginContext

**Цель**: Унифицировать интерфейс, убрать прямой доступ к `NotehubCore`.

**План**:
1. Расширить `PluginContext` всеми необходимыми методами
2. Мигрировать системные плагины один за другим
3. Deprecated IPlugin интерфейс

**Преимущества**:
- Единая точка входа для всех плагинов
- Упрощение тестирования (можно мокировать `PluginContext`)
- Лучший контроль безопасности

---

## VI. Дорожная Карта Внедрения

### Фаза 1: Быстрые Победы (1-2 недели)

**Цель**: Устранить блокирующие проблемы для разработчиков плагинов.

- [ ] **P0**: Исправить JSX runtime проблему (Рекомендация 4.3)
- [ ] **P0**: Добавить базовые Editor API методы (Рекомендация 5.5)
- [ ] **P1**: Expose CodeMirror EditorView как `editor:unsafe_get-view` (Рекомендация 1.1)
- [ ] **P1**: Добавить стабильные data-атрибуты для зон (Рекомендация 1.3)
- [ ] **P2**: Создать TypeScript enum для ZoneId (Рекомендация 4.2)

### Фаза 2: Escape Hatches (2-4 недели)

**Цель**: Дать разработчикам "аварийные выходы" для продвинутых сценариев.

- [ ] **P0**: Expose React UI components в shared scope (Рекомендация 1.2)
- [ ] **P1**: Добавить `unsafe` namespace в PluginContext (Рекомендация 5.6)
- [ ] **P1**: Реализовать `dom:wait-for-zone` helper (Рекомендация 1.3)
- [ ] **P2**: Документация по использованию unsafe API

### Фаза 3: Динамический Контракт (4-6 недель)

**Цель**: Разрешить плагинам расширять API.

- [ ] **P0**: Поддержка регистрации собственных API с типами (Рекомендация 2.1)
- [ ] **P1**: Улучшенная система хуков с приоритетами (Рекомендация 2.2)
- [ ] **P1**: Механизм plugin-to-plugin API discovery
- [ ] **P2**: Runtime валидация API контрактов

### Фаза 4: EventBus 2.0 (6-8 недель)

**Цель**: Продвинутая система событий с приоритетами и отменой.

- [ ] **P1**: Cancelable events (Рекомендация 3.1)
- [ ] **P1**: Event priorities (Рекомендация 3.2)
- [ ] **P2**: Conditional event handlers
- [ ] **P2**: Event replay для debugging

### Фаза 5: Унификация (8-12 недель)

**Цель**: Привести все плагины к единому интерфейсу.

- [ ] **P1**: Расширение PluginContext для системных плагинов
- [ ] **P1**: Миграция 14 системных плагинов на PluginContext
- [ ] **P2**: Deprecated IPlugin интерфейс
- [ ] **P2**: Обновление документации

### Фаза 6: Developer Experience (Параллельно)

**Цель**: Упростить жизнь разработчикам плагинов.

- [ ] **P0**: Визуальная карта зон (Рекомендация 4.1)
- [ ] **P1**: Команда разработчика "Show Zone IDs"
- [ ] **P1**: Улучшение CLI (поддержка vite.config.ts)
- [ ] **P2**: Playground для тестирования плагинов онлайн
- [ ] **P2**: Автогенерация типов для plugin API

---

## VII. Заключение

### 7.1 Ключевые Выводы

1. **Архитектура в целом отличная**: Микроядро, изоляция плагинов, типобезопасность — все на высшем уровне.

2. **Основная проблема — жесткость**: API контракт заранее определен, нет способов обхода ограничений.

3. **Решение — "Escape Hatches"**: Дать доступ к "движку" (CodeMirror, React, DOM) для продвинутых сценариев.

4. **Приоритет — Developer Experience**: Быстрые победы (JSX fix, Editor API) разблокируют экосистему плагинов.

### 7.2 Метрики Успеха

После внедрения рекомендаций система должна обеспечить:

- ✅ **100% покрытие базовых сценариев** через Core API
- ✅ **80% покрытие продвинутых сценариев** через Escape Hatches
- ✅ **0 блокеров** для разработчиков плагинов
- ✅ **<1 час** времени от идеи до рабочего прототипа плагина
- ✅ **Plugin-to-plugin API** без изменения Core

### 7.3 Философия

> **"Ядро агностично; вся функциональность — это плагин."**
> 
> **"Плагины изолированы; коммуникация только через `ctx`."**
>
> **"Contract-first; но с escape hatches для свободы."**
> 
> **"Цель — свобода пользователя. Каждый компонент должен быть заменяемым."**

### 7.4 Следующие Шаги

1. **Обсудить приоритеты** с командой
2. **Создать GitHub Issues** для каждой рекомендации
3. **Начать с Фазы 1** (Quick Wins)
4. **Собрать feedback** от ранних разработчиков плагинов
5. **Итеративно улучшать** на основе реальных кейсов

---

## Приложения

### A. Глоссарий

- **Kernel** — `NotehubCore`, минимальное ядро системы
- **Plugin** — изолированный модуль с жизненным циклом load/unload
- **ApiBus** — шина для синхронных вызовов методов
- **EventBus** — шина для асинхронных событий
- **Escape Hatch** — способ обхода ограничений API для продвинутых сценариев
- **SystemJS** — загрузчик модулей для динамических плагинов
- **Shared Scope** — набор зависимостей, доступных всем плагинам

### B. Ссылки на Ключевые Файлы

- [NotehubCore](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/core/src/index.ts) — Ядро системы
- [ApiBus](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/core/src/buses/ApiBus.ts) — RPC шина
- [EventBus](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/core/src/buses/EventBus.ts) — Pub/Sub шина
- [PluginContext](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/api/src/context.ts) — Интерфейс для внешних плагинов
- [Bootloader](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/system/bootloader/src/index.ts) — Оркестрация загрузки
- [Synapse](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/system/synapse/src/logic/ScopeInitializer.ts) — Динамическая загрузка
- [API Contract](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/api/src/contract.ts) — Типы всех API методов

### C. Связанные Документы

- [EXTENSIBILITY_STRATEGIES_RU.md](file:///c:/Users/khton/sources/notehub.md_0.1.x/EXTENSIBILITY_STRATEGIES_RU.md) — Стратегии расширяемости
- [IMPROVEMENT_SUMMARY_RU.md](file:///c:/Users/khton/sources/notehub.md_0.1.x/IMPROVEMENT_SUMMARY_RU.md) — План улучшения DX

---

**Конец отчета**
