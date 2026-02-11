/**
 * @fileoverview TitleBar Plugin Entry Point
 */

import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { createElement } from 'react';
import { TitleBarController } from './logic/TitleBarController';
import { TitleBar } from './components/TitleBar';

/**
 * TitleBarPlugin - Custom window title bar
 */
export class TitleBarPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.titlebar',
        name: 'TitleBar',
        version: '0.1.2',
        type: 'system',
    };

    private controller: TitleBarController | null = null;

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Create controller
        this.controller = new TitleBarController(this.app);
        await this.controller.init();

        // Register API Methods
        this.registerApi('titlebar:set-title', (title: string) => {
            this.controller?.setTitle(title);
        });

        this.registerApi('titlebar:set-icon', (icon: string | null) => {
            this.controller?.setIcon(icon);
        });

        this.registerApi('titlebar:get-title', (): string => {
            return this.controller?.getTitle() || 'Notehub';
        });

        // Create TitleBar Component Factory
        const controller = this.controller;
        const appRef = this.app;
        const TitleBarComponent = () => {
            if (!controller) return null;
            return createElement(TitleBar, { controller, app: appRef });
        };

        // Register the component for layouts to use
        this.app.api.invoke('controller:register', 'titlebar', TitleBarComponent);

        this.log('info', 'Loaded successfully');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        // Unregister component
        this.app.api.invoke('controller:unregister', 'titlebar');

        // Dispose controller
        this.controller?.dispose();
        this.controller = null;

        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default TitleBarPlugin;
