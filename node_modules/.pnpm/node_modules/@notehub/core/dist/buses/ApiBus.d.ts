/**
 * Handler function type for API methods
 */
export type ApiHandler<TArgs extends unknown[] = unknown[], TResult = unknown> = (...args: TArgs) => TResult | Promise<TResult>;
/**
 * API Bus for registering and invoking plugin methods
 *
 * Provides a centralized registry for plugin-exposed APIs,
 * enabling direct method invocation between plugins.
 *
 * @example
 * ```ts
 * const api = new ApiBus();
 *
 * // Plugin A registers a method
 * api.register('notes.create', async (title: string) => {
 *   return { id: '123', title };
 * });
 *
 * // Plugin B invokes the method
 * const note = await api.invoke<{ id: string; title: string }>('notes.create', 'My Note');
 * ```
 */
export declare class ApiBus {
    private handlers;
    /**
     * Register an API method
     * @param name - Unique method name (e.g., "notes.create")
     * @param handler - Handler function implementation
     * @throws Error if method name is already registered
     */
    register<TArgs extends unknown[], TResult>(name: string, handler: ApiHandler<TArgs, TResult>): void;
    /**
     * Unregister an API method
     * @param name - Method name to unregister
     * @returns true if the method was unregistered, false if it didn't exist
     */
    unregister(name: string): boolean;
    /**
     * Invoke a registered API method
     * @param name - Method name to invoke
     * @param args - Arguments to pass to the handler
     * @returns Promise resolving to the handler's result
     * @throws Error if the method is not registered
     */
    invoke<TResult>(name: string, ...args: unknown[]): Promise<TResult>;
    /**
     * Check if a method is registered
     * @param name - Method name to check
     */
    has(name: string): boolean;
    /**
     * Get all registered method names
     */
    getRegisteredMethods(): string[];
}
//# sourceMappingURL=ApiBus.d.ts.map