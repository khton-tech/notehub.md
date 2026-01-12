<p align="center">
  <img src="./logos/logo-background.svg" alt="Notehub Logo" width="600" />
</p>

<h1 align="center">Notehub.md</h1>

<p align="center">
  <strong>🐧 The Linux of Note-Taking</strong><br>
  <em>A modular, plugin-first markdown editor that you can extend infinitely</em>
</p>

<p align="center">
  <a href="https://github.com/khton-tech/notehub.md/releases">
    <img src="https://img.shields.io/badge/version-0.1.5-blueviolet?style=for-the-badge" alt="Version" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-AGPLv3-blue?style=for-the-badge" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/Built_with-Tauri-24C8D8?style=for-the-badge&logo=tauri" alt="Tauri" />
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-plugin-development">Plugins</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔌 Plugin-First Architecture
Everything is a plugin. The core is minimal — all features (editor, explorer, themes) are implemented as plugins that can be replaced or extended.

### 🎨 Live Preview Editor
See formatting as you type. Markdown decorations, WikiLinks, and callouts render inline while editing.

### 🧩 Custom Widgets
Create interactive React components that render inside your notes. Progress bars, buttons, status badges — if you can build it, you can embed it.

</td>
<td width="50%">

### ⚡ Hot-Reload Plugins
Develop plugins with instant feedback. Save your code and see changes immediately — no restart required.

### 🎭 Theming System
Register custom themes with full control over colors, fonts, and styling. Switch themes on the fly.

### 🔐 Microkernel Design
Plugins run in isolation. A buggy plugin can't crash the core. Safe, stable, extensible.

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Installation

| Method | Description |
|--------|-------------|
| **Windows Installer** | Download `.msi` from [Releases](https://github.com/khton-tech/notehub.md/releases) |
| **Portable** | Download `.zip`, extract, and run `Notehub.exe` |

### Development

```bash
# Clone the repo
git clone https://github.com/khton-tech/notehub.md.git
cd notehub.md

# Install dependencies
pnpm install

# Run in development mode
pnpm dev:desktop
```

---

## 🧩 Plugin Development

Notehub is **designed for extensibility**. Create your own plugins to add features, widgets, themes, and more.

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class MyPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Register an API
        ctx.registerApi('my-plugin:greet', (name: string) => `Hello, ${name}!`);
        
        // Subscribe to events
        ctx.subscribe('explorer:file-selected', (payload) => {
            console.log('File selected:', payload.path);
        });
    }
    
    async onunload(): Promise<void> {
        // Cleanup is automatic!
    }
}
```

### 📚 Documentation

| Language | Link |
|----------|------|
| 🇬🇧 English | **[Plugin Developer Guide](docs/forPluginMakers/en/README.md)** |
| 🇷🇺 Русский | **[Руководство разработчика плагинов](docs/forPluginMakers/ru/README.md)** |

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      NotehubCore                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │   EventBus   │  │    ApiBus    │  │  Plugin Registry │    │ 
│  │  (pub/sub)   │  │  (RPC calls) │  │  (lifecycle)     │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
└──────────────────────────────────────────────────────────────┘
         ▲                  ▲                   ▲
         │                  │                   │
    ┌────┴────┐       ┌────┴────┐        ┌──────┴─────┐
    │  Logger │       │  Editor │        │  Explorer  │
    │  Plugin │       │  Plugin │        │   Plugin   │
    └─────────┘       └─────────┘        └────────────┘
```

### Core Packages

| Package | Description |
|---------|-------------|
| `@notehub/core` | Microkernel with EventBus and ApiBus |
| `@notehub/api` | Public SDK for plugin development |
| `apps/desktop` | Tauri-based desktop application |

### Plugin Categories

| Category | Examples |
|----------|----------|
| **System** | Logger, Config Manager, State Manager, Synapse (plugin loader) |
| **UI** | Theme Manager, Layout Manager, Settings, Dialogs |
| **Features** | Editor, Explorer, Backlinks, About |

---

## 🤝 Contributing

We welcome contributions! Notehub is **Open Source and Copyleft** (AGPLv3).

### Ways to Contribute

- 🐛 **Report bugs** — Open an issue
- 💡 **Suggest features** — Start a discussion  
- 🔧 **Submit PRs** — Check [open issues](https://github.com/khton-tech/notehub.md/issues)
- 📖 **Improve docs** — Help us write better guides

### Development Resources

- **[Developer Hub](docs/DEVELOPERS.md)** — Architecture and conventions
- **[Plugin Guide](docs/forPluginMakers/en/README.md)** — Build external plugins

---

## 📄 License

**GNU Affero General Public License v3.0 (AGPL-3.0)**

Copyright © 2026 Notehub Contributors

If you modify and distribute Notehub, you must share your changes.
See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Made with ❤️ for people who love plugins and markdown</strong>
</p>
