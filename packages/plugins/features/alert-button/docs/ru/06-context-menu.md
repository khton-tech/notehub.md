# Интеграция контекстных меню

Добавление кастомных элементов в контекстные меню по всему Notehub.

## Обзор

Контекстные меню динамические — провайдеры вызываются при открытии меню и могут возвращать разные элементы в зависимости от того, на что кликнули.

## Регистрация провайдера меню

```typescript
const unsubscribe = await ctx.invokeApi<() => void>(
    'context-menu:register',
    contextId,     // Где появляется меню
    provider       // Функция, возвращающая элементы меню
);
```

## Идентификаторы контекстов

| ID контекста | Срабатывает на | Payload |
|--------------|----------------|---------|
| `explorer-item` | Файл/папка в проводнике | `{ path: string, isDirectory: boolean }` |

## Типы элементов меню

### Action (Действие)

Кликабельный элемент меню:

```typescript
{
    type: 'action',
    id: 'my-action',           // Уникальный идентификатор
    label: 'Моё действие',     // Отображаемый текст
    icon: 'star',              // Иконка Lucide (опционально)
    color: 'var(--nh-danger)', // CSS-цвет (опционально)
    disabled: false,           // Сделать серым если true
    onClick: (payload) => {
        // Обработка клика
    }
}
```

### Separator (Разделитель)

Визуальный разделитель:

```typescript
{
    type: 'separator'
}
```

### Submenu (Подменю)

Вложенные элементы меню:

```typescript
{
    type: 'submenu',
    label: 'Дополнительно',
    icon: 'more-horizontal',
    items: [
        { type: 'action', id: 'sub-1', label: 'Опция 1', onClick: () => {} },
        { type: 'action', id: 'sub-2', label: 'Опция 2', onClick: () => {} }
    ]
}
```

---

## Полный пример

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

interface ExplorerPayload {
    path: string;
    isDirectory: boolean;
}

export default class ContextMenuPlugin extends NotehubPlugin {
    private unsubscribe?: () => void;
    
    async onload(ctx: PluginContext): Promise<void> {
        // Регистрация провайдера для элементов проводника
        this.unsubscribe = await ctx.invokeApi(
            'context-menu:register',
            'explorer-item',
            (payload: ExplorerPayload) => this.getMenuItems(payload, ctx)
        );
    }
    
    private getMenuItems(payload: ExplorerPayload, ctx: PluginContext) {
        const items = [];
        
        // Только для markdown-файлов
        if (payload.path.endsWith('.md')) {
            items.push({
                type: 'action' as const,
                id: 'count-words',
                label: 'Подсчитать слова',
                icon: 'hash',
                onClick: async () => {
                    const content = await ctx.invokeApi<string>(
                        'fs:read-text-file', 
                        payload.path
                    );
                    const wordCount = content.split(/\s+/).length;
                    await ctx.invokeApi(
                        'dialog:alert',
                        'Количество слов',
                        `${wordCount} слов`
                    );
                }
            });
        }
        
        // Разделитель
        if (items.length > 0) {
            items.push({ type: 'separator' as const });
        }
        
        // Подменю с опциями экспорта
        items.push({
            type: 'submenu' as const,
            label: 'Экспортировать как',
            icon: 'file-output',
            items: [
                {
                    type: 'action' as const,
                    id: 'export-txt',
                    label: 'Простой текст',
                    onClick: () => this.exportAs(payload.path, 'txt', ctx)
                },
                {
                    type: 'action' as const,
                    id: 'export-html',
                    label: 'HTML',
                    onClick: () => this.exportAs(payload.path, 'html', ctx)
                }
            ]
        });
        
        // Опасное действие (показывается красным)
        items.push({
            type: 'action' as const,
            id: 'archive',
            label: 'Переместить в архив',
            icon: 'archive',
            color: 'var(--nh-danger)',
            onClick: () => this.archiveFile(payload.path, ctx)
        });
        
        return items;
    }
    
    private async exportAs(path: string, format: string, ctx: PluginContext) {
        await ctx.invokeApi('logger:info', 'ContextMenu', `Экспорт ${path} как ${format}`);
    }
    
    private async archiveFile(path: string, ctx: PluginContext) {
        const confirmed = await ctx.invokeApi<boolean>(
            'dialog:confirm',
            'Архивировать файл',
            `Переместить ${path} в архив?`
        );
        if (confirmed) {
            // Логика перемещения файла
        }
    }
    
    async onunload(): Promise<void> {
        // Ручная очистка (опционально — автоочистка при выгрузке)
        this.unsubscribe?.();
    }
}
```

---

## Динамические элементы меню

Провайдеры вызываются каждый раз при открытии меню. Можно возвращать разные элементы на основе:

### Типа файла

```typescript
(payload: ExplorerPayload) => {
    if (payload.path.endsWith('.md')) {
        return [/* элементы для markdown */];
    } else if (payload.path.endsWith('.png')) {
        return [/* элементы для изображений */];
    }
    return [/* общие элементы */];
}
```

### Директория vs Файл

```typescript
(payload: ExplorerPayload) => {
    if (payload.isDirectory) {
        return [
            { type: 'action', id: 'new-file', label: 'Новый файл здесь', ... }
        ];
    }
    return [
        { type: 'action', id: 'duplicate', label: 'Дублировать файл', ... }
    ];
}
```

### Асинхронные провайдеры

Провайдеры могут быть асинхронными:

```typescript
async (payload: ExplorerPayload) => {
    const metadata = await loadMetadata(payload.path);
    return [/* элементы на основе метаданных */];
}
```

---

## Справочник иконок

Иконки используют имена [Lucide](https://lucide.dev/icons/) в kebab-case:

| Имя иконки | Описание |
|------------|----------|
| `file` | Общий файл |
| `folder` | Папка |
| `star` | Звезда/избранное |
| `trash-2` | Удаление/корзина |
| `copy` | Копировать |
| `scissors` | Вырезать |
| `clipboard` | Вставить |
| `edit` | Редактировать |
| `eye` | Просмотр |
| `download` | Скачать |
| `upload` | Загрузить |
| `archive` | Архив |
| `more-horizontal` | Больше опций |

---

## Определения типов

```typescript
type MenuItem = MenuAction | MenuSeparator | SubMenu;

interface MenuAction {
    type: 'action';
    id: string;
    label: string;
    icon?: string;
    color?: string;
    disabled?: boolean;
    onClick: (payload: unknown) => void;
}

interface MenuSeparator {
    type: 'separator';
}

interface SubMenu {
    type: 'submenu';
    label: string;
    icon?: string;
    items: MenuItem[];
}

type MenuProvider = (payload: unknown) => MenuItem[] | Promise<MenuItem[]>;
```

---

## Следующие шаги

- Смотрите **[Полные примеры](07-examples.md)** для полного кода плагинов
