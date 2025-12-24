# Theme Manager

**ID:** `nh.ui.theme-manager`  
**Пакет:** `@notehub/theme-manager`  
**Путь:** `packages/plugins/ui/theme-manager/`

## Описание

Система тем на основе CSS-переменных. Управляет регистрацией и применением цветовых схем к документу.

## Зависимости

| Плагин | Версия |
|--------|--------|
| `nh.system.logger` | `^1.0.0` |

## CSS-переменные

Все переменные имеют префикс `--nh-`:

| Переменная | Описание | Значение (Deep Space) |
|------------|----------|----------------------|
| `--nh-bg-main` | Основной фон | `#021024` |
| `--nh-bg-surface` | Фон поверхности | `#052659` |
| `--nh-border-accent` | Акцентная граница | `#5483B3` |
| `--nh-border-secondary` | Вторичная граница | `#7DA0CA` |
| `--nh-text-primary` | Основной текст | `#C1E8FF` |
| `--nh-text-secondary` | Вторичный текст | `#7DA0CA` |

## API методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `theme:register` | `(name: string, palette: ThemePalette) => void` | Зарегистрировать тему |
| `theme:set` | `(name: string) => Promise<boolean>` | Применить тему |
| `theme:get-current` | `() => string` | Получить имя текущей темы |
| `theme:list` | `() => string[]` | Список всех тем |
| `theme:get` | `(name: string) => ThemePalette \| undefined` | Получить палитру темы |

## События

| Событие | Payload | Описание |
|---------|---------|----------|
| `theme:changed` | `{ name: string, palette: ThemePalette }` | Испускается при смене темы |

## Темы по умолчанию

| Тема | Описание |
|------|----------|
| `deep-space` | Тёмная тема в оттенках синего (по умолчанию) |

## Пример использования

```typescript
// Регистрация кастомной темы
app.api.invoke('theme:register', 'light', {
    'bg-main': '#ffffff',
    'bg-surface': '#f5f5f5',
    'border-accent': '#3366cc',
    'border-secondary': '#cccccc',
    'text-primary': '#333333',
    'text-secondary': '#666666',
});

// Применение темы
await app.api.invoke('theme:set', 'light');

// Подписка на изменения
app.events.on('theme:changed', ({ name }) => {
    console.log('Theme changed to:', name);
});
```

## Использование в CSS

```css
.my-component {
    background-color: var(--nh-bg-surface);
    color: var(--nh-text-primary);
    border: 1px solid var(--nh-border-accent);
}
```

## См. также

- [Layout Manager](./layout-manager.md) — использует CSS-переменные
- [Config Manager](./config-manager.md) — хранит выбранную тему
