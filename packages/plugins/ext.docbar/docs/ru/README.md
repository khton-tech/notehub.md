<h1 align="center">🔌 Руководство разработчика плагинов Notehub</h1>

<p align="center">
  <em>Создавайте мощные плагины для Notehub.md — расширяемого приложения для заметок</em>
</p>

<p align="center">
  <a href="#-быстрый-старт">Быстрый старт</a> •
  <a href="#-документация">Документация</a> •
  <a href="#-примеры">Примеры</a> •
  <a href="#-справочник-api">Справочник API</a>
</p>

---

## 🚀 Быстрый старт

### Вариант 1: Генератор плагинов (Рекомендуется)

Для **внутренних плагинов** (часть монорепо):

```bash
pnpm gen:plugin
```

Интерактивный CLI:
1. Запросит имя плагина (kebab-case, например `my-feature`)
2. Предложит выбрать категорию (`system`, `ui`, `features`)
3. Сгенерирует полную структуру плагина

**Результат:**
```
🔌 Notehub.md Plugin Generator

✔ Plugin name (kebab-case): word-counter
✔ Select plugin category: features - User-facing features

📦 Creating plugin: nh.features.word-counter
   Path: packages/plugins/features/word-counter

   ✅ Created: package.json
   ✅ Created: tsconfig.json
   ✅ Created: manifest.json
   ✅ Created: src/index.ts

✨ Plugin created successfully!
```

---

### Вариант 2: Ручная настройка (Внешние плагины)

Для плагинов, загружаемых в runtime из хранилища:

#### 1. Создайте папку плагина

```bash
mkdir my-plugin && cd my-plugin
npm init -y
npm install @notehub/api typescript esbuild --save-dev
```

---

## 📚 Документация

| Глава | Описание |
|-------|----------|
| [Начало работы](01-getting-started.md) | Требования, настройка, первый плагин |
| [Архитектура](02-architecture.md) | Жизненный цикл, EventBus, ApiBus |
| [Справочник API](03-api-reference.md) | Все 50+ методов API с примерами |
| [Виджеты](04-widgets.md) | Кастомные React-компоненты в заметках |
| [Настройки](05-settings.md) | Добавление UI конфигурации |
| [Контекстное меню](06-context-menu.md) | Интеграция правой кнопки мыши |
| [Примеры](07-examples.md) | Полные рабочие плагины |

---

## 💡 Что могут делать плагины?

| Возможность | API |
|-------------|-----|
| 📁 Чтение/запись файлов | `fs:read-text-file`, `fs:write-text-file` |
| ⚙️ Сохранение настроек | `config:get`, `config:set` |
| 🎨 Регистрация тем | `theme:register`, `theme:set` |
| 🧩 Создание виджетов | `editor:register-widget` |
| 📋 Контекстные меню | `context-menu:register` |
| 💬 Показ диалогов | `dialog:alert`, `dialog:confirm` |
| 📡 Подписка на события | `ctx.subscribe()` |

---

## 🎯 Примеры

### Hello World
```typescript
ctx.registerApi('hello:greet', (name: string) => `Привет, ${name}!`);
```

### Виджет прогресс-бара
```typescript
await ctx.invokeApi('editor:register-widget', 'progress', /\[progress:(\d+)\]/g, 
    ({ match }) => <ProgressBar value={parseInt(match[1])} />);
```

### Наблюдатель за файлами
```typescript
ctx.subscribe<{ path: string }>('explorer:file-selected', (payload) => {
    console.log('Выбрано:', payload.path);
});
```

---

## 🔗 Ссылки

- [Главный README](../../README.md)
- [Пакет API](../../packages/api)
- [Примеры плагинов](../../packages/plugins)

---

<p align="center">
  <strong>Удачной разработки! 🎉</strong>
</p>
