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

import type { PluginContext } from '@notehub.md/api';
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

    /** List of registered widget IDs (for cleanup) */
    private registeredWidgets: string[] = [];

    /** Lists of registered settings resources (for cleanup) */
    private registeredSettingsTabs: string[] = [];
    private registeredSettingsGroups: string[] = [];
    private registeredSettingsItems: string[] = [];

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

        // Intercept portal registration for auto-cleanup
        if (name === 'editor:register-portal' && args[0] && typeof (args[0] as any).id === 'string') {
            const widgetId = (args[0] as any).id;
            this.registeredWidgets.push(widgetId);
            this.log('info', `Tracked portal for cleanup: ${widgetId}`);
        }

        // Intercept settings registration
        this.interceptSettingsRegistration(name, args);

        return this.app.api.invoke<T>(name, ...args);
    }

    /**
     * Helper to track settings registrations
     */
    private interceptSettingsRegistration(name: string, args: unknown[]): void {
        const arg0 = args[0] as any;
        if (!arg0) return;

        if (name === 'settings:register-tab' && typeof arg0.id === 'string') {
            this.registeredSettingsTabs.push(arg0.id);
        } else if (name === 'settings:register-group' && typeof arg0.id === 'string') {
            this.registeredSettingsGroups.push(arg0.id);
        } else if (name === 'settings:register-item' && typeof arg0.key === 'string') {
            this.registeredSettingsItems.push(arg0.key);
        } else if (name === 'settings:register-tabs' && Array.isArray(arg0)) {
            arg0.forEach((t: any) => t.id && this.registeredSettingsTabs.push(t.id));
        } else if (name === 'settings:register-groups' && Array.isArray(arg0)) {
            arg0.forEach((g: any) => g.id && this.registeredSettingsGroups.push(g.id));
        } else if (name === 'settings:register-items' && Array.isArray(arg0)) {
            arg0.forEach((i: any) => i.key && this.registeredSettingsItems.push(i.key));
        }
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

        for (const widgetId of this.registeredWidgets) {
            try {
                this.app.api.invoke('editor:unregister-portal', widgetId).catch(err => {
                    this.log('warn', `Failed to unregister portal "${widgetId}" during cleanup: ${err}`);
                });
                this.log('info', `Unregistered portal: ${widgetId}`);
            } catch (error) {
                this.log('error', `Failed to unregister portal "${widgetId}": ${error}`);
            }
        }
        this.registeredWidgets = [];

        // Unregister settings resources
        // Note: We unregister items first, then groups, then tabs to be safe,
        // although the registry handles cascading deletion.

        for (const key of this.registeredSettingsItems) {
            this.app.api.invoke('settings:unregister-item', key).catch(() => { });
        }
        this.registeredSettingsItems = [];

        for (const id of this.registeredSettingsGroups) {
            this.app.api.invoke('settings:unregister-group', id).catch(() => { });
        }
        this.registeredSettingsGroups = [];

        for (const id of this.registeredSettingsTabs) {
            this.app.api.invoke('settings:unregister-tab', id).catch(() => { });
        }
        this.registeredSettingsTabs = [];

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
    getStats(): { registeredApis: number; eventSubscriptions: number; registeredWidgets: number; settings: number } {
        return {
            registeredApis: this.registeredApis.length,
            eventSubscriptions: this.eventUnsubscribers.length,
            registeredWidgets: this.registeredWidgets.length,
            settings: this.registeredSettingsTabs.length + this.registeredSettingsGroups.length + this.registeredSettingsItems.length,
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
