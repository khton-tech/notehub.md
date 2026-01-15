/**
 * @fileoverview Middleware System Type Definitions
 * @module @notehub/core/middleware/types
 * 
 * Core types for the Interceptor Engine (Wave 2 - RFC-010 v2)
 * Implements Koa-style "Onion" middleware architecture.
 */

/**
 * CallContext - Mutable state object traveling through the middleware chain.
 * 
 * @template TArgs - Type of the arguments array
 * @template TResult - Type of the result value
 * 
 * @example
 * ```ts
 * const ctx: CallContext<[string, number], boolean> = {
 *   commandId: 'fs:write',
 *   args: ['/path/to/file', 42],
 *   meta: { id: '...', timestamp: Date.now(), initiatorId: 'my-plugin', depth: 0, isAborted: false }
 * };
 * ```
 */
export interface CallContext<TArgs extends any[] = any[], TResult = any> {
    /**
     * Unique identifier of the command type.
     * Used for routing (matching) in MiddlewareRunner.
     * Examples: 'fs:write-file', 'editor:insert-text', 'ui:show-toast'.
     */
    readonly commandId: string;

    /**
     * Arguments of the call.
     * Middleware can read, validate, and REPLACE contents of this array.
     * Changes made here will be reflected in all subsequent middleware (Downstream)
     * and in the final core handler.
     */
    args: TArgs;

    /**
     * Result of the operation.
     * Initially undefined. Set by:
     * 1. The final core handler.
     * 2. Any middleware that decides to short-circuit and return early.
     * 3. Modified in Upstream phase (e.g., decryption).
     */
    result?: TResult;

    /**
     * Call metadata for debugging, tracing, and safety mechanisms.
     */
    readonly meta: CallContextMeta;
}

/**
 * Metadata for CallContext.
 * Contains system-level information about the call.
 */
export interface CallContextMeta {
    /**
     * UUID (v4) of this specific call.
     * Allows correlating logs and traces.
     */
    readonly id: string;

    /**
     * Timestamp of execution start (Date.now()).
     * Used for performance metrics calculation.
     */
    readonly timestamp: number;

    /**
     * Identifier of the call initiator (Plugin ID or 'core').
     * Required for security auditing and dependency graph construction.
     */
    readonly initiatorId: string;

    /**
     * Recursion depth counter.
     * System counter for nested calls. Used by the
     * Distributed Loop Detection mechanism to prevent stack overflow.
     */
    depth: number;

    /**
     * Forced abort flag.
     * If true, Runner stops executing the chain.
     */
    isAborted: boolean;

    /**
     * Extensible storage for passing arbitrary data between middleware.
     * Example: { "skip-logging": true }
     */
    [key: string]: any;
}

/**
 * Function to pass control to the next middleware in the chain.
 * Returns a Promise that resolves when the entire downstream chain
 * (including core handler and all Upstream phases) has completed.
 */
export type NextFn = () => Promise<void>;

/**
 * Middleware function signature.
 * Asynchronous by nature (Promise<void>), allowing I/O operations.
 * 
 * @param ctx - Current call context
 * @param next - Function to call the next handler in the chain
 * 
 * @example
 * ```ts
 * const loggingMiddleware: MiddlewareFn = async (ctx, next) => {
 *   console.log(`[START] ${ctx.commandId}`);
 *   await next();
 *   console.log(`[END] ${ctx.commandId} -> ${ctx.result}`);
 * };
 * ```
 */
export type MiddlewareFn = (ctx: CallContext, next: NextFn) => Promise<void>;

/**
 * Priority constants for middleware execution order.
 * Higher values execute earlier in Downstream phase (and later in Upstream phase).
 */
export const Priority = {
    /**
     * System patches, security, hotfixes.
     * Use for: Fixing core bugs, blocking dangerous operations, ACL checks.
     */
    CRITICAL: 1000,

    /**
     * Data transformation, preprocessing.
     * Use for: Encryption/decryption, transliteration, auto-correction.
     */
    HIGH: 500,

    /**
     * Standard business logic.
     * Use for: Regular plugin functionality.
     * This is the default priority.
     */
    NORMAL: 100,

    /**
     * Post-processing, analytics.
     * Use for: Logging, UI status updates (if result capture needed).
     */
    LOW: 0
} as const;

/**
 * Type for Priority constant values
 */
export type PriorityValue = typeof Priority[keyof typeof Priority];

/**
 * Maximum recursion depth before throwing error.
 * Prevents infinite loops and stack overflow.
 */
export const MAX_RECURSION_DEPTH = 16;
