# Logger Plugin

**ID:** `nh.system.logger`  
**Type:** System  
**Dependencies:** None

## Overview

Централизованная система логирования для Notehub.md. Все сообщения форматируются единообразно и эмитятся как события, что позволяет создать Developer Console UI в будущем.

## Log Levels

| Level | Description |
|-------|-------------|
| `LOG` | Обычное информационное сообщение |
| `INFO` | Информационное сообщение (синоним LOG) |
| `WARN` | Предупреждение о потенциальной проблеме |
| `ERROR` | Ошибка, которая не прерывает работу |
| `CRITICAL` | Критическая ошибка |

## API Methods

### `logger:log(level, source, message)`

Основной метод логирования.

```typescript
await app.api.invoke('logger:log', 'WARN', 'MyPlugin', 'Something might be wrong');
```

**Parameters:**
- `level: string` — Уровень логирования (LOG, INFO, WARN, ERROR, CRITICAL)
- `source: string` — Идентификатор источника (обычно имя плагина/модуля)
- `message: string` — Текст сообщения

### `logger:info(source, message)`

Shortcut для уровня INFO.

```typescript
await app.api.invoke('logger:info', 'MyPlugin', 'Operation completed');
```

### `logger:warn(source, message)`

Shortcut для уровня WARN.

```typescript
await app.api.invoke('logger:warn', 'MyPlugin', 'Using deprecated feature');
```

### `logger:error(source, message)`

Shortcut для уровня ERROR.

```typescript
await app.api.invoke('logger:error', 'MyPlugin', 'Failed to load resource');
```

## Message Format

Все сообщения форматируются по шаблону:

```
[ISO-TIME] [LEVEL] [SOURCE] Message
```

**Пример:**
```
[2024-12-24T22:45:30.123Z] [INFO] [ConfigManager] Configuration loaded
```

## Events

### `sys:log`

Эмитится при каждом вызове логгера. Payload содержит структуру `LogEntry`:

```typescript
interface LogEntry {
    timestamp: string;  // ISO 8601 format
    level: LogLevel;    // LOG | INFO | WARN | ERROR | CRITICAL
    source: string;     // Source identifier
    message: string;    // Log message
}
```

**Использование:**

```typescript
app.events.on('sys:log', (entry: LogEntry) => {
    // Display in Developer Console UI
    console.log(`[${entry.level}] ${entry.message}`);
});
```

## Usage Example

```typescript
// In your plugin
async load(app: NotehubCore): Promise<void> {
    // Using full method
    await app.api.invoke('logger:log', 'INFO', 'MyPlugin', 'Starting...');
    
    // Using shortcuts
    await app.api.invoke('logger:info', 'MyPlugin', 'Connected to server');
    await app.api.invoke('logger:warn', 'MyPlugin', 'Rate limit approaching');
    await app.api.invoke('logger:error', 'MyPlugin', 'Connection failed');
}
```
