# Примеры плагинов

Полные, рабочие примеры плагинов, которые можно использовать как шаблоны.

---

## Пример 1: Hello World (Минимальный)

Простейший возможный плагин.

### `manifest.json`

```json
{
    "id": "hello-world",
    "name": "Hello World",
    "version": "1.0.0"
}
```

### `src/index.ts`

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class HelloWorld extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        await ctx.invokeApi('logger:info', 'HelloWorld', '👋 Привет из моего первого плагина!');
        
        // Регистрация простого API
        ctx.registerApi('hello:greet', (name: string) => {
            return `Привет, ${name}!`;
        });
    }
    
    async onunload(): Promise<void> {
        console.log('До свидания!');
    }
}
```

---

## Пример 2: Виджет счетчика слов

Виджет, считающий слова в текущем параграфе.

### `manifest.json`

```json
{
    "id": "word-counter",
    "name": "Счетчик слов",
    "version": "1.0.0"
}
```

### `src/index.ts`

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';
import React from 'react';

// Компонент виджета
const WordCounter: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const text = match[1];
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const chars = text.length;
    
    return (
        <span style={{
            display: 'inline-flex',
            gap: '12px',
            padding: '4px 12px',
            background: 'var(--nh-bg-surface)',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'var(--nh-text-muted)',
            border: '1px solid var(--nh-border-subtle)',
        }}>
            <span>📝 {words} слов</span>
            <span>📏 {chars} символов</span>
        </span>
    );
};

export default class WordCounterPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Совпадение: {{count: любой текст здесь}}
        await ctx.invokeApi(
            'editor:register-widget',
            'word-counter',
            /\{\{count:\s*(.+?)\}\}/g,
            WordCounter
        );
        
        await ctx.invokeApi('logger:info', 'WordCounter', 'Виджет зарегистрирован');
    }
    
    async onunload(): Promise<void> {}
}
```

**Использование:**
```markdown
{{count: Это пример текста ровно с десятью словами всего}}
```

---

## Пример 3: Плагин с настройками

Плагин с настраиваемыми параметрами.

### `manifest.json`

```json
{
    "id": "settings-demo",
    "name": "Демо настроек",
    "version": "1.0.0"
}
```

