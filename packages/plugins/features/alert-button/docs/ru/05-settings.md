# Интеграция настроек

Добавление параметров конфигурации в ваш плагин через Settings API.

## Структура настроек

Настройки организованы в иерархию:

```
Модальное окно настроек
└── Вкладка (например, "Мой плагин")
    └── Группа (например, "Внешний вид")
        └── Элемент (например, "Включить темный режим")
```

## Шаг 1: Регистрация вкладки

```typescript
await ctx.invokeApi('settings:register-tab', {
    id: 'my-plugin',            // Уникальный идентификатор
    label: 'Мой плагин',        // Отображаемое имя
    icon: 'puzzle',             // Имя иконки Lucide (kebab-case)
    order: 100                  // Позиция (меньше = первее)
});
```

## Шаг 2: Регистрация группы

```typescript
await ctx.invokeApi('settings:register-group', {
    id: 'my-plugin-general',    // Уникальный идентификатор
    tabId: 'my-plugin',         // ID родительской вкладки
    label: 'Основные',          // Отображаемое имя
    order: 0                    // Позиция внутри вкладки
});
```

## Шаг 3: Регистрация элементов

### Toggle (Булевый переключатель)

```typescript
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.enabled',
    type: 'toggle',
    label: 'Включить плагин',
    description: 'Включение или выключение плагина',
    groupId: 'my-plugin-general',
    order: 0,
    defaultValue: true
});
```

### Text (Текстовое поле)

```typescript
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.prefix',
    type: 'text',
    label: 'Кастомный префикс',
    description: 'Текст для добавления перед элементами',
    placeholder: 'Введите префикс...',
    groupId: 'my-plugin-general',
    order: 1,
    defaultValue: ''
});
```

### Number (Числовое поле)

```typescript
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.max-items',
    type: 'number',
    label: 'Максимум элементов',
    description: 'Ограничение количества отображаемых элементов',
    groupId: 'my-plugin-general',
    order: 2,
    min: 1,
    max: 100,
    step: 1,
    defaultValue: 10
});
```

### Select (Выпадающий список)

```typescript
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.theme',
    type: 'select',
    label: 'Тема виджета',
    description: 'Выбор визуального стиля',
    groupId: 'my-plugin-general',
    order: 3,
    options: [
        { label: 'По умолчанию', value: 'default' },
        { label: 'Компактный', value: 'compact' },
        { label: 'Минимальный', value: 'minimal' }
    ],
    defaultValue: 'default'
});
```

### Color (Выбор цвета)

```typescript
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.accent-color',
    type: 'color',
    label: 'Акцентный цвет',
    description: 'Основной цвет для выделений',
    groupId: 'my-plugin-general',
    order: 4,
    defaultValue: '#3b82f6'
});
```

---

## Чтение значений настроек

Используйте API `config:get` для чтения настроек:

```typescript
const isEnabled = await ctx.invokeApi<boolean>('config:get', 'my-plugin.enabled', true);
const prefix = await ctx.invokeApi<string>('config:get', 'my-plugin.prefix', '');
const maxItems = await ctx.invokeApi<number>('config:get', 'my-plugin.max-items', 10);
const theme = await ctx.invokeApi<string>('config:get', 'my-plugin.theme', 'default');
const color = await ctx.invokeApi<string>('config:get', 'my-plugin.accent-color', '#3b82f6');
```

---

## Полный пример

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class ConfigurablePlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Регистрация вкладки настроек
        await ctx.invokeApi('settings:register-tab', {
            id: 'my-plugin',
            label: 'Мой плагин',
            icon: 'settings-2',
            order: 100
        });
        
        // Регистрация группы
        await ctx.invokeApi('settings:register-group', {
            id: 'my-plugin-appearance',
            tabId: 'my-plugin',
            label: 'Внешний вид',
            order: 0
        });
        
        // Регистрация элементов
        await ctx.invokeApi('settings:register-items', [
            {
                key: 'my-plugin.show-icons',
                type: 'toggle',
                label: 'Показывать иконки',
                groupId: 'my-plugin-appearance',
                order: 0,
                defaultValue: true
            },
            {
                key: 'my-plugin.icon-size',
                type: 'select',
                label: 'Размер иконок',
                groupId: 'my-plugin-appearance',
                order: 1,
                options: [
                    { label: 'Маленький', value: 16 },
                    { label: 'Средний', value: 24 },
                    { label: 'Большой', value: 32 }
                ],
                defaultValue: 24
            }
        ]);
        
        // Использование значений
        const showIcons = await ctx.invokeApi<boolean>('config:get', 'my-plugin.show-icons', true);
        const iconSize = await ctx.invokeApi<number>('config:get', 'my-plugin.icon-size', 24);
        
        await ctx.invokeApi('logger:info', 'MyPlugin', 
            `Настройки: showIcons=${showIcons}, iconSize=${iconSize}`);
    }
    
    async onunload(): Promise<void> {
        // Элементы настроек автоматически удаляются!
    }
}
```

---

## Пакетная регистрация

Для множества элементов используйте пакетные API:

```typescript
// Регистрация нескольких вкладок
await ctx.invokeApi('settings:register-tabs', [
    { id: 'tab1', label: 'Вкладка 1', icon: 'star', order: 0 },
    { id: 'tab2', label: 'Вкладка 2', icon: 'heart', order: 1 }
]);

// Регистрация нескольких групп
await ctx.invokeApi('settings:register-groups', [
    { id: 'group1', tabId: 'tab1', label: 'Группа 1', order: 0 },
    { id: 'group2', tabId: 'tab1', label: 'Группа 2', order: 1 }
]);

// Регистрация нескольких элементов
await ctx.invokeApi('settings:register-items', [/* массив элементов */]);
```

---

## Кастомное представление настроек

Для сложного UI настроек зарегистрируйте кастомный React-компонент:

```typescript
const MyCustomSettings: React.FC = () => {
    return (
        <div>
            <h2>Кастомный UI настроек</h2>
            {/* Ваш кастомный интерфейс */}
        </div>
    );
};

await ctx.invokeApi('settings:register-custom-view', {
    tabId: 'my-plugin',
    view: MyCustomSettings
});
```

---

## Программное управление

```typescript
// Открыть модальное окно настроек
await ctx.invokeApi('settings:open');

// Закрыть модальное окно настроек
await ctx.invokeApi('settings:close');

// Переключить модальное окно настроек
await ctx.invokeApi('settings:toggle');
```

---

## Определения типов

```typescript
interface SettingsTabDef {
    id: string;          // Уникальный идентификатор
    label: string;       // Отображаемый текст
    icon: string;        // Имя иконки Lucide
    order: number;       // Порядок сортировки
}

interface SettingsGroupDef {
    id: string;          // Уникальный идентификатор
    tabId: string;       // ID родительской вкладки
    label: string;       // Отображаемый текст
    order: number;       // Порядок сортировки
}

interface SettingsItemDef {
    key: string;         // Ключ конфига (например, 'my-plugin.option')
    type: 'toggle' | 'text' | 'number' | 'select' | 'color';
    label: string;       // Отображаемый текст
    description?: string;
    groupId: string;     // ID родительской группы
    order: number;       // Порядок сортировки
    defaultValue?: unknown;
    
    // Для 'text'
    placeholder?: string;
    
    // Для 'number'
    min?: number;
    max?: number;
    step?: number;
    
    // Для 'select'
    options?: Array<{ label: string; value: unknown }>;
}
```

---

## Следующие шаги

- Изучите интеграцию **[Контекстных меню](06-context-menu.md)**
- Смотрите **[Полные примеры](07-examples.md)**
