<h1 align="center">📝 Logger Plugin</h1>

<p align="center">
  <code>nh.system.logger</code> • System • No dependencies
</p>

---

## Overview

Централизованная система логирования для Notehub.md. Все сообщения форматируются единообразно и эмитятся как события для возможности отображения в Developer Console.

## 📊 Log Levels

| Level | Emoji | Использование |
|-------|-------|---------------|
| `INFO` | ℹ️ | Информационные сообщения |
| `WARN` | ⚠️ | Предупреждения |
| `ERROR` | ❌ | Ошибки |
| `CRITICAL` | 🔥 | Критические ошибки |

---

## 🔌 API Methods

### `logger:log(level, source, message)`

Основной метод логирования.

```typescript
await app.api.invoke('logger:log', 'WARN', 'MyPlugin', 'Something might be wrong');
```

### `logger:info(source, message)`

```typescript
await app.api.invoke('logger:info', 'MyPlugin', 'Operation completed');
```

### `logger:warn(source, message)`

```typescript
await app.api.invoke('logger:warn', 'MyPlugin', 'Using deprecated feature');
```

### `logger:error(source, message)`

```typescript
await app.api.invoke('logger:error', 'MyPlugin', 'Failed to load resource');
```

---

## 📤 Events

### `sys:log`

Эмитится при каждом вызове логгера.

```typescript
interface LogEntry {
    timestamp: string;  // ISO 8601
    level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
    source: string;
    message: string;
}

app.events.on('sys:log', (entry: LogEntry) => {
    console.log(`[${entry.level}] ${entry.message}`);
});
```

---

## 📋 Message Format

```
[2024-12-24T22:45:30.123Z] [INFO] [ConfigManager] Configuration loaded
```
