/**
 * @fileoverview Middleware System Barrel Export
 * @module @notehub/core/middleware
 */

// Types
export type {
    CallContext,
    CallContextMeta,
    MiddlewareFn,
    NextFn,
    PriorityValue
} from './types.js';

export { Priority, MAX_RECURSION_DEPTH } from './types.js';

// Core Engine
export { MiddlewareRunner } from './runner.js';

// Hooks API
export { HooksAPI, createHooksAPI } from './hooks.js';
export type { HookHandler, ReplaceHandler } from './hooks.js';
