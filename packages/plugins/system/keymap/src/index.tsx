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
        app.api.register('keymap:register-binding' as any, (commandId: unknown, hotkey: unknown) => {
            this.listener?.registerBinding(commandId as string, hotkey as string);
        });

        // Legacy: Overwrites/Adds a binding. We map this to addBinding for now, 
        // but arguably it should clear others. 
        // Given we are moving to multiple, adding is safer than deleting others unexpectedly.
        app.api.register('keymap:bind' as any, async (commandId: unknown, hotkey: unknown) => {
            await this.listener?.addBinding(commandId as string, hotkey as string);
        });

        app.api.register('keymap:add-binding' as any, async (commandId: unknown, hotkey: unknown) => {
            await this.listener?.addBinding(commandId as string, hotkey as string);
        });

        app.api.register('keymap:remove-binding' as any, async (commandId: unknown, hotkey: unknown) => {
            await this.listener?.removeBinding(commandId as string, hotkey as string);
        });

        app.api.register('keymap:reset' as any, async (commandId: unknown) => {
            await this.listener?.reset(commandId as string);
        });

        // Helper to get effective binding for UI
        app.api.register('keymap:get-binding' as any, (commandId: unknown): string | undefined => {
            const bindings = (this.listener as any)?.getBindings(commandId as string);
            return bindings && bindings.length > 0 ? bindings[0] : undefined;
        });

        app.api.register('keymap:get-bindings' as any, (commandId: unknown): string[] => {
            return (this.listener as any)?.getBindings(commandId as string) || [];
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
