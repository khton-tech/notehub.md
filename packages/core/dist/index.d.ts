import { EventBus, type EventMap } from './buses/EventBus.js';
import { ApiBus } from './buses/ApiBus.js';
import type { IPlugin } from './types.js';
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
export declare class NotehubCore<TEvents extends EventMap = EventMap> {
    /** Event bus instance for pub/sub communication */
    readonly events: EventBus<TEvents>;
    /** API bus instance for direct method calls */
    readonly api: ApiBus;
    /** Registry of loaded plugins */
    private plugins;
    /** Track initialization state */
    private initialized;
    constructor();
    /**
     * Register a plugin with the kernel
     * Plugin is added to registry but not loaded until init() is called
     *
     * @param plugin - Plugin instance to register
     * @throws Error if plugin with same ID is already registered
     */
    registerPlugin(plugin: IPlugin): void;
    /**
     * Unregister a plugin from the kernel
     *
     * @param pluginId - ID of the plugin to unregister
     * @returns true if plugin was unregistered, false if not found
     */
    unregisterPlugin(pluginId: string): boolean;
    /**
     * Get a registered plugin by ID
     *
     * @param pluginId - ID of the plugin to retrieve
     * @returns Plugin instance or undefined if not found
     */
    getPlugin(pluginId: string): IPlugin | undefined;
    /**
     * Get all registered plugin IDs
     */
    getPluginIds(): string[];
    /**
     * Initialize the kernel and load all registered plugins
     *
     * Note: Current implementation uses simple sequential loading.
     * Dependency graph resolution will be added in a future iteration.
     */
    init(): Promise<void>;
    /**
     * Shutdown the kernel and unload all plugins
     * Plugins are unloaded in reverse order of registration
     */
    shutdown(): Promise<void>;
    /**
     * Check if the kernel has been initialized
     */
    isInitialized(): boolean;
}
//# sourceMappingURL=index.d.ts.map