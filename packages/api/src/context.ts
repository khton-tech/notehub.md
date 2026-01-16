/**
 * @fileoverview Plugin Context Interface
 * @module @notehub/api
 * 
 * Defines the context object passed to external plugins during load.
 * Provides methods for API registration, invocation, and event subscription.
 */

/**
 * Unsafe Context interface - "God Mode" API for plugins.
 * 
 * WARNING: APIs exposed through UnsafeContext may change without notice.
 * Plugins using this API should be prepared for breakage on core updates.
 * 
 * @remarks
 * The `app` property type is `unknown` to avoid coupling the API package
 * to internal core types. Cast to your expected type as needed.
 */
export interface UnsafeContext {
    /** Direct access to the global Window object */
    readonly window: Window;
    /** Reference to the root application controller */
    readonly app: unknown;
    /** Get the currently active CodeMirror EditorView instance */
    getActiveEditorView(): unknown;

    /**
     * Create a container element for React portal injection.
     * 
     * @param selector - CSS selector for target container (e.g., '[data-nh-portal="editor"]')
     * @param position - Where to insert: 'prepend' (before first child) or 'append' (after last child)
     * @returns The created container element, or null if target not found
     * 
     * @example
     * ```ts
     * const container = ctx.unsafe.createPortal('[data-nh-portal="editor"]', 'prepend');
     * if (container) {
     *     ReactDOM.createRoot(container).render(<MyToolbar />);
     * }
     * ```
     */
    createPortal(selector: string, position?: 'prepend' | 'append'): HTMLElement | null;
}

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
 *         
 *         // Wave 3: Access editor directly
 *         const view = ctx.unsafe.getActiveEditorView();
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

    /**
     * Wave 3: Direct access to platform internals.
     * 
     * WARNING: APIs exposed through `unsafe` may change without notice.
     * Use only when the Safe API doesn't provide required functionality.
     */
    readonly unsafe: UnsafeContext;
}

