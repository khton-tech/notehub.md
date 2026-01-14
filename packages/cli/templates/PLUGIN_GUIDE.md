# 🔌 Notehub Plugin Developer Guide

> Complete documentation for creating plugins for Notehub.md

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Plugin Architecture](#plugin-architecture)
3. [API Reference](#api-reference)
4. [Widgets (Portals)](#widgets-portals)
5. [Settings Integration](#settings-integration)
6. [Context Menu](#context-menu)
7. [Plugin Examples](#plugin-examples)

---

# Getting Started

This guide will walk you through creating your first Notehub.md plugin.

## Prerequisites

- **Node.js** v18+ with npm/pnpm
- **TypeScript** (recommended, but JavaScript works too)
- **Bundler**: esbuild, Vite, or Rollup
- A Notehub.md vault to test in

## Plugin Structure

Every plugin needs at minimum:

```
my-plugin/
├── manifest.json    # Plugin metadata (required)
├── main.js          # Entry point (compiled)
└── src/             # Source files (optional)
    └── index.ts
```

## manifest.json

The manifest describes your plugin to Notehub:

```json
{
    "id": "my-awesome-plugin",
    "name": "My Awesome Plugin",
    "version": "1.0.0",
    "main": "main.js",
    "dependencies": []
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Unique identifier (lowercase, hyphens allowed) |
| `name` | ✅ | Human-readable display name |
| `version` | ✅ | Semantic version (e.g., `1.0.0`) |
| `main` | ❌ | Entry point file, defaults to `main.js` |
| `dependencies` | ❌ | Array of internal plugin IDs this plugin requires |

---

## Quick Start with CLI

The fastest way to create a new plugin:

```bash
npx @notehub/cli create ext.my-plugin --name "My Plugin"
```

This generates the complete plugin structure with all necessary files.

## Manual Setup

### Step 1: Create the folder structure

```bash
mkdir my-plugin
cd my-plugin
npm init -y
npm install @notehub/api typescript esbuild --save-dev
```

### Step 2: Create src/index.ts

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class HelloWorldPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        await ctx.invokeApi('logger:info', 'HelloWorld', 'Hello from my plugin!');
        
        ctx.registerApi('hello:say', (message: string) => {
            console.log(`[HelloWorld] ${message}`);
        });
        
        ctx.subscribe<{ path: string }>('explorer:file-selected', (payload) => {
            console.log('File selected:', payload.path);
        });
    }
    
    async onunload(): Promise<void> {
        console.log('HelloWorld plugin unloaded');
    }
}
```

### Step 3: Build and Install

```bash
npm run build
```

Copy to your vault:
```
MyVault/.notehub/plugins/hello-world/
├── manifest.json
└── main.js
```

## Hot Reload

Notehub watches the `.notehub/plugins/` directory. When you update your plugin:

1. The old version is automatically unloaded
2. The new version is loaded
3. All your API registrations are cleaned up automatically!

---

# Plugin Architecture

## Microkernel Architecture

Notehub.md follows a **microkernel** design where the core is minimal and all functionality comes from plugins:

```
┌─────────────────────────────────────────────────────────────┐
│                    NotehubCore                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  EventBus   │  │   ApiBus    │  │  Plugin Registry    │ │
│  │  (pub/sub)  │  │ (RPC calls) │  │  (lifecycle mgmt)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        ▲                 ▲                    ▲
        │                 │                    │
   ┌────┴───┐       ┌─────┴────┐        ┌─────┴────┐
   │ Logger │       │  Editor  │        │ Explorer │
   │ Plugin │       │  Plugin  │        │  Plugin  │
   └────────┘       └──────────┘        └──────────┘
```

## PluginContext

Your gateway to the Notehub ecosystem:

```typescript
interface PluginContext {
    registerApi(name: string, handler: (...args: unknown[]) => unknown): void;
    invokeApi<T>(name: string, ...args: unknown[]): Promise<T>;
    subscribe<T>(event: string, handler: (payload: T) => void): void;
}
```

### Auto-Cleanup Magic

When your plugin is unloaded, `PluginContext` automatically:

- ✅ Unregisters all APIs you registered
- ✅ Unsubscribes from all events
- ✅ Removes editor widgets you registered
- ✅ Removes settings tabs/groups/items you added

---

# API Reference

## Logger API

```typescript
await ctx.invokeApi('logger:info', 'MyPlugin', 'Operation completed');
await ctx.invokeApi('logger:warn', 'MyPlugin', 'Config not found');
await ctx.invokeApi('logger:error', 'MyPlugin', 'Failed to load');
```

## Config API (Persistent)

```typescript
// Get value
const fontSize = await ctx.invokeApi<number>('config:get', 'editor.font-size', 14);

// Set value (auto-saved)
await ctx.invokeApi('config:set', 'my-plugin.option', true);

// Delete
await ctx.invokeApi('config:delete', 'my-plugin.option');
```

## State API (Runtime)

```typescript
await ctx.invokeApi('state:set', 'my-plugin.cache', { data: [...] });
const cache = await ctx.invokeApi<MyData>('state:get', 'my-plugin.cache');
await ctx.invokeApi('state:delete', 'my-plugin.cache');
```

## Filesystem API

```typescript
// Read file
const content = await ctx.invokeApi<string>('fs:read-text-file', '/path/to/file.md');

// Write file
await ctx.invokeApi('fs:write-text-file', '/path/to/file.md', '# Hello World');

// Check existence
const exists = await ctx.invokeApi<boolean>('fs:exists', '/path/to/file.md');

// Read directory
const entries = await ctx.invokeApi<DirEntry[]>('fs:read-dir', '/path/to/folder');

// Create directory
await ctx.invokeApi('fs:create-dir', '/path/to/new-folder', { recursive: true });

// Delete file
await ctx.invokeApi('fs:remove-file', '/path/to/file.md');

// Rename/move
await ctx.invokeApi('fs:rename', '/old/path.md', '/new/path.md');

// Watch for changes
const unwatch = await ctx.invokeApi<() => void>(
    'fs:watch', 
    '/path/to/folder', 
    (event) => console.log('Change:', event)
);
```

## Dialog API

```typescript
// Alert
await ctx.invokeApi('dialog:alert', 'Warning', 'File has been deleted');

// Confirm
const confirmed = await ctx.invokeApi<boolean>(
    'dialog:confirm', 'Delete File', 'Are you sure?'
);

// Prompt
const name = await ctx.invokeApi<string | null>(
    'dialog:prompt', 'Rename File', 'Enter new name:', 'default.md'
);
```

## Theme API

```typescript
// Register theme
await ctx.invokeApi('theme:register', 'my-theme', {
    'bg-main': '#1a1a2e',
    'accent-primary': '#e94560',
    // ...
});

// Apply theme
await ctx.invokeApi('theme:set', 'my-theme');

// Get current
const theme = await ctx.invokeApi<string>('theme:get-current');

// List all
const themes = await ctx.invokeApi<string[]>('theme:list');
```

## Editor Widget API

```typescript
// Register widget
await ctx.invokeApi(
    'editor:register-widget',
    'my-plugin:progress-bar',
    /\[progress:(\d+)\]/g,
    ProgressBarComponent
);

// Unregister (optional - auto-cleaned)
await ctx.invokeApi('editor:unregister-widget', 'my-plugin:progress-bar');
```

## Settings API

```typescript
// Register tab
await ctx.invokeApi('settings:register-tab', {
    id: 'my-plugin', label: 'My Plugin', icon: 'puzzle', order: 100
});

// Register group
await ctx.invokeApi('settings:register-group', {
    id: 'my-group', tabId: 'my-plugin', label: 'General', order: 0
});

// Register item
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.enabled',
    type: 'toggle',  // 'toggle' | 'text' | 'number' | 'select' | 'color'
    label: 'Enable plugin',
    groupId: 'my-group',
    order: 0,
    defaultValue: true
});

// Open/close settings
await ctx.invokeApi('settings:open');
await ctx.invokeApi('settings:close');
```

## Context Menu API

```typescript
await ctx.invokeApi(
    'context-menu:register',
    'explorer-item',
    (payload: { path: string }) => [
        {
            type: 'action',
            id: 'my-action',
            label: 'My Action',
            icon: 'star',
            onClick: () => console.log('Clicked:', payload.path)
        },
        { type: 'separator' },
        {
            type: 'submenu',
            label: 'More Options',
            items: [/* ... */]
        }
    ]
);
```

## Shell API

```typescript
await ctx.invokeApi('shell:open', 'https://notehub.md');
```

## Vault API

```typescript
await ctx.invokeApi('vault:close');
```

---

# Widgets (Portals)

Portals are custom React components that render inline within the editor.

## How Portals Work

1. You define a **regex pattern** that matches text in the document
2. You provide a **React component** to render for each match
3. Notehub replaces matched text with your component in **view mode**
4. When the cursor enters the match, it switches to **edit mode**

## Complete Example: Progress Bar

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';
import React from 'react';

const ProgressBar: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const percentage = parseInt(match[1], 10);
    
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '2px 8px',
            background: 'var(--nh-bg-surface)',
            borderRadius: '4px',
        }}>
            <span style={{
                width: '100px',
                height: '8px',
                background: 'var(--nh-bg-secondary)',
                borderRadius: '4px',
                overflow: 'hidden',
            }}>
                <span style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: 'var(--nh-accent-primary)',
                    display: 'block',
                }} />
            </span>
            <span style={{ fontSize: '12px', color: 'var(--nh-text-muted)' }}>
                {percentage}%
            </span>
        </span>
    );
};