### `src/index.ts`

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class SettingsDemo extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Регистрация вкладки
        await ctx.invokeApi('settings:register-tab', {
            id: 'settings-demo',
            label: 'Демо настроек',
            icon: 'sliders',
            order: 100
        });
        
        // Регистрация группы
        await ctx.invokeApi('settings:register-group', {
            id: 'demo-general',
            tabId: 'settings-demo',
            label: 'Основные опции',
            order: 0
        });
        
        // Регистрация элементов
        await ctx.invokeApi('settings:register-items', [
            {
                key: 'settings-demo.enabled',
                type: 'toggle',
                label: 'Включить функцию',
                description: 'Включить или выключить демо-функцию',
                groupId: 'demo-general',
                order: 0,
                defaultValue: true
            },
            {
                key: 'settings-demo.name',
                type: 'text',
                label: 'Ваше имя',
                placeholder: 'Введите ваше имя...',
                groupId: 'demo-general',
                order: 1,
                defaultValue: ''
            },
            {
                key: 'settings-demo.count',
                type: 'number',
                label: 'Количество элементов',
                min: 1,
                max: 100,
                step: 1,
                groupId: 'demo-general',
                order: 2,
                defaultValue: 10
            },
            {
                key: 'settings-demo.mode',
                type: 'select',
                label: 'Режим отображения',
                options: [
                    { label: 'Компактный', value: 'compact' },
                    { label: 'Обычный', value: 'normal' },
                    { label: 'Расширенный', value: 'expanded' }
                ],
                groupId: 'demo-general',
                order: 3,
                defaultValue: 'normal'
            },
            {
                key: 'settings-demo.color',
                type: 'color',
                label: 'Цвет подсветки',
                groupId: 'demo-general',
                order: 4,
                defaultValue: '#3b82f6'
            }
        ]);
        
        // Чтение и использование настроек
        const enabled = await ctx.invokeApi<boolean>('config:get', 'settings-demo.enabled', true);
        const name = await ctx.invokeApi<string>('config:get', 'settings-demo.name', 'Пользователь');
        
        await ctx.invokeApi('logger:info', 'SettingsDemo', 
            `Загружено! enabled=${enabled}, name="${name}"`);
    }
    
    async onunload(): Promise<void> {}
}
```

---

## Пример 4: Расширение контекстного меню

Добавление кастомных действий в контекстное меню проводника.

### `manifest.json`

```json
{
    "id": "quick-actions",
    "name": "Быстрые действия",
    "version": "1.0.0"
}
```

### `src/index.ts`

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

interface FilePayload {
    path: string;
    isDirectory: boolean;
}

export default class QuickActionsPlugin extends NotehubPlugin {
    private ctx!: PluginContext;
    
    async onload(ctx: PluginContext): Promise<void> {
        this.ctx = ctx;
        
        await ctx.invokeApi(
            'context-menu:register',
            'explorer-item',
            (payload: FilePayload) => this.buildMenu(payload)
        );
        
        await ctx.invokeApi('logger:info', 'QuickActions', 'Контекстное меню зарегистрировано');
    }
    
    private buildMenu(payload: FilePayload) {
        const items = [];
        
        // Только для markdown-файлов
        if (payload.path.endsWith('.md')) {
            items.push({
                type: 'action' as const,
                id: 'qa-word-count',
                label: 'Подсчитать слова',
                icon: 'hash',
                onClick: () => this.countWords(payload.path)
            });
            
            items.push({
                type: 'action' as const,
                id: 'qa-add-date',
                label: 'Добавить сегодняшнюю дату',
                icon: 'calendar',
                onClick: () => this.addDate(payload.path)
            });
        }
        
        // Для всех файлов
        items.push({ type: 'separator' as const });
        
        items.push({
            type: 'action' as const,
            id: 'qa-copy-path',
            label: 'Скопировать путь',
            icon: 'copy',
            onClick: () => navigator.clipboard.writeText(payload.path)
        });
        
        // Дублирование
        if (!payload.isDirectory) {
            items.push({
                type: 'action' as const,
                id: 'qa-duplicate',
                label: 'Дублировать файл',
                icon: 'files',
                onClick: () => this.duplicateFile(payload.path)
            });
        }
        
        return items;
    }
    
    private async countWords(path: string) {
        const content = await this.ctx.invokeApi<string>('fs:read-text-file', path);
        const words = content.split(/\s+/).filter(w => w.length > 0).length;
        await this.ctx.invokeApi('dialog:alert', 'Количество слов', `${words} слов в этом файле`);
    }
    
    private async addDate(path: string) {
        const content = await this.ctx.invokeApi<string>('fs:read-text-file', path);
        const date = new Date().toISOString().split('T')[0];
        const newContent = `---\ndate: ${date}\n---\n\n${content}`;
        await this.ctx.invokeApi('fs:write-text-file', path, newContent);
        await this.ctx.invokeApi('dialog:alert', 'Успех', 'Дата добавлена в файл');
    }
    
    private async duplicateFile(path: string) {
        const content = await this.ctx.invokeApi<string>('fs:read-text-file', path);
        const newPath = path.replace(/\.md$/, ' (копия).md');
        await this.ctx.invokeApi('fs:write-text-file', newPath, content);
        await this.ctx.invokeApi('dialog:alert', 'Успех', `Создано: ${newPath}`);
    }
    
    async onunload(): Promise<void> {}
}
```

---

## Пример 5: Полнофункциональный плагин

Комплексный плагин, объединяющий виджеты, настройки и контекстные меню.

### `manifest.json`

```json
{
    "id": "task-tracker",
    "name": "Трекер задач",
    "version": "1.0.0"
}
```

### `src/index.ts`

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';
import React, { useState } from 'react';

// === Виджет: Интерактивный чекбокс задачи ===
const TaskWidget: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const status = match[1]; // 'x' или ' '
    const text = match[2];
    const [checked, setChecked] = useState(status === 'x');
    
    return (
        <span
            onClick={() => setChecked(!checked)}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 8px',
                background: checked ? 'var(--nh-accent-primary)20' : 'var(--nh-bg-surface)',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
            }}
        >
            <span style={{
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                border: `2px solid ${checked ? 'var(--nh-accent-primary)' : 'var(--nh-border-subtle)'}`,
                background: checked ? 'var(--nh-accent-primary)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '12px',
            }}>
                {checked && '✓'}
            </span>
            <span style={{
                textDecoration: checked ? 'line-through' : 'none',
                color: checked ? 'var(--nh-text-muted)' : 'var(--nh-text-primary)',
            }}>
                {text}
            </span>
        </span>
    );
};

