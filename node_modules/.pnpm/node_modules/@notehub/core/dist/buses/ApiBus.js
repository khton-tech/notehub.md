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
export class ApiBus {
    handlers = new Map();
    /**
     * Register an API method
     * @param name - Unique method name (e.g., "notes.create")
     * @param handler - Handler function implementation
     * @throws Error if method name is already registered
     */
    register(name, handler) {
        if (this.handlers.has(name)) {
            throw new Error(`[ApiBus] Handler "${name}" is already registered`);
        }
        this.handlers.set(name, handler);
    }
    /**
     * Unregister an API method
     * @param name - Method name to unregister
     * @returns true if the method was unregistered, false if it didn't exist
     */
    unregister(name) {
        return this.handlers.delete(name);
    }
    /**
     * Invoke a registered API method
     * @param name - Method name to invoke
     * @param args - Arguments to pass to the handler
     * @returns Promise resolving to the handler's result
     * @throws Error if the method is not registered
     */
    async invoke(name, ...args) {
        const handler = this.handlers.get(name);
        if (!handler) {
            throw new Error(`[ApiBus] Handler "${name}" is not registered`);
        }
        return handler(...args);
    }
    /**
     * Check if a method is registered
     * @param name - Method name to check
     */
    has(name) {
        return this.handlers.has(name);
    }
    /**
     * Get all registered method names
     */
    getRegisteredMethods() {
        return Array.from(this.handlers.keys());
    }
}
//# sourceMappingURL=ApiBus.js.map