export default class ProgressBarPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        await ctx.invokeApi(
            'editor:register-widget',
            'progress-bar',
            /\[progress:(\d+)\]/g,
            ProgressBar
        );
    }
    
    async onunload(): Promise<void> {}
}
```

**Usage in documents:**
```markdown
Project completion: [progress:75]
```

---

# Settings Integration

## Structure

```
Settings Modal
└── Tab (e.g., "My Plugin")
    └── Group (e.g., "Appearance")
        └── Item (e.g., "Enable dark mode")
```

## Item Types

| Type | Description |
|------|-------------|
| `toggle` | Boolean switch |
| `text` | Text input |
| `number` | Number input with min/max/step |
| `select` | Dropdown with options |
| `color` | Color picker |

## Reading Settings

```typescript
const isEnabled = await ctx.invokeApi<boolean>('config:get', 'my-plugin.enabled', true);
const maxItems = await ctx.invokeApi<number>('config:get', 'my-plugin.max-items', 10);
```

---

# Context Menu

## Menu Item Types

### Action

```typescript
{
    type: 'action',
    id: 'my-action',
    label: 'My Action',
    icon: 'star',
    onClick: (payload) => { /* handle */ }
}
```

### Separator

```typescript
{ type: 'separator' }
```

### Submenu

```typescript
{
    type: 'submenu',
    label: 'More Options',
    items: [/* nested items */]
}
```

---

# Plugin Examples

## Hello World

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class HelloWorld extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        await ctx.invokeApi('logger:info', 'HelloWorld', '👋 Hello!');
        
        ctx.registerApi('hello:greet', (name: string) => {
            return `Hello, ${name}!`;
        });
    }
    
    async onunload(): Promise<void> {}
}
```

