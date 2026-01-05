![Notehub Banner](./logos/logo-background.svg)

# Notehub

![License](https://img.shields.io/badge/License-AGPLv3-blue.svg)

**The Linux of Note-taking.**
A modular, microkernel-based note-taking environment designed to be extended.

---

> 🛠 **Building Plugins?**
> Check out the [Developer Hub](docs/DEVELOPERS.md) to learn how to extend Notehub.

---

## Features

Notehub is built from the ground up to be different:

- **Modular Architecture:** Everything is a plugin. The core is minimal, ensuring stability and performance.
- **Microkernel Design:** Isolation by default. Plugins run safely without crashing the core.
- **Rich Markdown:** Use real React components inside your notes (Callouts, Checkboxes, Progress Bars).
- **Settings System:** A unified, searchable settings interface for Core and Plugins alike.
- **External Plugin Loader:** Load plugins dynamically. If you can build it, Notehub can run it.

## Getting Started

### Installation

- **Windows Installer (.msi)**: For a standard setup.
- **Portable Version**: Run directly without installation.

### Development

To build the app locally:

```bash
pnpm install
pnpm dev:desktop
```

## Community & Contributing

We are Open Source and Copyleft (AGPLv3).

- **For Users:** Join our community (link coming soon).
- **For Developers:** Read the [Developer Hub](docs/DEVELOPERS.md).

## License

Copyright (C) 2026 Notehub Contributors.
Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
See [LICENSE](LICENSE) for details.
