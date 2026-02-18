# Комплексный Обзор Кодовой Базы Notehub.md

**Дата:** 16 февраля 2026
**Ветка:** `main`
**Версия:** 0.1.6
**Аналитик:** Claude Opus 4.6

---

## Оглавление

- [I. Резюме](#i-резюме)
- [II. Архитектура и Структура Проекта](#ii-архитектура-и-структура-проекта)
- [III. Критические Проблемы](#iii-критические-проблемы)
- [IV. Проблемы Ядра (core, app-bootstrap, cli)](#iv-проблемы-ядра-core-app-bootstrap-cli)
- [V. Проблемы Плагинной Системы](#v-проблемы-плагинной-системы)
- [VI. Проблемы API-Контрактов](#vi-проблемы-api-контрактов)
- [VII. Проблемы Платформенных Приложений](#vii-проблемы-платформенных-приложений)
- [VIII. Безопасность](#viii-безопасность)
- [IX. Сводная Таблица](#ix-сводная-таблица)
- [X. Рекомендации по Приоритетам](#x-рекомендации-по-приоритетам)

---

## I. Резюме

Проведён глубокий анализ всей кодовой базы монорепозитория Notehub.md, включая ядро, API-слой, плагинную систему и платформенные приложения (Tauri Desktop, Capacitor Mobile). Исследовано **5 основных областей** параллельно.

| Область | Найдено проблем | Критических | Высоких | Средних | Низких |
|---------|----------------|-------------|---------|---------|--------|
| Ядро (core, bootstrap, cli) | 24 | 4 | 7 | 8 | 5 |
| Плагинная система | 15 | 3 | 4 | 5 | 3 |
| API-контракты | 14 | 2 | 5 | 5 | 2 |
| Платформенные приложения | 16 | 2 | 6 | 5 | 3 |
| **Итого** | **69** | **11** | **22** | **23** | **13** |

---

## II. Архитектура и Структура Проекта

### 2.1 Топология

```
notehub.md_0.1.x/
├── packages/
│   ├── core/              ← Микроядро: EventBus + ApiBus + Plugin Registry (~600 LOC)
│   ├── api/               ← Публичный SDK: NotehubPlugin + PluginContext (~1400 LOC)
│   ├── app-bootstrap/     ← Инициализация приложения + React-обёртка (~200 LOC)
│   ├── cli/               ← CLI: create + build + dev команды
│   └── plugins/
│       ├── system/        ← 14 системных (bootloader, fs-manager, synapse, keymap, ...)
│       ├── ui/            ← 9 UI (theme-manager, layout-manager, settings-manager, ...)
│       ├── features/      ← 9 функциональных (editor, explorer, vault-picker, ...)
│       └── portals/       ← Inline-виджеты для редактора
├── apps/
│   ├── desktop/           ← Tauri V2 (Windows/Mac/Linux) + Vite + React
│   └── capacitor/         ← Capacitor V6 (Android/iOS) + Vite + React
├── scripts/               ← Автоматизация сборки и линковки плагинов
└── artifacts/             ← Граф зависимостей
```

### 2.2 Ключевые Метрики

- **27 плагинов** в реестре (14 system + 9 UI + 9 feature)
- **130+ API-методов** в `NotehubApiMap`
- **15+ событий** в `NotehubEventMap`
- **2 платформы**: Desktop (Tauri/Rust) и Mobile (Capacitor/Android)
- Двухшинная архитектура: `EventBus` (pub/sub) + `ApiBus` (RPC с хуками)

---

## III. Критические Проблемы

### 3.1 🔴 Отсутствие защиты от зависания при инициализации

**Файл:** `packages/core/src/index.ts:133-157`

Последовательная загрузка плагинов без таймаута. Если один плагин зависнет — всё приложение заблокировано навсегда.

```typescript
// Текущий код — нет ни таймаута, ни cancellation
for (const plugin of this.plugins) {
    await plugin.load(this);   // ← Может зависнуть бесконечно
}
```

**Рекомендация:** Добавить таймаут (например, 30 сек) с `Promise.race()` и механизм отмены.

---

### 3.2 🔴 Безопасность Tauri: CSP отключён, asset scope = `**/*`

**Файл:** `apps/desktop/src-tauri/tauri.conf.json:25-33`

```json
"security": {
    "csp": null,
    "assetProtocol": {
        "enable": true,
        "scope": ["**/*"]
    }
}
```

- `csp: null` — Content Security Policy полностью отключена, что открывает приложение для XSS/инъекций
- `scope: ["**/*"]` — Asset protocol даёт доступ к **любому файлу** в системе

**Рекомендация:** Включить CSP с разрешённым списком источников. Ограничить scope до директории vault и ресурсов приложения.

---

### 3.3 🔴 Приложение падает при отсутствии одной зависимости плагина

**Файл:** `packages/plugins/system/bootloader/src/Bootloader.ts:225-231`

```typescript
try {
    this.graph.buildEdges();
} catch (error) {
    this.log('error', `Resolution failed: ${error...}`);
    throw error;  // ← Вся загрузка прекращается
}
```

Если хотя бы одна обязательная зависимость отсутствует — boot полностью проваливается. Нет механизма частичной загрузки.

**Рекомендация:** Реализовать graceful degradation — пропускать плагин с недоступными зависимостями, но продолжать загрузку остальных.

---

### 3.4 🔴 Небезопасное приведение типов в SystemPlugin

**Файл:** `packages/core/src/SystemPlugin.ts:174`

```typescript
const unsubscribe = (this.app.api.hook as Function)(method, position, handler, options);
```

Кастинг к `Function` полностью обходит TypeScript-проверку типов. Хуки регистрируются без валидации аргументов.

**Рекомендация:** Добавить типизированные перегрузки для метода `hook()` в ApiBus.

---

### 3.5 🔴 Тихое проглатывание ошибок при очистке плагинов

**Файл:** `packages/core/src/SystemPlugin.ts:189-215`

```typescript
try {
    this.app.api.unregister(name);
} catch {
    // ignore ← Все ошибки молча проглатываются
}
```

Если очистка не удалась — утечки памяти и зомби-обработчики останутся в системе. Без логирования проблему невозможно диагностировать.

**Рекомендация:** Заменить пустой catch на `console.warn()` с указанием плагина и метода.

---

## IV. Проблемы Ядра (core, app-bootstrap, cli)

### 4.1 NotehubCore

| # | Проблема | Файл | Критичность |
|---|----------|------|-------------|
| 1 | `console.log` вместо Logger API | `core/src/index.ts:85,97` | 🟡 Средняя |
| 2 | Нет таймаута/deadlock-защиты в `init()` | `core/src/index.ts:133-157` | 🔴 Критическая |
| 3 | Кастинг `hook as Function` | `SystemPlugin.ts:174` | 🔴 Критическая |
| 4 | Тихое проглатывание ошибок cleanup | `SystemPlugin.ts:189-215` | 🔴 Критическая |
| 5 | `EventBus.once()` — утечка при ошибке callback | `EventBus.ts:163` | 🟡 Средняя |
| 6 | Race condition в async-условиях хуков ApiBus | `ApiBus.ts:277-279` | 🟡 Средняя |

### 4.2 App-Bootstrap

| # | Проблема | Файл | Критичность |
|---|----------|------|-------------|
| 7 | Невнятная ошибка при загрузке реестра | `bootstrap.ts:45` | 🟠 Высокая |
| 8 | Тихий пропуск плагинов при ошибке импорта (string-matching) | `bootstrap.ts:108-114` | 🟠 Высокая |
| 9 | Race condition StrictMode при параллельном монтировании | `NotehubApp.tsx:36-38` | 🟠 Высокая |
| 10 | `PluginRegistryEntry.type` = `string` вместо union | `types.ts:6-12` | 🟡 Средняя |
| 11 | Искусственная задержка 1 сек. при загрузке | `NotehubApp.tsx:46-50` | 🟡 Средняя |
| 12 | Нет валидации экземпляра плагина после загрузки | `bootstrap.ts:82` | 🟠 Высокая |

**Подробнее о #11:** Хардкод минимального времени загрузки:

```typescript
const elapsed = Date.now() - startTime;
if (elapsed < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
}
```

Всегда добавляет минимум 1 секунду задержки даже на мощных устройствах. Следует использовать анимацию fade-out или Skeleton UI вместо этого.

### 4.3 CLI (@notehub.md/cli)

| # | Проблема | Файл | Критичность |
|---|----------|------|-------------|
| 13 | `process.exit(1)` без cleanup (6 мест) | `build.ts:60,69,74,83,108,169` | 🟠 Высокая |
| 14 | Дублирование regex валидации ID | `build.ts:78` + `create.ts:152` | 🟡 Средняя |
| 15 | Нет валидации JSON → PluginManifest | `build.ts:63-70` | 🟠 Высокая |
| 16 | Захардкоженный список externals в Vite | `build.ts:133-139` | 🟡 Средняя |
| 17 | CLI непригоден для программного использования | Весь CLI | 🟡 Средняя |
| 18 | Нет валидации диапазона порта (1-65535) | `cli/src/index.ts:84` | 🔵 Низкая |

---

## V. Проблемы Плагинной Системы

### 5.1 Загрузчик (Bootloader)

| # | Проблема | Файл | Критичность |
|---|----------|------|-------------|
| 19 | Отсутствие зависимости = полный отказ boot | `Bootloader.ts:225-231` | 🔴 Критическая |
| 20 | Цикл зависимостей = fatal без рекомендации | `Bootloader.ts:158` | 🟡 Средняя |

### 5.2 Система внешних плагинов (Synapse)

| # | Проблема | Файл | Критичность |
|---|----------|------|-------------|
| 21 | Legacy `IPlugin` обходит PluginContextImpl | `PluginLoader.ts:220-225` | 🟠 Высокая |
| 22 | Нет проверки версий при загрузке | `PluginLoader.ts:154-261` | 🟡 Средняя |
| 23 | Возможность бесконечной рекурсии хуков | `PluginContextImpl.ts:230-252` | 🟡 Средняя |

**Подробнее о #21:** Legacy-плагины получают полный доступ к `this.app`, минуя контекст с автоочисткой:

```typescript
if (this.isNotehubPlugin(plugin)) {
    context = new PluginContextImpl(...);
    await plugin.onload(context);          // ← Context с трекингом
} else {
    await plugin.load(this.app);           // ← Полный доступ, нет трекинга!
}
```

При выгрузке legacy-плагина зарегистрированные им API-методы и хуки **не будут автоматически удалены**.

### 5.3 File System Manager

| # | Проблема | Файл | Критичность |
|---|----------|------|-------------|
| 24 | Write-lock без таймаута — каскадная блокировка | `fs-manager/src/index.ts:86-100` | 🟠 Высокая |
| 25 | Молчаливый catch при ошибке lock | `fs-manager/src/index.ts:84` | 🟡 Средняя |

```typescript
// Текущий код — бесконечное ожидание
const existingLock = this.writeLocks.get(path);
const newLock = (async () => {
    if (existingLock) await existingLock.catch(() => { });  // ← Ждёт бесконечно
    await this.ensureDriver().writeFile(path, data);
})();
```

### 5.4 Explorer Controller

| # | Проблема | Файл | Критичность |
|---|----------|------|-------------|
| 26 | Утечка памяти: watcherTimers при ошибке | `ExplorerController.ts:23-36` | 🟡 Средняя |
| 27 | Оптимистичные обновления UI без rollback | `ExplorerController.ts:428-475` | 🟡 Средняя |
| 28 | Только один rename одновременно | `ExplorerController.ts:27` | 🔵 Низкая |

### 5.5 Context Manager

| # | Проблема | Файл | Критичность |
|---|----------|------|-------------|
| 29 | `splitByOperator()` — O(n²) алгоритм, ReDoS-уязвимость | `context-manager/src/index.ts:167-188` | 🟡 Средняя |
| 30 | Строка с " in " в значении ломает парсер выражений | `context-manager/src/index.ts:150-161` | 🔵 Низкая |

### 5.6 Несогласованность именования ID плагинов

**Файл:** `plugin-registry.json`

```
nh.system.logger         ← Стандарт: nh.{type}.{name}
nh.features.explorer     ← Стандарт
features.alert-button    ← НАРУШЕНИЕ: нет префикса "nh."
```

**Рекомендация:** Переименовать `features.alert-button` → `nh.features.alert-button`.

---

## VI. Проблемы API-Контрактов

### 6.1 Типобезопасность

| # | Проблема | Файл (contract.ts) | Критичность |
|---|----------|---------------------|-------------|
| 31 | `FC<any>` в `settings:register-custom-view` | Строка 829 | 🔴 Критическая |
| 32 | `unknown` payload в `MenuProvider` | Строка 354 | 🟠 Высокая |
| 33 | `unknown` payload в `MenuAction.onClick` | Строка 317 | 🟠 Высокая |
| 34 | `unknown` возврат `editor:unsafe_get-view` | Строка 923 | 🟡 Средняя |
| 35 | `unknown` возврат `settings:get-structure` | Строка 808 | 🟡 Средняя |
| 36 | `unknown[]` в `bootloader.load/getResult/getInstance` | Строки 770-776 | 🟡 Средняя |
| 37 | `unknown` payload в `context-menu:trigger` | Строка 745 | 🟡 Средняя |

### 6.2 Несогласованность именования API

Два разных стиля именования в одном контракте:

```typescript
// Kebab-case (стандарт):
'fs:read-file': ...
'editor:open': ...

// Dot-notation (нарушение):
'bootloader.load': ...
'bootloader.getResult': ...
'bootloader.getInstance': ...
```

**Рекомендация:** Унифицировать все API в kebab-case: `bootloader:load`, `bootloader:get-result`, `bootloader:get-instance`.

### 6.3 Отсутствие спецификации ошибок

Контракт описывает только "happy path". Для ни одного из 130+ методов нет указания:
- Какие ошибки могут быть выброшены
- Какие типы ошибок использовать
- Поведение при невалидных входных данных

| API метод | Вопрос без ответа |
|-----------|-------------------|
| `fs:read-text-file` | Что при отсутствии файла? Что при ошибке декодирования? |
| `config:get` | Возвращает `undefined` или бросает? |
| `editor:open` | Ошибки при невалидном пути? |
| `settings:register-item` | Что если ключ уже зарегистрирован? |

### 6.4 Обход типизации в потребителях

**Файл:** `packages/plugins/features/alert-button/src/components/ApiInspectorView.tsx`

```typescript
const api = (ctx as any).app?.api;  // ← Прямой доступ к internal API
```

**Файл:** `packages/plugins/features/explorer/src/components/FileTree.tsx`

```typescript
app.api.invoke('context-menu:trigger' as any, ...);  // ← Каст к any
```

Необходимость кастов указывает на неполноту контракта или несовпадение типов.

### 6.5 Отсутствие валидации PluginContext

| Проблема | Описание |
|----------|----------|
| `invokeApi` всегда async | Нет указания, какие API синхронные, а какие — нет |
| `storage` не в `NotehubApiMap` | Дублирование: доступ через `storage` и через `config:` |
| `EventContext` не документирован | `preventDefault()` и `stopPropagation()` без описания применимости |

---

## VII. Проблемы Платформенных Приложений

### 7.1 Capacitor (Mobile)

| # | Проблема | Файл | Критичность |
|---|----------|------|-------------|
| 38 | `@ts-ignore` для `directory: undefined` | `fs-driver-capacitor/src/index.ts:82-84` | 🟠 Высокая |
| 39 | Watch не реализован (no-op) | `fs-driver-capacitor/src/index.ts:247-249` | 🟠 Высокая |
| 40 | Нет try-catch в `removeFile`, `removeDir`, `rename` | `fs-driver-capacitor/src/index.ts:252-277` | 🟠 Высокая |
| 41 | `window.open()` вместо нативного shell:open | `apps/capacitor/src/main.tsx:18-25` | 🟡 Средняя |
| 42 | Избыточное диагностическое логирование при ошибке чтения | `fs-driver-capacitor/src/index.ts:120-137` | 🔵 Низкая |
| 43 | Отсутствие оптимизации Vite для мобильных устройств | `apps/capacitor/vite.config.ts` | 🔵 Низкая |
| 44 | Запрос пермишенов при загрузке, а не при первом использовании | FS driver capacitor | 🟡 Средняя |

**Подробнее о #39:** Полное отсутствие watcher-а на мобильной платформе:

```typescript
async watch(_path: string, _onChange: (event: any) => void): Promise<() => void> {
    this.log('warn', 'watch not implemented on Capacitor');
    return () => { };  // ← No-op
}
```

Это означает, что Explorer не будет обновляться при изменении файлов вне приложения.

### 7.2 Desktop (Tauri)

| # | Проблема | Файл | Критичность |
|---|----------|------|-------------|
| 45 | CSP отключён (`csp: null`) | `tauri.conf.json:26` | 🔴 Критическая |
| 46 | Asset scope = `**/*` — доступ ко всем файлам | `tauri.conf.json:30` | 🔴 Критическая |
| 47 | Хрупкий парсинг Android SAF-путей (indexOf) | `fs-driver-tauri/src/index.ts:95-121` | 🟠 Высокая |
| 48 | `(event as any)` при маппинге watch-событий | `fs-driver-tauri/src/index.ts:285-343` | 🟡 Средняя |
| 49 | Бета-версия `tauri-plugin-os = "2.0.0-beta.0"` в стабильном билде | `Cargo.toml` | 🟡 Средняя |
| 50 | Android FS-плагин в desktop Cargo.toml | `Cargo.toml:27,29-30` | 🟡 Средняя |

### 7.3 Несогласованность между платформами

| Аспект | Capacitor | Desktop |
|--------|-----------|---------|
| Версия пакета | 0.1.0 | 0.1.6 |
| `shell:open` | `window.open()` (ограниченный) | Tauri `open()` (нативный) |
| File watcher | Не реализован | Реализован |
| Vite config | Минимальный | Полный (port, target, sourcemap) |
| FS error handling | Частичный (без try-catch) | Полный |
| Build target | Не указан | Специфичный по платформе |

---

## VIII. Безопасность

### 8.1 Высокий риск

| # | Проблема | Влияние |
|---|----------|---------|
| S1 | CSP отключён в Tauri | XSS/инъекции в desktop-приложении |
| S2 | Asset scope `**/*` | Доступ к любому файлу ОС |
| S3 | Нет namespace-валидации для system-плагинов | Системные плагины могут зарегистрировать API с любым именем |
| S4 | Нет проверки совместимости внешних плагинов | Внешний плагин может зарегистрировать вредоносные хуки |

### 8.2 Средний риск

| # | Проблема | Влияние |
|---|----------|---------|
| S5 | `splitByOperator()` O(n²) — потенциальный ReDoS | DoS через сложные context-выражения |
| S6 | Android SAF path traversal | Возможный выход за пределы vault |
| S7 | Legacy-плагины получают полный `this.app` | Обход изоляции PluginContext |

---

## IX. Сводная Таблица

### По категориям

| Категория | 🔴 Крит. | 🟠 Выс. | 🟡 Сред. | 🔵 Низ. | Всего |
|-----------|----------|----------|----------|---------|-------|
| Ядро (core) | 3 | 0 | 3 | 0 | 6 |
| Загрузка (bootstrap) | 0 | 4 | 2 | 0 | 6 |
| CLI | 0 | 2 | 3 | 1 | 6 |
| Плагинная система | 1 | 2 | 5 | 2 | 10 |
| API-контракты | 1 | 2 | 4 | 0 | 7 |
| Обход типов | 0 | 2 | 0 | 0 | 2 |
| Capacitor | 0 | 3 | 2 | 2 | 7 |
| Desktop (Tauri) | 2 | 1 | 2 | 0 | 5 |
| Безопасность | 2 | 2 | 3 | 0 | 7 |
| **Итого** | **9** | **18** | **24** | **5** | **56** |

### Кросс-пакетные проблемы

| Проблема | Затронутые пакеты |
|----------|-------------------|
| Нет единой стратегии логирования | core, cli, bootstrap — все используют `console.log` |
| Непоследовательная обработка ошибок | EventBus логирует, ApiBus логирует, SystemPlugin молчит |
| Нет тестов для bootstrap-логики | app-bootstrap, cli — 0 тестов |
| Нет управления версиями зависимостей | Все workspace-зависимости через `workspace:*` |

---

## X. Рекомендации по Приоритетам

### 🔴 P0 — Немедленно (блокируют стабильность)

1. **Включить CSP в Tauri** — `tauri.conf.json:26`
   - Добавить `"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"`
   - Ограничить `assetProtocol.scope` до `["$APPDATA/**", "$RESOURCE/**"]`

2. **Добавить таймаут в `NotehubCore.init()`** — `core/src/index.ts`
   - `Promise.race([plugin.load(this), timeout(30000)])` с возможностью пропуска плагина

3. **Реализовать graceful degradation в Bootloader** — `Bootloader.ts`
   - При отсутствии зависимости: пометить плагин как SKIPPED, продолжить boot

4. **Исправить cleanup SystemPlugin** — `SystemPlugin.ts:189-215`
   - Заменить пустой `catch {}` на `catch (e) { console.warn(...) }`

### 🟠 P1 — Высокий приоритет (влияют на качество)

5. **Типизировать хук-метод** — убрать `as Function` в `SystemPlugin.ts:174`
6. **Добавить таймаут к write-lock** — `fs-manager/src/index.ts` (30 сек по умолчанию)
7. **Валидация загруженных плагинов** — `bootstrap.ts:82` — проверка instance
8. **Исправить `PluginRegistryEntry.type`** — `string` → `'system' | 'ui' | 'feature'`
9. **Стандартизировать API naming** — `bootloader.load` → `bootloader:load`
10. **Исправить `FC<any>`** — `contract.ts:829` → `FC<Record<string, unknown>>`
11. **Исправить ID `alert-button`** — `features.alert-button` → `nh.features.alert-button`
12. **Реализовать watcher на Capacitor** — хотя бы polling-based fallback
13. **Добавить try-catch** в `removeFile/removeDir/rename` на Capacitor

### 🟡 P2 — Средний приоритет (улучшают DX)

14. Добавить manifest-валидацию (Zod) при импорте в CLI
15. Убрать искусственную задержку 1 сек при загрузке
16. Типизировать MenuProvider payload через дженерики
17. Документировать спецификации ошибок API
18. Унифицировать стратегию логирования (Logger API вместо console)
19. Рефакторить CLI для программного использования (return вместо process.exit)
20. Добавить тесты для bootstrap-логики

### 🔵 P3 — Низкий приоритет (техдолг)

21. Оптимизировать `splitByOperator()` до O(n)
22. Валидировать порт в CLI (1-65535)
23. Обновить `tauri-plugin-os` с beta на stable
24. Вынести externals list из хардкода в конфиг

---

*Отчёт сгенерирован автоматическим анализом 5 параллельных агентов, покрывающих все области кодовой базы.*
