# Справочник API

Полный справочник всех методов API Notehub.md, доступных для плагинов.

Используйте `ctx.invokeApi(имяМетода, ...аргументы)` для вызова любого из этих методов.

---

## Logger API

Структурированное логирование для отладки и мониторинга.

### `logger:log`

Логирование сообщения с указанным уровнем.

```typescript
await ctx.invokeApi('logger:log', level: string, source: string, message: string): void;
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `level` | `string` | Уровень: 'info', 'warn', 'error' |
| `source` | `string` | Идентификатор источника (обычно имя плагина) |
| `message` | `string` | Сообщение для логирования |

### `logger:info`

Логирование сообщения уровня INFO.

```typescript
await ctx.invokeApi('logger:info', 'MyPlugin', 'Операция завершена');
```

### `logger:warn`

Логирование сообщения уровня WARN.

```typescript
await ctx.invokeApi('logger:warn', 'MyPlugin', 'Конфиг не найден, используются значения по умолчанию');
```

### `logger:error`

Логирование сообщения уровня ERROR.

```typescript
await ctx.invokeApi('logger:error', 'MyPlugin', 'Не удалось загрузить данные');
```

---

## Config API

Персистентная конфигурация, сохраняемая на диск.

### `config:get`

Получение значения конфигурации по ключу.

```typescript
const value = await ctx.invokeApi<T>('config:get', key: string, defaultValue?: T): T | undefined;
```

**Пример:**
```typescript
const fontSize = await ctx.invokeApi<number>('config:get', 'editor.font-size', 14);
const theme = await ctx.invokeApi<string>('config:get', 'theme.current', 'dark');
```

### `config:set`

Установка значения конфигурации (автоматически сохраняется на диск).

```typescript
await ctx.invokeApi('config:set', 'my-plugin.option', true);
```

### `config:delete`

Удаление значения конфигурации.

```typescript
await ctx.invokeApi('config:delete', 'my-plugin.option');
```

### `config:reload`

Перезагрузка конфигурации с диска.

```typescript
await ctx.invokeApi('config:reload');
```

---

## State API

Состояние времени выполнения (не сохраняется — теряется при перезапуске).

### `state:set`

Сохранение значения в состояние.

```typescript
await ctx.invokeApi('state:set', 'my-plugin.cache', { data: [...] });
```

### `state:get`

Получение значения из состояния.

```typescript
const cache = await ctx.invokeApi<MyData>('state:get', 'my-plugin.cache');
```

### `state:delete`

Удаление значения из состояния.

```typescript
await ctx.invokeApi('state:delete', 'my-plugin.cache');
// Возвращает: boolean (true если удалено)
```

### `state:has`

Проверка существования ключа.

```typescript
const exists = await ctx.invokeApi<boolean>('state:has', 'my-plugin.cache');
```

### `state:keys`

Получение всех ключей в состоянии.

```typescript
const keys = await ctx.invokeApi<string[]>('state:keys');
```

### `state:clear`

Очистка всего состояния.

```typescript
await ctx.invokeApi('state:clear');
```

### `state:dump`

Экспорт всего состояния как объекта.

```typescript
const snapshot = await ctx.invokeApi<Record<string, unknown>>('state:dump');
```

### `state:restore`

Восстановление состояния из дампа.

```typescript
await ctx.invokeApi('state:restore', snapshot);
```

---

## Filesystem API

Доступ к файлам в хранилище.

### `fs:read-text-file`

Чтение файла как UTF-8 текста.

```typescript
const content = await ctx.invokeApi<string>('fs:read-text-file', '/path/to/file.md');
```

### `fs:read-file`

Чтение файла как бинарных данных.

```typescript
const data = await ctx.invokeApi<Uint8Array>('fs:read-file', '/path/to/image.png');
```

### `fs:write-text-file`

Запись текста в файл.

```typescript
await ctx.invokeApi('fs:write-text-file', '/path/to/file.md', '# Привет мир');
```

### `fs:write-file`

Запись бинарных данных в файл.

```typescript
await ctx.invokeApi('fs:write-file', '/path/to/file.bin', new Uint8Array([...]));
```

### `fs:exists`

Проверка существования пути.

```typescript
const exists = await ctx.invokeApi<boolean>('fs:exists', '/path/to/file.md');
```

### `fs:read-dir`

Чтение содержимого директории.

```typescript
interface DirEntry {
    name: string;
    isDirectory: boolean;
    isFile: boolean;
}

