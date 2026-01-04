/**
 * @fileoverview Plugin Context Implementation with Auto-Cleanup
 * @module nh.system.synapse
 * 
 * This module implements the PluginContext interface from @notehub/api,
 * providing a facade that tracks all registrations and subscriptions
 * for automatic cleanup when a plugin is unloaded.
 * 
 * The "ownership tracking" pattern ensures that if a plugin crashes or
 * is unloaded, all its API registrations and event subscriptions are
 * automatically cleaned up, preventing "Zombie Methods".
 */

import type { PluginContext } from '@notehub/api';
import type { NotehubCore } from '@notehub/core';

/**
 * Implementation of PluginContext that wraps Core APIs and 
 * tracks registrations for automatic cleanup.
 * 
 * @internal This class is instantiated by PluginLoader for each external plugin
 */
export class PluginContextImpl implements PluginContext {
    /** Core application instance */
    private readonly app: NotehubCore;

    /** Plugin ID for logging */
    private readonly pluginId: string;

    /** List of registered API names (for cleanup) */
    private registeredApis: string[] = [];

    /** List of event unsubscriber functions (for cleanup) */
    private eventUnsubscribers: (() => void)[] = [];

    /** Whether the context has been cleaned up */
    private disposed = false;

    /**
     * Create a new PluginContextImpl
     * 
     * @param app - Core application instance
     * @param pluginId - ID of the plugin this context belongs to
     */
    constructor(app: NotehubCore, pluginId: string) {
        this.app = app;
        this.pluginId = pluginId;
    }

    /**
     * Register an API method that other plugins can invoke.
     * The registration is tracked for automatic cleanup on unload.
     * 
     * @param name - Unique API method name
     * @param handler - Handler function to execute when API is invoked
     * @throws Error if context is disposed or API name is already registered
     */
    registerApi(name: string, handler: (...args: unknown[]) => unknown): void {
        this.ensureNotDisposed('registerApi');

        try {
            // Delegate to Core ApiBus
            this.app.api.register(name, handler);

            // Track for cleanup
            this.registeredApis.push(name);

            this.log('info', `Registered API: ${name}`);
        } catch (error) {
            this.log('error', `Failed to register API "${name}": ${error}`);
            throw error;
        }
    }

    /**
     * Invoke an API method registered by Core or another plugin.
     * 
     * @param name - API method name to invoke
     * @param args - Arguments to pass to the API method
     * @returns Promise resolving to the API method's return value
     */
    async invokeApi<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
        this.ensureNotDisposed('invokeApi');

        return this.app.api.invoke<T>(name, ...args);
    }

    /**
     * Subscribe to an application event.
     * The subscription is tracked for automatic cleanup on unload.
     * 
     * @param event - Event name to subscribe to
     * @param handler - Callback function invoked when event is emitted
     */
    subscribe<T = unknown>(event: string, handler: (payload: T) => void): void {
        this.ensureNotDisposed('subscribe');

        // Cast handler to EventCallback<unknown> since EventBus uses generic unknown type
        // The type safety is maintained at the API level
        const callback = handler as (payload: unknown) => void;

        // Subscribe to the event via Core EventBus
        this.app.events.on(event, callback);

        // Store unsubscriber for cleanup
        const unsubscribe = () => {
            this.app.events.off(event, callback);
        };
        this.eventUnsubscribers.push(unsubscribe);

        this.log('info', `Subscribed to event: ${event}`);
    }

    /**
     * Clean up all registrations and subscriptions.
     * Called by PluginLoader when a plugin is unloaded.
     * 
     * @internal
     */
    cleanup(): void {
        if (this.disposed) {
            this.log('warn', 'Context already disposed, skipping cleanup');
            return;
        }

        this.log('info', 'Starting cleanup...');

        // Unregister all APIs
        for (const apiName of this.registeredApis) {
            try {
                const unregistered = this.app.api.unregister(apiName);
                if (unregistered) {
                    this.log('info', `Unregistered API: ${apiName}`);
                } else {
                    this.log('warn', `API "${apiName}" was not found during unregister`);
                }
            } catch (error) {
                this.log('error', `Failed to unregister API "${apiName}": ${error}`);
            }
        }
        this.registeredApis = [];

        // Call all event unsubscribers
        for (const unsubscribe of this.eventUnsubscribers) {
            try {
                unsubscribe();
            } catch (error) {
                this.log('error', `Failed to unsubscribe from event: ${error}`);
            }
        }
        this.eventUnsubscribers = [];

        this.disposed = true;
        this.log('info', 'Cleanup complete');
    }

    /**
     * Check if the context has been disposed
     */
    isDisposed(): boolean {
        return this.disposed;
    }

    /**
     * Get statistics about tracked registrations
     */
    getStats(): { registeredApis: number; eventSubscriptions: number } {
        return {
            registeredApis: this.registeredApis.length,
            eventSubscriptions: this.eventUnsubscribers.length,
        };
    }

    /**
     * Throw if the context has been disposed
     */
    private ensureNotDisposed(method: string): void {
        if (this.disposed) {
            throw new Error(
                `[PluginContext:${this.pluginId}] Cannot call ${method}() - context has been disposed`
            );
        }
    }

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        const source = `PluginContext:${this.pluginId}`;
        // Use fire-and-forget to avoid blocking
        this.app.api.invoke(`logger:${level}`, source, message).catch(() => {
            // Fallback to console if logger is not available
            console[level](`[${source}] ${message}`);
        });
    }
}
