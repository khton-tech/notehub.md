import type { IPlugin } from '@notehub/core';

/**
 * Plugin registry entry from generated JSON
 */
export interface PluginRegistryEntry {
    id: string;
    name: string;
    version: string;
    type: string;
    dependencies?: string[];
}

/**
 * Plugin module that exports a plugin class
 */
export interface PluginModule {
    default?: new () => IPlugin;
    [key: string]: unknown;
}

/**
 * Configuration for the Notehub bootstrap process.
 * Each host app (desktop, capacitor) provides platform-specific implementations.
 */
export interface BootstrapConfig {
    /** Platform identifier for logging (e.g., "Desktop", "Capacitor") */
    platform: string;

    /**
     * Import a plugin by its package name.
     * Each host app implements this with its own set of static imports
     * (required for Vite to bundle them).
     */
    importPlugin: (packageName: string) => Promise<PluginModule>;

    /**
     * Register platform-specific host capabilities on the core instance.
     * For example, registering `shell:open` with a Tauri or Capacitor handler.
     */
    registerHostCapabilities: (core: import('@notehub/core').NotehubCore) => void;

    /**
     * Optional: Plugin IDs to skip during import (e.g., incompatible drivers).
     */
    skipPluginIds?: string[];

    /**
     * Load the plugin registry JSON.
     * Defaults to `import('./generated/plugin-registry.json')`.
     * Each host app provides its own import since the generated file is app-local.
     */
    loadRegistry: () => Promise<PluginRegistryEntry[]>;
}
