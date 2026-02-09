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

        // Legacy: Overwrites/Adds a binding. We map this to addBinding for now, 
        // but arguably it should clear others. 
        // Given we are moving to multiple, adding is safer than deleting others unexpectedly.
        app.api.register('keymap:bind', async (commandId: string, hotkey: string) => {
            await this.listener?.addBinding(commandId, hotkey);
        });

        app.api.register('keymap:add-binding', async (commandId: string, hotkey: string) => {
            await this.listener?.addBinding(commandId, hotkey);
        });

        app.api.register('keymap:remove-binding', async (commandId: string, hotkey: string) => {
            await this.listener?.removeBinding(commandId, hotkey);
        });

        app.api.register('keymap:reset', async (commandId: string) => {
            await this.listener?.reset(commandId);
        });

        // Helper to get effective binding for UI
        app.api.register('keymap:get-binding', (commandId: string): string | undefined => {
            const bindings = this.listener?.getBindings?.(commandId);
            return bindings && bindings.length > 0 ? bindings[0] : undefined;
        });

        app.api.register('keymap:get-bindings', (commandId: string): string[] => {
            return this.listener?.getBindings?.(commandId) || [];
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
