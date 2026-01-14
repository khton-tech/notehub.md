# 🔌 Руководство разработчика плагинов Notehub

> Полная документация по созданию плагинов для Notehub.md

---

## Содержание

1. [Начало работы](#начало-работы)
2. [Архитектура плагинов](#архитектура-плагинов)
3. [Справочник API](#справочник-api)
4. [Виджеты (Порталы)](#виджеты-порталы)
5. [Интеграция настроек](#интеграция-настроек)
6. [Контекстное меню](#контекстное-меню)
7. [Примеры плагинов](#примеры-плагинов)

---

# Начало работы

Это руководство проведет вас через создание первого плагина Notehub.md.

## Предварительные требования

- **Node.js** v18+ с npm/pnpm
- **TypeScript** (рекомендуется, JavaScript тоже работает)
- **Сборщик**: esbuild, Vite или Rollup
- Хранилище Notehub.md для тестирования

## Структура плагина

Каждый плагин требует как минимум:

```
my-plugin/
├── manifest.json    # Метаданные плагина (обязательно)
├── main.js          # Точка входа (скомпилированная)
└── src/             # Исходные файлы (опционально)
    └── index.ts
```

## manifest.json

Манифест описывает ваш плагин для Notehub:

```json
{
    "id": "my-awesome-plugin",
    "name": "Мой Крутой Плагин",
    "version": "1.0.0",
    "main": "main.js",
    "dependencies": []
}
```

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `id` | ✅ | Уникальный идентификатор (строчные буквы, дефисы разрешены) |
| `name` | ✅ | Человекочитаемое имя |
| `version` | ✅ | Семантическая версия (например, `1.0.0`) |
| `main` | ❌ | Файл точки входа, по умолчанию `main.js` |
| `dependencies` | ❌ | Массив ID плагинов, от которых зависит этот плагин |

---

## Быстрый старт с CLI

Самый быстрый способ создать новый плагин:

```bash
npx @notehub/cli create ext.my-plugin --name "My Plugin"
```

Это сгенерирует полную структуру плагина со всеми необходимыми файлами.

## Ручная настройка

### Шаг 1: Создайте структуру папок

```bash
mkdir my-plugin
cd my-plugin
npm init -y
npm install @notehub/api typescript esbuild --save-dev
```

### Шаг 2: Создайте src/index.ts

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class HelloWorldPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        await ctx.invokeApi('logger:info', 'HelloWorld', 'Привет из моего плагина!');
        
        ctx.registerApi('hello:say', (message: string) => {
            console.log(`[HelloWorld] ${message}`);
        });
        
        ctx.subscribe<{ path: string }>('explorer:file-selected', (payload) => {
            console.log('Выбран файл:', payload.path);
        });
    }
    
    async onunload(): Promise<void> {
        console.log('Плагин HelloWorld выгружен');
    }
}
```

### Шаг 3: Соберите и установите

```bash
npm run build
```

Скопируйте в ваше хранилище:
```
MyVault/.notehub/plugins/hello-world/
├── manifest.json
└── main.js
```

## Горячая перезагрузка

Notehub следит за директорией `.notehub/plugins/`. При обновлении плагина:

1. Старая версия автоматически выгружается
2. Новая версия загружается
3. Все регистрации API очищаются автоматически!

---

# Архитектура плагинов

## Микроядерная архитектура

Notehub.md следует **микроядерному** дизайну, где ядро минимально, а вся функциональность приходит от плагинов:

```
┌─────────────────────────────────────────────────────────────┐
│                    NotehubCore                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  EventBus   │  │   ApiBus    │  │  Plugin Registry    │ │
│  │  (pub/sub)  │  │(RPC вызовы) │  │  (управление ЖЦ)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        ▲                 ▲                    ▲
        │                 │                    │
   ┌────┴───┐       ┌─────┴────┐        ┌─────┴────┐
   │ Logger │       │  Editor  │        │ Explorer │
   │ Plugin │       │  Plugin  │        │  Plugin  │
   └────────┘       └──────────┘        └──────────┘
```

## PluginContext

Ваш шлюз в экосистему Notehub:

```typescript
interface PluginContext {
    registerApi(name: string, handler: (...args: unknown[]) => unknown): void;
    invokeApi<T>(name: string, ...args: unknown[]): Promise<T>;
    subscribe<T>(event: string, handler: (payload: T) => void): void;
}
```

### Магия автоматической очистки

Когда ваш плагин выгружается, `PluginContext` автоматически:

- ✅ Отменяет регистрацию всех ваших API
- ✅ Отписывается от всех событий
- ✅ Удаляет виджеты редактора
- ✅ Удаляет вкладки/группы/элементы настроек

---

# Справочник API

## Logger API

```typescript
await ctx.invokeApi('logger:info', 'MyPlugin', 'Операция завершена');
await ctx.invokeApi('logger:warn', 'MyPlugin', 'Конфиг не найден');
await ctx.invokeApi('logger:error', 'MyPlugin', 'Ошибка загрузки');
```

## Config API (Персистентный)

```typescript
// Получить значение
const fontSize = await ctx.invokeApi<number>('config:get', 'editor.font-size', 14);

// Установить значение (автосохранение)
await ctx.invokeApi('config:set', 'my-plugin.option', true);

// Удалить
await ctx.invokeApi('config:delete', 'my-plugin.option');
```

## State API (Runtime)

```typescript
await ctx.invokeApi('state:set', 'my-plugin.cache', { data: [...] });
const cache = await ctx.invokeApi<MyData>('state:get', 'my-plugin.cache');
await ctx.invokeApi('state:delete', 'my-plugin.cache');
```

## Filesystem API

```typescript
// Чтение файла
const content = await ctx.invokeApi<string>('fs:read-text-file', '/path/to/file.md');

// Запись файла
await ctx.invokeApi('fs:write-text-file', '/path/to/file.md', '# Привет мир');

// Проверка существования
const exists = await ctx.invokeApi<boolean>('fs:exists', '/path/to/file.md');

// Чтение директории
const entries = await ctx.invokeApi<DirEntry[]>('fs:read-dir', '/path/to/folder');

// Создание директории
await ctx.invokeApi('fs:create-dir', '/path/to/new-folder', { recursive: true });

// Удаление файла
await ctx.invokeApi('fs:remove-file', '/path/to/file.md');

// Переименование/перемещение
await ctx.invokeApi('fs:rename', '/old/path.md', '/new/path.md');

// Наблюдение за изменениями
const unwatch = await ctx.invokeApi<() => void>(
    'fs:watch', 
    '/path/to/folder', 
    (event) => console.log('Изменение:', event)
);
```

## Dialog API

```typescript
// Сообщение
await ctx.invokeApi('dialog:alert', 'Внимание', 'Файл был удален');

// Подтверждение
const confirmed = await ctx.invokeApi<boolean>(
    'dialog:confirm', 'Удаление файла', 'Вы уверены?'
);

// Ввод
const name = await ctx.invokeApi<string | null>(
    'dialog:prompt', 'Переименование', 'Введите новое имя:', 'default.md'
);
```

## Theme API

```typescript
// Регистрация темы
await ctx.invokeApi('theme:register', 'my-theme', {
    'bg-main': '#1a1a2e',
    'accent-primary': '#e94560',
    // ...
});

// Применение темы
await ctx.invokeApi('theme:set', 'my-theme');

// Получить текущую
const theme = await ctx.invokeApi<string>('theme:get-current');

// Список всех
const themes = await ctx.invokeApi<string[]>('theme:list');
```

## Editor Widget API

```typescript
// Регистрация виджета
await ctx.invokeApi(
    'editor:register-widget',
    'my-plugin:progress-bar',
    /\[progress:(\d+)\]/g,
    ProgressBarComponent
);

// Отмена регистрации (опционально - очищается автоматически)
await ctx.invokeApi('editor:unregister-widget', 'my-plugin:progress-bar');
```

## Settings API

```typescript
// Регистрация вкладки
await ctx.invokeApi('settings:register-tab', {
    id: 'my-plugin', label: 'Мой плагин', icon: 'puzzle', order: 100
});

// Регистрация группы
await ctx.invokeApi('settings:register-group', {
    id: 'my-group', tabId: 'my-plugin', label: 'Основные', order: 0
});

// Регистрация элемента
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.enabled',
    type: 'toggle',  // 'toggle' | 'text' | 'number' | 'select' | 'color'
    label: 'Включить плагин',
    groupId: 'my-group',
    order: 0,
    defaultValue: true
});

// Открыть/закрыть настройки
await ctx.invokeApi('settings:open');
await ctx.invokeApi('settings:close');
```

## Context Menu API

```typescript
await ctx.invokeApi(
    'context-menu:register',
    'explorer-item',
    (payload: { path: string }) => [
        {
            type: 'action',
            id: 'my-action',
            label: 'Моё действие',
            icon: 'star',
            onClick: () => console.log('Клик:', payload.path)
        },
        { type: 'separator' },
        {
            type: 'submenu',
            label: 'Ещё опции',
            items: [/* ... */]
        }
    ]
);
```

## Shell API

```typescript
await ctx.invokeApi('shell:open', 'https://notehub.md');
```

## Vault API

```typescript
await ctx.invokeApi('vault:close');
```

---

# Виджеты (Порталы)

Порталы — это кастомные React-компоненты, которые рендерятся inline в редакторе.

## Как работают порталы

1. Вы определяете **regex-паттерн**, который ищет текст в документе
2. Вы предоставляете **React-компонент** для рендеринга совпадений
3. Notehub заменяет найденный текст на ваш компонент в **режиме просмотра**
4. Когда курсор входит в совпадение, переключается **режим редактирования**

## Полный пример: Прогресс-бар

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';
import React from 'react';

const ProgressBar: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const percentage = parseInt(match[1], 10);
    
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '2px 8px',
            background: 'var(--nh-bg-surface)',
            borderRadius: '4px',
        }}>
            <span style={{
                width: '100px',
                height: '8px',
                background: 'var(--nh-bg-secondary)',
                borderRadius: '4px',
                overflow: 'hidden',
            }}>
                <span style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: 'var(--nh-accent-primary)',
                    display: 'block',
                }} />
            </span>
            <span style={{ fontSize: '12px', color: 'var(--nh-text-muted)' }}>
                {percentage}%
            </span>
        </span>
    );
};

export default class ProgressBarPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        await ctx.invokeApi(
            'editor:register-widget',
            'progress-bar',
            /\[progress:(\d+)\]/g,
            ProgressBar
        );
    }
    
    async onunload(): Promise<void> {}
}
```

**Использование в документах:**
```markdown
Прогресс проекта: [progress:75]
```

---

# Интеграция настроек

## Структура

```
Модальное окно настроек
└── Вкладка (например, "Мой плагин")
    └── Группа (например, "Внешний вид")
        └── Элемент (например, "Включить тёмный режим")
```

## Типы элементов

| Тип | Описание |
|-----|----------|
| `toggle` | Булевый переключатель |
| `text` | Текстовый ввод |
| `number` | Числовой ввод с min/max/step |
| `select` | Выпадающий список с опциями |
| `color` | Выбор цвета |

## Чтение настроек

```typescript
const isEnabled = await ctx.invokeApi<boolean>('config:get', 'my-plugin.enabled', true);
const maxItems = await ctx.invokeApi<number>('config:get', 'my-plugin.max-items', 10);
```

---

# Контекстное меню

## Типы элементов меню

### Action (Действие)

```typescript
{
    type: 'action',
    id: 'my-action',
    label: 'Моё действие',
    icon: 'star',
    onClick: (payload) => { /* обработка */ }
}
```

### Separator (Разделитель)

```typescript
{ type: 'separator' }
```

### Submenu (Подменю)

```typescript
{
    type: 'submenu',
    label: 'Ещё опции',
    items: [/* вложенные элементы */]
}
```

---

# Примеры плагинов

## Hello World

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class HelloWorld extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        await ctx.invokeApi('logger:info', 'HelloWorld', '👋 Привет!');
        
        ctx.registerApi('hello:greet', (name: string) => {
            return `Привет, ${name}!`;
        });
    }
    
    async onunload(): Promise<void> {}
}
```

## Виджет подсчёта слов

```typescript
const WordCounter: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const text = match[1];
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    return <span>📝 {words} слов</span>;
};

