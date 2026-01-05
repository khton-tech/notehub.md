# Developer Hub

Welcome! So you want to hack on Notehub? You've come to the right place.
Notehub is built to be the "Linux of Note-taking"—a strong, stable core with infinite possibilities for community extension.

## Architecture Overview

Notehub focuses on modularity.
- **Microkernel:** The core system is minimal, handling only the most essential lifecycle events.
- **Synapse:** Our internal system plugin responsible for dynamic loading of external extensions.
- **React Bridge:** Seamlessly integrates standard React components into the application's flow, including within Markdown.

## Quick Links

Check out our technical reports and RFCs for deep dives:
- [Architecture & Design Reports](../docs/ru/reports/)

## Plugin Development

Notehub uses a custom `.nhp` format for plugins. This ensures strictly bundled, secure, and performant extensions.

### Getting Started
We are working on the `@notehub/cli` to make creating plugins a breeze. For now, check out the `@notehub/api` definitions to understand what's possible.

### Key Concepts
- **Manifest:** Every plugin starts with a `manifest.json`.
- **API:** Interact with the system via the global `notehub` object or the injected context.

## Contributing

To build the core Notehub Desktop application:

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Run in development mode:**
    ```bash
    pnpm dev:desktop
    ```

We welcome Pull Requests! Please follow the existing code style and ensure you've tested your changes.
