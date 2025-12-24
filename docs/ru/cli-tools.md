# CLI инструменты

## pnpm gen:plugin

Интерактивный генератор плагинов.

### Использование

```bash
pnpm gen:plugin
```

### Процесс

1. Скрипт запросит **имя плагина** (в kebab-case)
2. Предложит выбрать **категорию** (system, ui, features)
3. Автоматически создаст структуру папок и файлы

### Пример

```
$ pnpm gen:plugin

🔌 Notehub.md Plugin Generator

✔ Plugin name (kebab-case): theme-manager
✔ Select plugin category: ui - UI components and themes

📦 Creating plugin: nh.ui.theme-manager
   Path: packages/plugins/ui/theme-manager

   ✅ Created: packages/plugins/ui/theme-manager/package.json
   ✅ Created: packages/plugins/ui/theme-manager/tsconfig.json
   ✅ Created: packages/plugins/ui/theme-manager/manifest.json
   ✅ Created: packages/plugins/ui/theme-manager/src/index.ts

✨ Plugin created successfully!

Next steps:
   1. Run: pnpm install
   2. Build: pnpm --filter @notehub/theme-manager build
   3. Import in your app and register with NotehubCore
```

### Генерируемые файлы

| Файл | Описание |
|------|----------|
| `package.json` | Конфигурация пакета с зависимостью на `@notehub/core` |
| `tsconfig.json` | TypeScript конфиг, расширяющий базовый |
| `manifest.json` | Метаданные плагина (id, name, version, type) |
| `src/index.ts` | Класс плагина с базовой реализацией `IPlugin` |

---

## Другие команды

| Команда | Описание |
|---------|----------|
| `pnpm install` | Установка/обновление зависимостей всех пакетов |
| `pnpm build` | Сборка всех пакетов в монорепозитории |
| `pnpm dev` | Запуск watch-режима для всех пакетов |
| `pnpm clean` | Очистка dist-папок во всех пакетах |
| `pnpm --filter <pkg> build` | Сборка конкретного пакета |

---

## Техническая реализация

Скрипт находится в `scripts/create-plugin.ts` и использует:

- **tsx** — TypeScript executor для запуска .ts без компиляции
- **prompts** — библиотека для интерактивного CLI

### Расширение скрипта

Для добавления новых шаблонов или опций редактируйте `scripts/create-plugin.ts`:

```typescript
// Добавление нового типа файла
function generateCustomFile(config: PluginConfig): string {
  return `// Custom content for ${config.name}`;
}

// В секции генерации файлов
files.push({
  path: path.join(config.pluginPath, 'custom.ts'),
  content: generateCustomFile(config)
});
```
