/**
 * @fileoverview Plugin Context Interface
 * @module @notehub/api
 * 
 * Defines the context object passed to external plugins during load.
 * Provides methods for API registration, invocation, and event subscription.
 */

/**
 * Context passed to event handlers, allowing control of event propagation.
 */
export interface EventContext {
    /** Prevent the default action */
    preventDefault(): void;
    /** Check if default was prevented */
    readonly defaultPrevented: boolean;
    /** Stop calling remaining listeners */
    stopPropagation(): void;
    /** Check if propagation was stopped */
    readonly propagationStopped: boolean;
}

/**
 * Hook position for API interception.
 */
export type HookPosition = 'before' | 'after' | 'around';

/**
 * Hook handler types for API interception.
 */
export type BeforeHook = (args: unknown[]) => unknown[] | void;
export type AfterHook = (result: unknown, args: unknown[]) => unknown;
export type AroundHook = (args: unknown[], next: (...args: unknown[]) => Promise<unknown>) => Promise<unknown>;

/**
 * Unsafe context providing direct access to internal APIs.
 * 
 * @warning These APIs may change or break in future versions.
 * Use at your own risk for advanced functionality.
 */
export interface UnsafeContext {
    /**
     * Register a hook for an API method.
     * 
     * @param method - API method name to intercept
     * @param position - Hook position ('before', 'after', 'around')
     * @param handler - Hook handler function
     * @returns Unsubscribe function to remove the hook
     */
    hook(method: string, position: 'before', handler: BeforeHook): () => void;
    hook(method: string, position: 'after', handler: AfterHook): () => void;
    hook(method: string, position: 'around', handler: AroundHook): () => void;
}

/**
 * Context object provided to plugins during lifecycle.
 * 
 * Enables plugins to:
 * - Register their own APIs for other plugins to consume
 * - Invoke APIs provided by Core or other plugins
 * - Subscribe to application events
 * - Emit events to other plugins
 * 
 * All registrations are automatically cleaned up when the plugin is unloaded.
 * 
 * @example
 * ```ts
 * class MyPlugin extends NotehubPlugin {
 *     async onload(ctx: PluginContext): Promise<void> {
 *         // Provide an API
 *         ctx.registerApi('my-plugin:greet', (name: string) => `Hello, ${name}!`);
 *         
 *         // Consume an API
 *         const content = await ctx.invokeApi<string>('fs:read-text-file', '/path');
 *         
 *         // Subscribe to events
 *         ctx.subscribe('note:saved', (payload) => console.log(payload));
 *         
 *         // Emit events
 *         ctx.emit('my-plugin:ready', { version: '1.0.0' });
 *         
 *         // Use unsafe API for advanced interception
 *         ctx.unsafe.hook('fs:write-text-file', 'before', (args) => {
 *             console.log('Writing to:', args[0]);
 *             return args;
 *         });
 *     }
 * }
 * ```
 */
export interface PluginContext {
    /**
     * Register an API method that other plugins can invoke.
     * 
     * The API will be automatically unregistered when the plugin is unloaded.
     * 
     * @param name - Unique API method name (recommend format: `plugin-id:method-name`)
     * @param handler - Handler function to execute when API is invoked
     * @throws Error if API name is already registered
     * 
     * @example
     * ```ts
     * ctx.registerApi('my-plugin:calculate', (a: number, b: number) => a + b);
     * ```
     */
    registerApi(name: string, handler: (...args: unknown[]) => unknown): void;

    /**
     * Invoke an API method registered by Core or another plugin.
     * 
     * @typeParam T - Expected return type of the API method
     * @param name - API method name to invoke
     * @param args - Arguments to pass to the API method
     * @returns Promise resolving to the API method's return value
     * @throws Error if API method is not registered
     * 
     * @example
     * ```ts
     * const exists = await ctx.invokeApi<boolean>('fs:exists', '/path/to/file');
     * const config = await ctx.invokeApi<string>('config:get', 'theme.current', 'dark');
     * ```
     */
    invokeApi<T = unknown>(name: string, ...args: unknown[]): Promise<T>;

    /**
     * Subscribe to an application event.
     *
     * The subscription will be automatically removed when the plugin is unloaded.
     *
     * @typeParam T - Type of the event payload
     * @param event - Event name to subscribe to
     * @param handler - Callback function invoked when event is emitted
     * @param options - Optional subscription options (priority)
     *
     * @example
     * ```ts
     * ctx.subscribe<{ noteId: string }>('note:saved', (payload, context) => {
     *     console.log('Note saved:', payload.noteId);
     *     // context.preventDefault() to prevent default action
     *     // context.stopPropagation() to stop further handlers
     * });
     *
     * // With priority (higher = runs earlier)
     * ctx.subscribe('note:saved', handler, { priority: 100 });
     * ```
     */
    subscribe<T = unknown>(
        event: string,
        handler: (payload: T, context: EventContext) => void,
        options?: { priority?: number }
    ): void;

    /**
     * Emit an event to all subscribers.
     * 
     * @typeParam T - Type of the event payload
     * @param event - Event name to emit
     * @param payload - Optional payload to send with the event
     * 
     * @example
     * ```ts
     * ctx.emit('my-plugin:initialized', { version: '1.0.0' });
     * ```
     */
    emit<T = unknown>(event: string, payload?: T): Promise<void>;

    /**
     * Access to unsafe/internal APIs.
     * 
     * @warning Using these APIs may break compatibility in future versions.
     * They are provided for advanced use cases where standard APIs are insufficient.
     */
    readonly unsafe: UnsafeContext;

    /**
     * Plugin manifest information.
     */
    readonly manifest: {
        id: string;
        name: string;
        version: string;
    };

    /**
     * Per-plugin key-value storage.
     *
     * Data is namespaced by plugin ID and persisted via the config-manager.
     * Each plugin can only access its own storage.
     *
     * @example
     * ```ts
     * await ctx.storage.set('lastOpenedFile', '/path/to/file.md');
     * const path = await ctx.storage.get<string>('lastOpenedFile');
     * await ctx.storage.delete('lastOpenedFile');
     * const keys = await ctx.storage.list();
     * ```
     */
    readonly storage: {
        /** Get a value by key. Returns undefined if not found. */
        get<T = unknown>(key: string): Promise<T | undefined>;
        /** Set a value for a key. */
        set(key: string, value: unknown): Promise<void>;
        /** Delete a key. */
        delete(key: string): Promise<void>;
        /** List all keys in this plugin's storage. */
        list(): Promise<string[]>;
    };
}

