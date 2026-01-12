<h1 align="center">📐 Layout Manager Plugin</h1>

<p align="center">
  <code>nh.ui.layout-manager</code> • UI • Screen management system
</p>

---

## Overview

Централизованное управление лейаутами как React-компонентами:

- 📝 Регистрация React-компонентов как именованных лейаутов
- 🔄 Переключение активного лейаута
- 📤 События при смене лейаута
- 🎨 `<LayoutRenderer />` для host-приложений

---

## 🚀 Quick Start

### 1. Add LayoutRenderer

```tsx
import { LayoutRenderer } from '@notehub/layout-manager';

function App() {
    return <LayoutRenderer />;
}
```

### 2. Set Active Layout

```typescript
await app.api.invoke('layout:set-active', 'welcome');
```

---

## 🔌 API Methods

### `layout:register-component(name, component)`

```typescript
await app.api.invoke('layout:register-component', 'editor', EditorLayout);
```

### `layout:set-active(name, props?)`

```typescript
await app.api.invoke('layout:set-active', 'editor', { vaultName: 'My Notes' });
```

### `layout:get-active()`

```typescript
const { name, props } = await app.api.invoke('layout:get-active');
```

### `layout:list()`

```typescript
const layouts = await app.api.invoke('layout:list');
// ['welcome', 'editor']
```

---

## 📤 Events

### `layout:changed`

```typescript
app.events.on('layout:changed', ({ name, props }) => {
    console.log(`Layout: ${name}`);
});
```

---

## 🏗 Creating Layouts

```tsx
const MyLayout: React.FC<{ title: string }> = ({ title }) => (
    <div style={{
        height: '100vh',
        background: 'var(--nh-bg-main)',
        color: 'var(--nh-text-primary)',
    }}>
        <h1>{title}</h1>
    </div>
);

// Register
await app.api.invoke('layout:register-component', 'my-layout', MyLayout);

// Activate
await app.api.invoke('layout:set-active', 'my-layout', { title: 'Hello!' });
```

---

## 📦 Dependencies

- `nh.system.logger`
- `nh.ui.theme-manager`
- `react` >= 18.0.0
