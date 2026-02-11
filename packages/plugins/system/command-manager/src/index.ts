/**
 * @fileoverview Command Manager Plugin Entry Point
 *
 * Central nervous system for user actions. Provides context-aware command
 * registration and execution, with global hotkey support.
 *
 * @module @notehub/command-manager
 */

import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import type { CommandDefinition } from '@notehub.md/api';
import { CommandRegistry } from './logic/CommandRegistry';

/**
 * CommandManagerPlugin - Central command system
 */
export class CommandManagerPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.command-manager',
        name: 'Command Manager',
        version: '0.1.5',
        type: 'system',
        dependencies: ['nh.system.logger'],
    };

    private registry: CommandRegistry | null = null;

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Create registry
        this.registry = new CommandRegistry(this.app);
        this.registry.init();

        // Register API methods
        this.registerApi('command:register', (def: CommandDefinition) => {
            this.registry?.register(def);
        });

        this.registerApi('command:execute', async (id: string) => {
            await this.registry?.execute(id);
        });

        this.registerApi('command:set-context', (context: string) => {
            this.registry?.setContext(context);
        });

        this.registerApi('command:get-visible', () => {
            return this.registry?.getVisibleCommands() ?? [];
        });

        this.registerApi('command:get-all', () => {
            return this.registry?.getAll() ?? [];
        });

        this.log('info', 'Loaded successfully');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        if (this.registry) {
            this.registry.dispose();
            this.registry = null;
        }

        this.log('info', 'Unloaded');
    }
}

export default CommandManagerPlugin;
