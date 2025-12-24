import { EventBus, type EventMap } from './buses/EventBus.js';
import { ApiBus } from './buses/ApiBus.js';
import type { IPlugin } from './types.js';

// Re-export types and buses
export * from './types.js';
export * from './buses/index.js';

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
export class NotehubCore<TEvents extends EventMap = EventMap> {
    /** Event bus instance for pub/sub communication */
    public readonly events: EventBus<TEvents>;

    /** API bus instance for direct method calls */
    public readonly api: ApiBus;

    /** Registry of loaded plugins */
    private plugins: Map<string, IPlugin> = new Map();

    /** Track initialization state */
    private initialized = false;

    constructor() {
        this.events = new EventBus<TEvents>();
        this.api = new ApiBus();
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

        if (this.plugins.has(id)) {
            throw new Error(`[NotehubCore] Plugin "${id}" is already registered`);
        }

        this.plugins.set(id, plugin);
        console.log(`[NotehubCore] Plugin "${id}" registered`);
    }

    /**
     * Unregister a plugin from the kernel
     *
     * @param pluginId - ID of the plugin to unregister
     * @returns true if plugin was unregistered, false if not found
     */
    unregisterPlugin(pluginId: string): boolean {
        const removed = this.plugins.delete(pluginId);
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
        return this.plugins.get(pluginId);
    }

    /**
     * Get all registered plugin IDs
     */
    getPluginIds(): string[] {
        return Array.from(this.plugins.keys());
    }

    /**
     * Initialize the kernel and load all registered plugins
     *
     * Note: Current implementation uses simple sequential loading.
     * Dependency graph resolution will be added in a future iteration.
     */
    async init(): Promise<void> {
        if (this.initialized) {
            console.warn('[NotehubCore] Kernel already initialized');
            return;
        }

        console.log(`[NotehubCore] Initializing with ${this.plugins.size} plugin(s)...`);

        for (const [id, plugin] of this.plugins) {
            try {
                console.log(`[NotehubCore] Loading plugin "${id}"...`);
                await plugin.load(this);
                console.log(`[NotehubCore] Plugin "${id}" loaded successfully`);
            } catch (error) {
                console.error(`[NotehubCore] Failed to load plugin "${id}":`, error);
                throw error;
            }
        }

        this.initialized = true;
        console.log('[NotehubCore] Kernel initialized successfully');
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
        const pluginEntries = Array.from(this.plugins.entries()).reverse();

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
