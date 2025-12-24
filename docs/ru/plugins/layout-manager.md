# Layout Manager

**ID:** `nh.ui.layout-manager`  
**Пакет:** `@notehub/layout-manager`  
**Путь:** `packages/plugins/ui/layout-manager/`

## Описание

Система лейаутов. Регистрирует React-компоненты как лейауты и предоставляет `<LayoutRenderer />` для отрисовки активного лейаута.

## Зависимости

| Плагин | Версия |
|--------|--------|
| `nh.system.logger` | `^1.0.0` |
| `nh.ui.theme-manager` | `^1.0.0` |
| `nh.ui.icon-manager` | `^1.0.0` |

## API методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `layout:register` | `(name: string, component: React.FC) => void` | Зарегистрировать лейаут |
| `layout:set-active` | `(name: string) => boolean` | Установить активный лейаут |
| `layout:get-active` | `() => string \| null` | Получить имя активного лейаута |
| `layout:list` | `() => string[]` | Список всех лейаутов |

## Компонент `<LayoutRenderer />`

Отображает текущий активный лейаут.

```tsx
import { LayoutRenderer } from '@notehub/layout-manager';

function App() {
    return <LayoutRenderer />;
}
```

## Лейауты по умолчанию

### WelcomeLayout

Приветственный экран с CSS Grid:

```
┌─────────────┬────────────────────┐
│             │     App Info       │
│   Recent    ├────────────────────┤
│   Vaults    │                    │
│             │     Actions        │
│             │                    │
└─────────────┴────────────────────┘
```

**Структура:**
- **Sidebar (300px):** Последние хранилища
- **Header (30%):** Информация о приложении
- **Content (70%):** Быстрые действия

## Пример регистрации лейаута

```tsx
import React from 'react';

const MyLayout: React.FC = () => (
    <div style={{ padding: 20 }}>
        <h1>My Custom Layout</h1>
    </div>
);

// В плагине
app.api.invoke('layout:register', 'my-layout', MyLayout);

// Активация
app.api.invoke('layout:set-active', 'my-layout');
```

## Интеграция с Theme Manager

Все лейауты должны использовать CSS-переменные темы:

```tsx
const styles = {
    container: {
        backgroundColor: 'var(--nh-bg-main)',
        color: 'var(--nh-text-primary)',
    }
};
```

## Интеграция с Icon Manager

```tsx
import { Icon } from '@notehub/icon-manager';

const MyLayout = () => (
    <div>
        <Icon name="folder-open" size={48} className="text-yellow-400" />
        <span>Files</span>
    </div>
);
```

## См. также

- [Theme Manager](./theme-manager.md) — CSS-переменные
- [Icon Manager](./icon-manager.md) — компонент Icon
