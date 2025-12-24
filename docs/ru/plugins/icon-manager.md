# Icon Manager

**ID:** `nh.ui.icon-manager`  
**Пакет:** `@notehub/icon-manager`  
**Путь:** `packages/plugins/ui/icon-manager/`

## Описание

Централизованный реестр иконок на базе Lucide React. Предоставляет унифицированный компонент `<Icon />` и API для регистрации кастомных иконок.

## Зависимости

| Плагин | Версия |
|--------|--------|
| `nh.system.logger` | `^1.0.0` |

## Внешние зависимости

- `lucide-react` — библиотека иконок

## Доступные иконки

| Имя | Описание | Lucide-компонент |
|-----|----------|------------------|
| `folder-open` | Открытая папка | `FolderOpen` |
| `info` | Информация | `Info` |
| `zap` | Молния (действия) | `Zap` |
| `plus` | Плюс (добавить) | `Plus` |
| `settings` | Настройки | `Settings` |
| `x` | Закрыть | `X` |
| `file-text` | Документ | `FileText` |
| `help-circle` | Помощь (fallback) | `HelpCircle` |

## API методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `icon:register` | `(name: string, component: React.ElementType) => void` | Зарегистрировать иконку |
| `icon:get` | `(name: string) => React.ElementType` | Получить компонент иконки |

## Компонент `<Icon />`

### Импорт

```tsx
import { Icon } from '@notehub/icon-manager';
```

### Props

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `name` | `string` | — | Имя иконки из реестра |
| `size` | `number` | `24` | Размер в пикселях |
| `className` | `string` | — | CSS-классы |

### Примеры

```tsx
// Базовое использование
<Icon name="folder-open" />

// С размером и классом
<Icon name="info" size={48} className="text-blue-400" />

// Недоступная иконка → fallback на HelpCircle
<Icon name="unknown" />
```

## Регистрация кастомных иконок

```typescript
import { Star } from 'lucide-react';

// Регистрация через API
app.api.invoke('icon:register', 'star', Star);
```

## Архитектура

- **Singleton Pattern:** Реестр доступен глобально для компонента `<Icon />`
- **Fallback:** Неизвестные иконки отображаются как `HelpCircle`
- **Tree-shakeable:** Lucide поддерживает tree-shaking

## См. также

- [Layout Manager](./layout-manager.md) — использует Icon компонент
- [Theme Manager](./theme-manager.md) — стилизация через CSS-классы
