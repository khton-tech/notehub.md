/**
 * @fileoverview Synapse Plugin - External Extension Loader
 * 
 * The Synapse Engine is responsible for loading external JavaScript plugins
 * at runtime using SystemJS. It provides a "shared scope" mechanism that
 * injects the host's React, ReactDOM, and @notehub/core instances into
 * external plugins.
 * 
 * ## Architecture
 * 
 * 1. **Shared Scope**: Host dependencies (React, etc.) are registered with
 *    SystemJS so external plugins can import them without bundling their own.
 * 
 * 2. **Plugin Loader**: Scans `.notehub/plugins` directory for external
 *    plugin folders, reads their manifests, and loads them dynamically.
 * 
 * 3. **Error Isolation**: If an external plugin fails to load, it's logged
 *    but doesn't crash the host application.
 * 
 * ## External Plugin Structure
 * 
 * ```
 * .notehub/plugins/my-plugin/
 * ├── manifest.json
 * └── main.js
 * ```
 * 
 * @module nh.system.synapse
 */

import 'systemjs';
import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { initSharedScope } from './logic/ScopeInitializer.js';
import { PluginLoader } from './logic/PluginLoader.js';

// Re-export types for consumers
export * from './types.js';
export { initSharedScope, isScopeInitialized } from './logic/ScopeInitializer.js';
export { PluginLoader } from './logic/PluginLoader.js';
export { ZipLoader, type NhpLoadResult } from './logic/ZipLoader.js';

/**
 * SynapsePlugin - System plugin for external extension loading
 * 
 * Lifecycle:
 * 1. `load()`: Initialize SystemJS shared scope
 * 2. `onReady()`: Scan and load external plugins from vault
 * 3. `unload()`: Unload all external plugins
 */
