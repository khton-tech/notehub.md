import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { Button } from './components/Button';
import { Label } from './components/Label';
import { Card } from './components/Card';

/**
 * CKStandardPlugin - Standard Controllers Kit
 *
 * Provides standard UI component implementations for the controllers-manager.
 * Registers Button, Label, and Card controllers on initialization.
 *
 * Dependencies:
 * - nh.ui.controllers-manager - For controller registration
 * - nh.ui.icon-manager - For Button icon support
 * - nh.ui.theme-manager - For CSS variable theming
 */
export class CKStandardPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.ck-standard',
        name: 'CKStandard',
        version: '1.0.0',
        type: 'ui',
    };

    /** Reference to kernel */
    private app: NotehubCore | null = null;

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    // =============== Plugin Lifecycle ===============

    /**
     * Load the plugin and register all standard controllers
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Register standard controllers
        await app.api.invoke('controller:register', 'button', Button);
        await app.api.invoke('controller:register', 'label', Label);
        await app.api.invoke('controller:register', 'card', Card);

        this.log('info', 'Registered 3 standard controllers: button, label, card');
        this.log('info', 'Loaded successfully');
    }

    /**
     * Unload the plugin
     */
    async unload(_app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Note: Controllers remain registered until controllers-manager unloads
        // This allows for hot-reload scenarios where ck-standard can be replaced

        this.app = null;
        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default CKStandardPlugin;

// Re-export components for direct usage if needed
export { Button, Label, Card };
export type { ButtonProps } from './components/Button';
export type { LabelProps } from './components/Label';
export type { CardProps } from './components/Card';
