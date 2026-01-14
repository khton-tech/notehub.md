# 🚨 Критический аудит архитектуры Notehub.md
**Дата:** 2026-01-14  
**Версия документа:** 1.1  
**Фокус:** Критические проблемы архитектуры + рекомендации по развитию  
**Scope:** `@notehub/core`, `packages/plugins`, `apps/desktop`

---

## Executive Summary

Данный аудит сфокусирован на **критических архитектурных проблемах**, которые могут привести к:
- 🔴 **Потере данных пользователя**
- 🔴 **Системным крашам**
- 🔴 **Блокирующим проблемам масштабирования**

Архитектура в целом хорошо спроектирована (микроядро + плагины). Выявлено **4 критические проблемы** и предложены **дополнительные улучшения** для развития системы.

---

## 🔴 Критические проблемы

### 1. Конкурентная запись без атомарности (DATA LOSS/CRITICAL)

> [!CAUTION]
> Текущая реализация write-locks не гарантирует атомарность записи при сбоях.

**Расположение:** `packages/plugins/system/fs-manager/src/index.ts` L:144-164

**Проблема:**
```typescript
// Текущая реализация
private async writeFile(path: string, data: Uint8Array): Promise<void> {
    while (this.writeLocks.has(path)) {
        await this.writeLocks.get(path);   // ← Ожидание предыдущей записи
    }
    const writePromise = this.ensureDriver().writeFile(path, data);
    this.writeLocks.set(path, writePromise.finally(() => this.writeLocks.delete(path)));
    return writePromise;
}
```

**Сценарии потери данных:**
1. Если приложение крашится **во время записи**, файл остаётся в corrupted состоянии
2. Если пользователь закрывает приложение до завершения `writePromise`, данные теряются
3. При конкурентном auto-save + manual save возможна гонка состояний

**Рекомендации:**
1. **Immediate:** Реализовать **write-ahead logging** или **atomic rename pattern**:
   ```typescript
   // Рекомендуемый паттерн
   async writeFileAtomic(path: string, data: Uint8Array) {
       const tempPath = `${path}.tmp`;
       await this.driver.writeFile(tempPath, data);
       await this.driver.rename(tempPath, path);  // Атомарная операция
   }
   ```
2. **Short-term:** Добавить backup-механизм (`.notehub/backups/`)
3. **Long-term:** Рассмотреть интеграцию с SQLite для метаданных

---

### 2. Отсутствие graceful shutdown при критических ошибках (STABILITY/HIGH)

> [!WARNING]
> При краше плагина приложение не выполняет корректное завершение.

**Расположение:** 
- `packages/core/src/index.ts` L:186-194
- `apps/desktop/src/main.tsx`

**Проблема:**
```typescript
// NotehubCore.shutdown() — вызывается только при нормальном завершении
async shutdown(): Promise<void> {
    for (const [id, plugin] of pluginEntries) {
        await plugin.unload(this);  // ← Может не выполниться при краше
    }
}
```

Если плагин A падает в runtime:
1. Событие не перехватывается глобально
2. Другие плагины не уведомляются
3. Несохранённые данные могут быть потеряны

**Рекомендации:**
1. **Immediate:** Добавить глобальный error boundary:
   ```typescript
   window.addEventListener('unhandledrejection', async (event) => {
       await core.api.invoke('fs:flush-all-buffers');
       core.shutdown();
   });
   ```
2. **Short-term:** Реализовать `app.events.emit('core:critical-error', {...})` с обработчиками в плагинах
3. **Long-term:** Добавить crash recovery при повторном запуске

---

### 3. Синхронный блокирующий главный поток (PERFORMANCE/CRITICAL)

> [!WARNING]
> Распаковка NHP-плагинов и парсинг Markdown блокируют Main Thread.

**Расположения:**
- `packages/plugins/system/synapse/src/logic/ZipLoader.ts` — распаковка в Main Thread
- Парсинг больших документов в CodeMirror

**Измеримое влияние:**
- NHP файл 5MB = freeze UI на ~300-500ms
- Markdown файл 100KB с множеством виджетов = jank при скролле

**Проблема в ZipLoader:**
```typescript
// ZipLoader.ts — всё выполняется синхронно в Main Thread
async loadFromBuffer(buffer: ArrayBuffer, sourcePath: string): Promise<NhpLoadResult> {
    const zip = await JSZip.loadAsync(buffer);  // ← CPU-bound операция
    const manifest = await zip.file('manifest.json')!.async('string');
    const mainJs = await zip.file('main.js')!.async('text');
    // ...
}
```

**Рекомендации:**
1. **Immediate:** Перенести `ZipLoader` в Web Worker с использованием Comlink:
   ```typescript
   // worker/zip-worker.ts
   Comlink.expose({
       async unpack(buffer: ArrayBuffer) {
           const zip = await JSZip.loadAsync(buffer);
           return { manifest, mainJs, css };
       }
   });
   ```
2. **Short-term:** Добавить индикатор загрузки при установке больших плагинов
3. **Long-term:** Рассмотреть использование WASM-based unzip (fflate) для скорости

