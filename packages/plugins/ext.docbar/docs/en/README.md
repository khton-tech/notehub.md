<h1 align="center">🔌 Notehub Plugin Developer Guide</h1>

<p align="center">
  <em>Create powerful plugins for Notehub.md - the extensible note-taking app</em>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-documentation">Documentation</a> •
  <a href="#-examples">Examples</a> •
  <a href="#-api-reference">API Reference</a>
</p>

---

## 🚀 Quick Start

### Option 1: Use the Plugin Generator (Recommended)

For **internal plugins** (part of the monorepo):

```bash
pnpm gen:plugin
```

This interactive CLI will:
1. Ask for a plugin name (kebab-case, e.g., `my-feature`)
2. Let you choose a category (`system`, `ui`, `features`)
3. Generate the full plugin structure

**Output:**
```
🔌 Notehub.md Plugin Generator

✔ Plugin name (kebab-case): word-counter
✔ Select plugin category: features - User-facing features

📦 Creating plugin: nh.features.word-counter
   Path: packages/plugins/features/word-counter

   ✅ Created: package.json
   ✅ Created: tsconfig.json
   ✅ Created: manifest.json
   ✅ Created: src/index.ts

✨ Plugin created successfully!
```

---

### Option 2: Manual Setup (External Plugins)

For plugins that will be loaded at runtime from a vault:

#### 1. Create a plugin folder

```bash
mkdir my-plugin && cd my-plugin
npm init -y
npm install @notehub/api typescript esbuild --save-dev
```

---

## 📚 Documentation

| Chapter | Description |
|---------|-------------|
| [Getting Started](01-getting-started.md) | Prerequisites, setup, first plugin |
| [Architecture](02-architecture.md) | Plugin lifecycle, EventBus, ApiBus |
| [API Reference](03-api-reference.md) | All 50+ API methods with examples |
| [Widgets](04-widgets.md) | Custom React components in notes |
| [Settings](05-settings.md) | Add configuration UI |
| [Context Menu](06-context-menu.md) | Right-click menu integration |
| [Examples](07-examples.md) | Complete working plugins |

---

## 💡 What Can Plugins Do?

| Feature | API |
|---------|-----|
| 📁 Read/write files | `fs:read-text-file`, `fs:write-text-file` |
| ⚙️ Save settings | `config:get`, `config:set` |
| 🎨 Register themes | `theme:register`, `theme:set` |
| 🧩 Create widgets | `editor:register-widget` |
| 📋 Context menus | `context-menu:register` |
| 💬 Show dialogs | `dialog:alert`, `dialog:confirm` |
| 📡 Subscribe to events | `ctx.subscribe()` |

---

## 🎯 Examples

### Hello World
```typescript
ctx.registerApi('hello:greet', (name: string) => `Hello, ${name}!`);
```

### Progress Bar Widget
```typescript
await ctx.invokeApi('editor:register-widget', 'progress', /\[progress:(\d+)\]/g, 
    ({ match }) => <ProgressBar value={parseInt(match[1])} />);
```

### File Watcher
```typescript
ctx.subscribe<{ path: string }>('explorer:file-selected', (payload) => {
    console.log('Selected:', payload.path);
});
```

---

## 🔗 Links

- [Main README](../../README.md)
- [API Package](../../packages/api)
- [Example Plugins](../../packages/plugins)

---

<p align="center">
  <strong>Happy coding! 🎉</strong>
</p>