## Word Counter Widget

```typescript
const WordCounter: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const text = match[1];
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    return <span>📝 {words} words</span>;
};

// Register with pattern: {{count: your text here}}
await ctx.invokeApi(
    'editor:register-widget',
    'word-counter',
    /\{\{count:\s*(.+?)\}\}/g,
    WordCounter
);
```

## Full-Featured Plugin

See the [examples documentation](https://github.com/khton-tech/notehub.md/tree/main/docs/forPluginMakers/en/07-examples.md) for complete plugin code combining widgets, settings, and context menus.

---

## Build Configuration

### package.json

```json
{
    "scripts": {
        "build": "nhp build"
    },
    "devDependencies": {
        "@notehub/api": "workspace:*",
        "@types/react": "^18.3.0",
        "typescript": "^5.6.0"
    },
    "peerDependencies": {
        "react": "^18.3.0"
    }
}
```

### External Dependencies

These packages are provided by Notehub - mark them as **external**:

- `@notehub/api`
- `react`
- `react-dom`

---

## Debugging Tips

1. **Open DevTools** (Ctrl+Shift+I) to see console logs
2. **Use `logger:info`** API for structured logging
3. **Check the Synapse plugin** logs for load/unload events

---

## CSS Variables

Use these for consistent styling:

- `--nh-bg-main`, `--nh-bg-sidebar`, `--nh-bg-surface`
- `--nh-text-primary`, `--nh-text-secondary`, `--nh-text-muted`
- `--nh-accent-primary`, `--nh-accent-secondary`
- `--nh-border-accent`, `--nh-border-subtle`

---

## Resources

- [GitHub Repository](https://github.com/khton-tech/notehub.md)
- [API Package](https://github.com/khton-tech/notehub.md/tree/main/packages/api)
- [Example Plugins](https://github.com/khton-tech/notehub.md/tree/main/packages/plugins)

---

<p align="center">
  <strong>Happy coding! 🎉</strong>
</p>
