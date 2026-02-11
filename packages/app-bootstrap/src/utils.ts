import type { IPlugin } from '@notehub/core';
import type { PluginRegistryEntry, PluginModule } from './types.js';

/**
 * Convert plugin ID to package name.
 *
 * @example
 *   "nh.system.logger" -> "@notehub/logger"
 *   "nh.ui.theme-manager" -> "@notehub/theme-manager"
 */
export function pluginIdToPackageName(id: string): string {
    const parts = id.split('.');
    const name = parts[parts.length - 1];
    return `@notehub/${name}`;
}

/**
 * Extract plugin class from a dynamically imported module.
 * Tries (in order): default export, named `{name}Plugin`, any `*Plugin` export.
 */
export function extractPluginClass(module: PluginModule, manifest: PluginRegistryEntry): (new () => IPlugin) | null {
    // Try default export first
    if (module.default && typeof module.default === 'function') {
        return module.default as new () => IPlugin;
    }

    // Try named export based on manifest name + "Plugin"
    const namedExport = `${manifest.name}Plugin`;
    if (module[namedExport] && typeof module[namedExport] === 'function') {
        return module[namedExport] as new () => IPlugin;
    }

    // Try any export that looks like a plugin class
    for (const key of Object.keys(module)) {
        if (key.endsWith('Plugin') && typeof module[key] === 'function') {
            return module[key] as new () => IPlugin;
        }
    }

    return null;
}
