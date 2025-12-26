/**
 * @fileoverview API Bus for registering and invoking plugin methods
 * @module @notehub/core/buses/ApiBus
 */

import type {
    NotehubApiMap,
    ApiMethodName,
    ApiMethodArgs,
    ApiMethodAwaitedResult
} from '../api/contract.js';

// Re-export types for convenience
export type { NotehubApiMap, ApiMethodName, ApiMethodArgs, ApiMethodAwaitedResult };

/**
 * Handler function type for API methods
 */
export type ApiHandler<TArgs extends unknown[] = unknown[], TResult = unknown> = (
    ...args: TArgs
) => TResult | Promise<TResult>;

/**
 * API Bus for registering and invoking plugin methods
 *
 * Provides a centralized registry for plugin-exposed APIs,
 * enabling direct method invocation between plugins with full type safety.
 *
 * @example
 * ```ts
 * const api = new ApiBus();
 *
 * // Type-safe invocation
 * const config = await api.invoke('config:get', 'theme.current', 'dark');
 * //    ^? string | undefined
 *
 * await api.invoke('logger:info', 'MyPlugin', 'Hello, World!');
 * ```
 */
export class ApiBus {
    private handlers = new Map<string, ApiHandler>();

    /**
     * Register an API method with type safety
     * 
     * @param name - Unique method name from NotehubApiMap
     * @param handler - Handler function implementation
     * @throws Error if method name is already registered
     * 
     * @example
     * ```ts
     * api.register('logger:info', (source, message) => {
     *     console.info(`[${source}] ${message}`);
     * });
     * ```
     */
    register<K extends ApiMethodName>(
        name: K,
        handler: (...args: ApiMethodArgs<K>) => ReturnType<NotehubApiMap[K]>
    ): void;

    /**
     * Register an API method (untyped overload for dynamic registration)
     * Use this only when the method name is not in NotehubApiMap yet.
     */
    register(name: string, handler: ApiHandler): void;

    register(name: string, handler: ApiHandler): void {
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
    unregister(name: string): boolean {
        return this.handlers.delete(name);
    }

    /**
     * Invoke a registered API method with full type safety
     * 
     * @param method - Method name from NotehubApiMap
     * @param args - Arguments matching the method signature
     * @returns Promise resolving to the method's return type
     * @throws Error if the method is not registered
     * 
     * @example
     * ```ts
     * // Fully typed - IDE knows the return type!
     * const exists = await api.invoke('fs:exists', '/path/to/file');
     * //    ^? boolean
     * 
     * const entries = await api.invoke('fs:read-dir', '/path');
     * //    ^? DirEntry[]
     * ```
     */
    async invoke<K extends ApiMethodName>(
        method: K,
        ...args: ApiMethodArgs<K>
    ): Promise<ApiMethodAwaitedResult<K>>;

    /**
     * Invoke an API method (untyped overload for dynamic invocation)
     * Use this only when you need to call methods not in NotehubApiMap.
     */
    async invoke<TResult = unknown>(name: string, ...args: unknown[]): Promise<TResult>;

    async invoke(name: string, ...args: unknown[]): Promise<unknown> {
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
    has(name: string): boolean {
        return this.handlers.has(name);
    }

    /**
     * Get all registered method names
     */
    getRegisteredMethods(): string[] {
        return Array.from(this.handlers.keys());
    }
}
