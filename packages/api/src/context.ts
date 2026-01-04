/**
 * @fileoverview Plugin Context Interface
 * @module @notehub/api
 * 
 * Defines the context object passed to external plugins during load.
 * Provides methods for API registration, invocation, and event subscription.
 */

/**
 * Context object provided to plugins during lifecycle.
 * 
 * Enables plugins to:
 * - Register their own APIs for other plugins to consume
 * - Invoke APIs provided by Core or other plugins
 * - Subscribe to application events
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
     * 
     * @example
     * ```ts
     * ctx.subscribe<{ noteId: string }>('note:saved', (payload) => {
     *     console.log('Note saved:', payload.noteId);
     * });
     * ```
     */
    subscribe<T = unknown>(event: string, handler: (payload: T) => void): void;
}