// Регистрация с паттерном: {{count: ваш текст здесь}}
await ctx.invokeApi(
    'editor:register-widget',
    'word-counter',
    /\{\{count:\s*(.+?)\}\}/g,
    WordCounter
);
```

## Полноценный плагин

Смотрите [документацию с примерами](https://github.com/khton-tech/notehub.md/tree/main/docs/forPluginMakers/ru/07-examples.md) для полного кода плагина, комбинирующего виджеты, настройки и контекстные меню.

---

## Конфигурация сборки

### package.json

```json
{
    "scripts": {
        "build": "nhp build"
    },
    "devDependencies": {
        "@notehub/api": "workspace:*",
        "@types/react": "^18.3.0",
        "typescript": "^5.6.0"
    },
    "peerDependencies": {
        "react": "^18.3.0"
    }
}
```

### Внешние зависимости

Эти пакеты предоставляются Notehub — отметьте их как **external**:

- `@notehub/api`
- `react`
- `react-dom`

---

## Советы по отладке

1. **Откройте DevTools** (Ctrl+Shift+I) чтобы видеть логи консоли
2. **Используйте `logger:info`** API для структурированного логирования
3. **Проверьте логи плагина Synapse** для событий загрузки/выгрузки

---

## CSS-переменные

Используйте для консистентной стилизации:

- `--nh-bg-main`, `--nh-bg-sidebar`, `--nh-bg-surface`
- `--nh-text-primary`, `--nh-text-secondary`, `--nh-text-muted`
- `--nh-accent-primary`, `--nh-accent-secondary`
- `--nh-border-accent`, `--nh-border-subtle`

---

## Ресурсы

- [Репозиторий GitHub](https://github.com/khton-tech/notehub.md)
- [Пакет API](https://github.com/khton-tech/notehub.md/tree/main/packages/api)
- [Примеры плагинов](https://github.com/khton-tech/notehub.md/tree/main/packages/plugins)

---

<p align="center">
  <strong>Удачной разработки! 🎉</strong>
</p>
