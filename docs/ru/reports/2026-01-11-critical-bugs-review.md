# 🔴 Критические проблемы проекта Notehub.md

**Дата:** 2026-01-11  
**Автор:** Code Review AI  
**Версия проекта:** 0.1.3-a

---

## Обзор

Данный отчет содержит анализ **критических архитектурных, реализационных и UX-проблем** проекта Notehub.md. Акцент сделан на проблемах, которые могут привести к:
- Потере данных пользователя
- Утечкам памяти и деградации производительности
- Race conditions и непредсказуемому поведению
- Критическим UX-проблемам

---

## 🔥 Категория A: Критические баги с потерей данных

### A1. Race Condition при переключении файлов в редакторе

**Файл:** `packages/plugins/features/editor/src/logic/EditorController.ts`

**Проблема:** При быстром переключении между файлами существует окно, в котором `lastKnownContent` может быть перезаписан содержимым нового файла ДО того, как debounced save завершил сохранение старого файла.

```typescript
// Строки 455-512: openFile()
const openPromise = (async () => {
    // ...
    const content = await this.app.api.invoke('fs:read-text-file', path) as string;
    
    // ПРОБЛЕМА: lastKnownContent обновляется немедленно
    this.currentPath = path;
    this.lastKnownContent = content;  // ⚠️ Старый контент ещё может быть в debounce!
    this.isDirty = false;
    // ...
})();
```

**Сценарий потери данных:**
1. Пользователь редактирует файл A
2. Debounce timer ожидает 1 секунду
3. Пользователь переключается на файл B за 500ms
4. `lastKnownContent` перезаписывается содержимым файла B
5. Debounce срабатывает и сохраняет контент файла B в файл A

**Критичность:** 🔴 КРИТИЧЕСКАЯ — потеря данных

**Рекомендация:** Немедленный flush debounced save перед сменой файла:
```typescript
async openFile(path: string): Promise<string> {
    // Немедленно сохранить текущий файл перед переключением
    if (this.isDirty && this.currentPath && this.currentPath !== path) {
        await this.saveFile();
    }
    // ... остальной код
}
```

---

### A2. Отсутствие блокировки concurrent writes в fs:write-text-file

**Файл:** `packages/plugins/system/fs-manager/src/index.ts`

**Проблема:** FsManager не имеет механизма блокировки файлов. Параллельные операции записи могут привести к повреждению данных.

```typescript
// Строки 145-147
private async writeTextFile(path: string, content: string): Promise<void> {
    return this.ensureDriver().writeTextFile(path, content);
    // ⚠️ Нет блокировки, нет очереди, нет проверки concurrent access
}
```

**Сценарий:**
1. Плагин A вызывает `fs:write-text-file` с длинным контентом
2. До завершения записи плагин B вызывает `fs:write-text-file` на тот же файл
3. Результат непредсказуем — чередование байтов или потеря данных

**Критичность:** 🔴 КРИТИЧЕСКАЯ — потеря данных

**Рекомендация:** Добавить write lock per file path:
```typescript
private writeLocks = new Map<string, Promise<void>>();

private async writeTextFile(path: string, content: string): Promise<void> {
    // Wait for any pending write to same path
    while (this.writeLocks.has(path)) {
        await this.writeLocks.get(path);
    }
    
    const writePromise = this.ensureDriver().writeTextFile(path, content);
    this.writeLocks.set(path, writePromise.finally(() => this.writeLocks.delete(path)));
    return writePromise;
}
```

---

## 🔥 Категория B: Утечки памяти

### B1. Event handlers в EditorController не отписываются полностью

**Файл:** `packages/plugins/features/editor/src/logic/EditorController.ts`

**Проблема:** В конструкторе подписываются два event handler на `config:updated` и `config:reloaded`, но метод `dispose()` не отписывается от них.

```typescript
// Строки 203-220: Конструктор
constructor(app: NotehubCore) {
    this.app = app;
    
    // Подписка БЕЗ сохранения ссылки для отписки
    this.app.events.on('config:updated', (payload) => {
        // ... анонимная функция
    });
    
    this.app.events.on('config:reloaded', () => {
        // ... анонимная функция
    });
    // ...
}

// Строки 731-748: dispose()
dispose(): void {
    // Отписка только от fs:deleted и fs:renamed
    this.app.events.off('fs:deleted', this.handleFsDeleted as ...);
    this.app.events.off('fs:renamed', this.handleFsRenamed as ...);
    // ⚠️ config:updated и config:reloaded НЕ отписаны!
}
```

