/**
 * @fileoverview Hooks API Facade
 * @module @notehub/core/middleware/hooks
 * 
 * High-level API for plugin developers to register middleware hooks.
 * Provides semantic methods (before, after, replace) for common patterns.
 */

import type { CallContext, MiddlewareFn } from './types.js';
import { Priority } from './types.js';
import type { MiddlewareRunner } from './runner.js';

/**
 * Handler function for before/after hooks.
 * Receives the context and can optionally return a Promise.
 */
export type HookHandler = (ctx: CallContext) => void | Promise<void>;

/**
 * Handler function for replace hooks.
 * Must return the replacement result.
 */
export type ReplaceHandler = (ctx: CallContext) => any | Promise<any>;

/**
 * HooksAPI - Developer-friendly facade for middleware registration.
 * 
 * Provides semantic methods that wrap the low-level `MiddlewareRunner.register()`:
 * - `before()` - Execute logic before the core handler
 * - `after()` - Execute logic after the core handler (access to result)
 * - `replace()` - Completely replace the core handler
 * 
 * @example
 * ```ts
 * const hooks = new HooksAPI(runner, 'my-plugin');
 * 
 * // Uppercase all text before saving
 * hooks.before('fs:write', (ctx) => {
 *   ctx.args[1] = ctx.args[1].toUpperCase();
 * });
 * 
 * // Log results after reading
 * hooks.after('fs:read', (ctx) => {
 *   console.log(`Read ${ctx.result?.length || 0} bytes`);
 * });
 * 
 * // Replace a buggy core function
 * hooks.replace('legacy:broken-fn', async (ctx) => {
 *   return fixedImplementation(...ctx.args);
 * });
 * ```
 */
export class HooksAPI {
    private disposers: Array<() => void> = [];

    /**
     * Create a new HooksAPI instance.
     * 
     * @param runner - The MiddlewareRunner instance to register hooks with
     * @param pluginId - ID of the plugin using this API (for debugging)
     */
    constructor(
        private readonly runner: MiddlewareRunner,
        private readonly pluginId: string
    ) { }

    /**
     * Register a "before" hook - runs before the core handler.
     * 
     * Use for:
     * - Validating arguments
     * - Transforming/modifying arguments
     * - Access control checks
     * - Starting performance timers
     * 
     * The hook automatically calls `next()` after your handler completes.
     * 
     * @param pattern - Glob pattern for matching commandId
     * @param handler - Function to execute (can modify ctx.args)
     * @param priority - Optional custom priority (default: HIGH)
     * @returns Dispose function to unregister
     * 
     * @example
     * ```ts
     * hooks.before('fs:write', (ctx) => {
     *   const [path, content] = ctx.args;
     *   if (!path.startsWith('/allowed/')) {
     *     throw new Error('Access denied');
     *   }
     * });
     * ```
     */
    before(
        pattern: string,
        handler: HookHandler,
        priority: number = Priority.HIGH
    ): () => void {
        const middleware: MiddlewareFn = async (ctx, next) => {
            await handler(ctx);
            await next();
        };

        const dispose = this.runner.register(pattern, middleware, priority, this.pluginId);
        this.disposers.push(dispose);
        return dispose;
    }

    /**
     * Register an "after" hook - runs after the core handler.
     * 
     * Use for:
     * - Transforming results
     * - Logging/analytics
     * - Caching results
     * - Cleanup operations
     * 
     * The hook calls `next()` first, then executes your handler.
     * You have access to `ctx.result` after `next()` completes.
     * 
     * @param pattern - Glob pattern for matching commandId
     * @param handler - Function to execute (can modify ctx.result)
     * @param priority - Optional custom priority (default: LOW)
     * @returns Dispose function to unregister
     * 
     * @example
     * ```ts
     * hooks.after('fs:read', (ctx) => {
     *   // Wrap result in metadata
     *   ctx.result = {
     *     data: ctx.result,
     *     readAt: new Date().toISOString()
     *   };
     * });
     * ```
     */
    after(
        pattern: string,
        handler: HookHandler,
        priority: number = Priority.LOW
    ): () => void {
        const middleware: MiddlewareFn = async (ctx, next) => {
            await next();
            await handler(ctx);
        };

        const dispose = this.runner.register(pattern, middleware, priority, this.pluginId);
        this.disposers.push(dispose);
        return dispose;
    }

    /**
     * Register a "replace" hook - completely replaces the core handler.
     * 
     * Use for:
     * - Hotfixing buggy core functions
     * - Providing alternative implementations
     * - Mocking for testing
     * - Feature flags/toggles
     * 
     * ⚠️ WARNING: This does NOT call `next()` - the core handler is bypassed!
     * 
     * @param pattern - Glob pattern for matching commandId
     * @param handler - Function that returns the replacement result
     * @param priority - Optional custom priority (default: CRITICAL)
     * @returns Dispose function to unregister
     * 
     * @example
     * ```ts
     * // Hotfix a broken save function
     * hooks.replace('legacy:save', async (ctx) => {
     *   const [data] = ctx.args;
     *   return await fixedSaveImplementation(data);
     * });
     * ```
     */
    replace(
        pattern: string,
        handler: ReplaceHandler,
        priority: number = Priority.CRITICAL
    ): () => void {
        const middleware: MiddlewareFn = async (ctx, _next) => {
            // Intentionally NOT calling next() - we're replacing the handler
            ctx.result = await handler(ctx);
        };

        const dispose = this.runner.register(pattern, middleware, priority, this.pluginId);
        this.disposers.push(dispose);
        return dispose;
    }

    /**
     * Register a raw middleware with full control.
     * 
     * Use when you need custom behavior that doesn't fit before/after/replace.
     * 
     * @param pattern - Glob pattern for matching commandId
     * @param middleware - Full middleware function (must handle next() yourself)
     * @param priority - Execution priority
     * @returns Dispose function to unregister
     */
    intercept(
        pattern: string,
        middleware: MiddlewareFn,
        priority: number = Priority.NORMAL
    ): () => void {
        const dispose = this.runner.register(pattern, middleware, priority, this.pluginId);
        this.disposers.push(dispose);
        return dispose;
    }

    /**
     * Dispose all hooks registered through this API instance.
     * Call this during plugin unload to clean up.
     */
    disposeAll(): void {
        for (const dispose of this.disposers) {
            dispose();
        }
        this.disposers = [];
    }
}

/**
 * Factory function to create a HooksAPI for a plugin.
 * 
 * @param runner - The MiddlewareRunner instance
 * @param pluginId - The plugin's ID
 * @returns A new HooksAPI instance
 */
export function createHooksAPI(runner: MiddlewareRunner, pluginId: string): HooksAPI {
    return new HooksAPI(runner, pluginId);
}
