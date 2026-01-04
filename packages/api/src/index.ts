/**
 * @fileoverview Notehub Public API SDK
 * @module @notehub/api
 * 
 * Public SDK for developing external Notehub.md plugins.
 * 
 * This package provides:
 * - {@link NotehubPlugin} - Abstract base class for plugins
 * - {@link PluginContext} - Interface for plugin-ecosystem interaction
 * - {@link NotehubApiMap} - Complete API type definitions
 * 
 * @example
 * ```ts
 * import { NotehubPlugin, PluginContext } from '@notehub/api';
 * 
 * export default class MyPlugin extends NotehubPlugin {
 *     async onload(ctx: PluginContext): Promise<void> {
 *         // Register an API
 *         ctx.registerApi('my-plugin:greet', (name: string) => `Hello, ${name}!`);
 *         
 *         // Call an API
 *         const content = await ctx.invokeApi<string>('fs:read-text-file', '/path');
 *         
 *         // Subscribe to events
 *         ctx.subscribe('note:saved', (payload) => console.log(payload));
 *     }
 *     
 *     async onunload(): Promise<void> {
 *         // Cleanup is automatic for APIs and subscriptions!
 *     }
 * }
 * ```
 * 
 * @packageDocumentation
 */

// Export plugin base class
export { NotehubPlugin } from './plugin.js';

// Export context interface
export type { PluginContext } from './context.js';

// Export API contract types
export * from './contract.js';
