# Анализ Сильных и Слабых Сторон Notehub.md v0.1.x

**Дата:** 18 февраля 2026  
**Версия проекта:** 0.1.6  
**Аналитик:** AI Code Review  
**Статус:** Черновик

---

## Оглавление

- [I. Резюме](#i-резюме)
- [II. Сильные Стороны](#ii-сильные-стороны)
- [III. Критика и Слабые Стороны](#iii-критика-и-слабые-стороны)
- [IV. Сравнение с Конкурентами](#iv-сравнение-с-конкурентами)
- [V. Рекомендации](#v-рекомендации)
- [VI. Заключение](#vi-заключение)

---

## I. Резюме

Notehub.md — это амбициозный проект с целью стать «Linux в мире заметок»: минималистичное ядро и бесконечно расширяемая экосистема плагинов. После глубокого анализа кодовой базы (56+ файлов отчётов, исходный код ядра, плагинов и приложений) выявлено:

| Категория | Оценка | Комментарий |
|-----------|--------|-------------|
| **Архитектура** | 9/10 | Микроядро, изоляция плагинов — отлично |
| **Типобезопасность** | 8/10 | TypeScript используется, но есть пробелы |
| **Безопасность** | 4/10 | Критические уязвимости в Tauri CSP |
| **Надёжность** | 5/10 | Race conditions, утечки памяти |
| **DX (Developer Experience)** | 6/10 | Хорошая база, но не хватает документации |
| **Мобильная поддержка** | 3/10 | Capacitor — незавершённая реализация |

**Ключевой вывод:** Архитектурно проект превосходен, но реализация содержит критические проблемы, которые блокируют стабильность и безопасность production-использования.

---

## II. Сильные Стороны

### 2.1 Архитектурные Преимущества

#### 🏆 Микроядерная Архитектура

**Ядро (`NotehubCore`) — ~236 строк кода**, содержит только:
- `EventBus` — pub/sub для событий
- `ApiBus` — RPC для вызова методов
- `PluginRegistry` — реестр плагинов

Вся функциональность (редактор, файловая система, темы, настройки) реализована в **27 плагинах**.

**Преимущества:**
- Стабильность: ядро не содержит бизнес-логики → меньше багов
- Расширяемость: любой компонент можно заменить плагином
- Тестируемость: ядро легко покрыть юнит-тестами

```typescript
// Пример чистоты архитектуры
const app = new NotehubCore();
app.registerPlugin(new LoggerPlugin());
app.registerPlugin(new EditorPlugin());
await app.init(); // Загрузка через Bootloader
```

#### 🏆 Двухшинная Коммуникация

Разделение каналов связи между плагинами:

| Шина | Назначение | Пример |
|------|------------|--------|
| **EventBus** | Асинхронные события (pub/sub) | `file:selected`, `config:changed` |
| **ApiBus** | Синхронные вызовы (RPC) | `fs:read-file`, `editor:insert-text` |

**EventBus** поддерживает:
- Приоритеты обработчиков
- `preventDefault()` / `stopPropagation()` (как в DOM)
- Асинхронные обработчики с `Promise.allSettled`

**ApiBus** поддерживает:
- Хуки `before`/`after`/`around` с приоритетами
- Условия срабатывания хуков
- Автоматическую очистку при выгрузке плагина

```typescript
// Хук для форматирования перед записью
api.hook('fs:write-text-file', 'before',
    { priority: 10, condition: (args) => args[0].endsWith('.md') },
    async (args) => {
        args[1] = await formatMarkdown(args[1]);
        return args;
    }
);
```

#### 🏆 Изоляция Плагинов

**Внутренние плагины** (`IPlugin`):
- Полный доступ к `NotehubCore`
- Используются для системных компонентов

**Внешние плагины** (`NotehubPlugin`):
- Получают изолированный `PluginContext`
- Не имеют доступа к внутренностям ядра
- Загружаются через **SystemJS** из `.nhp` файлов

**PluginContext** автоматически отслеживает:
- Зарегистрированные API методы
- Подписки на события
- Хуки
- Виджеты и настройки

При выгрузке плагина **всё очищается автоматически** — нет утечек памяти из-за забытых обработчиков.

#### 🏆 Bootloader с Разрешением Зависимостей

**Bootloader** строит граф зависимостей между плагинами:
- Топологическая сортировка
- Параллельная загрузка независимых плагинов
- Детекция циклических зависимостей
- Graceful degradation при отсутствии опциональных зависимостей

```typescript
// manifest.json
{
    "id": "nh.features.explorer",
    "dependencies": [
        "nh.system.fs-manager",
        "nh.ui.theme-manager"
    ]
}
```

#### 🏆 Contract-First Подход

**`NotehubApiMap`** (840 строк, 130+ методов) — централизованная типизация всех API:

```typescript
interface NotehubApiMap {
    'fs:read-file': (path: string) => Promise<Uint8Array>;
    'fs:write-text-file': (path: string, content: string) => Promise<void>;
    'editor:insert-text': (text: string, offset?: number) => void;
    'theme:register': (id: string, palette: ThemePalette) => void;
    'command:register': (id: string, def: CommandDefinition) => void;
    // ... 125+ других методов
}
```

**Преимущества:**
- Полная типобезопасность при вызовах
- Автодополнение в IDE
- Документация в одном месте

### 2.2 Технические Преимущества

#### 🎯 Hot-Reload Плагинов

**Synapse Engine** отслеживает изменения файлов плагинов:
- Автоматическая перезагрузка при сохранении
- Debounce для предотвращения множественных загрузок
- Сохранение состояния (опционально)

```typescript
// Плагин меняется → Synapse перезагружает
// app/api/plugins/my-plugin.nhp → сохранение → reload
```

#### 🎯 Shared Scope через SystemJS

Плагины **не бандлят React** повторно:
- Экономия памяти (один инстанс React на всё приложение)
- Плагины используют те же компоненты UI
- Автоматическая поддержка тем

```typescript
// SystemJS предоставляет зависимости
System.set('react', { ...React, default: React });
System.set('@notehub/api', { ...NotehubApi });
```

#### 🎯 Зоновая Система UI

**Layout Manager** определяет зоны для рендеринга:
- `sidebar-left`, `sidebar-right`
- `editor-header`, `editor-footer`
- `status-bar`, `titlebar`

Плагины регистрируют компоненты в зонах:
```typescript
ctx.invokeApi('zone:register', 'editor-footer', MyWidget, priority);
```

#### 🎯 Portal System для Редактора

**Inline-виджеты** в Markdown через regex:
```typescript
// {{progress-bar value=50}} → рендерится React-компонент
ctx.invokeApi('editor:register-portal', {
    pattern: /\{\{progress-bar value=(\d+)\}\}/,
    component: ProgressBarWidget
});
```

### 2.3 Экосистемные Преимущества

| Аспект | Реализация |
|--------|------------|
| **Кроссплатформенность** | Tauri (Desktop) + Capacitor (Mobile) |
| **Формат плагинов** | `.nhp` (NHP = Notehub Plugin) |
| **CLI для разработки** | `pnpm gen:plugin`, `nhp create/build` |
| **Лицензия** | AGPLv3 — защита от проприетарных форков |

---

## III. Критика и Слабые Стороны

### 3.1 🔴 КРИТИЧЕСКИЕ Проблемы (Блокируют Production)

#### Проблема 1: CSP Отключён в Tauri — XSS Уязвимость

**Файл:** `apps/desktop/src-tauri/tauri.conf.json:26`

```json
"security": {
    "csp": null,  // ← Content Security Policy отключён!
    "assetProtocol": {
        "enable": true,
        "scope": ["**/*"]  // ← Доступ ко ВСЕМ файлам системы
    }
}
```

**Влияние:**
- Злонамеренный плагин может выполнить произвольный JavaScript
- Asset protocol даёт доступ к `/etc/passwd`, `C:\Windows\System32`, и т.д.
- Возможны атаки через инъекции в Markdown

**Рекомендация:**
```json
"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
"assetProtocol": {
    "scope": ["$APPDATA/**", "$RESOURCE/**"]
}
```

**Приоритет:** **P0** — исправить немедленно.

---

#### Проблема 2: Race Conditions при Загрузке/Выгрузке Плагинов

**Файл:** `packages/plugins/system/synapse/src/logic/PluginLoader.ts:154-261`

```typescript
async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
    if (this.loadedPlugins.has(manifest.id)) {  // ← Проверка
        return { success: true, pluginId: manifest.id };
    }
    // ... длительная асинхронная загрузка (200+ строк) ...
    this.loadedPlugins.set(manifest.id, {...});  // ← Установка
}
```

**Проблема:** Между проверкой `has()` и установкой `set()` проходит асинхронное время. Два одновременных вызова `loadPlugin()` для одного плагина загрузят его **дважды**.

**Последствия:**
- Двойная регистрация API методов
- Утечки памяти
- Непредсказуемое поведение хуков

**Аналогично для `unloadPlugin()`:** если вызвать во время `loadPlugin()`, состояние станет некорректным.

**Рекомендация:** Ввести **мьютекс** (Mutex) или Map с промисами-блокировками для каждого pluginId.

**Приоритет:** **P0**.

---

#### Проблема 3: Асинхронный Cleanup Без Ожидания

**Файл:** `packages/plugins/system/synapse/src/logic/PluginContextImpl.ts:300-380`

```typescript
cleanup(): void {  // ← Синхронный метод!
    for (const widgetId of this.registeredWidgets) {
        this.app.api.invoke('editor:unregister-portal', widgetId)
            .catch(err => { ... });  // ← Promise не awaited!
    }
    for (const key of this.registeredSettingsItems) {
        this.app.api.invoke('settings:unregister-item', key)
            .catch(() => { });  // ← Promise не awaited!
    }
    this.disposed = true;  // ← Устанавливается ДО завершения вызовов
}
```

**Проблема:** `cleanup()` вызывается синхронно, но выполняет асинхронные операции без ожидания. Вызывающий код считает, что очистка завершена, но `invoke()` ещё выполняются.

**Последствия:**
- Неполная очистка ресурсов
- «Зомби»-виджеты и настройки
- Ошибки при повторной загрузке плагина

**Рекомендация:** Сделать `cleanup()` асинхронным, использовать `Promise.allSettled()`.

**Приоритет:** **P0**.

---

#### Проблема 4: Отсутствие Таймаута при Инициализации

**Файл:** `packages/core/src/index.ts:133-157`

```typescript
// Последовательная загрузка плагинов — БЕЗ таймаута!
for (const plugin of this.plugins) {
    await plugin.load(this);  // ← Может зависнуть бесконечно
}
```

**Проблема:** Если один плагин зависнет при загрузке, **всё приложение заблокировано навсегда**. Нет механизма:
- Таймаута (например, 30 секунд)
- Отмены загрузки
- Пропуска проблемного плагина

**Рекомендация:**
```typescript
for (const plugin of this.plugins) {
    await Promise.race([
        plugin.load(this),
        timeout(30000).then(() => {
            throw new Error(`Plugin ${plugin.id} load timeout`);
        })
    ]);
}
```

**Приоритет:** **P0**.

---

#### Проблема 5: Path Traversal Уязвимость

**Файлы:** `packages/plugins/system/fs-manager/src/index.ts`, `packages/plugins/system/synapse/src/logic/PluginLoader.ts`

```typescript
// Путь не проверяется на ../
const nhpPath = `${pluginsDir}/${entry.name}`;  // entry.name = "../../etc/passwd"
```

**Проблема:** Вредоносный плагин с `main: "../../etc/passwd"` может выйти за пределы vault-директории.

**Рекомендация:**
```typescript
const normalized = path.resolve(vaultPath, inputPath);
if (!normalized.startsWith(vaultPath)) {
    throw new Error('Path traversal detected');
}
```

**Приоритет:** **P0**.

---

### 3.2 🟠 ВЫСОКИЙ Приоритет (Влияют на Надёжность)

#### Проблема 6: Race Condition в Write Locks

**Файл:** `packages/plugins/system/fs-manager/src/index.ts:83-108`

```typescript
const existingLock = this.writeLocks.get(path);
const newLock = (async () => {
    if (existingLock) {
        await Promise.race([
            existingLock.catch(() => {}),
            timeout(WRITE_LOCK_TIMEOUT)
        ]);
    }
    await this.ensureDriver().writeFile(path, data);  // ← Параллельная запись!
})();
```

**Проблема:** Если предыдущая запись «зависла», таймаут позволяет начать новую запись **параллельно**. Это приводит к гонке данных и повреждению файлов.

**Рекомендация:** Использовать **promise-chaining**:
```typescript
const newLock = existingLock
    ? existingLock.then(() => writeFile())
    : writeFile();
```

**Приоритет:** **P1**.

---

#### Проблема 7: Утечка Event Listeners в CodeMirror

**Файл:** `packages/plugins/features/editor/src/cm/links/view-plugin.ts:60-65, 115-120`

`LinkWidget` и `WikiLinkWidget` добавляют event listeners в `toDOM()`, но CodeMirror может уничтожить декорации в любой момент (при вводе текста). Listeners **никогда не удаляются**.

**Последствия:** Постепенная деградация производительности, утечки памяти.

**Рекомендация:** Реализовать `destroy()` метод в виджетах для удаления listeners.

**Приоритет:** **P1**.

---

#### Проблема 8: Отсутствие Error Boundaries в React

Ни один feature-плагин не обёрнут в `<ErrorBoundary>`. Краш в одном плагине (Explorer, Editor, TabBar) уронит **всё React-дерево** приложения.

**Рекомендация:** Обернуть каждую зону рендеринга в ErrorBoundary с fallback UI.

**Приоритет:** **P1**.

---

#### Проблема 9: Hot-Reload с Произвольной Задержкой

**Файл:** `packages/plugins/system/synapse/src/index.tsx:206-216`

```typescript
await this.loader!.unloadPlugin(affectedPluginId);
await new Promise(resolve => setTimeout(resolve, 100));  // ← ПРОИЗВОЛЬНАЯ ЗАДЕРЖКА
await this.loadPluginByPath(sourcePath);
```

**Проблема:** 100мс — недетерминировано. На медленных дисках или при больших файлах недостаточно. Это классический **TOCTOU** (Time-of-Check-Time-of-Use).

**Рекомендация:** Использовать debounce на основе стабильности файла (отсутствие изменений).

**Приоритет:** **P1**.

---

#### Проблема 10: ZipLoader Повреждает Код при Переписывании Импортов

**Файл:** `packages/plugins/system/synapse/src/logic/ZipLoader.ts:132-153`

```typescript
private rewriteSpecifiers(js: string): string {
    for (const [bare, url] of map) {
        js = js.replaceAll(`"${bare}"`, `"${url}"`);  // ← Заменяет ВСЕ вхождения!
        js = js.replaceAll(`'${bare}'`, `'${url}'`);
    }
}
```

**Проблема:** Простой `replaceAll` заменяет все вхождения строк, включая:
- Внутри комментариев: `// import 'react'`
- Внутри строковых литералов: `const msg = "I love react";`
- Внутри URL: `https://cdn.example.com/react.min.js`

**Рекомендация:** Использовать regex с привязкой к `from "..."` / `from '...'`.

**Приоритет:** **P1**.

---

#### Проблема 11: Мобильная Адаптация Не Завершена

**Критические проблемы Capacitor:**

| Проблема | Файл | Влияние |
|----------|------|---------|
| Resize handle не поддерживает touch | `EditorLayout.tsx:61-71` | Невозможно изменить размер панелей |
| Safe area insets не учитываются | `NotificationContainer.tsx:90-100` | UI попадает под notch iPhone |
| Кнопки слишком мелкие (<44px) | `Button.tsx:29-34` | Не соответствуют WCAG |
| File watcher не реализован | `fs-driver-capacitor:247-249` | Explorer не обновляется |
| Нет try-catch в `removeFile/rename` | `fs-driver-capacitor:252-277` | Падения при ошибках FS |

**Приоритет:** **P1** для мобильной версии.

---

#### Проблема 12: `IPlugin.load()` Принимает `any`

**Файл:** `packages/core/src/types.ts:43`

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
load(app: any): Promise<void> | void;
```

Все методы жизненного цикла типизированы как `any` — это **уничтожает преимущества TypeScript** для 28 встроенных плагинов.

**Рекомендация:** Импортировать `NotehubCore` напрямую — циклической зависимости нет.

**Приоритет:** **P1**.

---

### 3.3 🟡 СРЕДНИЙ Приоритет (Технический Долг)

#### Проблема 13: Гигантский `switch` в `main.tsx`

**Файлы:** `apps/desktop/src/main.tsx:67-133`, `apps/capacitor/src/main.tsx:67-133`

Каждый из 27 плагинов прописан в `switch(packageName)` **вручную**. При добавлении нового плагина нужно:
1. Создать пакет
2. Добавить в `plugin-registry.json`
3. **Вручную** добавить `case` в **два** файла (desktop + capacitor)

**Проблемы:**
- Дублирование кода
- Хрупкость: забыл `case` → плагин молча не загрузится
- Немасштабируемость: при 100+ плагинах `switch` станет неуправляемым

**Рекомендация:** Использовать Vite `import.meta.glob` для автоматического обнаружения.

**Приоритет:** **P2**.

---

#### Проблема 14: 29 Использований `as any` в Коде

Распределение:
- `explorer/ExplorerController.ts` — 4
- `synapse/PluginContextImpl.ts` — 3
- `floating-toolbar/index.tsx` — 3
- Остальные — 19

Большинство `as any` — следствие того, что API контракт не покрывает все используемые методы.

**Приоритет:** **P2**.

---

#### Проблема 15: 6 Использований `@ts-ignore`

| Файл | Причина |
|------|---------|
| `titlebar/TitleBarController.ts:94` | Tauri API |
| `fs-driver-capacitor/index.ts:103` | `directory: undefined` |
| `config-manager/index.ts:68, 76` | Tauri appDataDir |
| `layout-manager/index.tsx:455` | Неизвестно (TODO?) |
| `context-manager/index.ts:315` | Tauri internals |

Каждый `@ts-ignore` — потенциальная бомба при обновлении зависимостей.

**Приоритет:** **P2**.

---

#### Проблема 16: Только 4 Тест-файла на Весь Проект

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
- 24 из 27 плагинов — **0 тестов**

**Приоритет:** **P2** — критично для стабильности.

---

#### Проблема 17: 119 Прямых `console.log` Вызовов

Многие модули используют `console.log` вместо Logger API:
- NotehubCore — 18 вызовов
- CLI commands — 61 вызов

**Проблемы:**
- Обходит систему логирования (уровни, фильтрация)
- Не может быть перенаправлено в файл/UI
- Загрязняет консоль в production

**Приоритет:** **P2**.

---

#### Проблема 18: EventBus Типизация — Иллюзия

**Файл:** `packages/core/src/buses/EventBus.ts`

`EventBus<TEvents>` генерик выглядит типобезопасным, но:
- `NotehubCore` создаётся без generic: `new NotehubCore()` → `EventBus<EventMap>` → все события = `unknown`
- Нет централизованной карты событий (`NotehubEventMap` не используется)
- `PluginContext.subscribe<T>` — ручной каст, тип не проверяется

**Рекомендация:** Создать `NotehubEventMap` по аналогии с `NotehubApiMap`.

**Приоритет:** **P2**.

---

#### Проблема 19: Отсутствие Валидации Plugin Manifest

**Файл:** `packages/plugins/system/synapse/src/logic/ManifestParser.ts`

ID плагина принимается как любая строка. Нет проверки на:
- Формат (`nh.scope.name`)
- Максимальную длину
- Спецсимволы (ID используется в `document.getElementById`, CSS)
- Path traversal в `main` поле

**Приоритет:** **P2**.

---

#### Проблема 20: Z-index Конфликты

Множественные компоненты используют `z-index: 9999`:
- ContextMenu
- ContextMenu overlay
- NotehubEditor (`9999 !important`)
- Resize overlay

**Проблема:** Нет стратегии наслоения. Контекстное меню, тултипы, оверлеи будут некорректно перекрывать друг друга.

**Рекомендация:** Создать систему z-index токенов.

**Приоритет:** **P2**.

---

### 3.4 🔵 НИЗКИЙ Приоритет (Улучшения DX)

| # | Проблема | Влияние |
|---|----------|---------|
| 21 | Нет списка Zone ID в типах | Нет автодополнения для зон |
| 22 | Editor игнорирует не-.md файлы | Невозможно расширить форматы |
| 23 | Нет Storage API для плагинов | Плагины сами управляют путями |
| 24 | Искусственная задержка 1 сек при загрузке | Замедляет старт |
| 25 | Нет подтверждения «Close All» | Случайное закрытие вкладок |
| 26 | Нет восстановления позиции скролла | UX дефект |
| 27 | Transition-all на мобильных | Jank при анимациях |

---

## IV. Сравнение с Конкурентами

### 4.1 Notehub.md vs Obsidian

| Возможность | Obsidian | Notehub.md | Зазор |
|-------------|----------|------------|-------|
| **Plugin Marketplace** | ✅ Есть (1000+ community plugins) | ❌ Нет | 🔴 Критический |
| **Custom Views** | ✅ `registerView()` + `WorkspaceLeaf` | ❌ Нет аналога | 🔴 Критический |
| **File Type Handlers** | ✅ `registerExtension()` | ❌ Жёстко `.md` | 🔴 Критический |
| **Ribbon Actions** | ✅ `addRibbonIcon()` | ⚠️ Через `zone:register` | 🟡 Средний |
| **Status Bar Items** | ✅ `addStatusBarItem()` | ❌ Нет типизированного API | 🟡 Средний |
| **Settings Tab** | ✅ `addSettingTab()` | ✅ `settings:register-tab` | ✅ Паритет |
| **Command Palette** | ✅ `addCommand()` | ✅ `command:register` | ✅ Паритет |
| **Editor Extensions** | ✅ CodeMirror ViewPlugin | ⚠️ `editor:register-portal` | 🟡 Частичный |
| **Plugin Dependencies** | ✅ Через manifest | ⚠️ Только для встроенных | 🟡 Средний |
| **Hot Reload** | ✅ Ctrl+Shift+I → Console | ⚠️ Synapse (нестабилен) | 🟡 Средний |
| **Mobile Support** | ✅ Official iOS/Android | ⚠️ Capacitor (в разработке) | 🟡 Прогресс |
| **Type Safety** | ❌ Plain JavaScript | ✅ TypeScript | 🟢 Преимущество |
| **Microkernel** | ❌ Закрытый монолит | ✅ 236 LOC ядро | 🟢 Преимущество |
| **Hook System** | ❌ Monkey-patching | ✅ Before/After/Around | 🟢 Преимущество |

**Вывод:** Notehub.md архитектурно превосходит Obsidian, но функционально отстаёт на 2-3 года.

---

### 4.2 Notehub.md vs Emacs

| Возможность | Emacs | Notehub.md |
|-------------|-------|------------|
| **Полная перепрограммируемость** | ✅ Всё — функция Elisp | ⚠️ Ограничено API контрактом |
| **REPL/Live Evaluation** | ✅ `eval-expression` | ❌ Нет |
| **Minor/Major Modes** | ✅ Произвольные keybinding | ⚠️ Только `context` в commands |
| **Advice System** | ✅ `defadvice` | ✅ Hook System — аналог |
| **Buffer-local Variables** | ✅ Состояние привязано к буферу | ❌ Нет |
| **Customization Groups** | ✅ Иерархия `defcustom` | ✅ `settings:register-group` |

**Вывод:** До Emacs-подобной гибкости далеко, но Hook System — хороший старт.

---

## V. Рекомендации

### P0 — Немедленно (Блокируют Production)

1. **Включить CSP в Tauri** — `tauri.conf.json:26`
2. **Добавить таймаут в `NotehubCore.init()`** — 30 секунд на плагин
3. **Ввести мьютекс для `loadPlugin`/`unloadPlugin`** — защита от race conditions
4. **Сделать `cleanup()` асинхронным** — `Promise.allSettled()`
5. **Добавить валидацию путей** — защита от path traversal

### P1 — Высокий Приоритет (Надёжность)

6. **Исправить write locks** — promise-chaining вместо `Promise.race`
7. **Добавить cleanup в CodeMirror виджеты** — удаление listeners
8. **Обернуть плагины в Error Boundaries** — защита от крашей
9. **Исправить hot-reload** — debounce на основе стабильности файла
10. **Исправить `rewriteSpecifiers`** — regex для `from "..."`
11. **Завершить мобильную адаптацию** — touch events, safe area, 44px кнопки
12. **Убрать `any` из `IPlugin`** — типизировать `NotehubCore`

### P2 — Средний Приоритет (Технический Долг)

13. **Автоматизировать `switch` в `main.tsx`** — `import.meta.glob`
14. **Убрать `as any`** — покрыть API контракт
15. **Убрать `@ts-ignore`** — исправить типы
16. **Добавить тесты для ядра** — ApiBus, EventBus, Bootloader, FsManager
17. **Заменить `console.log` на Logger API** — единая стратегия
18. **Создать `NotehubEventMap`** — типизация событий
19. **Валидировать manifest** — ID формат, dependencies
20. **Создать z-index токены** — стратегия наслоения

### P3 — Низкий Приоритет (DX)

21. **Создать enum ZoneId** — автодополнение зон
22. **Добавить File Type Handlers** — поддержка не-.md файлов
23. **Добавить Storage API** — `ctx.storage.get/set`
24. **Убрать задержку 1 сек** — skeleton UI вместо этого
25. **Добавить подтверждение деструктивных действий**

---

## VI. Заключение

### 6.1 Итоговая Оценка

| Аспект | Оценка | Комментарий |
|--------|--------|-------------|
| **Архитектура** | 9/10 | Микроядро, изоляция, шины — отлично |
| **Реализация** | 5/10 | Race conditions, утечки, CSP |
| **Безопасность** | 4/10 | CSP отключён, path traversal |
| **Надёжность** | 5/10 | Нет таймаутов, тестов |
| **DX** | 6/10 | Хорошая база, не хватает docs |
| **Мобильность** | 3/10 | Capacitor незавершён |

### 6.2 Ключевые Выводы

1. **Архитектурно проект превосходен** — микроядро, двухшинная коммуникация, изоляция плагинов на уровне Emacs/Obsidian.

2. **Реализация содержит критические проблемы** — 5 проблем P0 блокируют production-использование (CSP, race conditions, таймауты, path traversal).

3. **Безопасность в текущем состоянии неприемлема** — CSP отключён, asset scope = `**/*`, нет валидации путей.

4. **Мобильная версия не готова** — touch events не поддерживаются, safe area не учитывается, watcher не реализован.

5. **Отсутствуют тесты** — 4 тест-файла на 27 плагинов и ядро. Это критично для стабильности.

6. **До Emacs-подобной гибкости далеко** — нет file type handlers, custom views, storage API.

### 6.3 Дорожная Карта

**Неделя 1-2 (P0):**
- Исправить CSP, race conditions, таймауты, path traversal
- Сделать cleanup асинхронным

**Неделя 3-4 (P1):**
- Исправить write locks, hot-reload, утечки listeners
- Добавить Error Boundaries
- Завершить мобильную адаптацию (touch, safe area)

**Неделя 5-8 (P2):**
- Автоматизировать switch, убрать as any/@ts-ignore
- Добавить тесты для ядра и плагинов
- Создать NotehubEventMap, валидировать manifests

**Месяц 3+ (P3):**
- Добавить file type handlers, custom views, storage API
- Улучшить DX (enum ZoneId, z-index tokens)

### 6.4 Философия Проекта

> **«Ядро агностично; вся функциональность — это плагин.»**

> **«Плагины изолированы; коммуникация только через ctx.»**

> **«Contract-first; но с escape hatches для свободы.»**

> **«Цель — свобода пользователя. Каждый компонент должен быть заменяемым.»**

### 6.5 Следующие Шаги

1. **Исправить P0 проблемы** — блокируют production
2. **Создать GitHub Issues** для каждой рекомендации
3. **Начать с тестов для ядра** — без тестов невозможно рефакторить
4. **Собрать feedback** от ранних пользователей
5. **Итеративно улучшать** на основе реальных кейсов

---

**Приложения:**

- [A. Глоссарий](#a-глоссарий)
- [B. Ссылки на Ключевые Файлы](#b-ссылки-на-ключевые-файлы)
- [C. Связанные Документы](#c-связанные-документы)

---

## Приложения

### A. Глоссарий

| Термин | Определение |
|--------|-------------|
| **Kernel** | `NotehubCore` — минимальное ядро системы (~236 LOC) |
| **Plugin** | Изолированный модуль с жизненным циклом load/unload |
| **ApiBus** | RPC шина для синхронных вызовов методов |
| **EventBus** | Pub/Sub шина для асинхронных событий |
| **Escape Hatch** | Способ обхода ограничений API для продвинутых сценариев |
| **SystemJS** | Загрузчик модулей для динамических плагинов |
| **Shared Scope** | Набор зависимостей, доступных всем плагинам (React, core, api) |
| **Bootloader** | Оркестрация загрузки с разрешением зависимостей |
| **Synapse** | Система горячей перезагрузки плагинов |
| **NHP** | Notehub Plugin — формат внешних плагинов (`.nhp` файл) |

### B. Ссылки на Ключевые Файлы

| Файл | Описание |
|------|----------|
| [`NotehubCore`](packages/core/src/index.ts) | Ядро системы (236 LOC) |
| [`ApiBus`](packages/core/src/buses/ApiBus.ts) | RPC шина с хуками |
| [`EventBus`](packages/core/src/buses/EventBus.ts) | Pub/Sub шина с приоритетами |
| [`PluginContext`](packages/api/src/context.ts) | Интерфейс для внешних плагинов |
| [`Bootloader`](packages/plugins/system/bootloader/src/index.ts) | Оркестрация загрузки |
| [`Synapse`](packages/plugins/system/synapse/src/logic/ScopeInitializer.ts) | Динамическая загрузка плагинов |
| [`API Contract`](packages/api/src/contract.ts) | Типы всех API методов (840 LOC, 130+ методов) |
| [`Tauri Config`](apps/desktop/src-tauri/tauri.conf.json) | Конфигурация безопасности Tauri |

### C. Связанные Документы

- [`EXTENSIBILITY_STRATEGIES_RU.md`](EXTENSIBILITY_STRATEGIES_RU.md) — Стратегии расширяемости (Escape Hatches)
- [`IMPROVEMENT_SUMMARY_RU.md`](IMPROVEMENT_SUMMARY_RU.md) — План улучшения DX
- [`docs/ru/reports/codebase-review-2026-02-16.md`](docs/ru/reports/codebase-review-2026-02-16.md) — Комплексный обзор кодовой базы (69 проблем)
- [`docs/ru/reports/deep-architecture-review-2026-02-09.md`](docs/ru/reports/deep-architecture-review-2026-02-09.md) — Глубокий архитектурный обзор
- [`docs/ru/reports/bug-audit-2026-02-17.md`](docs/ru/reports/bug-audit-2026-02-17.md) — Аудит багов (38 проблем)
- [`docs/ru/reports/architectural_analysis_plugin_system.md`](docs/ru/reports/architectural_analysis_plugin_system.md) — Анализ системы плагинов

---

**Конец отчёта**

*Отчёт сгенерирован на основе анализа 5 существующих отчётов, исходного кода ядра, плагинов и приложений.*
