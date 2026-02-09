# Создание Плагина: Floating Toolbar

Полный туториал по созданию плагина для Notehub.md — плавающая панель инструментов поверх редактора с кнопками форматирования.

---

## Что Мы Создадим

Плагин `floating-toolbar`:
- Плавающая панель над редактором
- Кнопки: **Bold**, *Italic*, `Code`, [Link]
- Появляется при выделении текста
- Использует API редактора для форматирования

---

## Шаг 1: Создание Структуры

### Автоматически (рекомендуется)

```bash
pnpm gen:plugin
```

Ввести:
- Имя: `floating-toolbar`
- Категория: `ui`

### Вручную

```bash
mkdir -p packages/plugins/ui/floating-toolbar/src
```

Создать файлы:

**packages/plugins/ui/floating-toolbar/package.json**
```json
{
    "name": "@notehub/floating-toolbar",
    "version": "0.0.1",
    "type": "module",
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "scripts": {
        "build": "tsc",
        "dev": "tsc --watch"
    },
    "dependencies": {
        "@notehub/core": "workspace:*",
        "react": "^18.2.0"
    },
    "devDependencies": {
        "@types/react": "^18.2.0",
        "typescript": "^5.3.0"
    }
}
```

**packages/plugins/ui/floating-toolbar/tsconfig.json**
```json
{
    "extends": "../../../../tsconfig.base.json",
    "compilerOptions": {
        "outDir": "./dist",
        "rootDir": "./src",
        "jsx": "react"
    },
    "include": ["src/**/*"]
}
```

**packages/plugins/ui/floating-toolbar/manifest.json**
```json
{
    "id": "nh.ui.floating-toolbar",
    "name": "FloatingToolbar",
    "version": "0.0.1",
    "type": "ui",
    "dependencies": [
        "nh.features.editor"
    ]
}
```

---

## Шаг 2: Основной Класс Плагина

**packages/plugins/ui/floating-toolbar/src/index.tsx**

```typescript
import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import React from 'react';

/**
 * FloatingToolbarPlugin — плавающая панель форматирования
 */
export class FloatingToolbarPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.floating-toolbar',
        name: 'FloatingToolbar',
        version: '0.0.1',
        type: 'ui',
    };

    private app: NotehubCore | null = null;
    private unsubscribe: (() => void) | null = null;

    /**
     * Log через Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app?.api.invoke(`logger:${level}`, this.manifest.id, message);
    }

    /**
     * Загрузка плагина
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Регистрируем наш компонент тулбара
        app.api.invoke('controller:register', 'FloatingToolbar', FloatingToolbar);

        // Подписываемся на событие выделения текста
        this.unsubscribe = app.events.on('editor:selection-changed', this.handleSelection);

        // Регистрируем в зоне редактора (overlay)
        app.api.invoke('zone:register', 'editor-overlay', {
            component: 'FloatingToolbar',
            priority: 100,
        });

        this.log('info', 'Loaded successfully');
    }

    /**
     * Выгрузка плагина
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Отписываемся от событий
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        // Удаляем компонент из реестра
        app.api.invoke('controller:unregister', 'FloatingToolbar');

        this.log('info', 'Unloaded');
        this.app = null;
    }

    /**
     * Обработчик изменения выделения
     */
    private handleSelection = (event: { hasSelection: boolean; text: string }): void => {
        // Устанавливаем контекст для when clauses
        this.app?.api.invoke('context:set', 'hasSelection', event.hasSelection);
    };
}

export default FloatingToolbarPlugin;
```

---

## Шаг 3: React Компонент Тулбара

**packages/plugins/ui/floating-toolbar/src/FloatingToolbar.tsx**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNotehub } from '@notehub/core';

/**
 * Кнопка тулбара
 */
interface ToolbarButton {
    icon: string;
    label: string;
    command: string;
    shortcut?: string;
}

/**
 * Конфигурация кнопок
 */
const BUTTONS: ToolbarButton[] = [
    { icon: 'B', label: 'Bold', command: 'editor:format-bold', shortcut: 'Ctrl+B' },
    { icon: 'I', label: 'Italic', command: 'editor:format-italic', shortcut: 'Ctrl+I' },
    { icon: '`', label: 'Code', command: 'editor:format-code', shortcut: 'Ctrl+`' },
    { icon: '🔗', label: 'Link', command: 'editor:insert-link', shortcut: 'Ctrl+K' },
];