---

### 4. Hardcoded импорты плагинов в main.tsx (SCALABILITY/HIGH)

> [!IMPORTANT]
> Добавление нового плагина требует изменения бандла.

**Расположение:** `apps/desktop/src/main.tsx` L:64-131

**Проблема:**
```typescript
async function importPlugin(packageName: string): Promise<PluginModule> {
    switch (packageName) {
        case '@notehub/logger':
            return import('@notehub/logger');
        case '@notehub/fs-manager':
            return import('@notehub/fs-manager');
        // ... 20+ cases, каждый требует изменения main.tsx
        default:
            throw new Error(`Unknown plugin package: ${packageName}`);
    }
}
```

**Последствия:**
- Невозможно добавить новый встроенный плагин без ребилда main.tsx
- Невозможно отключить встроенный плагин без ребилда
- Нарушает Open-Closed Principle

**Рекомендации:**
1. **Immediate:** Использовать Vite dynamic import с glob:
   ```typescript
   const pluginModules = import.meta.glob('../../../packages/plugins/**/src/index.{ts,tsx}');
   
   async function importPlugin(packageName: string) {
       const path = resolvePluginPath(packageName);
       return pluginModules[path]();
   }
   ```
2. **Short-term:** Генерировать switch-case автоматически из `plugin-registry.json` при билде
3. **Long-term:** Унифицировать загрузку внутренних и внешних плагинов через единый механизм

---

## 📋 Сводная таблица критических проблем

| # | Проблема | Категория | Срочность | Сложность | Влияние |
|---|----------|-----------|-----------|-----------|---------|
| 1 | Неатомарная запись файлов | Data Integrity | 🔴 Критическая | Средняя | Потеря данных |
| 2 | Отсутствие graceful shutdown | Stability | 🟠 Высокая | Средняя | Потеря несохранённого |
| 3 | Блокировка Main Thread | Performance | 🟠 Высокая | Средняя | UX деградация |
| 4 | Hardcoded plugin imports | Scalability | 🟠 Высокая | Низкая | Tech debt |

---

## 🚀 Рекомендуемые улучшения архитектуры

Помимо критических проблем, предлагаются следующие улучшения для повышения качества и функциональности системы:

### 5. Типизированный контракт событий EventBus (DX/MEDIUM)

**Текущее состояние:**  
EventBus типизирован, но события не имеют строгого контракта. Плагины могут эмитить события с произвольными payload.

**Рекомендация:**
```typescript
// Добавить в @notehub/core/api/events.ts
interface NotehubEventMap {
    'app:vault-opened': { path: string; name: string };
    'editor:file-opened': { path: string; content: string };
    'fs:deleted': { path: string; isDirectory: boolean };
    // ... все события системы
}

// Типизированный emit/on
events.emit<K extends keyof NotehubEventMap>(event: K, payload: NotehubEventMap[K]): void;
```

**Влияние:** Улучшение DX, предотвращение ошибок типизации в runtime.

---

### 6. Система версионирования API (COMPATIBILITY/MEDIUM)

**Текущее состояние:**  
ApiBus регистрирует методы по имени без версии. При изменении сигнатуры API все плагины ломаются.

**Рекомендация:**
```typescript
// Версионированные API
api.register('fs:read-file@v1', handler);
api.register('fs:read-file@v2', newHandler);

// Плагин может указать требуемую версию
api.invoke('fs:read-file@v1', path);  // Гарантированно старая сигнатура
```

**Влияние:** Backward compatibility для сторонних плагинов.

---

### 7. Централизованная система ошибок (OBSERVABILITY/MEDIUM)

**Текущее состояние:**  
Ошибки логируются через `console.error` или Logger plugin, но нет единой точки сбора.

**Рекомендация:**
```typescript
// packages/core/src/errors/ErrorCollector.ts
class ErrorCollector {
    private errors: AppError[] = [];
    
    report(error: AppError): void {
        this.errors.push(error);
        this.emit('error:reported', error);
    }
    
    getRecentErrors(limit = 50): AppError[] {
        return this.errors.slice(-limit);
    }
}

// UI компонент для просмотра ошибок в Settings
```

**Влияние:** Улучшение debugging experience, возможность отправки crash reports.

---

### 8. Ленивая загрузка UI-плагинов (PERFORMANCE/MEDIUM)

**Текущее состояние:**  
Все плагины загружаются при старте приложения, даже если пользователь не использует их функции.

**Рекомендация:**
```typescript
// Lazy loading для тяжёлых feature-плагинов
const EditorPlugin = React.lazy(() => import('@notehub/editor'));
const BacklinksPlugin = React.lazy(() => import('@notehub/backlinks'));

// В bootloader manifest:
{
    "id": "nh.features.backlinks",
    "lazy": true,
    "loadOn": "first-use"  // или "viewport-visible"
}
```

**Влияние:** Уменьшение времени холодного старта на 30-50%.

---

### 9. Persist State Manager (RELIABILITY/MEDIUM)

