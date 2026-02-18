import { EventBus, type EventMap } from './buses/EventBus.js';
import { ApiBus } from './buses/ApiBus.js';
import type { IPlugin } from './types.js';
import type { NotehubEventMap } from './api/contract.js';

// Re-export types, buses, and base classes
export * from './types.js';
export * from './buses/index.js';
export { SystemPlugin } from './SystemPlugin.js';

// Re-export API contract types
export * from './api/contract.js';

// Re-export React context and hooks
export * from './react/NotehubContext.js';


/**
 * Core application class for Notehub.md
 *
 * Implements the microkernel architecture pattern, providing:
 * - EventBus for pub/sub inter-plugin communication
 * - ApiBus for direct method invocation between plugins
 * - Plugin registry and lifecycle management
 *
 * @example
 * ```ts
 * const app = new NotehubCore();
 *
 * app.registerPlugin(new LoggerPlugin());
 * app.registerPlugin(new StoragePlugin());
 *
 * await app.init();
 * ```
 */
export class NotehubCore<TEvents extends EventMap = NotehubEventMap> {
    /** Event bus instance for pub/sub communication */
    public readonly events: EventBus<TEvents>;

    /** API bus instance for direct method calls */
    public readonly api: ApiBus;

    /** Registry of loaded plugins */
    private pluginRegistry: Map<string, IPlugin> = new Map();

    /** Track initialization state */
    private initialized = false;

    constructor() {
        this.events = new EventBus<TEvents>();
        this.api = new ApiBus();

        // Register built-in API Discovery methods
        this.registerApiDiscoveryMethods();
    }

    /**
     * Register built-in API discovery methods
     * @internal
     */
    private registerApiDiscoveryMethods(): void {
        // Use untyped overload for dynamic registration
        this.api.register('api:list', () => this.api.getRegisteredMethods());
        this.api.register('api:has', (...args: unknown[]) => this.api.has(args[0] as string));
        this.api.register('api:info', (...args: unknown[]) => this.api.getMethodInfo(args[0] as string));
        this.api.register('api:list-with-metadata', () => this.api.getMethodsWithMetadata());
        this.api.register('api:version', () => '0.1');
    }

    /**
     * Register a plugin with the kernel
     * Plugin is added to registry but not loaded until init() is called
     *
     * @param plugin - Plugin instance to register
     * @throws Error if plugin with same ID is already registered
     */
    registerPlugin(plugin: IPlugin): void {
        const { id } = plugin.manifest;

        if (this.pluginRegistry.has(id)) {
            throw new Error(`[NotehubCore] Plugin "${id}" is already registered`);
        }

        this.pluginRegistry.set(id, plugin);
        console.log(`[NotehubCore] Plugin "${id}" registered`);
    }

    /**
     * Unregister a plugin from the kernel
     *
     * @param pluginId - ID of the plugin to unregister
     * @returns true if plugin was unregistered, false if not found
     */
    unregisterPlugin(pluginId: string): boolean {
        const removed = this.pluginRegistry.delete(pluginId);
        if (removed) {
            console.log(`[NotehubCore] Plugin "${pluginId}" unregistered`);
        }
        return removed;
    }

    /**
     * Get a registered plugin by ID
     *
     * @param pluginId - ID of the plugin to retrieve
     * @returns Plugin instance or undefined if not found
     */
    getPlugin(pluginId: string): IPlugin | undefined {
        return this.pluginRegistry.get(pluginId);
    }

    /**
     * Get all registered plugin IDs
     */
    getPluginIds(): string[] {
        return Array.from(this.pluginRegistry.keys());
    }

    /**
     * Get iterator over all registered plugins
     * Used by bootloader to iterate plugins for onReady calls
     */
    getPlugins(): IterableIterator<[string, IPlugin]> {
        return this.pluginRegistry.entries();
    }

    /** Timeout for individual plugin load (ms) */
    private static readonly PLUGIN_LOAD_TIMEOUT = 30_000;

    /**
     * Initialize the kernel and load all registered plugins
     *
     * @deprecated Use Bootloader.load() for proper dependency resolution and parallel loading.
     * This method is kept for backward compatibility but loads plugins sequentially.
     */
    async init(): Promise<void> {
        if (this.initialized) {
            console.warn('[NotehubCore] Kernel already initialized');
            return;
        }

        console.log(`[NotehubCore] Initializing with ${this.pluginRegistry.size} plugin(s)...`);

        for (const [id, plugin] of this.pluginRegistry) {
            try {
                console.log(`[NotehubCore] Loading plugin "${id}"...`);
                await Promise.race([
                    plugin.load(this),
                    new Promise<never>((_, reject) =>
                        setTimeout(
                            () => reject(new Error(`Plugin "${id}" timed out after ${NotehubCore.PLUGIN_LOAD_TIMEOUT}ms`)),
                            NotehubCore.PLUGIN_LOAD_TIMEOUT
                        )
                    )
                ]);
                console.log(`[NotehubCore] Plugin "${id}" loaded successfully`);
            } catch (error) {
                console.error(`[NotehubCore] Failed to load plugin "${id}":`, error);
                throw error;
            }
        }

        this.initialized = true;
        console.log('[NotehubCore] Kernel initialized successfully');

        // Call onReady for all plugins (deprecated path)
        await this.callOnReady();
    }

    /**
     * Call onReady() on all plugins that implement it
     * Should be called after all plugins have been loaded
     */
    async callOnReady(): Promise<void> {
        console.log('[NotehubCore] Calling onReady on all plugins...');

        for (const [id, plugin] of this.pluginRegistry) {
            if (plugin.onReady) {
                try {
                    console.log(`[NotehubCore] Calling onReady for "${id}"...`);
                    await plugin.onReady(this);
                } catch (error) {
                    console.error(`[NotehubCore] onReady failed for "${id}":`, error);
                    // Continue with other plugins - don't throw
                }
            }
        }

        console.log('[NotehubCore] All onReady calls completed');
    }

    /**
     * Set initialization state (used by Bootloader)
     * @internal
     */
    setInitialized(value: boolean): void {
        this.initialized = value;
    }

    /**
     * Shutdown the kernel and unload all plugins
     * Plugins are unloaded in reverse order of registration
     */
    async shutdown(): Promise<void> {
        if (!this.initialized) {
            console.warn('[NotehubCore] Kernel not initialized, nothing to shutdown');
            return;
        }

        console.log('[NotehubCore] Shutting down...');

        // Unload in reverse order
        const pluginEntries = Array.from(this.pluginRegistry.entries()).reverse();

        for (const [id, plugin] of pluginEntries) {
            try {
                console.log(`[NotehubCore] Unloading plugin "${id}"...`);
                await plugin.unload(this);
                console.log(`[NotehubCore] Plugin "${id}" unloaded successfully`);
            } catch (error) {
                console.error(`[NotehubCore] Failed to unload plugin "${id}":`, error);
            }
        }

        this.initialized = false;
        console.log('[NotehubCore] Kernel shutdown complete');
    }

    /**
     * Check if the kernel has been initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }
}
