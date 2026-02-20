/**
 * @fileoverview Plugin Loader for External Extensions
 * 
 * This module handles the loading and unloading of external JavaScript plugins
 * from disk. It uses SystemJS for dynamic module loading and validates that
 * loaded modules conform to either the legacy IPlugin or the new NotehubPlugin interface.
 * 
 * NotehubPlugin instances receive a PluginContextImpl that tracks all registrations
 * for automatic cleanup when the plugin is unloaded.
 */

import type { NotehubPlugin } from '@notehub.md/api';
import type { IPlugin, NotehubCore } from '@notehub/core';
import type { ExternalPluginManifest, LoadedPluginRecord, PluginLoadResult, DiscoveredPluginRecord } from '../types.js';
import { PluginContextImpl } from './PluginContextImpl.js';
import { ZipLoader, type NhpLoadResult } from './ZipLoader.js';
import { parseManifest, withTimeout, PLUGIN_LOAD_TIMEOUT_MS } from './ManifestParser.js';
import { convertFileSrc } from '@tauri-apps/api/core';

// SystemJS global type declaration (SystemJS 6.x)
declare const System: {
    set(id: string, module: object): void;
    import(id: string): Promise<{ default?: unknown;[key: string]: unknown }>;
    delete(id: string): boolean;
};

/**
 * PluginLoader - Manages loading and unloading of external plugins
 */
export class PluginLoader {
    /** Map of loaded plugins by ID */
    private loadedPlugins: Map<string, LoadedPluginRecord> = new Map();

    /** Map of all discovered plugins (loaded or not) by ID */
    private discoveredPlugins: Map<string, DiscoveredPluginRecord> = new Map();

    /** Per-plugin operation locks to prevent concurrent load/unload */
    private operationLocks: Map<string, Promise<any>> = new Map();

    /** Core application instance */
    private app: NotehubCore;

    constructor(app: NotehubCore) {
        this.app = app;
    }

