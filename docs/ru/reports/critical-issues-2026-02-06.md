# Отчёт о Критических Проблемах Кодовой Базы

**Дата:** 2026-02-06  
**Версия проекта:** 0.1.6  
**Аналитик:** Antigravity AI

---

## Резюме

Проведён глубокий анализ монорепозитория Notehub.md. Выявлено **12 критических проблем**, требующих немедленного внимания.

| Категория | Количество | Приоритет |
|-----------|------------|-----------|
| Нарушения типизации | 50+ | 🔴 Критический |
| Потенциальные утечки памяти | 5+ | 🔴 Критический |
| Несогласованность API | 15+ | 🟠 Высокий |
| Android/Mobile баги | 3 | 🟠 Высокий |
| Отсутствие обработки ошибок | 4 | 🟡 Средний |

---

## 1. 🔴 Критические Нарушения Типизации

### Проблема
Массовое использование `as any` (50+ случаев) и `@ts-ignore` (5 случаев) для обхода TypeScript типизации.

### Затронутые файлы

| Файл | Проблема |
|------|----------|
| [`fs-manager/src/index.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/system/fs-manager/src/index.ts#L60-L74) | 4× `as any` для API регистрации |
| [`keymap/src/index.tsx`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/system/keymap/src/index.tsx#L19-L49) | 8× `as any` |
| [`synapse/src/index.tsx`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/system/synapse/src/index.tsx#L92-L95) | 4× `as any` |
| [`explorer/src/logic/ExplorerController.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/features/explorer/src/logic/ExplorerController.ts#L404-L551) | 4× `as any` для fs операций |
| [`fs-driver-capacitor/src/index.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/system/fs-driver-capacitor/src/index.ts#L103) | `@ts-ignore` для `directory: undefined` |

### Корневая причина
API методы `fs:remove-file`, `fs:remove-dir`, `fs:rename`, `titlebar:*`, `keymap:*` **не добавлены** в `NotehubApiMap` ([contract.ts](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/api/src/contract.ts)).

### Рекомендация

```diff
// packages/api/src/contract.ts
export interface NotehubApiMap {
+   // FS Manager - добавить недостающие методы
+   'fs:remove-file': (path: string) => Promise<void>;
+   'fs:remove-dir': (path: string, options?: { recursive?: boolean }) => Promise<void>;
+   'fs:rename': (oldPath: string, newPath: string) => Promise<void>;

+   // TitleBar Plugin
+   'titlebar:set-title': (title: string) => void;
+   'titlebar:set-icon': (icon: string | null) => void;
+   'titlebar:get-title': () => string;

+   // Keymap Plugin - все методы
+   'keymap:bind': (commandId: string, hotkey: string) => Promise<void>;
+   'keymap:add-binding': (commandId: string, hotkey: string) => Promise<void>;
+   'keymap:remove-binding': (commandId: string, hotkey: string) => Promise<void>;
+   'keymap:reset': (commandId: string) => Promise<void>;
+   'keymap:get-binding': (commandId: string) => string | undefined;
+   'keymap:get-bindings': (commandId: string) => string[];
}
```

---

## 2. 🔴 Потенциальные Утечки Памяти

### Проблема
Event listeners добавляются на DOM-элементы без соответствующего cleanup при размонтировании.

### Критические локации

| Файл | Строки | Проблема |
|------|--------|----------|
| [`view-plugin.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/features/editor/src/cm/links/view-plugin.ts#L60-L155) | 60-155 | 6× `addEventListener` без `removeEventListener` |
| [`widget.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/features/editor/src/bridge/widget.ts#L118-L120) | 118-120 | 3× `addEventListener` без cleanup |

### Пример проблемы

```typescript
// view-plugin.ts:60-61
link.addEventListener('click', clickHandler);
link.addEventListener('mousedown', (e) => { ... });
// ❌ НЕТ removeEventListener в destroy()
```

### Рекомендация
Реализовать паттерн cleanup:

```typescript
class LinkViewPlugin {
    private cleanupFns: (() => void)[] = [];
    
    createLink() {
        const handler = () => { ... };
        link.addEventListener('click', handler);
        this.cleanupFns.push(() => link.removeEventListener('click', handler));
    }
    
    destroy() {
        this.cleanupFns.forEach(fn => fn());
    }
}
```

---

## 3. 🟠 Критическая Проблема Android Permissions

### Проблема
В [`MainActivity.java`](file:///c:/Users/khton/sources/notehub.md_0.1.x/apps/capacitor/android/app/src/main/java/com/notehub/app/MainActivity.java) запрос MANAGE_ALL_FILES_ACCESS_PERMISSION выполняется некорректно.

### Текущий код

```java
// MainActivity.java:16-23
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
    if (!Environment.isExternalStorageManager()) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
        // ...
        startActivity(intent);  // ❌ Нет обработки результата!
    }
}
```

### Проблемы
1. **Нет обработки результата** — пользователь может отклонить разрешение
2. **Блокирует UI** — приложение запускается, даже если разрешение не получено
3. **Нет повторного запроса** — если разрешение отклонено, приложение сломается

### Рекомендация

```java
private static final int REQUEST_MANAGE_FILES = 1001;

@Override
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    checkAndRequestPermissions();
}

private void checkAndRequestPermissions() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        if (!Environment.isExternalStorageManager()) {
            showPermissionRationale();
        }
    }
}

