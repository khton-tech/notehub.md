/**
 * @fileoverview Keymap Plugin Entry Point
 */

import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { KeyListener } from './logic/KeyListener';
import manifest from '../manifest.json';

export class KeymapPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = manifest as unknown as PluginManifest;
    private listener: KeyListener | null = null;

    protected async onLoad(): Promise<void> {
        // Initialize listener
        this.listener = new KeyListener(this.app);
        this.listener.init();

        // Register API methods
        this.registerApi('keymap:register-binding', (commandId: string, hotkey: string) => {
            this.listener?.registerBinding(commandId, hotkey);
        });

        this.registerApi('keymap:bind', async (commandId: string, hotkey: string) => {
            await this.listener?.addBinding(commandId, hotkey);
        });

        this.registerApi('keymap:add-binding', async (commandId: string, hotkey: string) => {
            await this.listener?.addBinding(commandId, hotkey);
        });

        this.registerApi('keymap:remove-binding', async (commandId: string, hotkey: string) => {
            await this.listener?.removeBinding(commandId, hotkey);
        });

        this.registerApi('keymap:reset', async (commandId: string) => {
            await this.listener?.reset(commandId);
        });

        this.registerApi('keymap:get-binding', (commandId: string): string | undefined => {
            const bindings = this.listener?.getBindings?.(commandId);
            return bindings && bindings.length > 0 ? bindings[0] : undefined;
        });

        this.registerApi('keymap:get-bindings', (commandId: string): string[] => {
            return this.listener?.getBindings?.(commandId) || [];
        });
    }

    protected async onUnload(): Promise<void> {
        if (this.listener) {
            this.listener.dispose();
            this.listener = null;
        }
    }
}

export default KeymapPlugin;
