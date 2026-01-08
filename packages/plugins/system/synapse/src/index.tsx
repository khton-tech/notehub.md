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
import { PluginManagerView } from './components/PluginManagerView.js';

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
    private watcherUnsubscribe: (() => void) | null = null;
    private pendingEvents: Map<string, { path: string; type: string }> = new Map();
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

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
            (app.api.register as any)('synapse:get-details', this.getPluginsDetails.bind(this));

            // Subscribe to vault-opened event to scan for external plugins
            app.events.on('app:vault-opened', this.handleVaultOpened);
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
     * Arrow function to ensure stable reference for event subscription/unsubscription
     */
    private handleVaultOpened = async (payload: unknown): Promise<void> => {
        // Event payload is { path: string, name: string }
        const eventData = payload as { path?: string; name?: string } | undefined;
        const vaultPath = eventData?.path;

        if (!vaultPath) {
            this.log('warn', 'Vault opened event received but no path in payload');
            return;
        }

        this.log('info', `Vault opened: ${vaultPath}, scanning for external plugins...`);
        try {
            await this.loader?.scan(vaultPath);
            await this.loader?.loadAll();
            await this.startWatching(vaultPath);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Error scanning for external plugins: ${errorMessage}`);
        }
    };

    /**
     * Called after all internal plugins are loaded
     * 
     * Scans the vault's `.notehub/plugins` directory and loads external plugins.
     */
    async onReady(app: NotehubCore): Promise<void> {
        this.log('info', 'Synapse onReady: scanning for external plugins...');

        try {
            // Register Settings UI
            app.api.invoke('settings:register-tab', {
                id: 'plugins',
                label: 'Plugins',
                order: 100, // Put it at the bottom
                icon: 'package' // Assuming lucide icon name support or similar, settings manager might use string
            });

            // Register custom view for the plugins tab
            app.api.invoke('settings:register-custom-view', {
                tabId: 'plugins',
                view: PluginManagerView
            });

            // Get current vault path from state
            const vaultPath = (await app.api.invoke('state:get', 'vault.current-path')) as string | undefined;

            if (!vaultPath) {
                this.log('info', 'No vault currently open, skipping external plugin scan');
                return;
            }

            await this.loader!.scan(vaultPath);
            await this.loader!.loadAll();
            await this.startWatching(vaultPath);




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

        // Unsubscribe from vault-opened event
        app.events.off('app:vault-opened', this.handleVaultOpened);

        // Unregister API methods
        app.api.unregister('synapse:load-plugin');
        app.api.unregister('synapse:unload-plugin');
        app.api.unregister('synapse:list-plugins');
        app.api.unregister('synapse:get-details');

        this.stopWatching();
        this.loader = null;
        this.log('info', 'Synapse Engine unloaded');
        this.app = null;
    }

    /**
     * Start watching the plugins directory for changes
     */
    private async startWatching(vaultPath: string): Promise<void> {
        this.stopWatching(); // Clean up existing watcher if any

        const pluginsDir = `${vaultPath}/.notehub/plugins`;

        // Ensure directory exists before watching (though scanAndLoadPlugins checks too)
        const dirExists = await this.app!.api.invoke('fs:exists', pluginsDir);
        if (!dirExists) return;

        try {
            this.log('info', `Starting plugin watcher on ${pluginsDir}`);
            // Use an arrow function wrapper to preserve 'this' context and handle the event
            this.watcherUnsubscribe = await this.app!.api.invoke('fs:watch', pluginsDir, (event: any) => this.handleFsEvent(event)) as (() => void);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to start plugin watcher: ${errorMessage}`);
        }
    }

    /**
     * Stop the current watcher
     */
    private stopWatching(): void {
        if (this.watcherUnsubscribe) {
            try {
                this.watcherUnsubscribe();
                this.log('info', 'Stopped plugin watcher');
            } catch (error) {
                // Ignore errors during cleanup
            }
            this.watcherUnsubscribe = null;
        }

        // Clear pending events/timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.pendingEvents.clear();
    }

    /**
     * Handle File System events with debounce
     */
    private handleFsEvent(event: { path: string; type: string }): void {
        if (!event.path || !event.type) return;

        // Add to pending events map (keyed by path to deduplicate multiple events for same file)
        this.pendingEvents.set(event.path, event);

        // Reset debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.processPendingEvents();
        }, 500);
    }

    /**
     * Process accumulated FS events
     */
    private async processPendingEvents(): Promise<void> {
        if (!this.loader) return;

        const events = Array.from(this.pendingEvents.values());
        this.pendingEvents.clear();
        this.debounceTimer = null;

        for (const event of events) {
            await this.processFsEvent(event);
        }
    }

    /**
     * Process a single FS event
     */
    private async processFsEvent(event: { path: string; type: string }): Promise<void> {
        const { path, type } = event;
        // Normalize path separator
        const normalizedPath = path.replace(/\\/g, '/');

        this.log('info', `Processing FS event: ${type} on ${normalizedPath}`);

        // Helper to get plugin ID affected by this path
        const affectedPluginId = this.loader!.getPluginIdByPath(normalizedPath);

        // Case 1: Removal
        if (type === 'remove') {
            if (affectedPluginId) {
                this.log('info', `Detected removal of plugin ${affectedPluginId}`);
                await this.loader!.unloadPlugin(affectedPluginId);
            }
            return;
        }

        // Case 2: Create or Modify
        if (type === 'create' || type === 'modify') {

            // If it's an existing loaded plugin, unload it first (Hot Reload)
            if (affectedPluginId) {
                this.log('info', `Hot reloading plugin ${affectedPluginId}...`);
                const record = this.loader!.getLoadedPlugin(affectedPluginId);
                // We need the source path (loaded path) to reload
                // If the event was on a subfile, we reload the plugin root
                const sourcePath = record?.sourcePath;

                await this.loader!.unloadPlugin(affectedPluginId);

                if (sourcePath) {
                    // Delay to ensure file system is stable before re-reading the file
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await this.loadPluginByPath(sourcePath);
                }
                return;
            }

            // If it's a NEW plugin (not currently loaded)
            // It could be a new .nhp file
            if (normalizedPath.endsWith('.nhp')) {
                await this.loadPluginByPath(normalizedPath);
                return;
            }

            // Or a new directory with manifest.json
            // If the event path is .../manifest.json, the plugin root is the parent dir
            if (normalizedPath.endsWith('/manifest.json')) {
                const pluginDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
                await this.loadPluginByPath(pluginDir);
                return;
            }

            // Or just a directory creation?
            // Usually we wait for manifest.json or content. 
            // If a user drops a folder, we might get create events for folder then files.
            // If we get "create manifest.json" that's our signal.
            // If we get generic directory changes, we might ignore unless we can verify it's a plugin.
        }
    }

    /**
     * Helper to load a plugin from a path (NHP or Folder)
    */
    private async loadPluginByPath(path: string): Promise<void> {
        if (!this.loader) return;

        // Check if it's an NHP file
        if (path.endsWith('.nhp')) {
            try {
                const buffer = await this.app!.api.invoke('fs:read-file', path) as Uint8Array;
                const arrayBuffer = new Uint8Array(buffer).buffer;
                await this.loader.loadFromNhp(arrayBuffer, path);
            } catch (err) {
                this.log('error', `Hot load failed for NHP ${path}: ${err}`);
            }
        } else {
            // Assume folder
            await this.loader.loadPlugin(path);
        }
    }


    // scanAndLoadPlugins removed in favor of loader.scan() + loader.loadAll()


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

    /**
     * API: Get detailed metadata for all loaded plugins
     */
    private getPluginsDetails(): any[] {
        if (!this.loader) {
            return [];
        }
        return this.loader.getPluginsMetadata();
    }
}

// Default export for dynamic loading
export default SynapsePlugin;