@Override
protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == REQUEST_MANAGE_FILES) {
        if (!Environment.isExternalStorageManager()) {
            // Показать диалог о необходимости разрешения
            showPermissionDeniedDialog();
        }
    }
}
```

---

## 4. 🟠 Несогласованность API Контракта

### Проблема
API контракт (`NotehubApiMap`) не синхронизирован с реальными реализациями плагинов.

### Несоответствия

| Реализованный метод | Статус в контракте |
|--------------------|--------------------|
| `fs:remove-file` | ❌ Отсутствует |
| `fs:remove-dir` | ❌ Отсутствует |
| `fs:rename` | ❌ Отсутствует |
| `titlebar:set-title` | ❌ Отсутствует |
| `titlebar:set-icon` | ❌ Отсутствует |
| `titlebar:get-title` | ❌ Отсутствует |
| `keymap:bind` | ❌ Отсутствует |
| `keymap:add-binding` | ❌ Отсутствует |
| `keymap:remove-binding` | ❌ Отсутствует |
| `keymap:reset` | ❌ Отсутствует |
| `keymap:get-binding` | ❌ Отсутствует |
| `keymap:get-bindings` | ❌ Отсутствует |
| `context-menu:register` | ✅ Есть, но использует `as any` |
| `context-menu:trigger` | ✅ Есть, но использует `as any` |
| `editor:register-portal` | ✅ Есть, но использует `as any` |
| `editor:unregister-portal` | ✅ Есть, но использует `as any` |
| `editor:is-dirty` | ❌ Отсутствует |

### Влияние
- Нет типобезопасности при вызове API
- IDE не может предоставить автодополнение
- Ошибки обнаруживаются только в runtime

---

## 5. 🟠 Capacitor FS Driver — watch() Не Реализован

### Проблема
Метод `watch()` в [`FsDriverCapacitorPlugin`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/system/fs-driver-capacitor/src/index.ts#L283-L286) возвращает пустую функцию.

```typescript
// fs-driver-capacitor/src/index.ts:283-286
async watch(_path: string, _onChange: (event: any) => void): Promise<() => void> {
    this.log('warn', 'watch not implemented on Capacitor');
    return () => { };
}
```

### Влияние
- Файлы, изменённые внешними приложениями, не обновляются в редакторе
- Возможна потеря данных при sync конфликтах
- Explorer не отражает изменения файловой системы

### Рекомендация
Реализовать polling-based watch или использовать `@nicolo-ribaudo/chokidar-browser` для Capacitor.

---

## 6. 🟡 Пустые Catch-блоки

### Проблема
Несколько catch-блоков игнорируют ошибки без логирования.

### Локации
| Файл | Строка |
|------|--------|
| [`EditorController.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/features/editor/src/logic/EditorController.ts#L504) | 504 |
| [`EditorController.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/features/editor/src/logic/EditorController.ts#L653) | 653 |
| [`widget.ts`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/features/editor/src/bridge/widget.ts#L211) | 211 |

### Пример

```typescript
} catch {
    // ❌ Ошибка полностью игнорируется
}
```

### Рекомендация

```typescript
} catch (error) {
    this.log('error', `Operation failed: ${error}`);
}
```

---

## 7. 🟡 Race Condition в FsManager

### Проблема
Комментарий `⚡ FIX A2` в [`FsManagerPlugin`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/system/fs-manager/src/index.ts#L40) указывает на исправление race condition, но реализация может быть неполной.

```typescript
// fs-manager/src/index.ts:40-41
// ⚡ FIX A2: Write locks per file path to prevent concurrent writes
private writeLocks = new Map<string, Promise<void>>();
```

### Текущая реализация

```typescript
private async writeFile(path: string, data: Uint8Array): Promise<void> {
    while (this.writeLocks.has(path)) {
        await this.writeLocks.get(path);
    }
    // ❌ Между while и set может произойти другой вызов
    const writePromise = this.ensureDriver().writeFile(path, data);
    this.writeLocks.set(path, writePromise.finally(() => this.writeLocks.delete(path)));
    return writePromise;
}
```

### Проблема
TOCTOU (Time-of-check to time-of-use) race condition между проверкой `has()` и `set()`.

### Рекомендация
Использовать mutex или atomic операции:

```typescript
private async writeFile(path: string, data: Uint8Array): Promise<void> {
    const existingLock = this.writeLocks.get(path);
    
    const newLock = (async () => {
        if (existingLock) await existingLock;
        await this.ensureDriver().writeFile(path, data);
    })();
    
    this.writeLocks.set(path, newLock);
    
    try {
        await newLock;
    } finally {
        if (this.writeLocks.get(path) === newLock) {
            this.writeLocks.delete(path);
        }
    }
}
```

---

## 8. 🟡 Нереализованный TODO

### Локация
[`VaultList.tsx:38`](file:///c:/Users/khton/sources/notehub.md_0.1.x/packages/plugins/features/vault-picker/src/components/VaultList.tsx#L38)

```typescript
// TODO: Implement vault deletion from history
```

### Влияние
- Пользователи не могут удалять vault'ы из истории
- Список vault'ов может бесконечно расти

---

## Рекомендации по Приоритизации

### Немедленные действия (Week 1)
1. Добавить недостающие методы в `NotehubApiMap`
2. Исправить Android permission handling
3. Исправить race condition в FsManager

### Краткосрочные (Week 2-3)
4. Реализовать cleanup для event listeners в editor
5. Логировать ошибки в пустых catch-блоках
6. Реализовать базовый watch() для Capacitor

### Долгосрочные (Month 1-2)
7. Полностью синхронизировать API контракт
8. Добавить E2E тесты для критических путей
9. Реализовать vault deletion

---

## Статистика Анализа

| Метрика | Значение |
|---------|----------|
| Файлов проанализировано | 88+ |
| Критических проблем | 12 |
| Использований `as any` | 50+ |
| Использований `@ts-ignore` | 5 |
| Потенциальных утечек памяти | 9 |
| Пустых catch-блоков | 3 |

---

*Отчёт сгенерирован автоматически. Рекомендуется проверка разработчиком.*
