# Отчёт о багах Notehub.md

> **Дата:** 29 декабря 2025  
> **Версия:** 0.1.0  
> **Приоритет:** Критические → Высокий → Средний → Низкий

---

## Критические баги (🔴)

### BUG-001: FileTree обходит EventBus

**Файл:** [`explorer/src/components/FileTree.tsx:78-79`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/components/FileTree.tsx#L78-L79)

```typescript
// ❌ НЕПРАВИЛЬНО: Используется window.dispatchEvent
const event = new CustomEvent('explorer:file-selected', { detail: { path } });
window.dispatchEvent(event);
```

**Проблема:** Компонент `FileTree` отправляет событие через `window.dispatchEvent`, но `EditorPlugin` слушает на `EventBus`:

```typescript
// EditorPlugin (index.tsx:204)
app.events.on('explorer:file-selected', handleFileSelected);
```

**Следствие:** Редактор **никогда не откроет файл** при клике в эксплорере.

**Решение:**
```typescript
// ✅ ПРАВИЛЬНО: Использовать EventBus через контроллер
controller.emitFileSelected(path);

// В ExplorerController:
emitFileSelected(path: string) {
    this.app.events.emit('explorer:file-selected', { path });
}
```

---

### BUG-002: Утечка памяти — fs:watch не отписывается

**Файл:** [`explorer/src/logic/ExplorerController.ts:145-164`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/logic/ExplorerController.ts#L145-L164)

```typescript
private unwatch: (() => void) | null = null;

async startWatching(path: string) {
    if (this.unwatch) {
        this.unwatch();
        this.unwatch = null;
    }
    this.unwatch = await this.app.api.invoke('fs:watch', path, ...);
}
```

**Проблема:** В `ExplorerPlugin.unload()` нет вызова `this.controller.unwatch()`. Watcher остаётся активным.

**Следствие:** Утечка ресурсов Tauri, множественные обработчики при HMR.

**Решение:** Добавить в `ExplorerPlugin.unload()`:
```typescript
if (this.controller) {
    await this.controller.dispose(); // Новый метод
    this.controller = null;
}

// В ExplorerController добавить:
dispose() {
    if (this.unwatch) {
        this.unwatch();
        this.unwatch = null;
    }
    this.listeners.clear();
}
```

---

### BUG-003: DialogManager не отписывает API при unload

**Файл:** [`dialog-manager/src/index.tsx:327-342`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/ui/dialog-manager/src/index.tsx#L327-L342)

```typescript
async unload(_app: NotehubCore): Promise<void> {
    // ❌ НЕТ ОТПИСКИ API!
    // app.api.unregister('dialog:alert');
    // app.api.unregister('dialog:confirm');
    // app.api.unregister('dialog:prompt');
    
    if (this.dialogRoot) {
        this.dialogRoot.unmount();
    }
}
```

**Следствие:** При HMR старые обработчики остаются зарегистрированы → "Handler already registered" ошибка.

**Решение:**
```typescript
async unload(app: NotehubCore): Promise<void> {
    app.api.unregister('dialog:alert');
    app.api.unregister('dialog:confirm');
    app.api.unregister('dialog:prompt');
    // ... остальной cleanup
}
```

---

## Высокий приоритет (🟠)

### BUG-004: Race condition при авто-открытии vault

**Файл:** [`vault-picker/src/index.tsx:63-68`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/vault-picker/src/index.tsx#L63-L68)

```typescript
// Don't await - let it run asynchronously
this.service.openVault(lastOpened).catch((err) => {
    this.log('error', `Failed to auto-open vault: ${err}`);
    this.showWelcomeScreen();
});
return; // ⚠️ Возврат до завершения openVault
```

**Проблема:** Async-операция не awaited, плагин "загружен" до фактического открытия vault.

**Следствие:** `onReady()` вызывается до открытия vault, другие плагины могут обращаться к несуществующим данным.

**Решение:**
```typescript
if (isValid) {
    await this.service.openVault(lastOpened);
    return;
}
```

---

### BUG-005: Workbench дублирует vault-opened событие

**Файлы:**
- [`workbench/src/index.tsx:45`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/workbench/src/index.tsx#L45)
- [`vault-picker/src/logic/VaultService.ts:123`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/vault-picker/src/logic/VaultService.ts#L123)

```typescript
// Workbench:
app.events.emit('app:vault-opened', { path: lastOpened });

// VaultService:
this.app.events.emit('app:vault-opened', { path: fullPath, name });
```

**Проблема:** Событие `app:vault-opened` emit-ится дважды: в Workbench и VaultService.

**Следствие:** Explorer делает двойную загрузку, layout переключается дважды.

**Решение:** Убрать emit из `Workbench.load()`, оставить только в `VaultService.openVault()`.

---

### BUG-006: SmartButtonWidget замыкание на `this.label`

**Файл:** [`editor/src/cm/widgets/SmartButtonWidget.tsx:40-44`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/editor/src/cm/widgets/SmartButtonWidget.tsx#L40-L44)

```typescript
onClick={(e) => {
    console.log(`[SmartButton] Clicked: ${this.label}`);
}}
```

**Проблема:** `this.label` захватывается в замыкание при `renderComponent()`. Если виджет пересоздаётся с новым label, старый handler может ссылаться на stale данные.

**Следствие:** После редактирования `[[BUTTON::OldLabel]]` → `[[BUTTON::NewLabel]]` клик может логировать "OldLabel".

**Решение:** Использовать локальную переменную:
```typescript
protected renderComponent(): ReactNode {
    const label = this.label; // Capture
    return (
        <button onClick={() => console.log(`Clicked: ${label}`)}>
            {label}
        </button>
    );
}
```

---

### BUG-007: EventBus.once() не возвращает unsubscribe

**Файл:** [`core/src/buses/EventBus.ts:91-100`](file:///c:/Users/khton/sources/notehub.md/packages/core/src/buses/EventBus.ts#L91-L100)

```typescript
once<K extends keyof TEvents>(event: K, callback: EventCallback<TEvents[K]>): void {
    const onceWrapper = (payload: TEvents[K]) => {
        this.off(event, onceWrapper);
        callback(payload);
    };
    this.on(event, onceWrapper);
}
```

**Проблема:** Метод возвращает `void`, невозможно отписаться до срабатывания события.

**Следствие:** Если компонент unmount-ится до срабатывания события, handler остаётся.

**Решение:**
```typescript
once<K extends keyof TEvents>(event: K, callback: EventCallback<TEvents[K]>): () => void {
    const onceWrapper = (payload: TEvents[K]) => {
        this.off(event, onceWrapper);
        callback(payload);
    };
    this.on(event, onceWrapper);
    return () => this.off(event, onceWrapper);
}
```

---

## Средний приоритет (🟡)

### BUG-008: VaultPicker мёртвый код

**Файл:** [`vault-picker/src/index.tsx:28, 48-50`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/vault-picker/src/index.tsx#L28)

```typescript
private vaultOpenedHandler: ((payload: unknown) => void) | null = null;

// app.events.on('app:vault-opened', this.vaultOpenedHandler); // Закомментировано
```

**Проблема:** Поле `vaultOpenedHandler` объявлено, но никогда не используется.

**Следствие:** Мёртвый код, путаница при чтении.

---

### BUG-009: ControllersManager singleton pattern

**Файл:** [`controllers-manager/src/index.tsx:17`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/ui/controllers-manager/src/index.tsx#L17)

```typescript
let controllerRegistryInstance: Map<string, React.FC<any>> | null = null;
```

**Проблема:** Module-level singleton доступен всем Controller компонентам, но при HMR или тестах может быть в неконсистентном состоянии.

**Следствие:** Тесты могут видеть контроллеры из предыдущих тестов.

---

### BUG-010: LayoutManager appInstance глобальная

**Файл:** [`layout-manager/src/index.tsx:99`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/ui/layout-manager/src/index.tsx#L99)

```typescript
let appInstance: NotehubCore | null = null;
```

**Проблема:** Аналогично BUG-009. Глобальное состояние вместо Context.

---

### BUG-011: EditorController pathRef stale closure

**Файл:** [`editor/src/index.tsx:167-180`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/editor/src/index.tsx#L167-L180)

```typescript
const path = pathRef.current;
if (path) {
    saveTimeoutRef.current = setTimeout(() => {
        saveFile(path, newContent); // 'path' captured at callback creation
    }, 500);
}
```

**Проблема:** Если пользователь откроет другой файл за 500ms, сохранение запишет `newContent` в **старый** файл.

**Решение:**
```typescript
saveTimeoutRef.current = setTimeout(() => {
    const currentPath = pathRef.current; // Read at execution time
    if (currentPath) {
        saveFile(currentPath, newContent);
    }
}, 500);
```

---

### BUG-012: Live Preview полный rescan документа

**Файл:** [`editor/src/cm/view-plugin.ts:129`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/editor/src/cm/view-plugin.ts#L129)

```typescript
const docText = view.state.doc.toString();
const matches = findPatterns(docText);
```

**Проблема:** На каждое изменение документа выполняется `toString()` всего документа и regexp scan.

**Следствие:** Лаг на больших документах (>5000 строк).

**Решение:** Использовать `RangeSetBuilder` с инкрементальным обновлением или syntaxTree.

---

### BUG-013: EditorLayout sidebar width не сохраняется при resize

**Файл:** [`layout-manager/src/components/EditorLayout.tsx:37`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/ui/layout-manager/src/components/EditorLayout.tsx#L37)

```typescript
app.api.invoke('state:set', 'layout.sidebar.width', sidebarWidth);
```

**Проблема:** Вызов `state:set` без await. Если приложение закроется сразу после resize, изменение может не сохраниться.

---

### BUG-014: Portal ID collision риск

**Файл:** [`bridge/PortalManager.tsx:218-220`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/editor/src/bridge/PortalManager.tsx#L218-L220)

```typescript
let portalIdCounter = 0;

export function generatePortalId(prefix: string = 'portal'): string {
    return `${prefix}-${++portalIdCounter}-${Date.now().toString(36)}`;
}
```

**Проблема:** `Date.now()` имеет миллисекундную точность. При быстрых операциях возможен collision.

**Решение:** Добавить `Math.random()` или использовать UUID.

---

## Низкий приоритет (🟢)

### BUG-015: Bootloader не обрабатывает optional dependencies

**Файл:** [`bootloader/src/Bootloader.ts`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/system/bootloader/src/Bootloader.ts)

**Проблема:** Схема манифеста поддерживает `optionalDependencies`, но Bootloader их игнорирует.

---

### BUG-016: main.tsx жёсткий switch для import

**Файл:** [`desktop/src/main.tsx:59-101`](file:///c:/Users/khton/sources/notehub.md/apps/desktop/src/main.tsx#L59-L101)

**Проблема:** Каждый новый плагин требует добавления в switch-case.

---

### BUG-017: StatusBar props initialStatus/initialMessage игнорируются

**Файл:** [`ck-standard/src/components/StatusBar.tsx:15-20`](file:///c:/Users/khton/sources/notehub.md/packages/plugins/ui/ck-standard/src/components/StatusBar.tsx#L15-L20)

```typescript
const [state, setState] = useState<StatusState>({
    status: initialStatus || 'ready',
    message: initialMessage || 'No file open'
});
```

**Проблема:** `useState` инициализирует только при первом render. Изменение props не обновляет state.

---

## Сводка

| Категория | Количество |
|-----------|------------|
| 🔴 Критические | 3 |
| 🟠 Высокий приоритет | 4 |
| 🟡 Средний приоритет | 7 |
| 🟢 Низкий приоритет | 3 |
| **Всего** | **17** |

---

## Рекомендуемый порядок исправления

1. **BUG-001** — FileTree EventBus (блокирует основной функционал)
2. **BUG-002** — fs:watch утечка памяти
3. **BUG-003** — DialogManager API cleanup
4. **BUG-005** — Дублирование vault-opened
5. **BUG-011** — EditorController stale path
6. Остальные по приоритету

---

> *Отчёт сгенерирован на основе статического анализа кода*
