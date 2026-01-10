/**
 * @fileoverview TitleBar Plugin Entry Point
 * 
 * System plugin that provides a custom title bar replacing the native
 * OS window decorations. Features:
 * - "notehub" branding on the left
 * - Dynamic title in the center (set by other plugins)
 * - Window control buttons (minimize, maximize, close) on the right
 * 
 * API:
 * - `titlebar:set-title` - Set the current title (string)
 * - `titlebar:set-icon` - Set the title icon (string, icon name)
 * - `titlebar:get-title` - Get the current title
 * 
 * Events:
 * - `titlebar:title-changed` - Emitted when title changes
 * 
 * @module @notehub/titlebar
 */

import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { createElement } from 'react';
import { TitleBarController } from './logic/TitleBarController';
import { TitleBar } from './components/TitleBar';

/**
 * TitleBarPlugin - Custom window title bar
 * 
 * Lifecycle:
 * 1. `load()`: Initialize controller and register APIs
 * 2. `onReady()`: Register UI component
 * 3. `unload()`: Cleanup controller and unregister APIs
 */
export class TitleBarPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.titlebar',
        name: 'TitleBar',
        version: '0.1.2',
        type: 'system',
    };

    private app: NotehubCore | null = null;
    private controller: TitleBarController | null = null;

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    /**
     * Load the plugin
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Create controller
        this.controller = new TitleBarController(app);
        await this.controller.init();

        // ====================================================================
        // Register API Methods
        // ====================================================================

        (app.api.register as any)('titlebar:set-title', (title: string) => {
            this.controller?.setTitle(title);
        });

        (app.api.register as any)('titlebar:set-icon', (icon: string | null) => {
            this.controller?.setIcon(icon);
        });

        (app.api.register as any)('titlebar:get-title', (): string => {
            return this.controller?.getTitle() || 'Notehub';
        });

        // ====================================================================
        // Create TitleBar Component Factory
        // ====================================================================

        const controller = this.controller;
        const appRef = app;
        const TitleBarComponent = () => {
            if (!controller) return null;
            return createElement(TitleBar, { controller, app: appRef });
        };

        // Register the component for layouts to use
        app.api.invoke('controller:register', 'titlebar', TitleBarComponent);

        this.log('info', 'Loaded successfully');
    }

    /**
     * Unload the plugin
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Unregister APIs
        app.api.unregister('titlebar:set-title');
        app.api.unregister('titlebar:set-icon');
        app.api.unregister('titlebar:get-title');

        // Unregister component
        app.api.invoke('controller:unregister', 'titlebar');

        // Dispose controller
        this.controller?.dispose();
        this.controller = null;

        this.app = null;
        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default TitleBarPlugin;