**Критичность:** 🟡 ВЫСОКАЯ — memory leak при перезагрузке плагинов

**Рекомендация:** Сохранить ссылки на все handlers как bound methods и отписать в dispose().

---

### B2. Module-level state в LayoutManager сохраняется между HMR

**Файл:** `packages/plugins/ui/layout-manager/src/index.tsx`

**Проблема:** Хотя в `unload()` очищаются registries, при HMR модуль может быть переимпортирован без полной перезагрузки, оставляя zombie subscribers.

```typescript
// Строки 26-43: Module-level state
const layoutRegistry = new Map<string, LayoutComponent>();
let activeLayout: ActiveLayout | null = null;
const layoutSubscribers = new Set<() => void>();
const zoneRegistry = new Map<string, ZoneItem[]>();
const zoneSubscribers = new Set<() => void>();
let zoneVersion = 0;
let appInstance: NotehubCore | null = null;
```

**Проблема:** Module-level singletons в ES modules сохраняются при hot reload в development. Даже после очистки в `unload()`, если модуль не полностью перегружен, компоненты могут продолжать использовать stale appInstance.

**Критичность:** 🟡 ВЫСОКАЯ — memory leaks и stale state в dev mode

---

### B3. ZipLoader не освобождает Blob URLs при ошибках парсинга

**Файл:** `packages/plugins/system/synapse/src/logic/PluginLoader.ts`

**Проблема:** В методе `loadFromNhp()` есть finally block, но при других типах ошибок (например, ошибка instantiation класса плагина) Blob URL не отзывается.

```typescript
// Строки 396-494
async loadFromNhp(buffer: ArrayBuffer, sourcePath: string): Promise<PluginLoadResult> {
    let blobUrl: string | undefined;
    // ...
    try {
        // ...
        const module = await System.import(blobUrl);
        const plugin = this.extractPlugin(module, manifest.id);
        
        if (!plugin) {
            // ⚠️ blobUrl остается активным — return без revoke
            return { success: false, error: 'Module does not export a valid plugin' };
        }
        // ...
    } finally {
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);  // Вызовется, но слишком поздно для некоторых путей
        }
    }
}
```

**Критичность:** 🟡 СРЕДНЯЯ — memory leak при неудачных загрузках плагинов

---

## 🔥 Категория C: Race Conditions и Deadlocks

### C1. Deadlock при циклических зависимостях плагинов

**Файл:** `packages/plugins/system/bootloader/src/Bootloader.ts`

**Проблема:** Bootloader не обрабатывает циклические зависимости между плагинами. При наличии цикла A → B → A приложение зависнет.

**Рекомендация:** Добавить DFS-детектор циклов перед загрузкой и бросать понятную ошибку.

**Критичность:** 🟡 ВЫСОКАЯ — полный deadlock приложения

---

### C2. Race condition в ExplorerController при optimistic updates

**Файл:** `packages/plugins/features/explorer/src/logic/ExplorerController.ts`

**Проблема:** Optimistic updates применяются до FS-операции. При ошибке происходит rollback через полную перезагрузку директории, но между ошибкой и перезагрузкой UI находится в inconsistent state.

```typescript
// Строки 369-415: onMove()
// --- OPTIMISTIC UPDATE ---
if (oldParentNode && oldParentNode.children) {
    oldParentNode.children = oldParentNode.children.filter(c => c.id !== dragId);
    this.touch(oldParentPath);
}
const movedNode = this.moveNodeInternal(dragId, newPath);
// ...
this.notify();  // ⚠️ UI обновлен оптимистично

// --- FS OPERATION ---
try {
    await this.app.api.invoke('fs:rename' as any, dragId, newPath);
} catch (error: any) {
    // При ошибке — полная перезагрузка
    if (oldParentPath) await this.loadDir(oldParentPath);
    await this.loadDir(parentId);
    // ⚠️ Пользователь видит мерцание: правильно → неправильно → правильно
}
```

