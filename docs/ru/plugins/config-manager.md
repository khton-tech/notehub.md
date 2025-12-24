# Config Manager

**ID:** `nh.system.config-manager`  
**Пакет:** `@notehub/config-manager`  
**Путь:** `packages/plugins/system/config-manager/`

## Описание

Централизованное управление настройками. Предоставляет API для чтения/записи конфигурации с автоматическим сохранением в JSON-файл.

## Зависимости

| Плагин | Версия |
|--------|--------|
| `nh.system.fs-manager` | `^1.0.0` |

## API методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `config:get` | `(key: string, defaultValue?: any) => any` | Получить значение по ключу |
| `config:set` | `(key: string, value: any) => Promise<void>` | Установить значение |
| `config:reload` | `() => Promise<void>` | Перезагрузить конфиг с диска |

## События

| Событие | Payload | Описание |
|---------|---------|----------|
| `config:updated` | `{ key: string, value: any }` | Испускается при изменении значения |

## Хранение

- **Путь:** `.notehub/configs/settings.json`
- **Формат:** JSON с отступами (pretty-print)
- **Кэширование:** Конфиг хранится в памяти для быстрого чтения

## Обработка ошибок

- **Файл не найден:** Создаётся пустой конфиг `{}`
- **Ошибка чтения:** Логируется, используется пустой конфиг
- **Ошибка записи:** Логируется через `console.error`

## Пример использования

```typescript
// Чтение значения
const theme = app.api.invoke('config:get', 'theme', 'dark');

// Установка значения (автоматически сохраняется)
await app.api.invoke('config:set', 'theme', 'light');

// Перезагрузка с диска
await app.api.invoke('config:reload');
```

## Подписка на изменения

```typescript
app.events.on('config:updated', ({ key, value }) => {
  console.log(`Config changed: ${key} = ${value}`);
});
```

## См. также

- [FS Manager](./fs-manager.md) — используется для чтения/записи
- [Отчёт: Config Manager](../reports/2024-12-24-config-manager.md)
