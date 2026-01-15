/**
 * @fileoverview Middleware Runner Engine
 * @module @notehub/core/middleware/runner
 * 
 * Core execution engine for the Interceptor Engine (Wave 2 - RFC-010 v2).
 * Implements Koa-style "Onion" middleware pattern with priority-based ordering.
 */

import type { CallContext, MiddlewareFn, NextFn } from './types.js';
import { MAX_RECURSION_DEPTH, Priority } from './types.js';

/**
 * Internal structure representing a registered middleware hook.
 */
interface RegisteredHook {
    /** Compiled regex for commandId matching */
    pattern: RegExp;
    /** Original pattern string (for debugging) */
    rawPattern: string;
    /** Middleware function */
    fn: MiddlewareFn;
    /** Execution priority (higher = earlier in Downstream) */
    priority: number;
    /** Owner plugin ID (for isolation and debugging) */
    pluginId: string;
}

/**
 * Generates a UUID v4.
 * Uses crypto.randomUUID if available, falls back to manual generation.
 */
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Converts a glob pattern to a RegExp.
 * 
 * Algorithm:
 * 1. Escape all regex special characters except `*`
 * 2. Replace `*` with `.*` (match any characters)
 * 3. Add start (^) and end ($) anchors for full match
 * 
 * @param pattern - Glob pattern (e.g., 'fs:*', 'editor:insert-*')
 * @returns Compiled RegExp
 * 
 * @example
 * globToRegex('fs:*')       // /^fs:.*$/
 * globToRegex('fs:read')    // /^fs:read$/
 * globToRegex('*:save')     // /^.*:save$/
 */
function globToRegex(pattern: string): RegExp {
    // Escape regex special characters except *
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Replace * with .*
    const regexString = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(regexString);
}

/**
 * MiddlewareRunner - The core execution engine for middleware chains.
 * 
 * Responsible for:
 * - Registering interceptors with glob pattern matching
 * - Efficient lookup of applicable hooks for each command
 * - Managing middleware lifecycle with the "Onion" execution model
 * - Protecting against infinite recursion
 * 
 * @example
 * ```ts
 * const runner = new MiddlewareRunner();
 * 
 * // Register a logging middleware for all fs commands
 * runner.register('fs:*', async (ctx, next) => {
 *   console.log(`FS operation: ${ctx.commandId}`);
 *   await next();
 *   console.log(`FS result: ${ctx.result}`);
 * }, Priority.LOW, 'logger-plugin');
 * 
 * // Execute through the middleware chain
 * const result = await runner.run('fs:read', ['/path'], handler);
 * ```
 */
export class MiddlewareRunner {
    private middlewares: RegisteredHook[] = [];

    /**
     * Register a middleware hook with pattern matching.
     * 
     * @param pattern - Glob pattern for matching commandId (e.g., 'fs:*', 'editor:insert-text')
     * @param fn - Middleware function to execute
     * @param priority - Execution priority (use Priority constants)
     * @param pluginId - ID of the registering plugin (for debugging/isolation)
     * @returns Dispose function to unregister the hook
     * 
     * @example
     * ```ts
     * const dispose = runner.register('fs:write', async (ctx, next) => {
     *   // Encrypt data before writing
     *   ctx.args[1] = encrypt(ctx.args[1]);
     *   await next();
     * }, Priority.HIGH, 'encryption-plugin');
     * 
     * // Later: clean up
     * dispose();
     * ```
     */
    register(
        pattern: string,
        fn: MiddlewareFn,
        priority: number = Priority.NORMAL,
        pluginId: string = 'unknown'
    ): () => void {
        const hook: RegisteredHook = {
            pattern: globToRegex(pattern),
            rawPattern: pattern,
            fn,
            priority,
            pluginId
        };

        this.middlewares.push(hook);

        // Sort by priority (descending) - higher priority executes first
        // JavaScript's Array.sort is stable in modern engines
        this.middlewares.sort((a, b) => b.priority - a.priority);

        // Return dispose function
        return () => {
            const index = this.middlewares.indexOf(hook);
            if (index !== -1) {
                this.middlewares.splice(index, 1);
            }
        };
    }