// === Класс плагина ===
export default class TaskTracker extends NotehubPlugin {
    private ctx!: PluginContext;
    
    async onload(ctx: PluginContext): Promise<void> {
        this.ctx = ctx;
        
        // 1. Регистрация виджета
        await ctx.invokeApi(
            'editor:register-widget',
            'task-tracker:checkbox',
            /\[([x ])\]\s+(.+?)(?=\n|$)/g,
            TaskWidget
        );
        
        // 2. Регистрация настроек
        await ctx.invokeApi('settings:register-tab', {
            id: 'task-tracker',
            label: 'Трекер задач',
            icon: 'check-square',
            order: 50
        });
        
        await ctx.invokeApi('settings:register-group', {
            id: 'task-tracker-options',
            tabId: 'task-tracker',
            label: 'Опции',
            order: 0
        });
        
        await ctx.invokeApi('settings:register-items', [
            {
                key: 'task-tracker.style',
                type: 'select',
                label: 'Стиль чекбокса',
                options: [
                    { label: 'Круглый', value: 'round' },
                    { label: 'Квадратный', value: 'square' }
                ],
                groupId: 'task-tracker-options',
                order: 0,
                defaultValue: 'square'
            },
            {
                key: 'task-tracker.strikethrough',
                type: 'toggle',
                label: 'Зачеркивать выполненные',
                groupId: 'task-tracker-options',
                order: 1,
                defaultValue: true
            }
        ]);
        
        // 3. Регистрация контекстного меню
        await ctx.invokeApi(
            'context-menu:register',
            'explorer-item',
            (payload: { path: string }) => {
                if (!payload.path.endsWith('.md')) return [];
                
                return [
                    {
                        type: 'action' as const,
                        id: 'tt-count-tasks',
                        label: 'Подсчитать задачи',
                        icon: 'list-checks',
                        onClick: () => this.countTasks(payload.path)
                    }
                ];
            }
        );
        
        await ctx.invokeApi('logger:info', 'TaskTracker', 'Плагин успешно загружен!');
    }
    
    private async countTasks(path: string) {
        const content = await this.ctx.invokeApi<string>('fs:read-text-file', path);
        const total = (content.match(/\[[x ]\]/g) || []).length;
        const done = (content.match(/\[x\]/g) || []).length;
        
        await this.ctx.invokeApi(
            'dialog:alert',
            'Сводка по задачам',
            `${done}/${total} задач выполнено (${Math.round(done/total*100)}%)`
        );
    }
    
    async onunload(): Promise<void> {
        await this.ctx.invokeApi('logger:info', 'TaskTracker', 'Плагин выгружен');
    }
}
```

**Использование в документах:**
```markdown
## Задачи на сегодня

[x] Проверить pull request
[ ] Написать документацию
[ ] Задеплоить на продакшн
```

---

## Конфигурация сборки

### `package.json`

```json
{
    "name": "my-plugin",
    "version": "1.0.0",
    "type": "module",
    "scripts": {
        "build": "esbuild src/index.ts --bundle --format=esm --outfile=main.js --external:@notehub/api --external:react --external:react-dom",
        "watch": "npm run build -- --watch"
    },
    "devDependencies": {
        "@notehub/api": "file:../path/to/notehub/packages/api",
        "@types/react": "^18.2.0",
        "esbuild": "^0.20.0",
        "typescript": "^5.3.0"
    }
}
```

### `tsconfig.json`

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "lib": ["ES2020", "DOM"],
        "jsx": "react-jsx",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "declaration": false,
        "outDir": "./dist"
    },
    "include": ["src/**/*"]
}
```

---

## Советы по разработке

1. **Используйте `npm run watch`** для автоматической пересборки
2. **Notehub автоматически перезагружает** плагины при изменении файлов
3. **Откройте DevTools** (Ctrl+Shift+I) для вывода в консоль
4. **Используйте `logger:info`** для структурированного логирования
5. **Тестируйте инкрементально** — добавляйте функции по одной
