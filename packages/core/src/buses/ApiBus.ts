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
 * Hook position - when the hook runs relative to the original handler
 */
export type HookPosition = 'before' | 'after' | 'around';

/**
 * Before hook - runs before the handler, can modify args
 * Return modified args or undefined to keep original
 */
export type BeforeHook<TArgs extends unknown[] = unknown[]> = (
    args: TArgs
) => TArgs | void | Promise<TArgs | void>;

/**
 * After hook - runs after the handler, can modify result
 * Return modified result or undefined to keep original
 */
export type AfterHook<TResult = unknown> = (
    result: TResult,
    args: unknown[]
) => TResult | void | Promise<TResult | void>;

/**
 * Around hook - wraps the handler completely
 * Must call next() to continue the chain
 */
export type AroundHook<TArgs extends unknown[] = unknown[], TResult = unknown> = (
    args: TArgs,
    next: (args: TArgs) => Promise<TResult>
) => TResult | Promise<TResult>;

/**
 * Condition function to determine if hook should run
 */
export type HookCondition = (args: unknown[]) => boolean | Promise<boolean>;

/**
 * Options for hook registration
 */
export interface HookOptions {
    /**
     * Priority of the hook (higher = runs earlier)
     * Default: 0
     */
    priority?: number;

    /**
     * Condition that must return true for hook to run
     * If not provided, hook always runs
     */
    condition?: HookCondition;
}

/**
 * Internal hook record
 */
interface HookRecord {
    position: HookPosition;
    handler: BeforeHook | AfterHook | AroundHook;
    id: number;
    priority: number;
    condition: HookCondition | undefined;
}

/**
 * API Bus for registering and invoking plugin methods
 *
 * Provides a centralized registry for plugin-exposed APIs,
 * enabling direct method invocation between plugins with full type safety.
 * 
 * NEW: Hook System for intercepting/modifying API calls
 *
 * @example
 * ```ts
 * const api = new ApiBus();
 *
 * // Type-safe invocation
 * const config = await api.invoke('config:get', 'theme.current', 'dark');
 *
 * // Hook example: modify file before save
 * api.hook('fs:write-text-file', 'before', async (args) => {
 *     args[1] = await formatMarkdown(args[1]);
 *     return args;
 * });
 * ```
 */
export class ApiBus {
    private handlers = new Map<string, ApiHandler>();
    private hooks = new Map<string, HookRecord[]>();
    private hookIdCounter = 0;

    /**
     * Register an API method with type safety
     * 
     * @param name - Unique method name from NotehubApiMap
     * @param handler - Handler function implementation
     * @throws Error if method name is already registered
     */
    register<K extends ApiMethodName>(
        name: K,
        handler: (...args: ApiMethodArgs<K>) => ReturnType<NotehubApiMap[K]>
    ): void;

    /**
     * Register an API method (untyped overload for dynamic registration)
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
     * Register a hook for an API method
     * 
     * @param method - Method name to hook
     * @param position - When to run: 'before', 'after', or 'around'
     * @param handler - Hook function
     * @returns Unsubscribe function
     * 
     * @example
     * ```ts
     * // Before hook - modify args before handler runs
     * const unsub = api.hook('fs:write-text-file', 'before', async (args) => {
     *     args[1] = await formatMarkdown(args[1]);
     *     return args;
     * });
     * 
     * // After hook - modify result after handler runs
     * api.hook('fs:read-text-file', 'after', async (result, args) => {
     *     return result + '\n// Auto-appended comment';
     * });
     * 
     * // Around hook - wrap handler completely
     * api.hook('fs:write-file', 'around', async (args, next) => {
     *     console.log('Before write');
     *     const result = await next(args);
     *     console.log('After write');
     *     return result;
     * });
     *
     * // Hook with priority (higher priority runs first)
     * api.hook('editor:save', 'before', formatHandler, { priority: 100 });
     * api.hook('editor:save', 'before', validateHandler, { priority: 50 });
     * 
     * // Conditional hook (only runs when condition is true)
     * api.hook('fs:write-text-file', 'before', mdFormatter, { 
     *     condition: (args) => String(args[0]).endsWith('.md')
     * });
     * ```
     */
    hook(
        method: string,
        position: 'before',
        handler: BeforeHook,
        options?: HookOptions
    ): () => void;
    hook(
        method: string,
        position: 'after',
        handler: AfterHook,
        options?: HookOptions
    ): () => void;
    hook(
        method: string,
        position: 'around',
        handler: AroundHook,
        options?: HookOptions
    ): () => void;
    hook(
        method: string,
        position: HookPosition,
        handler: BeforeHook | AfterHook | AroundHook,
        options?: HookOptions
    ): () => void {
        const id = ++this.hookIdCounter;
        const record: HookRecord = {
            position,
            handler,
            id,
            priority: options?.priority ?? 0,
            condition: options?.condition
        };

        const existing = this.hooks.get(method) ?? [];
        existing.push(record);
        this.hooks.set(method, existing);

        // Return unsubscribe function
        return () => {
            const hooks = this.hooks.get(method);
            if (hooks) {
                const index = hooks.findIndex(h => h.id === id);
                if (index >= 0) {
                    hooks.splice(index, 1);
                    if (hooks.length === 0) {
                        this.hooks.delete(method);
                    }
                }
            }
        };
    }

