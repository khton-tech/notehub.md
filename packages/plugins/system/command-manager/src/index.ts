/**
 * @fileoverview Command Manager Plugin Entry Point
 * 
 * Central nervous system for user actions. Provides context-aware command
 * registration and execution, with global hotkey support.
 * 
 * ## Architecture
 * 
 * - **CommandRegistry**: Core logic for command storage and execution
 * - **API Methods**: `command:register`, `command:execute`, `command:set-context`, `command:get-visible`
 * - **Hotkey Listener**: Global keydown handler for keyboard shortcuts
 * 
 * ## Context System
 * 
 * Commands can specify a `context` requirement. When the context doesn't match
 * the active context, the command won't execute and hotkeys won't be intercepted.
 * 
 * Example: `editor:save` with `context: 'editor'` only works when editor is focused.
 * 
 * @module @notehub/command-manager
 */

import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import type { CommandDefinition } from '@notehub.md/api';
import { CommandRegistry } from './logic/CommandRegistry';

/**
 * CommandManagerPlugin - Central command system
 */
export class CommandManagerPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.command-manager',
        name: 'Command Manager',
        version: '0.1.5',
        type: 'system',
        dependencies: ['nh.system.logger'],
    };

    private app: NotehubCore | null = null;
    private registry: CommandRegistry | null = null;

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    /**
     * Initialize the plugin
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Create registry
        this.registry = new CommandRegistry(app);
        this.registry.init();

        // Register API methods
        app.api.register('command:register', (def: CommandDefinition) => {
            this.registry?.register(def);
        });

        app.api.register('command:execute', async (id: string) => {
            await this.registry?.execute(id);
        });

        app.api.register('command:set-context', (context: string) => {
            this.registry?.setContext(context);
        });

        app.api.register('command:get-visible', () => {
            return this.registry?.getVisibleCommands() ?? [];
        });

        app.api.register('command:get-all', () => {
            return this.registry?.getAll() ?? [];
        });

        this.log('info', 'Loaded successfully');
    }

    /**
     * Cleanup the plugin
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Unregister API methods
        app.api.unregister('command:register');
        app.api.unregister('command:execute');
        app.api.unregister('command:set-context');
        app.api.unregister('command:get-visible');
        app.api.unregister('command:get-all');

        // Dispose registry
        if (this.registry) {
            this.registry.dispose();
            this.registry = null;
        }

        this.app = null;
        this.log('info', 'Unloaded');
    }
}

export default CommandManagerPlugin;