**Критичность:** 🟡 СРЕДНЯЯ — плохой UX при ошибках

**Рекомендация:** Использовать механизм отката с сохраненным snapshot вместо полной перезагрузки.

---

### C3. Parallel API invocations могут race в ApiBus

**Файл:** `packages/core/src/buses/ApiBus.ts`

**Проблема:** `invoke()` не имеет очереди — все вызовы выполняются параллельно. Если handler A изменяет state, который читает handler B, результат непредсказуем.

```typescript
// Строки 113-118
async invoke(name: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(name);
    if (!handler) {
        throw new Error(`[ApiBus] Handler "${name}" is not registered`);
    }
    return handler(...args);  // ⚠️ Параллельный вызов без синхронизации
}
```

**Критичность:** 🟡 СРЕДНЯЯ — потенциальные race conditions

---

## 🔥 Категория D: Архитектурные проблемы

### D1. Singleton pattern в SettingsRegistry создает проблемы с тестируемостью

**Файл:** `packages/plugins/ui/settings-manager/src/logic/SettingsRegistry.ts`

**Проблема:** `SettingsRegistry.getInstance()` возвращает глобальный singleton. Это затрудняет:
- Unit-тестирование
- Изоляцию между тестами
- Создание нескольких экземпляров для A/B тестирования

**Критичность:** 🟠 СРЕДНЯЯ — технический долг

---

### D2. Type casting вместо type-safe API в plugin registration

**Файл:** `packages/plugins/system/synapse/src/index.tsx`

**Проблема:** Массовое использование `(app.api.register as any)` свидетельствует о несоответствии типов.

```typescript
// Строки 92-95
(app.api.register as any)('synapse:load-plugin', this.loadExternalPlugin.bind(this));
(app.api.register as any)('synapse:unload-plugin', this.unloadExternalPlugin.bind(this));
(app.api.register as any)('synapse:list-plugins', this.listLoadedPlugins.bind(this));
```

**Критичность:** 🟠 СРЕДНЯЯ — потеря type safety, риск runtime ошибок

---

### D3. Hardcoded таймауты без конфигурации

**Проблема:** Таймауты разбросаны по коду без централизации:

| Файл | Таймаут | Назначение |
|------|---------|------------|
| EditorController.ts | 1000ms | SAVE_DEBOUNCE_MS |
| EditorController.ts | 2000ms | Reset status to Ready |
| ExplorerController.ts | 100ms | Watcher debounce |
| ExplorerController.ts | 600ms | withWatcherIgnored delay |
| ExplorerController.ts | 1000ms | saveExpandedPaths debounce |
| WorkbenchPlugin.ts | 100ms | Restore last file delay |
| SynapsePlugin.ts | 500ms | FS event debounce |

**Критичность:** 🟠 СРЕДНЯЯ — непредсказуемое поведение на разном железе

---

## 🔥 Категория E: UX/Visual проблемы

### E1. Нет индикации unsaved changes в title bar

**Проблема:** При наличии несохраненных изменений пользователь не видит визуальной индикации в заголовке окна (например, `• Unsaved` или `*`).

**Критичность:** 🟡 ВЫСОКАЯ — пользователь может потерять данные закрыв приложение

---

### E2. Отсутствует "Confirm on Exit" при несохраненных изменениях

**Проблема:** При закрытии окна Tauri не проверяет наличие isDirty state и не показывает confirmation dialog.

**Файл:** Требуется интеграция с `tauri.conf.json` и Rust backend

**Критичность:** 🔴 КРИТИЧЕСКАЯ — потеря данных

---

### E3. Отсутствует undo/redo для Explorer операций

**Проблема:** Удаление/переименование файлов в Explorer не имеет возможности отмены. Пользователь может случайно удалить важный файл.

**Критичность:** 🟡 ВЫСОКАЯ — потеря данных без возможности восстановления

---

### E4. Мобильная версия не имеет жестов навигации

**Проблема:** На мобильных устройствах нет swipe-жестов для:
- Открытия/закрытия sidebar
- Навигации назад
- Pull-to-refresh

**Критичность:** 🟠 СРЕДНЯЯ — плохой мобильный UX

---

## 🔥 Категория F: Безопасность

