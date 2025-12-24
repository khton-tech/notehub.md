# Logger

**ID:** `nh.system.logger`  
**Пакет:** `@notehub/logger`  
**Путь:** `packages/plugins/system/logger/`

## Описание

Централизованная система логирования. Все плагины используют Logger для вывода сообщений в консоль с унифицированным форматом.

## Зависимости

Нет зависимостей. Logger — фундаментальный плагин.

## API методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `logger:info` | `(source: string, message: string) => void` | Информационное сообщение |
| `logger:warn` | `(source: string, message: string) => void` | Предупреждение |
| `logger:error` | `(source: string, message: string) => void` | Ошибка |

## Формат вывода

```
[2024-12-24T12:00:00.000Z] [INFO] [nh.ui.theme-manager] Theme applied
[2024-12-24T12:00:00.001Z] [WARN] [nh.system.config-manager] Config reset
[2024-12-24T12:00:00.002Z] [ERROR] [nh.system.fs-manager] File not found
```

## Пример использования

```typescript
// Из плагина
private log(level: 'info' | 'warn' | 'error', message: string): void {
    this.app?.api.invoke(`logger:${level}`, this.manifest.id, message);
}

// Вызов
this.log('info', 'Plugin loaded successfully');
```

## Цветовая схема консоли

| Уровень | Цвет |
|---------|------|
| INFO | Белый |
| WARN | Жёлтый |
| ERROR | Красный |

## См. также

- [Архитектура ядра](../core-architecture.md)
