import React from 'react';
import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { EditorController } from './logic/EditorController';
import { NotehubEditor } from './components/NotehubEditor';

// Export Portal Bridge infrastructure for other plugins
export { BridgeService, getBridgeService } from './lib/portal-bridge/BridgeService';
export { PortalRenderer } from './lib/portal-bridge/PortalRenderer';
export { ReactWidget } from './cm/widgets/ReactWidget';
export type { PortalItem } from './lib/portal-bridge/types';

/**
 * EditorPlugin - The Editor Host System (Wave 0)
 * 
 * A modular editor foundation built on CodeMirror 6.
 * Future features (Live Preview, Callouts) will be implemented as separate plugins
 * that inject themselves into this Host.
 * 
 * Responsibilities:
 * - Register editor component in 'main' zone
 * - Provide API methods: editor:open, editor:save
 * - Subscribe to explorer:file-selected events
 * - Manage editor controller lifecycle
 */

// Module-level controller reference for component access
let controllerInstance: EditorController | null = null;

// Stable EditorWrapper component
const EditorWrapper: React.FC = () => {
    if (!controllerInstance) {
        console.warn('[EditorPlugin] Controller not initialized');
        return null;
    }
    return <NotehubEditor controller={controllerInstance} />;
};

export class EditorPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.editor',
        name: 'Editor',
        version: '0.0.1',
        type: 'feature',
        dependencies: [
            'nh.system.fs-manager',
            'nh.system.logger',
            'nh.ui.theme-manager',
            'nh.ui.layout-manager',
            'nh.ui.controllers-manager'
        ]
    };

    private app: NotehubCore | null = null;
    private controller: EditorController | null = null;

    /** Event cleanup functions for lifecycle hygiene */
    private eventCleanups: Array<() => void> = [];

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Initialize controller
        this.controller = new EditorController(app);
        controllerInstance = this.controller; // Set module-level reference

        // === Component Registration ===

        // Register the stable wrapper component
        await app.api.invoke('controller:register', 'notehub-editor', EditorWrapper);
        this.log('info', 'Registered NotehubEditor component');

        // Register in 'main' zone
        await app.api.invoke('zone:register', 'main', {
            component: 'notehub-editor',
            priority: 100, // High priority to render first
        });
        this.log('info', 'Registered editor in main zone');

        // === API Method Registration ===

        const openHandler = async (path: string): Promise<void> => {
            if (this.controller) {
                await this.controller.loadFile(path);
            }
        };

        const saveHandler = async (): Promise<void> => {
            if (this.controller) {
                await this.controller.saveFile();
            }
        };

        app.api.register('editor:open', openHandler);
        app.api.register('editor:save', saveHandler);
        this.log('info', 'Registered API methods: editor:open, editor:save');

        // === Event Bus Subscriptions ===

        // Subscribe to explorer:file-selected
        const fileSelectedHandler = async (payload: any) => {
            const path = typeof payload === 'string' ? payload : payload.path;
            if (path && this.controller) {
                this.log('info', `Opening file from explorer: ${path}`);
                await this.controller.loadFile(path);
            }
        };
        app.events.on('explorer:file-selected', fileSelectedHandler);
        this.eventCleanups.push(() => app.events.off('explorer:file-selected', fileSelectedHandler));
        this.log('info', 'Subscribed to explorer:file-selected event');

        // Subscribe to editor:register-extension (for portal plugins)
        const registerExtensionHandler = (payload: any) => {
            if (payload && payload.id && payload.extension && this.controller) {
                this.log('info', `Registering extension from plugin: ${payload.id}`);
                this.controller.registerExtension(payload.id, payload.extension);
            }
        };
        app.events.on('editor:register-extension', registerExtensionHandler);
        this.eventCleanups.push(() => app.events.off('editor:register-extension', registerExtensionHandler));

        // Subscribe to editor:unregister-extension
        const unregisterExtensionHandler = (payload: any) => {
            if (payload && payload.id && this.controller) {
                this.log('info', `Unregistering extension from plugin: ${payload.id}`);
                this.controller.unregisterExtension(payload.id);
            }
        };
        app.events.on('editor:unregister-extension', unregisterExtensionHandler);
        this.eventCleanups.push(() => app.events.off('editor:unregister-extension', unregisterExtensionHandler));

        this.log('info', 'Loaded successfully');
    }

    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // === LIFECYCLE HYGIENE: Proper cleanup ===

        // 1. Cleanup controller (save pending changes)
        if (this.controller) {
            try {
                await this.controller.cleanup();
            } catch (error) {
                this.log('warn', `Error during controller cleanup: ${error}`);
            }
            this.controller = null;
        }

        // 2. Clear module-level controller reference
        controllerInstance = null;

        // 3. Unsubscribe all event handlers
        for (const cleanup of this.eventCleanups) {
            try {
                cleanup();
            } catch (error) {
                this.log('warn', `Error during event cleanup: ${error}`);
            }
        }
        this.eventCleanups = [];

        // 4. Unregister API methods
        app.api.unregister('editor:open');
        app.api.unregister('editor:save');

        // 5. Unregister controller component
        app.api.invoke('controller:unregister', 'notehub-editor');

        // 6. Clear app reference
        this.app = null;

        this.log('info', 'Unloaded - all listeners cleaned up');
    }
}

export default EditorPlugin;
