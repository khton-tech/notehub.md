# Разработка плагинов

## Структура плагина

Каждый плагин — это отдельный пакет в `packages/plugins/<category>/<name>/`:

```
packages/plugins/system/my-plugin/
├── package.json        # Конфигурация npm-пакета
├── tsconfig.json       # Конфигурация TypeScript
├── manifest.json       # Метаданные плагина
└── src/
    └── index.ts        # Точка входа с классом плагина
```

## Создание плагина

### Автоматически (рекомендуется)

```bash
pnpm gen:plugin
```

Скрипт запросит:
1. **Имя плагина** (kebab-case, например: `theme-manager`)
2. **Категорию** (system, ui, features)

И создаст готовую структуру с бойлерплейтом.

### Вручную

1. Создайте папку `packages/plugins/<category>/<name>/`
2. Добавьте файлы (см. шаблоны ниже)
3. Запустите `pnpm install`

---

## Шаблоны файлов

### package.json

```json
{
  "name": "@notehub/<name>",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@notehub/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

### tsconfig.json

```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### manifest.json

```json
{
  "id": "nh.<category>.<name>",
  "name": "My Plugin",
  "version": "0.0.0",
  "type": "system",
  "dependencies": []
}
```

### src/index.ts

```typescript
import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';

export class MyPlugin implements IPlugin {
  readonly manifest: PluginManifest = {
    id: 'nh.system.my-plugin',
    name: 'My Plugin',
    version: '0.0.0',
    type: 'system',
  };

  load(app: NotehubCore): void {
    console.log(`Plugin [${this.manifest.id}] loaded`);
    
    // Регистрация API методов
    app.api.register('myPlugin.doSomething', (arg: string) => {
      return `Result: ${arg}`;
    });
    
    // Подписка на события
    app.events.on('someEvent', this.handleEvent.bind(this));
  }

  unload(app: NotehubCore): void {
    console.log(`Plugin [${this.manifest.id}] unloaded`);
    
    // Очистка
    app.api.unregister('myPlugin.doSomething');
  }
  
  private handleEvent(payload: unknown): void {
    console.log('Event received:', payload);
  }
}

export default MyPlugin;
```

---

## Категории плагинов

| Категория | Путь | Назначение |
|-----------|------|------------|
| `system` | `packages/plugins/system/` | Инфраструктурные плагины (логирование, конфигурация, хранилище) |
| `ui` | `packages/plugins/ui/` | UI компоненты (темы, layouts, виджеты) |
| `features` | `packages/plugins/features/` | Пользовательские фичи (редактор, поиск, синхронизация) |

---

## Формат Plugin ID

```
nh.<category>.<name>

Примеры:
- nh.system.logger
- nh.ui.theme-manager
- nh.features.markdown-editor
```

---

## Зависимости между плагинами

Указывайте зависимости в `manifest.json`:

```json
{
  "id": "nh.features.markdown-editor",
  "dependencies": [
    "nh.system.file-storage",
    "nh.ui.toolbar"
  ]
}
```

> **Примечание:** На текущем этапе зависимости только декларируются. Топологическая сортировка при загрузке будет добавлена позже.

---

## Сборка и тестирование

```bash
# Установка зависимостей
pnpm install

# Сборка конкретного плагина
pnpm --filter @notehub/<name> build

# Сборка всех пакетов
pnpm build

# Режим разработки (watch)
pnpm --filter @notehub/<name> dev
```

---

## Best Practices

1. **Изоляция** — плагин не должен напрямую импортировать другие плагины, только через `app.api`
2. **Очистка** — всегда отписывайтесь от событий и удаляйте API в `unload()`
3. **Именование API** — используйте namespace: `pluginName.methodName`
4. **Типизация** — экспортируйте типы для ваших API методов
5. **Манифест** — поддерживайте `manifest.json` в актуальном состоянии