const entries = await ctx.invokeApi<DirEntry[]>('fs:read-dir', '/path/to/folder');
```

### `fs:create-dir`

Создание директории.

```typescript
await ctx.invokeApi('fs:create-dir', '/path/to/new-folder', { recursive: true });
```

### `fs:remove-file`

Удаление файла.

```typescript
await ctx.invokeApi('fs:remove-file', '/path/to/file.md');
```

### `fs:remove-dir`

Удаление директории.

```typescript
await ctx.invokeApi('fs:remove-dir', '/path/to/folder', { recursive: true });
```

### `fs:rename`

Переименование или перемещение файла/директории.

```typescript
await ctx.invokeApi('fs:rename', '/old/path.md', '/new/path.md');
```

### `fs:watch`

Наблюдение за изменениями в пути.

```typescript
interface FsEvent {
    path: string;
    type: 'create' | 'modify' | 'remove' | 'any';
}

const unwatch = await ctx.invokeApi<() => void>(
    'fs:watch', 
    '/path/to/folder', 
    (event: FsEvent) => {
        console.log('Обнаружено изменение:', event);
    }
);

// Позже: прекратить наблюдение
unwatch();
```

### `fs:pick-directory`

Открытие нативного диалога выбора директории.

```typescript
const path = await ctx.invokeApi<string | null>('fs:pick-directory');
if (path) {
    console.log('Пользователь выбрал:', path);
}
```

---

## Dialog API

Показ модальных диалогов пользователю.

### `dialog:alert`

Показ информационного сообщения.

```typescript
await ctx.invokeApi('dialog:alert', 'Внимание', 'Файл был удален');
```

### `dialog:confirm`

Показ диалога подтверждения.

```typescript
const confirmed = await ctx.invokeApi<boolean>(
    'dialog:confirm', 
    'Удаление файла', 
    'Вы уверены, что хотите удалить этот файл?'
);

if (confirmed) {
    // Пользователь нажал OK
}
```

### `dialog:prompt`

Показ диалога для ввода пользователя.

```typescript
const name = await ctx.invokeApi<string | null>(
    'dialog:prompt',
    'Переименование файла',
    'Введите новое имя файла:',
    'untitled.md'  // значение по умолчанию
);

if (name !== null) {
    // Пользователь ввел значение
}
```

---

## Theme API

Управление темами и цветами.

### `theme:register`

Регистрация кастомной темы.

```typescript
const myPalette = {
    'bg-main': '#1a1a2e',
    'bg-sidebar': '#16213e',
    'bg-surface': '#0f3460',
    'text-primary': '#e6e6e6',
    'accent-primary': '#e94560',
    // ... больше цветов
    'font-family': 'Inter, sans-serif'
};

await ctx.invokeApi('theme:register', 'my-dark-theme', myPalette);
```

### `theme:set`

Применение темы.

```typescript
const success = await ctx.invokeApi<boolean>('theme:set', 'my-dark-theme');
```

### `theme:get-current`

Получение имени текущей темы.

```typescript
const themeName = await ctx.invokeApi<string>('theme:get-current');
```

### `theme:list`

Список всех зарегистрированных тем.

```typescript
const themes = await ctx.invokeApi<string[]>('theme:list');
// ['deep-space', 'light', 'my-dark-theme']
```

### `theme:get`

Получение палитры темы по имени.

```typescript
const palette = await ctx.invokeApi<ThemePalette | undefined>('theme:get', 'deep-space');
```

---

## Layout API

Управление лэйаутами приложения и зонами.

### `layout:register-component`

Регистрация компонента лэйаута.

```typescript
const MyLayout: React.FC = () => <div>Мой кастомный лэйаут</div>;
await ctx.invokeApi('layout:register-component', 'my-layout', MyLayout);
```

### `layout:set`

Установка активного лэйаута.

```typescript
await ctx.invokeApi('layout:set', 'editor-layout', { showSidebar: true });
```

### `layout:get-active`

Получение информации о текущем лэйауте.

```typescript
interface ActiveLayout {
    name: string;
    props: Record<string, unknown>;
}

const layout = await ctx.invokeApi<ActiveLayout | null>('layout:get-active');
```

### `layout:list`

Список зарегистрированных лэйаутов.

```typescript
const layouts = await ctx.invokeApi<string[]>('layout:list');
```

### `zone:register`

Регистрация компонента в зоне лэйаута.

```typescript
await ctx.invokeApi('zone:register', 'sidebar-top', {
    component: 'my-sidebar-widget',
    priority: 100  // Выше = рендерится первым
});
```

### `zone:get`

Получение всех элементов в зоне.

```typescript
const items = await ctx.invokeApi<ZoneItem[]>('zone:get', 'sidebar-top');
```

### `zone:clear`

Очистка всех элементов в зоне.

```typescript
await ctx.invokeApi('zone:clear', 'sidebar-top');
```

---

## Controller API

Регистрация React-компонентов как именованных контроллеров.

### `controller:register`

Регистрация компонента-контроллера.

```typescript
const MyComponent: React.FC = () => <div>Привет!</div>;
await ctx.invokeApi('controller:register', 'my-component', MyComponent);
```

### `controller:unregister`

Отмена регистрации контроллера.

```typescript
await ctx.invokeApi('controller:unregister', 'my-component');
```

### `controller:get`

Получение контроллера по имени.

```typescript
const Component = await ctx.invokeApi<React.FC>('controller:get', 'my-component');
```

---

## Icon API

Регистрация и получение иконок.

### `icon:register`

Регистрация кастомной иконки.

```typescript
import { MyCustomIcon } from './icons';
await ctx.invokeApi('icon:register', 'my-icon', MyCustomIcon);
```

### `icon:get`

Получение компонента иконки.

```typescript
const IconComponent = await ctx.invokeApi<React.ElementType>('icon:get', 'my-icon');
```

---

## Editor API

Регистрация кастомных виджетов редактора (Порталов).

### `editor:register-widget`

Регистрация инлайн-виджета, рендерящегося для regex-совпадений.

```typescript
const ProgressBar: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const progress = parseInt(match[1], 10);
    return <div style={{ width: `${progress}%` }} />;
};

