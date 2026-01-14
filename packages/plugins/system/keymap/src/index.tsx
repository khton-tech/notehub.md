/**
 * @fileoverview Keymap Plugin Entry Point
 */

import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { KeyListener } from './logic/KeyListener';
import manifest from '../manifest.json';

export class KeymapPlugin implements IPlugin {
    readonly manifest: PluginManifest = manifest as unknown as PluginManifest;
    private listener: KeyListener | null = null;

    async load(app: NotehubCore): Promise<void> {
        // Initialize listener
        this.listener = new KeyListener(app);
        this.listener.init();

        // Register API methods
        app.api.register('keymap:register-binding', (commandId: string, hotkey: string) => {
            this.listener?.registerBinding(commandId, hotkey);
        });
    }

    async unload(app: NotehubCore): Promise<void> {
        if (this.listener) {
            this.listener.dispose();
            this.listener = null;
        }

        app.api.unregister('keymap:register-binding');
    }
}

export default KeymapPlugin;
