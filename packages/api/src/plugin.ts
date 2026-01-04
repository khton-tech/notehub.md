/**
 * @fileoverview Abstract Plugin Base Class
 * @module @notehub/api
 * 
 * Provides the base class that all external Notehub plugins must extend.
 */

import type { PluginContext } from './context.js';

/**
 * Abstract base class for Notehub plugins.
 * 
 * External plugin developers must extend this class and implement
 * the required lifecycle methods.
 * 
 * @example
 * ```ts
 * import { NotehubPlugin, PluginContext } from '@notehub/api';
 * 
 * export default class MyAwesomePlugin extends NotehubPlugin {
 *     private disposables: (() => void)[] = [];
 *     
 *     async onload(ctx: PluginContext): Promise<void> {
 *         // Register APIs
 *         ctx.registerApi('my-plugin:hello', () => 'Hello, World!');
 *         
 *         // Subscribe to events
 *         ctx.subscribe('app:ready', () => {
 *             console.log('App is ready!');
 *         });
 *     }
 *     
 *     async onunload(): Promise<void> {
 *         // Optional: Manual cleanup for resources not tracked by context
 *         // Note: API registrations and event subscriptions are
 *         // automatically cleaned up by the plugin loader.
 *     }
 * }
 * ```
 */
export abstract class NotehubPlugin {
    /**
     * Called when the plugin is loaded.
     * 
     * Use this method to:
     * - Register API methods
     * - Subscribe to events
     * - Initialize plugin state
     * - Set up UI components
     * 
     * @param ctx - Plugin context for interacting with the ecosystem
     * @returns Promise that resolves when initialization is complete, or void
     */
    abstract onload(ctx: PluginContext): Promise<void> | void;

    /**
     * Called when the plugin is being unloaded.
     * 
     * Use this method for manual cleanup of resources that are not
     * automatically managed by the PluginContext (e.g., timers, external connections).
     * 
     * Note: API registrations and event subscriptions made via PluginContext
     * are automatically cleaned up - you don't need to manually unregister them.
     * 
     * @returns Promise that resolves when cleanup is complete, or void
     */
    abstract onunload(): Promise<void> | void;
}
