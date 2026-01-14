<p align="center">
  <img src="https://raw.githubusercontent.com/khton-tech/notehub.md/main/logos/plugin-bundle-background.svg" alt="Notehub Plugin" width="128" />
</p>

<h1 align="center">@notehub.md/cli</h1>

<p align="center">
  <strong>🔧 CLI tool for building Notehub.md plugins</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@notehub.md/cli">
    <img src="https://img.shields.io/npm/v/@notehub.md/cli?style=flat-square&color=blueviolet" alt="npm version" />
  </a>
  <a href="https://github.com/khton-tech/notehub.md/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat-square" alt="License" />
  </a>
</p>

---

## 📦 Installation

To use `nhp` command globally (recommended for frequent use):

```bash
# Windows (PowerShell)
npm install -g "@notehub.md/cli"

# macOS / Linux
npm install -g @notehub.md/cli
```

Then you can simply run:

```bash
nhp create my-plugin
```

---

## 🚀 Quick Start (via npx)

### Create a new plugin

```bash
npx "@notehub.md/cli" create ext.my-plugin
```

This will scaffold a complete plugin project with:
- `manifest.json` — Plugin metadata
- `package.json` — Project configuration
- `tsconfig.json` — TypeScript config
- `src/index.ts` — Plugin entry point
- `PLUGIN_GUIDE.md` — Quick start guide
- `docs/index.html` — Beautiful documentation page

### Build your plugin

```bash
cd ext.my-plugin
npm install
npx "@notehub.md/cli" build
```

This creates `ext.my-plugin.nhp` — a ready-to-install plugin archive.

---

## 📖 Commands

### `nhp create <id>`

Create a new plugin from template.

```bash
nhp create ext.my-plugin              # Basic creation
nhp create ext.my-plugin --name "My Plugin"  # With custom name
nhp create ext.my-plugin --with-styles       # Include styles.css
```

**Options:**
- `-n, --name <name>` — Human-readable plugin name
- `-s, --with-styles` — Include `styles.css` template

### `nhp build`

Build and package the plugin in the current directory.

```bash
nhp build                   # Standard build
nhp build --no-minify       # Disable minification
nhp build --sourcemap       # Include source maps
nhp build --watch           # Watch mode
nhp build -o ./releases     # Custom output directory
```

**Options:**
- `-o, --output <dir>` — Output directory (default: `.`)
- `--no-minify` — Disable minification
- `--sourcemap` — Generate inline source maps
- `-w, --watch` — Watch mode (rebuild on changes)

---

## 📚 Documentation

Full documentation for plugin development:

| Language | Link |
|----------|------|
| 🇬🇧 English | **[Plugin Developer Guide](https://github.com/khton-tech/notehub.md/tree/main/docs/forPluginMakers/en)** |
| 🇷🇺 Русский | **[Руководство разработчика плагинов](https://github.com/khton-tech/notehub.md/tree/main/docs/forPluginMakers/ru)** |

---

## 🔌 Plugin Example

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

class MyPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Register an API
        ctx.registerApi('my-plugin:greet', (name: string) => {
            return `Hello, ${name}!`;
        });
        
        // Subscribe to events
        ctx.subscribe('explorer:file-selected', (payload) => {
            console.log('File selected:', payload.path);
        });
    }
}

export default new MyPlugin();
```

---

## 📄 License

**AGPL-3.0** — See [LICENSE](https://github.com/khton-tech/notehub.md/blob/main/LICENSE)

---

<p align="center">
  <strong>Made with ❤️ by <a href="https://github.com/khton-tech">khton-tech</a></strong>
</p>