**Текущее состояние:**  
`StateManager` хранит данные только в памяти. При перезапуске состояние теряется.

**Рекомендация:**
```typescript
// Автоматическая персистенция для выбранных ключей
state.set('editor.openTabs', tabs, { persist: true });

// При загрузке — восстановление из .notehub/state.json
await state.restore();
```

**Влияние:** Сохранение открытых вкладок, позиции скролла, UI-состояния между сессиями.

---

### 10. Health Check система для плагинов (STABILITY/LOW)

**Текущее состояние:**  
Если плагин "зависает" (бесконечный await), это не детектируется.

**Рекомендация:**
```typescript
// Bootloader добавляет heartbeat проверку
class PluginHealthMonitor {
    async checkPluginHealth(pluginId: string): Promise<boolean> {
        const start = Date.now();
        try {
            await Promise.race([
                this.app.api.invoke(`${pluginId}:ping`),
                timeout(5000)
            ]);
            return true;
        } catch {
            this.log('warn', `Plugin ${pluginId} is unresponsive`);
            return false;
        }
    }
}
```

**Влияние:** Возможность автоматического перезапуска/отключения зависших плагинов.

---

### 11. Undo/Redo на уровне файловой системы (UX/MEDIUM)

**Текущее состояние:**  
Undo/Redo работает только внутри CodeMirror для текущего документа.

**Рекомендация:**
```typescript
// fs-manager отслеживает изменения
class FsUndoStack {
    async trackChange(operation: 'write' | 'delete' | 'rename', details: any) {
        // Сохраняем предыдущее состояние
        this.undoStack.push({
            operation,
            timestamp: Date.now(),
            previousContent: await this.readFile(details.path),
            details
        });
    }
    
    async undo(): Promise<void> {
        const lastOp = this.undoStack.pop();
        // Восстанавливаем
    }
}
```

**Влияние:** Возможность отменить удаление файла, переименование и т.д.

---

### 12. Offline-first синхронизация (FUTURE/LOW)

**Текущее состояние:**  
Нет механизма синхронизации между устройствами.

**Рекомендация (концепт):**
```typescript
// CRDTs для конфликт-free редактирования
import { Doc } from 'yjs';

class SyncEngine {
    private doc: Doc;
    
    async sync(remoteEndpoint: string) {
        const remoteState = await fetch(remoteEndpoint);
        applyUpdate(this.doc, remoteState);
    }
}
```

**Влияние:** Подготовка архитектуры для будущей cloud-синхронизации.

---

## 📋 Сводная таблица рекомендуемых улучшений

| # | Улучшение | Категория | Приоритет | Сложность | Влияние |
|---|-----------|-----------|-----------|-----------|---------|
| 5 | Типизированные события | DX | Средний | Низкая | Type safety |
| 6 | Версионирование API | Compatibility | Средний | Средняя | Plugin stability |
| 7 | Система сбора ошибок | Observability | Средний | Низкая | Debugging |
| 8 | Lazy loading плагинов | Performance | Средний | Средняя | Startup time |
| 9 | Persist State Manager | Reliability | Средний | Низкая | Session restore |
| 10 | Health Check система | Stability | Низкий | Средняя | Auto-recovery |
| 11 | FS-level Undo/Redo | UX | Низкий | Высокая | User safety |
| 12 | Offline-first sync | Future | Низкий | Высокая | Multi-device |

---

## 🛠 Приоритетный план действий

### Фаза 1: Немедленные исправления (1-2 недели)
1. [ ] Реализовать атомарную запись через temp файлы
2. [ ] Добавить глобальный error handler с flush буферов
3. [ ] Вынести ZipLoader в Web Worker

### Фаза 2: Краткосрочные улучшения (1 месяц)
1. [ ] Автогенерация plugin imports при билде
2. [ ] Crash recovery при запуске
3. [ ] Типизированный EventBus контракт
4. [ ] Централизованный сбор ошибок

### Фаза 3: Среднесрочные улучшения (2-3 месяца)
1. [ ] Lazy loading для UI-плагинов
2. [ ] Persist State Manager
3. [ ] Версионирование API

### Фаза 4: Долгосрочная стратегия (3+ месяца)
1. [ ] SQLite для критических метаданных
2. [ ] WASM-based парсинг и распаковка
3. [ ] FS-level Undo/Redo
4. [ ] Подготовка к sync engine

---

## Заключение

Архитектура Notehub.md демонстрирует зрелый подход к проектированию (микроядро, чистое разделение, EventBus/ApiBus). Выявленные критические проблемы, особенно **неатомарная запись** и **отсутствие graceful shutdown**, создают риски потери данных пользователя.

Дополнительные рекомендации направлены на улучшение Developer Experience, производительности и подготовку к масштабированию системы.

Рекомендуется приоритизировать исправления в соответствии с предложенным планом, начиная с защиты данных пользователя.

---

*Аудит выполнен: 2026-01-14*  
*Ревизия: 1.1 — убрана секция изоляции плагинов, добавлены рекомендации по развитию*  
*Scope: packages/core, packages/plugins/system, apps/desktop*
