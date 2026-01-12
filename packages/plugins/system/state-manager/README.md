<h1 align="center">💾 State Manager Plugin</h1>

<p align="center">
  <code>nh.system.state-manager</code> • System • Runtime state management
</p>

---

## Overview

Менеджер runtime-состояния для Notehub.md. Хранит данные сессии в памяти и предоставляет API для их чтения/записи.

> [!IMPORTANT]
> **State Manager vs Config Manager**
>
> | Аспект | `config-manager` | `state-manager` |
> |--------|------------------|-----------------|
> | **Назначение** | Настройки | Данные сессии |
> | **Персистентность** | На диске | В памяти |
> | **Примеры** | Тема, шрифт | Открытый таб, скролл |
> | **Сброс** | Никогда | При перезапуске |

---

## 🔌 API Methods

### `state:set(key, value)`

```typescript
await app.api.invoke('state:set', 'editor.activeTabId', 'tab-123');
```

### `state:get(key)`

```typescript
const activeTab = await app.api.invoke('state:get', 'editor.activeTabId');
```

### `state:delete(key)`

```typescript
const deleted = await app.api.invoke('state:delete', 'editor.activeTabId');
```

### `state:has(key)`

```typescript
const exists = await app.api.invoke('state:has', 'editor.activeTabId');
```

### `state:keys()`

```typescript
const keys = await app.api.invoke('state:keys');
```

### `state:dump()` / `state:restore(dump)`

```typescript
// Save session
const sessionData = await app.api.invoke('state:dump');
await app.api.invoke('fs:write-text-file', '.notehub/session.json', JSON.stringify(sessionData));

// Restore session
const data = JSON.parse(await app.api.invoke('fs:read-text-file', '.notehub/session.json'));
await app.api.invoke('state:restore', data);
```

### `state:clear()`

```typescript
await app.api.invoke('state:clear');
```

---

## 📤 Events

### `state:changed:{key}`

```typescript
app.events.on('state:changed:editor.activeTabId', (event) => {
    console.log(`Changed from ${event.previousValue} to ${event.value}`);
});
```

**Payload:**
```typescript
interface StateChangeEvent {
    key: string;
    value: any;
    previousValue?: any;
    deleted?: boolean;
}
```

---

## 💡 Best Practices

1. **Namespace keys**: `component.property`
2. **JSON-serializable values** only
3. **User settings** → use `config-manager`
4. **Cleanup**: use `state:delete` to free memory
