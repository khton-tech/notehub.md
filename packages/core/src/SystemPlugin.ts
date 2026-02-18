/**
 * @fileoverview Abstract base class for internal system plugins
 * @module @notehub/core
 *
 * Provides a convenient base class that tracks API and event registrations
 * for automatic cleanup on unload. Plugins extend this instead of
 * implementing IPlugin directly.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { NotehubCore as NotehubCoreTyped } from './index.js';
type NotehubCore = NotehubCoreTyped<any>;
import type { IPlugin, PluginManifest } from './types.js';
import type { EventCallback } from './buses/EventBus.js';
import type { ApiHandler, BeforeHook, AfterHook, AroundHook } from './buses/ApiBus.js';

/**
 * Abstract base class for internal (bundled) plugins.
 *
 * Provides:
 * - `this.app` — core instance, available after `load()` is called
 * - `this.log(level, message)` — delegates to logger API
 * - `this.registerApi(name, handler)` — registers API with auto-cleanup tracking
 * - `this.registerEvent(event, handler, options?)` — subscribes to event with auto-cleanup
 * - Automatic cleanup of all tracked registrations on `unload()`
 *
 * Subclasses override `onLoad()`, `onReady()`, and `onUnload()` instead of
 * the raw IPlugin lifecycle methods.
 *
 * @example
 * ```ts
 * class MyPlugin extends SystemPlugin {
 *     manifest = { id: 'nh.system.my-plugin', name: 'My Plugin', version: '0.1.0', type: 'system' as const };
 *
 *     async onLoad(): Promise<void> {
 *         this.registerApi('my-plugin:greet', (name: string) => `Hello, ${name}!`);
 *         this.registerEvent('app:vault-opened', (payload) => { ... });
 *     }
 * }
 * ```
 */
export abstract class SystemPlugin implements IPlugin {
    abstract readonly manifest: PluginManifest;

    /** Core application instance, set during load() */
    protected app!: NotehubCore;

    /** Tracked API registrations for auto-cleanup */
    private _registeredApis: string[] = [];

    /** Tracked event unsubscribers for auto-cleanup */
    private _eventUnsubscribers: (() => void)[] = [];

    /** Tracked hook unsubscribers for auto-cleanup */
    private _hookUnsubscribers: (() => void)[] = [];

    // =========================================================================
    // IPlugin lifecycle (final — subclasses override onLoad/onReady/onUnload)
    // =========================================================================

    /**
     * Called by the kernel to load the plugin.
     * Sets `this.app` and delegates to `onLoad()`.
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        await this.onLoad();
    }

    /**
     * Called by the kernel after all plugins are loaded.
     * Delegates to `onReady()`.
     */
    async onReady?(_app: NotehubCore): Promise<void> {
        await this.onPluginReady();
    }

    /**
     * Called by the kernel to unload the plugin.
     * Runs `onUnload()` first, then cleans up all tracked registrations.
     */
    async unload(_app: NotehubCore): Promise<void> {
        await this.onUnload();
        this.cleanup();
    }

    // =========================================================================
    // Subclass overrides
    // =========================================================================

    /**
     * Override to initialize the plugin.
     * `this.app` is available. Register APIs, subscribe to events, etc.
     */
    protected async onLoad(): Promise<void> {
        // Default: no-op
    }

    /**
     * Override to perform actions after all plugins are loaded.
     * Safe for cross-plugin interactions.
     */
    protected async onPluginReady(): Promise<void> {
        // Default: no-op
    }

    /**
     * Override to perform plugin-specific cleanup before auto-cleanup runs.
     */
    protected async onUnload(): Promise<void> {
        // Default: no-op
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Log a message via the Logger plugin.
     * Falls back to console if the logger is not available.
     */
    protected log(level: 'info' | 'warn' | 'error', message: string): void {
        const source = this.manifest.id;
        this.app.api.invoke(`logger:${level}`, source, message).catch(() => {
            console[level](`[${source}] ${message}`);
        });
    }

    /**
     * Register an API handler with auto-cleanup tracking.
     *
     * @param name - API method name
     * @param handler - Handler function
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected registerApi(name: string, handler: (...args: any[]) => any): void {
        this.app.api.register(name, handler as ApiHandler);
        this._registeredApis.push(name);
    }

    /**
     * Subscribe to an event with auto-cleanup tracking.
     *
     * @param event - Event name
     * @param handler - Event callback
     * @param options - Subscription options (priority, condition)
     */
    protected registerEvent(
        event: string,
        handler: EventCallback,
        options?: { priority?: number; condition?: (payload: unknown) => boolean }
    ): void {
        this.app.events.on(event, handler, options);
        this._eventUnsubscribers.push(() => {
            this.app.events.off(event, handler);
        });
    }

    /**
     * Register a hook on an API method with auto-cleanup tracking.
     *
     * @param method - API method name
     * @param position - Hook position
     * @param handler - Hook handler
     * @param options - Hook options
     * @returns Unsubscribe function
     */
    protected registerHook(
        method: string,
        position: 'before' | 'after' | 'around',
        handler: (...args: unknown[]) => unknown,
        options?: { priority?: number; condition?: (args: unknown[]) => boolean | Promise<boolean> }
    ): () => void {
        // Position is a union type at this level; use type assertion to match overloads.
        // Safety: ApiBus.hook implementation accepts HookPosition union internally.
        const hookFn = this.app.api.hook.bind(this.app.api) as (
            method: string,
            position: 'before' | 'after' | 'around',
            handler: BeforeHook | AfterHook | AroundHook,
            options?: { priority?: number; condition?: (args: unknown[]) => boolean | Promise<boolean> }
        ) => () => void;
        const unsubscribe = hookFn(method, position, handler as BeforeHook & AfterHook & AroundHook, options);
        this._hookUnsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    // =========================================================================
    // Internal cleanup
    // =========================================================================

    /**
     * Clean up all tracked API registrations, event subscriptions, and hooks.
     */
    private cleanup(): void {
        // Unregister APIs
        for (const name of this._registeredApis) {
            try {
                this.app.api.unregister(name);
            } catch (e) {
                console.warn(`[${this.manifest.id}] Failed to unregister API "${name}":`, e);
            }
        }
        this._registeredApis = [];

        // Unsubscribe from events
        for (const unsub of this._eventUnsubscribers) {
            try {
                unsub();
            } catch (e) {
                console.warn(`[${this.manifest.id}] Failed to unsubscribe from event:`, e);
            }
        }
        this._eventUnsubscribers = [];

        // Remove hooks
        for (const unsub of this._hookUnsubscribers) {
            try {
                unsub();
            } catch (e) {
                console.warn(`[${this.manifest.id}] Failed to remove hook:`, e);
            }
        }
        this._hookUnsubscribers = [];
    }
}
