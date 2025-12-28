import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import type { Extension } from '@codemirror/state';
import { buttonParserPlugin } from './cm/button-parser';

/**
 * ButtonWidgetPlugin - Portal widget plugin for rendering interactive buttons
 * 
 * This plugin demonstrates the Portal Bridge infrastructure by:
 * - Parsing [BUTTON::{TEXT}] syntax in markdown
 * - Creating CodeMirror widget decorations
 * - Rendering React components via Portal Bridge
 * 
 * Architecture:
 * - Registers a CodeMirror extension with the editor
 * - Uses ButtonWidget (extends ReactWidget) for portal integration
 * - Proper lifecycle hygiene (load/unload)
 */
export class ButtonWidgetPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.portals.button-widget',
        name: 'Button Widget',
        version: '0.0.1',
        type: 'feature',
        dependencies: [
            'nh.features.editor',
            'nh.system.logger',
        ]
    };

    private app: NotehubCore | null = null;

    /**
     * Log helper
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading Button Widget Plugin...');

        // Create the editor extension
        const extension: Extension = [buttonParserPlugin];

        // Register extension with editor
        // Note: We need to add this API to the editor plugin
        // For now, we'll emit an event that the editor can listen to
        app.events.emit('editor:register-extension', {
            id: this.manifest.id,
            extension,
        });

        this.log('info', 'Button Widget Plugin loaded - [BUTTON::{TEXT}] syntax is now active');
    }

    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading Button Widget Plugin...');

        // Unregister extension
        app.events.emit('editor:unregister-extension', {
            id: this.manifest.id,
        });

        this.app = null;
        this.log('info', 'Button Widget Plugin unloaded');
    }
}

export default ButtonWidgetPlugin;