    /**
     * Invoke a registered API method with full type safety
     * Hooks are executed in order: before -> around -> handler -> after
     * Within each position, hooks are sorted by priority (higher = runs first)
     */
    async invoke<K extends ApiMethodName>(
        method: K,
        ...args: ApiMethodArgs<K>
    ): Promise<ApiMethodAwaitedResult<K>>;

    async invoke<TResult = unknown>(name: string, ...args: unknown[]): Promise<TResult>;

    async invoke(name: string, ...args: unknown[]): Promise<unknown> {
        const handler = this.handlers.get(name);
        if (!handler) {
            throw new Error(`[ApiBus] Handler "${name}" is not registered`);
        }

        const hooks = this.hooks.get(name) ?? [];

        // Sort by priority (descending - higher priority runs first)
        const sortByPriority = (a: HookRecord, b: HookRecord) => b.priority - a.priority;

        // Filter and sort hooks by position and priority
        const beforeHooks = hooks
            .filter(h => h.position === 'before')
            .sort(sortByPriority);
        const afterHooks = hooks
            .filter(h => h.position === 'after')
            .sort(sortByPriority);
        const aroundHooks = hooks
            .filter(h => h.position === 'around')
            .sort(sortByPriority);

        // 1. Run before hooks (can modify args)
        let currentArgs = args;
        for (const hook of beforeHooks) {
            // Check condition if present
            if (hook.condition) {
                const shouldRun = await hook.condition(currentArgs);
                if (!shouldRun) continue;
            }
            const beforeHandler = hook.handler as BeforeHook;
            const modifiedArgs = await beforeHandler(currentArgs);
            if (modifiedArgs !== undefined) {
                currentArgs = modifiedArgs;
            }
        }

        // 2. Build around chain (innermost = original handler)
        let chain: (a: unknown[]) => Promise<unknown> = async (a) => handler(...a);

        // Wrap with around hooks (reverse order so first hook is outermost)
        // Already sorted by priority, so need to reverse for correct chain order
        for (let i = aroundHooks.length - 1; i >= 0; i--) {
            const hookRecord = aroundHooks[i];
            if (!hookRecord) continue; // Safety check for TypeScript
            const aroundHook = hookRecord.handler as AroundHook;
            const innerChain = chain;
            const hookCondition = hookRecord.condition;

            chain = async (a) => {
                // Check condition for around hook
                if (hookCondition) {
                    const shouldRun = await hookCondition(a);
                    if (!shouldRun) return innerChain(a);
                }
                return aroundHook(a, innerChain);
            };
        }

        // 3. Execute chain
        let result = await chain(currentArgs);

        // 4. Run after hooks (can modify result)
        for (const hook of afterHooks) {
            // Check condition if present
            if (hook.condition) {
                const shouldRun = await hook.condition(currentArgs);
                if (!shouldRun) continue;
            }
            const afterHandler = hook.handler as AfterHook;
            const modifiedResult = await afterHandler(result, currentArgs);
            if (modifiedResult !== undefined) {
                result = modifiedResult;
            }
        }

        return result;
    }

    /**
     * Check if a method is registered
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
     * Get detailed info about a registered method
     */
    getMethodInfo(name: string): {
        exists: boolean;
        hookCount: { before: number; after: number; around: number };
    } {
        const hooks = this.hooks.get(name) ?? [];
        return {
            exists: this.handlers.has(name),
            hookCount: {
                before: hooks.filter(h => h.position === 'before').length,
                after: hooks.filter(h => h.position === 'after').length,
                around: hooks.filter(h => h.position === 'around').length,
            }
        };
    }

    /**
     * Get all registered methods with metadata
     * Useful for API discovery and debugging
     */
    getMethodsWithMetadata(): Array<{
        name: string;
        hookCount: { before: number; after: number; around: number };
    }> {
        return this.getRegisteredMethods().map(name => ({
            name,
            hookCount: this.getMethodInfo(name).hookCount
        }));
    }

    /**
     * Get hook count for a method (for debugging)
     */
    getHookCount(method: string): number {
        return this.hooks.get(method)?.length ?? 0;
    }

    /**
     * Clear all hooks for a method
     */
    clearHooks(method: string): void {
        this.hooks.delete(method);
    }
}
