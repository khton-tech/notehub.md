/**
 * @fileoverview API Bus for registering and invoking plugin methods
 * @module @notehub/core/buses/ApiBus
 * 
 * Wave 2 (RFC-010 v2): Integrated with MiddlewareRunner for interceptor support.
 */

import type {
    NotehubApiMap,
    ApiMethodName,
    ApiMethodArgs,
    ApiMethodAwaitedResult
} from '../api/contract.js';
import { MiddlewareRunner } from '../middleware/runner.js';
import type { CallContext, MiddlewareFn } from '../middleware/types.js';
import { Priority } from '../middleware/types.js';

// Re-export types for convenience
export type { NotehubApiMap, ApiMethodName, ApiMethodArgs, ApiMethodAwaitedResult };
export type { CallContext, MiddlewareFn };
export { Priority };

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
 * Wave 2: Now includes middleware/interceptor support via MiddlewareRunner.
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
 * 
 * // Register a middleware hook
 * api.registerHook('fs:*', async (ctx, next) => {
 *   console.log(`FS operation: ${ctx.commandId}`);
 *   await next();
 * }, Priority.LOW, 'logger-plugin');
 * ```
 */
export class ApiBus {
    private handlers = new Map<string, ApiHandler>();
    private runner: MiddlewareRunner;

    constructor() {
        this.runner = new MiddlewareRunner();
    }

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
     * Register a middleware hook for intercepting API calls.
     * 
     * @param pattern - Glob pattern for matching command IDs (e.g., 'fs:*')
     * @param fn - Middleware function
     * @param priority - Execution priority (use Priority constants)
     * @param pluginId - ID of the registering plugin
     * @returns Dispose function to unregister the hook
     * 
     * @example
     * ```ts
     * // Log all fs operations
     * api.registerHook('fs:*', async (ctx, next) => {
     *   console.log(`[FS] ${ctx.commandId} called with`, ctx.args);
     *   await next();
     *   console.log(`[FS] ${ctx.commandId} returned`, ctx.result);
     * }, Priority.LOW, 'logger-plugin');
     * ```
     */
    registerHook(
        pattern: string,
        fn: MiddlewareFn,
        priority: number = Priority.NORMAL,
        pluginId: string = 'unknown'
    ): () => void {
        return this.runner.register(pattern, fn, priority, pluginId);
    }

    /**
     * Get the MiddlewareRunner instance for advanced usage.
     * Primarily for internal use or the HooksAPI facade.
     */
    getRunner(): MiddlewareRunner {
        return this.runner;
    }

    /**
     * Invoke a registered API method with full type safety.
     * Uses legacy direct invocation (no middleware).
     * 
     * @deprecated Use execute() for middleware-aware invocation in new code.
     * This method is kept for backward compatibility.
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
        // Use execute() which routes through middleware
        return this.execute(name, args);
    }

    /**
     * Execute a command through the middleware chain.
     * This is the primary method for middleware-aware invocation.
     * 
     * @param commandId - Command identifier (e.g., 'fs:read-file')
     * @param args - Arguments array for the command
     * @param parentContext - Optional parent context for nested calls (loop detection)
     * @returns Promise resolving to the result
     * @throws Error if the command is not registered or recursion limit exceeded
     * 
     * @example
     * ```ts
     * // Basic usage
     * const result = await api.execute('fs:read', ['/path/to/file']);
     * 
     * // With parent context (for nested calls inside middleware)
     * const result = await api.execute('fs:write', [path, data], ctx);
     * ```
     */
    async execute<TResult = unknown>(
        commandId: string,
        args: unknown[],
        parentContext?: CallContext
    ): Promise<TResult> {
        const handler = this.handlers.get(commandId);
        if (!handler) {
            throw new Error(`[ApiBus] Handler "${commandId}" is not registered`);
        }

        // Delegate to middleware runner
        return this.runner.run(commandId, args, handler as any, parentContext);
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

    /**
     * Get all registered middleware hooks (for debugging).
     */
    getRegisteredHooks(): Array<{
        pattern: string;
        priority: number;
        pluginId: string;
    }> {
        return this.runner.getRegisteredHooks();
    }
}
