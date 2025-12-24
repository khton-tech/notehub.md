# Layout Manager Plugin

Layout and screen management for Notehub.md applications.

## Overview

The Layout Manager provides a centralized way to manage application layouts as React components. It:

- Registers React components as named layouts
- Controls which layout is currently active
- Exports a `<LayoutRenderer />` component for host applications
- Emits events when layouts change

## Installation

The host application must have React 18+ installed as a peer dependency.

## Quick Start

### 1. Add LayoutRenderer to your App

```tsx
import React from 'react';
import { LayoutRenderer } from '@notehub/layout-manager';

function App() {
    return <LayoutRenderer />;
}
```

### 2. Set an Active Layout

```typescript
// Set the welcome layout as active
app.api.invoke('layout:set-active', 'welcome');

// With optional props
app.api.invoke('layout:set-active', 'welcome', { showTutorial: true });
```

## API Methods

### `layout:register-component(name: string, component: React.FC)`
Register a React component as a layout.

```typescript
import { MyCustomLayout } from './layouts/MyCustomLayout';

app.api.invoke('layout:register-component', 'my-layout', MyCustomLayout);
```

### `layout:set-active(name: string, props?: object): boolean`
Set the active layout. Returns `true` if successful.

```typescript
const success = app.api.invoke('layout:set-active', 'my-layout', {
    title: 'Welcome Back',
    showSidebar: true,
});
```

### `layout:get-active(): { name: string, props: object } | null`
Get the currently active layout info.

```typescript
const active = app.api.invoke('layout:get-active');
// { name: 'welcome', props: {} }
```

### `layout:list(): string[]`
List all registered layout names.

```typescript
const layouts = app.api.invoke('layout:list');
// ['welcome', 'my-layout']
```

## Events

### `layout:changed`
Emitted when the active layout changes.

```typescript
app.events.on('layout:changed', ({ name, props }) => {
    console.log(`Layout changed to: ${name}`);
});
```

## Built-in Layouts

### WelcomeLayout

The `welcome` layout provides a default welcome screen with:

- **Sidebar** (300px) - Recent vaults area
- **Header** (30% height) - App info/branding
- **Content** (70% height) - Actions area

Layout structure:
```
┌──────────────┬────────────────────────────┐
│              │        Header (30%)        │
│   Sidebar    ├────────────────────────────┤
│   (300px)    │                            │
│              │       Content (70%)        │
│              │                            │
└──────────────┴────────────────────────────┘
```

## Creating Custom Layouts

Create a React component and register it:

```tsx
// layouts/EditorLayout.tsx
import React, { FC } from 'react';

interface EditorLayoutProps {
    vaultName?: string;
}

export const EditorLayout: FC<EditorLayoutProps> = ({ vaultName }) => {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '250px 1fr 300px',
            height: '100vh',
            backgroundColor: 'var(--nh-bg-main)',
            color: 'var(--nh-text-primary)',
        }}>
            <aside>File Explorer</aside>
            <main>
                <h1>{vaultName ?? 'Untitled Vault'}</h1>
                <p>Editor content here</p>
            </main>
            <aside>Properties Panel</aside>
        </div>
    );
};
```

Register in your plugin:

```typescript
import { EditorLayout } from './layouts/EditorLayout';

async load(app: NotehubCore) {
    app.api.invoke('layout:register-component', 'editor', EditorLayout);
}
```

Activate with props:

```typescript
app.api.invoke('layout:set-active', 'editor', { 
    vaultName: 'My Notes' 
});
```

## CSS Integration

Layouts should use CSS variables from `theme-manager` for consistent theming:

| Variable | Description |
|----------|-------------|
| `--nh-bg-main` | Main background color |
| `--nh-bg-surface` | Surface/panel background |
| `--nh-border-accent` | Primary border color |
| `--nh-border-secondary` | Secondary border color |
| `--nh-text-primary` | Primary text color |
| `--nh-text-secondary` | Secondary text color |

## Dependencies

- `nh.system.logger` - For logging
- `nh.ui.theme-manager` - For CSS variables

## Peer Dependencies

- `react` >= 18.0.0