await ctx.invokeApi(
    'editor:register-widget',
    'my-plugin:progress-bar',
    /\[progress:(\d+)\]/g,
    ProgressBar
);
```

### `editor:unregister-widget`

Отмена регистрации виджета (автоматически очищается при выгрузке).

```typescript
await ctx.invokeApi('editor:unregister-widget', 'my-plugin:progress-bar');
```

Смотрите **[Виджеты (Порталы)](04-widgets.md)** для подробной документации.

---

## Settings API

Добавление UI конфигурации в модальное окно настроек.

### `settings:register-tab`

Регистрация вкладки настроек.

```typescript
await ctx.invokeApi('settings:register-tab', {
    id: 'my-plugin-settings',
    label: 'Мой плагин',
    icon: 'puzzle',
    order: 100
});
```

### `settings:register-group`

Регистрация группы настроек внутри вкладки.

```typescript
await ctx.invokeApi('settings:register-group', {
    id: 'my-plugin-general',
    tabId: 'my-plugin-settings',
    label: 'Основные настройки',
    order: 0
});
```

### `settings:register-item`

Регистрация элемента настроек внутри группы.

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

Смотрите **[Интеграция настроек](05-settings.md)** для подробной документации.

### `settings:open` / `settings:close` / `settings:toggle`

Управление модальным окном настроек.

```typescript
await ctx.invokeApi('settings:open');
await ctx.invokeApi('settings:close');
await ctx.invokeApi('settings:toggle');
```

---

## Context Menu API

Добавление элементов в контекстные меню.

### `context-menu:register`

Регистрация провайдера меню для контекста.

```typescript
const unsubscribe = await ctx.invokeApi<() => void>(
    'context-menu:register',
    'explorer-item',  // ID контекста
    (payload: { path: string }) => [
        {
            type: 'action',
            id: 'my-action',
            label: 'Моё кастомное действие',
            icon: 'star',
            onClick: () => {
                console.log('Клик на:', payload.path);
            }
        }
    ]
);
```

Смотрите **[Контекстные меню](06-context-menu.md)** для подробной документации.

---

## Explorer API

Управление файловым проводником.

### `explorer:open`

Открытие папки в проводнике.

```typescript
await ctx.invokeApi('explorer:open', '/path/to/folder');
```

### `explorer:set-root`

Установка корневого пути для проводника.

```typescript
await ctx.invokeApi('explorer:set-root', '/new/vault/path');
```

---

## Synapse API

Программное управление внешними плагинами.

### `synapse:load-plugin`

Загрузка внешнего плагина по пути.

```typescript
interface SynapseLoadResult {
    success: boolean;
    pluginId?: string;
    error?: string;
}

const result = await ctx.invokeApi<SynapseLoadResult>(
    'synapse:load-plugin',
    '/path/to/plugin-folder'
);
```

### `synapse:unload-plugin`

Выгрузка внешнего плагина.

```typescript
const success = await ctx.invokeApi<boolean>('synapse:unload-plugin', 'plugin-id');
```

### `synapse:list-plugins`

Список загруженных ID плагинов.

```typescript
const pluginIds = await ctx.invokeApi<string[]>('synapse:list-plugins');
```

### `synapse:get-details`

Получение детальных метаданных всех плагинов.

```typescript
const details = await ctx.invokeApi<unknown[]>('synapse:get-details');
```

---

## Shell API

Открытие внешних ресурсов.

### `shell:open`

Открытие URL в браузере по умолчанию.

```typescript
await ctx.invokeApi('shell:open', 'https://notehub.md');
```

---

## Vault API

Операции уровня хранилища.

### `vault:close`

Закрытие текущего хранилища и возврат на экран приветствия.

```typescript
await ctx.invokeApi('vault:close');
```

---

## Следующие шаги

- Изучите создание **[Виджетов (Порталов)](04-widgets.md)**
- Добавьте **[Настройки](05-settings.md)** в ваш плагин
- Интегрируйтесь с **[Контекстными меню](06-context-menu.md)**
