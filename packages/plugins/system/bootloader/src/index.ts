import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { Bootloader, type LoadablePlugin, type BootloaderResult } from './Bootloader.js';

// Re-export all public types and classes
export * from './schema.js';
export * from './graph/index.js';
export { Bootloader, type LoadablePlugin, type BootloaderResult, type PluginLoadResult } from './Bootloader.js';

/**
 * Bootloader Plugin - System component for plugin orchestration
 * 
 * This plugin provides the Bootloader service which manages the loading
 * of other plugins with proper dependency resolution and parallel initialization.
 * 
 * The bootloader itself is a "bootstrap" plugin that should be loaded first,
 * before using it to load other plugins.
 * 
 * API Methods registered:
 * - `bootloader.load`: Load a set of plugins with dependency resolution
 * - `bootloader.getResult`: Get the result of the last load operation
 * 
 * @example
 * ```ts
 * // Register and load the bootloader plugin
 * const bootloaderPlugin = new BootloaderPlugin();
 * app.registerPlugin(bootloaderPlugin);
 * await app.init();
 * 
 * // Use the bootloader to load other plugins
 * const loadPlugins = app.api.get('bootloader.load');
 * const result = await loadPlugins([
 *   { manifest: loggerManifest, init: loggerPlugin.load.bind(loggerPlugin) },
 *   { manifest: storageManifest, init: storagePlugin.load.bind(storagePlugin) },
 * ]);
 * ```
 */
export class BootloaderPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.bootloader',
        name: 'Bootloader',
        version: '0.1.0',
        type: 'system',
    };

    private bootloader: Bootloader | null = null;
    private lastResult: BootloaderResult | null = null;
    private app: NotehubCore | null = null;

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    /**
     * Load the bootloader plugin
     * Registers API methods for plugin loading
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        this.bootloader = new Bootloader(app as NotehubCore);

        // Register API methods - using untyped overload since these are internal APIs
        app.api.register('bootloader.load', this.loadPlugins.bind(this) as (plugins: unknown[]) => Promise<unknown>);
        app.api.register('bootloader.getResult', this.getLastResult.bind(this) as () => unknown);
        app.api.register('bootloader.getInstance', this.getInstance.bind(this) as () => unknown);

        this.log('info', 'Loaded successfully');
    }

    /**
     * Unload the bootloader plugin
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Unregister API methods
        app.api.unregister('bootloader.load');
        app.api.unregister('bootloader.getResult');
        app.api.unregister('bootloader.getInstance');

        this.bootloader = null;
        this.lastResult = null;

        this.log('info', 'Unloaded successfully');
        this.app = null;
    }

    /**
     * API Method: Load plugins
     * 
     * @param plugins - Array of loadable plugins
     * @returns Bootloader result
     */
    private async loadPlugins(plugins: LoadablePlugin[]): Promise<BootloaderResult> {
        if (!this.bootloader) {
            throw new Error('Bootloader not initialized');
        }

        this.lastResult = await this.bootloader.load(plugins);
        return this.lastResult;
    }

    /**
     * API Method: Get the result of the last load operation
     */
    private getLastResult(): BootloaderResult | null {
        return this.lastResult;
    }

    /**
     * API Method: Get the bootloader instance for advanced usage
     */
    private getInstance(): Bootloader | null {
        return this.bootloader;
    }
}

// Default export for dynamic loading
export default BootloaderPlugin;