    /**
     * Queue an async operation for a specific plugin ID.
     * Ensures only one load/unload runs at a time per plugin.
     */
    private async withLock<T>(pluginId: string, fn: () => Promise<T>): Promise<T> {
        const prev = this.operationLocks.get(pluginId) ?? Promise.resolve();
        const current = prev.then(fn, fn);
        this.operationLocks.set(pluginId, current.catch(() => {}));
        return current;
    }

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.system.synapse', message);
    }

    /**
     * Scan the vault for plugins without loading them
     */
    async scan(vaultPath: string): Promise<void> {
        this.discoveredPlugins.clear();
        const pluginsDir = `${vaultPath}/.notehub/plugins`;

        // Check if plugins directory exists
        const dirExists = await this.app.api.invoke('fs:exists', pluginsDir);
        if (!dirExists) {
            this.log('info', `No plugins directory found at ${pluginsDir}`);
            return;
        }

        // Read directory contents
        const entries = await this.app.api.invoke('fs:read-dir', pluginsDir) as Array<{
            name: string;
            isDirectory: boolean;
        }>;

        // Separate directories and .nhp files
        const directories = entries.filter((entry) => entry.isDirectory);
        const nhpFiles = entries.filter((entry) =>
            !entry.isDirectory && entry.name.endsWith('.nhp')
        );

        this.log('info', `Scanning found: ${directories.length} folders, ${nhpFiles.length} NHP files`);

        // Process folders
        for (const entry of directories) {
            const pluginPath = `${pluginsDir}/${entry.name}`;
            const manifestPath = `${pluginPath}/manifest.json`;

            try {
                if (await this.app.api.invoke('fs:exists', manifestPath)) {
                    const manifestJson = await this.app.api.invoke('fs:read-text-file', manifestPath);
                    const manifest = parseManifest(manifestJson as string, pluginPath);
                    if (manifest) {
                        const isLoaded = this.loadedPlugins.has(manifest.id);
                        this.discoveredPlugins.set(manifest.id, {
                            manifest,
                            sourcePath: pluginPath,
                            status: isLoaded ? 'Active' : 'Inactive',
                            isNhp: false
                        });
                    }
                }
            } catch (err) {
                this.log('warn', `Failed to scan folder plugin at ${pluginPath}: ${err}`);
            }
        }

        // Process NHP files
        for (const entry of nhpFiles) {
            const nhpPath = `${pluginsDir}/${entry.name}`;
            try {
                // For NHP, we need to read the ZIP to get the manifest.
                const buffer = await this.app.api.invoke('fs:read-file', nhpPath) as Uint8Array;
                const arrayBuffer = new Uint8Array(buffer).buffer;
                const zipLoader = new ZipLoader();
                const { manifest } = await zipLoader.loadFromBuffer(arrayBuffer, nhpPath);

                if (manifest) {
                    const isLoaded = this.loadedPlugins.has(manifest.id);
                    this.discoveredPlugins.set(manifest.id, {
                        manifest,
                        sourcePath: nhpPath,
                        status: isLoaded ? 'Active' : 'Inactive',
                        isNhp: true
                    });
                }
            } catch (err) {
                this.log('warn', `Failed to scan NHP plugin at ${nhpPath}: ${err}`);
            }
        }
        this.log('info', `Scan complete. Discovered ${this.discoveredPlugins.size} plugins.`);
    }

    /**
     * Load all discovered plugins that depend on auto-load (currently all)
     */
    async loadAll(): Promise<void> {
        for (const [id, record] of this.discoveredPlugins) {
            // Check if plugin is disabled in config
            try {
                const disabled = await this.app.api.invoke('config:get', `synapse.disabled.${id}`);
                if (disabled === true) {
                    this.log('info', `Skipping disabled plugin: ${id}`);
                    record.status = 'Inactive';
                    continue;
                }
            } catch { /* config not available, load by default */ }

            if (record.isNhp) {
                try {
                    const buffer = await this.app.api.invoke('fs:read-file', record.sourcePath) as Uint8Array;
                    const arrayBuffer = new Uint8Array(buffer).buffer;
                    await this.loadFromNhp(arrayBuffer, record.sourcePath);
                } catch (e) {
                    this.log('error', `Failed to load discovered NHP ${id}: ${e}`);
                    record.status = 'Error';
                    record.error = String(e);
                }
            } else {
                await this.loadPlugin(record.sourcePath);
            }
        }
    }

    /**
     * Load an external plugin from a directory path
     */
    async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
        // Handle NHP files
        if (pluginPath.endsWith('.nhp')) {
            try {
                const buffer = await this.app.api.invoke('fs:read-file', pluginPath) as Uint8Array;
                const arrayBuffer = new Uint8Array(buffer).buffer;
                return this.loadFromNhp(arrayBuffer, pluginPath);
            } catch (e) {
                const errorMessage = String(e);
                this.log('error', `Failed to load NHP ${pluginPath}: ${errorMessage}`);
                return { success: false, error: errorMessage };
            }
        }

        const manifestPath = `${pluginPath}/manifest.json`;

        // Read manifest outside the lock to get the plugin ID
        let manifest: ExternalPluginManifest | undefined;
        try {
            const manifestExists = await this.app.api.invoke('fs:exists', manifestPath);
            if (!manifestExists) {
                const error = `No manifest.json found at ${manifestPath}`;
                this.log('warn', error);
                return { success: false, error };
            }

            const manifestJson = await this.app.api.invoke('fs:read-text-file', manifestPath);
            manifest = parseManifest(manifestJson as string, pluginPath) ?? undefined;
            if (!manifest) {
                return { success: false, error: 'Invalid manifest.json format' };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to read manifest from ${pluginPath}: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }

        // Acquire per-plugin lock for the actual load operation
        return this.withLock(manifest.id, async () => {
            try {
                // Check if already loaded
                if (this.loadedPlugins.has(manifest!.id)) {
                    this.log('warn', `Plugin ${manifest!.id} is already loaded, skipping`);
                    const discovered = this.discoveredPlugins.get(manifest!.id);
                    if (discovered) {
                        discovered.status = 'Active';
                        delete discovered.error;
                    }
                    return { success: true, pluginId: manifest!.id };
                }

                // Construct file URL for the entry point
                const entryPoint = manifest!.main || 'main.js';
                const url = this.constructFileUrl(pluginPath, entryPoint);

                this.log('info', `Loading external plugin: ${manifest!.id} from ${url}`);

                // Dynamic import via SystemJS with timeout
                const module = await withTimeout(
                    System.import(url),
                    PLUGIN_LOAD_TIMEOUT_MS,
                    `Plugin ${manifest!.id} load timeout after ${PLUGIN_LOAD_TIMEOUT_MS / 1000}s`
                );

                // Get and validate the plugin class/instance
                const plugin = this.extractPlugin(module, manifest!.id);
                if (!plugin) {
                    return { success: false, error: 'Module does not export a valid plugin' };
                }

                // Determine plugin type and call appropriate load method
                let context: PluginContextImpl | undefined;

                if (this.isNotehubPlugin(plugin)) {
                    context = new PluginContextImpl(this.app, manifest!.id, { name: manifest!.name, version: manifest!.version });
                    await plugin.onload(context);
                } else {
                    await plugin.load(this.app);
                }

                // Store in registry
                this.loadedPlugins.set(manifest!.id, {
                    manifest: manifest!,
                    plugin,
                    context,
                    url,
                    sourcePath: pluginPath,
                    loadedAt: new Date(),
                });

                const stats = context ? ` (${context.getStats().registeredApis} APIs, ${context.getStats().eventSubscriptions} subscriptions)` : '';
                this.log('info', `External plugin loaded: ${manifest!.id} v${manifest!.version}${stats}`);

                // Update discovered record status
                const discovered = this.discoveredPlugins.get(manifest!.id);
                if (discovered) {
                    discovered.status = 'Active';
                    delete discovered.error;
                } else {
                    this.discoveredPlugins.set(manifest!.id, {
                        manifest: manifest!,
                        sourcePath: pluginPath,
                        status: 'Active',
                        isNhp: false
                    });
                }

                return { success: true, pluginId: manifest!.id };

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.log('error', `Failed to load plugin from ${pluginPath}: ${errorMessage}`);
                return { success: false, error: errorMessage };
            }
        });
    }

    /**
     * Unload a previously loaded plugin
     */
    async unloadPlugin(pluginId: string): Promise<boolean> {
        return this.withLock(pluginId, async () => {
            const record = this.loadedPlugins.get(pluginId);
            if (!record) {
                this.log('warn', `Cannot unload plugin ${pluginId}: not found in registry`);
                return false;
            }

            try {
                // Step 1: Call appropriate unload method first so the plugin can
                // clean up its own external registrations (layout zones, controllers, etc.)
                // via invokeApi before the context is disposed.
                if (this.isNotehubPlugin(record.plugin)) {
                    await record.plugin.onunload();
                } else {
                    await record.plugin.unload(this.app);
                }

                // Step 2: Clean up context (unregister APIs, subscriptions, dispose)
                if (record.context) {
                    await record.context.cleanup();
                }

                // Step 3: Clean up SystemJS registry
                System.delete(record.url);

                // Step 4: Revoke Blob URL
                if (record.blobUrl) {
                    URL.revokeObjectURL(record.blobUrl);
                }

                // Step 5: Remove injected CSS
                if (record.isNhp) {
                    const styleTag = document.getElementById(`style-${pluginId}`);
                    if (styleTag) {
                        styleTag.remove();
                    }
                }

                // Step 6: Remove from registry
                this.loadedPlugins.delete(pluginId);

                this.log('info', `External plugin unloaded: ${pluginId}`);

                // Update status to Inactive
                const discovered = this.discoveredPlugins.get(pluginId);
                if (discovered) {
                    discovered.status = 'Inactive';
                }

                return true;

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.log('error', `Error unloading plugin ${pluginId}: ${errorMessage}`);

                // Cleanup on error
                this.loadedPlugins.delete(pluginId);
                if (record.blobUrl) URL.revokeObjectURL(record.blobUrl);
                const styleTag = document.getElementById(`style-${pluginId}`);
                if (styleTag) styleTag.remove();

                return false;
            }
        });
    }

    /**
     * Unload all loaded plugins
     */
    async unloadAll(): Promise<void> {
        const pluginIds = Array.from(this.loadedPlugins.keys());
        for (const pluginId of pluginIds.reverse()) {
            await this.unloadPlugin(pluginId);
        }
    }

    /**
     * Get list of loaded plugin IDs
     */
    getLoadedPluginIds(): string[] {
        return Array.from(this.loadedPlugins.keys());
    }

    /**
     * Get metadata for all plugins (loaded + discovered)
     */
    getPluginsMetadata(): any[] {
        return Array.from(this.discoveredPlugins.values()).map(record => {
            const loaded = this.loadedPlugins.get(record.manifest.id);
            return {
                id: record.manifest.id,
                name: record.manifest.name,
                version: record.manifest.version,
                description: (record.manifest as any).description || '',
                path: record.sourcePath || '',
                status: record.status,
                error: record.error || undefined,
                isNhp: record.isNhp,
                loadedAt: loaded?.loadedAt || new Date()
            };
        });
    }

    /**
     * Get a loaded plugin record by ID
     */
    getLoadedPlugin(pluginId: string): LoadedPluginRecord | undefined {
        return this.loadedPlugins.get(pluginId);
    }

    /**
     * Get a plugin ID by its source path
     */
    getPluginIdByPath(path: string): string | undefined {
        const normalizedPath = path.replace(/\\/g, '/');

        for (const [id, record] of this.loadedPlugins) {
            if (!record.sourcePath) continue;
            const recordPath = record.sourcePath.replace(/\\/g, '/');

            if (normalizedPath === recordPath) {
                return id;
            }
            if (normalizedPath.startsWith(recordPath + '/')) {
                return id;
            }
        }
        return undefined;
    }

    /**
     * Load an external plugin from an NHP file buffer
     */
    async loadFromNhp(buffer: ArrayBuffer, sourcePath: string): Promise<PluginLoadResult> {
        // Parse ZIP outside the lock to get the plugin ID
        let nhpResult: NhpLoadResult;
        try {
            const zipLoader = new ZipLoader();
            nhpResult = await zipLoader.loadFromBuffer(buffer, sourcePath);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to parse NHP from ${sourcePath}: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }

        const pluginId = nhpResult.manifest.id;

        // Acquire per-plugin lock for the actual load operation
        return this.withLock(pluginId, async () => {
            let blobUrl: string | undefined = nhpResult.blobUrl;
            const manifest = nhpResult.manifest;
            const css = nhpResult.css;
            let cssInjected = false;

            try {
                if (this.loadedPlugins.has(manifest.id)) {
                    this.log('warn', `Plugin ${manifest.id} is already loaded, skipping`);
                    const discovered = this.discoveredPlugins.get(manifest.id);
                    if (discovered) {
                        discovered.status = 'Active';
                        delete discovered.error;
                    }
                    URL.revokeObjectURL(blobUrl!);
                    return { success: true, pluginId: manifest.id };
                }

                this.log('info', `Loading NHP plugin: ${manifest.id} from ${sourcePath}`);

                if (css) {
                    const styleTag = document.createElement('style');
                    styleTag.id = `style-${manifest.id}`;
                    styleTag.textContent = css;
                    document.head.appendChild(styleTag);
                    cssInjected = true;
                }

                const module = await withTimeout(
                    System.import(blobUrl!),
                    PLUGIN_LOAD_TIMEOUT_MS,
                    `NHP plugin ${manifest.id} load timeout after ${PLUGIN_LOAD_TIMEOUT_MS / 1000}s`
                );
                const plugin = this.extractPlugin(module, manifest.id);
                if (!plugin) {
                    return { success: false, error: 'Module does not export a valid plugin' };
                }

                let context: PluginContextImpl | undefined;
                if (this.isNotehubPlugin(plugin)) {
                    context = new PluginContextImpl(this.app, manifest.id, { name: manifest.name, version: manifest.version });
                    await plugin.onload(context);
                } else {
                    await plugin.load(this.app);
                }

                this.loadedPlugins.set(manifest.id, {
                    manifest,
                    plugin,
                    context,
                    url: blobUrl!,
                    blobUrl,
                    isNhp: true,
                    sourcePath,
                    loadedAt: new Date(),
                });

                // Transfer ownership to loadedPlugins, don't revoke in finally
                blobUrl = undefined;
                cssInjected = false;

                const stats = context ? ` (${context.getStats().registeredApis} APIs, ${context.getStats().eventSubscriptions} subscriptions)` : '';
                this.log('info', `NHP plugin loaded: ${manifest.id} v${manifest.version}${stats}`);

                const discovered = this.discoveredPlugins.get(manifest.id);
                if (discovered) {
                    discovered.status = 'Active';
                    delete discovered.error;
                } else {
                    this.discoveredPlugins.set(manifest.id, {
                        manifest,
                        sourcePath,
                        status: 'Active',
                        isNhp: true
                    });
                }

                return { success: true, pluginId: manifest.id };

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.log('error', `Failed to load NHP plugin from ${sourcePath}: ${errorMessage}`);
                return { success: false, error: errorMessage };
            } finally {
                if (blobUrl) {
                    URL.revokeObjectURL(blobUrl);
                }
                if (cssInjected) {
                    const styleTag = document.getElementById(`style-${manifest.id}`);
                    if (styleTag) styleTag.remove();
                }
            }
        });
    }

    /**
     * Construct a file URL for loading
     */
    private constructFileUrl(basePath: string, entryPoint: string): string {
        const normalizedPath = basePath.replace(/\\/g, '/');
        const normalizedEntry = entryPoint.replace(/\\/g, '/');
        const fullPath = `${normalizedPath}/${normalizedEntry}`;
        return convertFileSrc(fullPath);
    }

    /**
     * Extract and validate plugin from module exports
     */
    private extractPlugin(
        module: { default?: unknown;[key: string]: unknown },
        pluginId: string
    ): IPlugin | NotehubPlugin | null {
        let pluginCandidate = module.default;

        if (typeof pluginCandidate === 'function') {
            try {
                pluginCandidate = new (pluginCandidate as new () => IPlugin | NotehubPlugin)();
            } catch (error) {
                this.log('error', `Failed to instantiate plugin class for ${pluginId}: ${error}`);
                return null;
            }
        }

        if (this.isNotehubPlugin(pluginCandidate)) {
            return pluginCandidate;
        }

        if (this.isLegacyPlugin(pluginCandidate)) {
            return pluginCandidate;
        }

        this.log('error', `Invalid plugin export for ${pluginId}: must implement NotehubPlugin (onload/onunload) or IPlugin (manifest/load/unload)`);
        return null;
    }

    /**
     * Type guard for NotehubPlugin interface
     */
    private isNotehubPlugin(candidate: unknown): candidate is NotehubPlugin {
        if (!candidate || typeof candidate !== 'object') {
            return false;
        }

        const plugin = candidate as Record<string, unknown>;
        return typeof plugin.onload === 'function' && typeof plugin.onunload === 'function';
    }

    /**
     * Type guard for legacy IPlugin interface
     */
    private isLegacyPlugin(candidate: unknown): candidate is IPlugin {
        if (!candidate || typeof candidate !== 'object') {
            return false;
        }

        const plugin = candidate as Record<string, unknown>;

        if (!plugin.manifest || typeof plugin.manifest !== 'object') {
            return false;
        }

        const manifest = plugin.manifest as Record<string, unknown>;
        if (!manifest.id || typeof manifest.id !== 'string') {
            return false;
        }

        if (typeof plugin.load !== 'function') {
            return false;
        }

        if (typeof plugin.unload !== 'function') {
            return false;
        }

        return true;
    }
}
