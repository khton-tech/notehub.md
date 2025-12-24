# Theme Manager Plugin

CSS variable theming system for Notehub.md applications.

## Overview

The Theme Manager provides a centralized way to manage application themes through CSS custom properties. It:

- Registers and applies theme palettes as CSS variables
- Persists user theme preference via `config-manager`
- Emits events when theme changes

## API Methods

### `theme:register(name: string, palette: ThemePalette)`
Register a new theme.

```typescript
app.api.invoke('theme:register', 'my-theme', {
  'bg-main': '#1a1b26',
  'bg-surface': '#24283b',
  'border-accent': '#7aa2f7',
  'border-secondary': '#565f89',
  'text-primary': '#c0caf5',
});
```

### `theme:set(name: string): Promise<boolean>`
Switch to a registered theme. Returns `true` if successful.

```typescript
await app.api.invoke('theme:set', 'my-theme');
```

### `theme:get-current(): string`
Get the currently active theme name.

```typescript
const current = app.api.invoke('theme:get-current');
```

### `theme:list(): string[]`
List all registered theme names.

```typescript
const themes = app.api.invoke('theme:list');
// ['deep-space', 'my-theme']
```

### `theme:get(name: string): ThemePalette | undefined`
Get a theme palette by name.

```typescript
const palette = app.api.invoke('theme:get', 'deep-space');
```

## Events

### `theme:changed`
Emitted when the active theme changes.

```typescript
app.events.on('theme:changed', ({ name, palette }) => {
  console.log(`Theme changed to: ${name}`);
});
```

## CSS Variables

All theme variables use the `--nh-` prefix. The default "Deep Space" theme provides:

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `--nh-bg-main` | `#021024` | Main background |
| `--nh-bg-surface` | `#052659` | Surface/card background |
| `--nh-border-accent` | `#5483B3` | Primary accent/border |
| `--nh-border-secondary` | `#7DA0CA` | Secondary border |
| `--nh-text-primary` | `#C1E8FF` | Primary text |
| `--nh-text-secondary` | `#7DA0CA` | Secondary text |

## Tailwind CSS Integration

To use theme variables in Tailwind, configure your `tailwind.config.js`:

```javascript
// tailwind.config.js
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Map Notehub theme variables to Tailwind colors
        'nh-bg': {
          main: 'var(--nh-bg-main)',
          surface: 'var(--nh-bg-surface)',
        },
        'nh-border': {
          accent: 'var(--nh-border-accent)',
          secondary: 'var(--nh-border-secondary)',
        },
        'nh-text': {
          primary: 'var(--nh-text-primary)',
          secondary: 'var(--nh-text-secondary)',
        },
      },
      backgroundColor: {
        main: 'var(--nh-bg-main)',
        surface: 'var(--nh-bg-surface)',
      },
      borderColor: {
        accent: 'var(--nh-border-accent)',
        secondary: 'var(--nh-border-secondary)',
      },
      textColor: {
        primary: 'var(--nh-text-primary)',
        secondary: 'var(--nh-text-secondary)',
      },
    },
  },
  plugins: [],
};
```

### Usage Examples

With the above configuration, you can use theme colors like:

```html
<!-- Background colors -->
<div class="bg-main">Main background</div>
<div class="bg-surface">Card or panel</div>

<!-- Text colors -->
<p class="text-primary">Primary text</p>
<p class="text-secondary">Secondary text</p>

<!-- Border colors -->
<div class="border border-accent">Accent border</div>
<div class="border border-secondary">Secondary border</div>

<!-- Using the color palette directly -->
<div class="bg-nh-bg-main text-nh-text-primary border-nh-border-accent">
  Full theme integration
</div>
```

## Creating Custom Themes

Register custom themes that match your design needs:

```typescript
// Register a light theme
app.api.invoke('theme:register', 'light-mode', {
  'bg-main': '#ffffff',
  'bg-surface': '#f5f5f5',
  'border-accent': '#0066cc',
  'border-secondary': '#cccccc',
  'text-primary': '#1a1a1a',
  'text-secondary': '#666666',
});

// Switch to light theme
await app.api.invoke('theme:set', 'light-mode');
```

## Dependencies

- `nh.system.logger` - For logging
- `nh.system.config-manager` - For persisting theme preference
