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

## Option 1: Plugin Generator (Internal Plugins)

If you're developing a plugin **inside the Notehub monorepo**, use the generator:

```bash
pnpm gen:plugin
```

This interactive CLI will:
1. ✔ Ask for a plugin name (kebab-case)
2. ✔ Let you choose a category (`system`, `ui`, `features`)
3. ✔ Generate the full plugin structure with all boilerplate

**Generated files:**
- `package.json` — Package config with `@notehub/core` dependency
- `tsconfig.json` — TypeScript config extending base
- `manifest.json` — Plugin metadata
- `src/index.ts` — Plugin class implementing `IPlugin`

---

## Option 2: Manual Setup (External Plugins)

For plugins that live **outside the monorepo** and load at runtime from a vault:

### Step 1: Create the folder structure

```bash
mkdir my-plugin
cd my-plugin
npm init -y
npm install @notehub/api typescript esbuild --save-dev
```

### Step 2: Create manifest.json

```json
{
    "id": "hello-world",
    "name": "Hello World",
    "version": "1.0.0"
}
```

### Step 3: Create src/index.ts

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class HelloWorldPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Log a message when plugin loads
        await ctx.invokeApi('logger:info', 'HelloWorld', 'Hello from my plugin!');
        
        // Register a custom API
        ctx.registerApi('hello:say', (message: string) => {
            console.log(`[HelloWorld] ${message}`);
        });
        
        // Subscribe to file selection events
        ctx.subscribe<{ path: string }>('explorer:file-selected', (payload) => {
            console.log('File selected:', payload.path);
        });
    }
    
    async onunload(): Promise<void> {
        // Nothing to do - cleanup is automatic!
        console.log('HelloWorld plugin unloaded');
    }
}
```

### Step 4: Create tsconfig.json

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "lib": ["ES2020", "DOM"],
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "declaration": false,
        "outDir": "./dist"
    },
    "include": ["src/**/*"]
}
```

### Step 5: Create build script

Add to `package.json`:

```json
{
    "scripts": {
        "build": "esbuild src/index.ts --bundle --format=esm --outfile=main.js --external:@notehub/api --external:react"
    }
}
```

### Step 6: Build and install

```bash
npm run build
```

Copy the folder to your vault:
```
MyVault/.notehub/plugins/hello-world/
├── manifest.json
└── main.js
```

### Step 7: Test

1. Open Notehub.md with your vault
2. Your plugin loads automatically!
3. Check the console for "Hello from my plugin!"

---

## Important: External Dependencies

Your plugin runs in a **shared scope** with Notehub. These packages are provided by the host:

| Package | Description |
|---------|-------------|
| `@notehub/api` | Plugin API (`NotehubPlugin`, `PluginContext`) |
| `react` | React library |
| `react-dom` | React DOM renderer |

**Mark these as external** in your bundler config to avoid duplicating them!

---

## Hot Reload

Notehub watches the `.notehub/plugins/` directory. When you update your plugin:

1. The old version is automatically unloaded
2. The new version is loaded
3. All your API registrations are cleaned up automatically!

---

## Debugging Tips

1. **Open DevTools** (Ctrl+Shift+I) to see console logs
2. **Use `logger:info`** API for structured logging
3. **Check the Synapse plugin** logs for load/unload events

---

## Next Steps

- Read **[Architecture](02-architecture.md)** to understand the plugin lifecycle
- Explore the **[API Reference](03-api-reference.md)** for all available methods