export class SynapsePlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.synapse',
        name: 'Synapse',
        version: '0.0.0',
        type: 'system',
    };

    private app: NotehubCore | null = null;
    private loader: PluginLoader | null = null;

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    /**
     * Load the Synapse plugin
     * 
     * Initializes the SystemJS shared scope with host dependencies.
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading Synapse Engine...');

        try {
            // Initialize SystemJS shared scope with React, ReactDOM, @notehub/core
            initSharedScope();
            this.log('info', 'Shared scope initialized');

            // Create plugin loader instance
            this.loader = new PluginLoader(app);

            // Register API methods for programmatic plugin loading
            (app.api.register as any)('synapse:load-plugin', this.loadExternalPlugin.bind(this));
            (app.api.register as any)('synapse:unload-plugin', this.unloadExternalPlugin.bind(this));
            (app.api.register as any)('synapse:list-plugins', this.listLoadedPlugins.bind(this));

            // Subscribe to vault-opened event to scan for external plugins
            app.events.on('app:vault-opened', this.handleVaultOpened.bind(this));
            this.log('info', 'Subscribed to app:vault-opened event');

            this.log('info', 'Synapse Engine loaded successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to initialize Synapse: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Handle vault opened event - scan for external plugins
     */
    private async handleVaultOpened(payload: unknown): Promise<void> {
        // Event payload is { path: string, name: string }
        const eventData = payload as { path?: string; name?: string } | undefined;
        const vaultPath = eventData?.path;

        if (!vaultPath) {
            this.log('warn', 'Vault opened event received but no path in payload');
            return;
        }

        this.log('info', `Vault opened: ${vaultPath}, scanning for external plugins...`);
        try {
            await this.scanAndLoadPlugins(vaultPath);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Error scanning for external plugins: ${errorMessage}`);
        }
    }

    /**
     * Called after all internal plugins are loaded
     * 
     * Scans the vault's `.notehub/plugins` directory and loads external plugins.
     */
    async onReady(app: NotehubCore): Promise<void> {
        this.log('info', 'Synapse onReady: scanning for external plugins...');

        try {
            // Get current vault path from state
            const vaultPath = (await app.api.invoke('state:get', 'vault.current-path')) as string | undefined;

            if (!vaultPath) {
                this.log('info', 'No vault currently open, skipping external plugin scan');
                return;
            }

            await this.scanAndLoadPlugins(vaultPath);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Error during external plugin scan: ${errorMessage}`);
            // Don't throw - external plugin failures shouldn't crash the app
        }
    }

    /**
     * Unload the Synapse plugin
     * 
     * Unloads all external plugins and cleans up.
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading Synapse Engine...');

        // Unload all external plugins
        if (this.loader) {
            await this.loader.unloadAll();
        }

        // Unregister API methods
        app.api.unregister('synapse:load-plugin');
        app.api.unregister('synapse:unload-plugin');
        app.api.unregister('synapse:list-plugins');

        this.loader = null;
        this.log('info', 'Synapse Engine unloaded');
        this.app = null;
    }

    /**
     * Scan a vault's plugin directory and load all external plugins
     * Supports both traditional folder-based plugins and packed .nhp files
     */
    private async scanAndLoadPlugins(vaultPath: string): Promise<void> {
        const pluginsDir = `${vaultPath}/.notehub/plugins`;

        // Check if plugins directory exists
        const dirExists = await this.app!.api.invoke('fs:exists', pluginsDir);
        if (!dirExists) {
            this.log('info', `No plugins directory found at ${pluginsDir}`);
            return;
        }

        // Read directory contents
        const entries = await this.app!.api.invoke('fs:read-dir', pluginsDir) as Array<{
            name: string;
            isDirectory: boolean;
        }>;

        // Separate directories and .nhp files
        const directories = entries.filter((entry) => entry.isDirectory);
        const nhpFiles = entries.filter((entry) =>
            !entry.isDirectory && entry.name.endsWith('.nhp')
        );

        const totalPlugins = directories.length + nhpFiles.length;
        if (totalPlugins === 0) {
            this.log('info', 'No external plugins found');
            return;
        }

        this.log('info', `Found ${totalPlugins} potential external plugin(s): ${directories.length} folders, ${nhpFiles.length} NHP files`);

        // Load counters
        let successCount = 0;
        let failCount = 0;

        // Load folder-based plugins
        for (const entry of directories) {
            const pluginPath = `${pluginsDir}/${entry.name}`;
            const result = await this.loader!.loadPlugin(pluginPath);

            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        // Load NHP files
        for (const entry of nhpFiles) {
            const nhpPath = `${pluginsDir}/${entry.name}`;

            try {
                // Read NHP file as binary
                const buffer = await this.app!.api.invoke('fs:read-file', nhpPath) as Uint8Array;

                // Convert Uint8Array to ArrayBuffer (create a copy to ensure proper type)
                const arrayBuffer = new Uint8Array(buffer).buffer;

                // Load using the NHP loader
                const result = await this.loader!.loadFromNhp(arrayBuffer, entry.name);

                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.log('error', `Failed to read NHP file ${entry.name}: ${errorMessage}`);
                failCount++;
            }
        }

        this.log('info', `External plugin loading complete: ${successCount} loaded, ${failCount} failed`);
    }

    // =========================================================================
    // API Methods
    // =========================================================================

    /**
     * API: Load an external plugin from a path
     */
    private async loadExternalPlugin(pluginPath: string): Promise<{ success: boolean; pluginId?: string; error?: string }> {
        if (!this.loader) {
            return { success: false, error: 'Synapse not initialized' };
        }
        return this.loader.loadPlugin(pluginPath);
    }

    /**
     * API: Unload an external plugin by ID
     */
    private async unloadExternalPlugin(pluginId: string): Promise<boolean> {
        if (!this.loader) {
            return false;
        }
        return this.loader.unloadPlugin(pluginId);
    }

    /**
     * API: List all loaded external plugin IDs
     */
    private listLoadedPlugins(): string[] {
        if (!this.loader) {
            return [];
        }
        return this.loader.getLoadedPluginIds();
    }
}

// Default export for dynamic loading
export default SynapsePlugin;
