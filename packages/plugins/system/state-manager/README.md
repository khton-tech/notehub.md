# State Manager Plugin

**ID:** `nh.system.state-manager`  
**Type:** System  
**Dependencies:** None

## Overview

Менеджер runtime-состояния для Notehub.md. Хранит данные сессии в памяти и предоставляет API для их чтения/записи.

> [!IMPORTANT]
> **State Manager vs Config Manager**
>
> | Аспект | `config-manager` | `state-manager` |
> |--------|------------------|-----------------|
> | **Назначение** | Настройки приложения | Данные сессии |
> | **Персистентность** | Сохраняется на диск | Только в памяти |
> | **Примеры данных** | Тема, шрифт, язык | Открытый таб, позиция скролла |
> | **Когда сбрасывается** | Никогда (явное изменение) | При перезапуске приложения |
>
> Используйте `config-manager` для настроек пользователя.  
> Используйте `state-manager` для временных данных сессии.

## API Methods

### `state:set(key, value)`

Сохраняет значение в состояние. Эмитит событие `state:changed:{key}`.

```typescript
await app.api.invoke('state:set', 'editor.activeTabId', 'tab-123');
await app.api.invoke('state:set', 'sidebar.expandedFolders', ['folder1', 'folder2']);
```

**Parameters:**
- `key: string` — Ключ (рекомендуется namespace-стиль: `component.property`)
- `value: any` — Любое сериализуемое значение

### `state:get(key)`

Возвращает значение по ключу или `undefined`.

```typescript
const activeTab = await app.api.invoke('state:get', 'editor.activeTabId');
// 'tab-123' или undefined
```

### `state:delete(key)`

Удаляет значение. Возвращает `true` если ключ существовал.

```typescript
const deleted = await app.api.invoke('state:delete', 'editor.activeTabId');
// true или false
```

### `state:has(key)`

Проверяет наличие ключа.

```typescript
const exists = await app.api.invoke('state:has', 'editor.activeTabId');
// true или false
```

### `state:keys()`

Возвращает массив всех ключей.

```typescript
const keys = await app.api.invoke('state:keys');
// ['editor.activeTabId', 'sidebar.expandedFolders', ...]
```

### `state:dump()`

Экспортирует всё состояние как объект. Полезно для сохранения сессии при закрытии приложения.

```typescript
const sessionData = await app.api.invoke('state:dump');
// { 'editor.activeTabId': 'tab-123', ... }

// Можно сохранить через fs-manager
await app.api.invoke('fs:write-text-file', 
    '.notehub/session.json', 
    JSON.stringify(sessionData)
);
```

### `state:restore(dump)`

Восстанавливает состояние из дампа. Применяется при запуске приложения.

```typescript
// При старте приложения
const sessionJson = await app.api.invoke('fs:read-text-file', '.notehub/session.json');
const sessionData = JSON.parse(sessionJson);
await app.api.invoke('state:restore', sessionData);
```

### `state:clear()`

Очищает всё состояние. Эмитит `state:changed:{key}` для каждого удалённого ключа.

```typescript
await app.api.invoke('state:clear');
```

## Events

### `state:changed:{key}`

Эмитится при изменении любого ключа (set, delete, clear).

**Payload:**

```typescript
interface StateChangeEvent {
    key: string;           // Изменённый ключ
    value: any;            // Новое значение (undefined при удалении)
    previousValue?: any;   // Предыдущее значение
    deleted?: boolean;     // true если ключ был удалён
}
```

**Пример подписки:**

```typescript
// Подписка на конкретный ключ
app.events.on('state:changed:editor.activeTabId', (event) => {
    console.log(`Tab changed from ${event.previousValue} to ${event.value}`);
});

// Динамическая подписка
const key = 'sidebar.width';
app.events.on(`state:changed:${key}`, (event) => {
    // React to sidebar width changes
});
```

## Usage Patterns

### UI State Synchronization

```typescript
// В React-компоненте
useEffect(() => {
    const unsubscribe = app.events.on('state:changed:sidebar.collapsed', (event) => {
        setSidebarCollapsed(event.value);
    });
    
    return () => unsubscribe();
}, []);

// При клике на toggle
const toggleSidebar = async () => {
    const current = await app.api.invoke('state:get', 'sidebar.collapsed');
    await app.api.invoke('state:set', 'sidebar.collapsed', !current);
};
```

### Session Persistence

```typescript
// При закрытии приложения
window.addEventListener('beforeunload', async () => {
    const state = await app.api.invoke('state:dump');
    await app.api.invoke('fs:write-text-file', 
        '.notehub/session.json', 
        JSON.stringify(state, null, 2)
    );
});

// При старте приложения
async function restoreSession() {
    try {
        const exists = await app.api.invoke('fs:exists', '.notehub/session.json');
        if (exists) {
            const json = await app.api.invoke('fs:read-text-file', '.notehub/session.json');
            await app.api.invoke('state:restore', JSON.parse(json));
        }
    } catch (error) {
        console.warn('Failed to restore session:', error);
    }
}
```

## Best Practices

1. **Namespace ключи**: Используйте формат `component.property` для ключей
2. **Serializable values**: Храните только JSON-сериализуемые данные
3. **Не дублируйте конфиг**: Настройки пользователя → `config-manager`
4. **Очищайте при необходимости**: Используйте `state:delete` для освобождения памяти