/**
 * FloatingToolbar — плавающая панель форматирования
 */
export const FloatingToolbar: React.FC = () => {
    const app = useNotehub();
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    // Слушаем изменение контекста
    useEffect(() => {
        if (!app) return;

        const unsubscribe = app.api.invoke('context:subscribe', 'hasSelection', (value: unknown) => {
            setVisible(Boolean(value));
        }) as () => void;

        return unsubscribe;
    }, [app]);

    // Обновляем позицию при изменении выделения
    useEffect(() => {
        if (!visible) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 50,
        });
    }, [visible]);

    // Выполнение команды
    const handleClick = useCallback((command: string) => {
        app?.api.invoke('command:execute', command);
    }, [app]);

    if (!visible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '4px',
                padding: '6px 8px',
                backgroundColor: 'var(--color-surface-elevated)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: 1000,
            }}
        >
            {BUTTONS.map((btn) => (
                <button
                    key={btn.command}
                    onClick={() => handleClick(btn.command)}
                    title={`${btn.label} (${btn.shortcut})`}
                    style={{
                        width: '32px',
                        height: '32px',
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: 'transparent',
                        color: 'var(--color-text-primary)',
                        fontSize: '14px',
                        fontWeight: btn.icon === 'B' ? 'bold' : 'normal',
                        fontStyle: btn.icon === 'I' ? 'italic' : 'normal',
                        cursor: 'pointer',
                    }}
                >
                    {btn.icon}
                </button>
            ))}
        </div>
    );
};
```

---

## Шаг 4: Экспорт Компонента

Обновите **index.tsx**:

```typescript
// В начале файла
import { FloatingToolbar } from './FloatingToolbar.js';

// Перед export default
export { FloatingToolbar };
```

---

## Шаг 5: Регистрация в Приложении

### Добавить в desktop/src/main.tsx

```typescript
// В switch importPlugin:
case '@notehub/floating-toolbar':
    return import('@notehub/floating-toolbar');
```

### Добавить в desktop/package.json

```json
"@notehub/floating-toolbar": "workspace:*"
```

---

## Шаг 6: Сборка и Тестирование

```bash
# Установка зависимостей
pnpm install

# Сборка плагина
pnpm --filter @notehub/floating-toolbar build

# Полная сборка
pnpm build

# Запуск приложения
pnpm dev:desktop
```

---

## Использование Hook System

Ваш плагин может перехватывать API вызовы других плагинов:

```typescript
async load(app: NotehubCore): Promise<void> {
    // Перехватываем сохранение файла — добавляем auto-format
    app.api.hook('fs:write-text-file', 'before', async (args) => {
        const [path, content] = args;
        if (path.endsWith('.md')) {
            args[1] = await this.formatMarkdown(content);
        }
        return args;
    });
}
```

---

## Использование Context System

Условная активация через when clauses:

```typescript
// Установить контекст
app.api.invoke('context:set', 'floatingToolbar.visible', true);

// Проверить условие
const canFormat = await app.api.invoke(
    'context:evaluate', 
    'hasSelection && activeEditor.languageId == markdown'
);

// Подписаться на изменение
const unsub = await app.api.invoke(
    'context:subscribe', 
    'hasSelection', 
    (value) => console.log('Selection:', value)
);
```

---

## Полная Структура Файлов

```
packages/plugins/ui/floating-toolbar/
├── package.json
├── tsconfig.json
├── manifest.json
└── src/
    ├── index.tsx           # Класс плагина
    └── FloatingToolbar.tsx # React компонент
```

---

## Чеклист

- [ ] Создана структура папок
- [ ] Написан класс плагина (implements IPlugin)
- [ ] Реализован React компонент
- [ ] Зарегистрирован компонент через controller:register
- [ ] Добавлен в zone (editor-overlay)
- [ ] Подписка на события с отпиской в unload()
- [ ] Добавлен в desktop/main.tsx и package.json
- [ ] Успешная сборка `pnpm build`
