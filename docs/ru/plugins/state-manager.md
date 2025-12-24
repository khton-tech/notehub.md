# State Manager

**ID:** `nh.system.state-manager`  
**Пакет:** `@notehub/state-manager`  
**Путь:** `packages/plugins/system/state-manager/`

## Описание

Реактивное хранилище состояния на основе Signals. Позволяет плагинам создавать и подписываться на изменения глобального состояния.

## Зависимости

| Плагин | Версия |
|--------|--------|
| `nh.system.logger` | `^1.0.0` |

## API методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `state:create` | `<T>(key: string, initial: T) => Signal<T>` | Создать signal с начальным значением |
| `state:get` | `<T>(key: string) => T \| undefined` | Получить текущее значение |
| `state:set` | `<T>(key: string, value: T) => void` | Установить значение |
| `state:subscribe` | `<T>(key: string, cb: (val: T) => void) => () => void` | Подписаться на изменения |

## Пример использования

```typescript
// Создание состояния
app.api.invoke('state:create', 'user.theme', 'dark');

// Чтение
const theme = app.api.invoke('state:get', 'user.theme');

// Изменение
app.api.invoke('state:set', 'user.theme', 'light');

// Подписка на изменения
const unsubscribe = app.api.invoke('state:subscribe', 'user.theme', (value) => {
    console.log('Theme changed to:', value);
});

// Отписка
unsubscribe();
```

## Архитектура

- **Signal-based:** Все состояния хранятся как Signals для реактивности
- **In-memory:** Состояние не персистится (для персистенции используйте Config Manager)
- **Type-safe:** Типизированные геттеры и сеттеры

## См. также

- [Config Manager](./config-manager.md) — для персистентных настроек
- [Logger](./logger.md) — используется для логирования