    /**
     * Execute a command through the middleware chain.
     * 
     * Implements the "Onion" execution model:
     * 1. Downstream: Middlewares execute in priority order (high to low)
     * 2. Core: The final handler executes
     * 3. Upstream: Middlewares resume in reverse order (low to high)
     * 
     * @param commandId - Command identifier (e.g., 'fs:read-file')
     * @param args - Arguments array for the command
     * @param finalHandler - Core handler function to execute at chain end
     * @param parentContext - Parent context for nested calls (loop detection)
     * @returns Promise resolving to the result (ctx.result)
     * 
     * @throws Error if recursion depth exceeds MAX_RECURSION_DEPTH (16)
     * 
     * @example
     * ```ts
     * const result = await runner.run(
     *   'fs:read',
     *   ['/path/to/file'],
     *   (path) => fs.readFile(path),
     *   parentContext // Optional: for nested calls
     * );
     * ```
     */
    async run<TArgs extends any[] = any[], TResult = any>(
        commandId: string,
        args: TArgs,
        finalHandler: (...args: TArgs) => Promise<TResult> | TResult,
        parentContext?: CallContext
    ): Promise<TResult> {
        // 1. Matching Phase - Find all applicable middlewares
        const chain = this.middlewares
            .filter(m => m.pattern.test(commandId))
            .map(m => m.fn);

        // 2. Context Initialization
        const context: CallContext<TArgs, TResult> = {
            commandId,
            args,
            meta: {
                id: generateUUID(),
                timestamp: Date.now(),
                // Inherit initiatorId from parent or default to 'system'
                initiatorId: parentContext?.meta.initiatorId ?? 'system',
                // Increment depth for nested calls
                depth: parentContext ? parentContext.meta.depth + 1 : 0,
                isAborted: false
            }
        };

        // 3. Loop Detection Check
        if (context.meta.depth > MAX_RECURSION_DEPTH) {
            console.error(
                `[MiddlewareRunner] Recursion Limit Exceeded for '${commandId}'. Depth: ${context.meta.depth}`
            );
            throw new Error(
                `Recursion Limit Exceeded: Infinite loop detected in middleware chain for '${commandId}'. ` +
                `Max depth: ${MAX_RECURSION_DEPTH}, Current: ${context.meta.depth}`
            );
        }

        // 4. Recursive Dispatch (The Onion)
        const dispatch = async (index: number): Promise<void> => {
            // Check abort flag
            if (context.meta.isAborted) {
                return;
            }

            // Base case: end of middleware chain - call core handler
            if (index === chain.length) {
                try {
                    context.result = await finalHandler(...context.args);
                } catch (error) {
                    // Core errors bubble up for middleware to catch
                    throw error;
                }
                return;
            }

            const middleware = chain[index];

            // Safety check (should never happen due to index check above)
            if (!middleware) {
                return;
            }

            // Define next() function for this middleware
            const next: NextFn = async () => {
                await dispatch(index + 1);
            };

            // Execute middleware
            try {
                await middleware(context, next);
            } catch (err) {
                // Log error with plugin context for debugging
                console.error(
                    `[MiddlewareRunner] Error in middleware (index ${index}) for '${commandId}':`,
                    err
                );
                throw err; // Re-throw for upstream handling
            }
        };

        // Start the chain
        await dispatch(0);

        return context.result as TResult;
    }

    /**
     * Get all registered hooks (for debugging/inspection).
     * 
     * @returns Array of registered hooks with their metadata
     */
    getRegisteredHooks(): Array<{
        pattern: string;
        priority: number;
        pluginId: string;
    }> {
        return this.middlewares.map(h => ({
            pattern: h.rawPattern,
            priority: h.priority,
            pluginId: h.pluginId
        }));
    }

    /**
     * Clear all registered middlewares.
     * Primarily for testing purposes.
     */
    clear(): void {
        this.middlewares = [];
    }
}
