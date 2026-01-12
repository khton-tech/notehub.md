<h1 align="center">🎨 Theme Manager Plugin</h1>

<p align="center">
  <code>nh.ui.theme-manager</code> • UI • CSS variable theming system
</p>

---

## Overview

Централизованная система тем на CSS-переменных для Notehub.md:

- 🎭 Регистрация и применение тем
- 💾 Сохранение выбранной темы через `config-manager`
- 📡 События при смене темы

---

## 🔌 API Methods

### `theme:register(name, palette)`

Регистрация новой темы.

```typescript
await app.api.invoke('theme:register', 'my-theme', {
    'bg-main': '#1a1b26',
    'bg-surface': '#24283b',
    'text-primary': '#c0caf5',
    'accent-primary': '#7aa2f7',
});
```

### `theme:set(name): Promise<boolean>`

Применение темы.

```typescript
await app.api.invoke('theme:set', 'my-theme');
```

### `theme:get-current(): string`

Получение имени текущей темы.

### `theme:list(): string[]`

Список всех зарегистрированных тем.

### `theme:get(name): ThemePalette | undefined`

Получение палитры темы по имени.

---

## 📤 Events

### `theme:changed`

```typescript
app.events.on('theme:changed', ({ name, palette }) => {
    console.log(`Theme changed to: ${name}`);
});
```

---

## 🎨 CSS Variables

Все переменные используют префикс `--nh-`:

| Variable | Description |
|----------|-------------|
| `--nh-bg-main` | Основной фон |
| `--nh-bg-sidebar` | Фон сайдбара |
| `--nh-bg-surface` | Фон карточек/панелей |
| `--nh-text-primary` | Основной текст |
| `--nh-text-muted` | Приглушенный текст |
| `--nh-accent-primary` | Основной акцент |
| `--nh-border-subtle` | Тонкие границы |

---

## 🌙 Встроенные темы

### Deep Space (default)
```css
--nh-bg-main: #021024;
--nh-accent-primary: #5483B3;
--nh-text-primary: #C1E8FF;
```

### Light
```css
--nh-bg-main: #f8fafc;
--nh-accent-primary: #3b82f6;
--nh-text-primary: #1e293b;
```

---

## 📦 Dependencies

- `nh.system.logger`
- `nh.system.config-manager`