### F1. Внешние плагины имеют полный доступ к API без sandbox

**Файл:** `packages/plugins/system/synapse/src/logic/PluginContextImpl.ts`

**Проблема:** `PluginContextImpl` предоставляет прямой доступ ко всем API без ограничений. Вредоносный плагин может:
- Читать/записывать любые файлы через `fs:*`
- Получить доступ к конфигурации через `config:*`
- Регистрировать API-методы, перехватывающие системные вызовы

```typescript
// Строки 90-103
async invokeApi<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
    this.ensureNotDisposed('invokeApi');
    // ⚠️ Нет проверки permissions — любой API доступен
    return this.app.api.invoke<T>(name, ...args);
}
```

**Критичность:** 🔴 КРИТИЧЕСКАЯ — безопасность

**Рекомендация:** Добавить permission manifest и runtime checks.

---

### F2. SystemJS import без CSP проверки

**Файл:** `packages/plugins/system/synapse/src/logic/PluginLoader.ts`

**Проблема:** `System.import(blobUrl)` загружает произвольный JavaScript без CSP-проверок.

**Критичность:** 🟡 ВЫСОКАЯ — XSS и code injection при установке вредоносного плагина

---

## Сводная таблица

| ID | Проблема | Критичность | Категория |
|----|----------|-------------|-----------|
| A1 | Race condition при смене файлов | 🔴 КРИТИЧЕСКАЯ | Потеря данных |
| A2 | Concurrent writes без блокировки | 🔴 КРИТИЧЕСКАЯ | Потеря данных |
| B1 | Memory leak в EditorController events | 🟡 ВЫСОКАЯ | Memory leak |
| B2 | Module-level state при HMR | 🟡 ВЫСОКАЯ | Memory leak |
| B3 | Blob URL leak в ZipLoader | 🟡 СРЕДНЯЯ | Memory leak |
| C1 | Deadlock при циклических зависимостях | 🟡 ВЫСОКАЯ | Race condition |
| C2 | Inconsistent UI при optimistic update ошибках | 🟡 СРЕДНЯЯ | Race condition |
| C3 | Parallel API invocations | 🟡 СРЕДНЯЯ | Race condition |
| D1 | Singleton SettingsRegistry | 🟠 СРЕДНЯЯ | Архитектура |
| D2 | Type casting в API registration | 🟠 СРЕДНЯЯ | Архитектура |
| D3 | Hardcoded таймауты | 🟠 СРЕДНЯЯ | Архитектура |
| E1 | Нет индикации unsaved в titlebar | 🟡 ВЫСОКАЯ | UX |
| E2 | Нет confirm on exit | 🔴 КРИТИЧЕСКАЯ | UX/Потеря данных |
| E3 | Нет undo для Explorer операций | 🟡 ВЫСОКАЯ | UX |
| E4 | Нет мобильных жестов | 🟠 СРЕДНЯЯ | UX |
| F1 | Плагины без sandbox | 🔴 КРИТИЧЕСКАЯ | Безопасность |
| F2 | SystemJS без CSP | 🟡 ВЫСОКАЯ | Безопасность |

---

## Приоритетный план исправлений

### Sprint 1 (Критические — 1-2 дня)
1. **A1** — Добавить flush перед сменой файла
2. **A2** — Добавить write lock в FsManager
3. **E2** — Добавить before-exit hook в Tauri

### Sprint 2 (Высокие — 3-5 дней)
1. **B1** — Исправить memory leak в EditorController
2. **C1** — Добавить детектор циклов в Bootloader
3. **E1** — Добавить индикатор unsaved в titlebar
4. **F1** — Разработать permission system для плагинов

### Sprint 3 (Средние — 1 неделя)
1. **B2, B3** — Memory leak fixes
2. **C2, C3** — Race condition mitigations
3. **D1-D3** — Архитектурный рефакторинг
4. **E3, E4** — UX улучшения

---

## Заключение

Проект имеет **2 критические проблемы с потерей данных** (A1, A2), **2 критические проблемы с UX/безопасностью** (E2, F1), и **множество высоких/средних проблем** требующих внимания.

Рекомендуется **заморозить выпуск новых фич** до устранения проблем Sprint 1.
