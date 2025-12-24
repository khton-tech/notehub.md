# Архитектура ядра (@notehub/core)

## Обзор

Ядро Notehub.md реализует паттерн **микроядерной архитектуры** (Microkernel Architecture). Само ядро содержит минимальный набор функций, а вся бизнес-логика вынесена в плагины.

## Компоненты ядра

### 1. NotehubCore

Главный класс приложения, координирующий все компоненты.

```typescript
import { NotehubCore } from '@notehub/core';

const app = new NotehubCore();

// Регистрация плагинов
app.registerPlugin(myPlugin);

// Инициализация (загрузка всех плагинов)
await app.init();

// Завершение работы
await app.shutdown();
```

**Свойства:**
- `events: EventBus` — шина событий
- `api: ApiBus` — шина API

**Методы:**
- `registerPlugin(plugin)` — регистрация плагина
- `unregisterPlugin(pluginId)` — удаление плагина
- `getPlugin(pluginId)` — получение плагина по ID
- `init()` — инициализация и загрузка плагинов
- `shutdown()` — выгрузка плагинов и завершение

---

### 2. EventBus

Типизированная шина событий для pub/sub коммуникации между плагинами.

```typescript
// Определение типов событий
interface AppEvents {
  'user:login': { userId: string };
  'note:created': { noteId: string; title: string };
}

const app = new NotehubCore<AppEvents>();

// Подписка на событие
app.events.on('user:login', (payload) => {
  console.log(`User logged in: ${payload.userId}`);
});

// Публикация события
app.events.emit('user:login', { userId: '123' });

// Отписка
app.events.off('user:login', handler);

// Одноразовая подписка
app.events.once('note:created', handler);
```

**Методы:**
- `on(event, callback)` — подписка
- `off(event, callback)` — отписка
- `emit(event, payload?)` — публикация
- `once(event, callback)` — одноразовая подписка
- `clear(event?)` — очистка подписчиков

---

### 3. ApiBus

Шина для регистрации и вызова API-методов между плагинами.

```typescript
// Плагин A регистрирует метод
app.api.register('notes.create', async (title: string, content: string) => {
  const note = await createNote(title, content);
  return note;
});

// Плагин B вызывает метод
const note = await app.api.invoke<Note>('notes.create', 'My Note', 'Content...');
```

**Методы:**
- `register(name, handler)` — регистрация метода
- `unregister(name)` — удаление метода
- `invoke<T>(name, ...args)` — вызов метода
- `has(name)` — проверка существования
- `getRegisteredMethods()` — список всех методов

---

## Типы

### PluginManifest

Метаданные плагина:

```typescript
interface PluginManifest {
  id: string;           // Уникальный ID (напр. "nh.system.logger")
  name: string;         // Человекочитаемое имя
  version: string;      // Семантическая версия
  type: 'system' | 'ui' | 'feature';
  dependencies?: string[]; // ID зависимых плагинов
}
```

### IPlugin

Интерфейс плагина:

```typescript
interface IPlugin {
  readonly manifest: PluginManifest;
  load(app: NotehubCore): Promise<void> | void;
  unload(app: NotehubCore): Promise<void> | void;
}
```

---

## Жизненный цикл

```
┌─────────────────────────────────────────────────────────────┐
│                      NotehubCore                            │
├─────────────────────────────────────────────────────────────┤
│  1. new NotehubCore()     → Создание ядра                   │
│  2. registerPlugin(...)   → Регистрация плагинов в реестре  │
│  3. init()                → Вызов load() у всех плагинов    │
│  4. ... работа приложения ...                               │
│  5. shutdown()            → Вызов unload() в обратном порядке│
└─────────────────────────────────────────────────────────────┘
```

## Будущие улучшения

- [ ] **Dependency Graph** — топологическая сортировка плагинов по зависимостям
- [ ] **Hot Reload** — горячая перезагрузка плагинов
- [ ] **Sandbox** — изоляция плагинов для безопасности
