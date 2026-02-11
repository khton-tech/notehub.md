
import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { ExplorerController } from './logic/ExplorerController';
import { FileTree } from './components/FileTree';
import { registerExplorerSettings } from './logic/ExplorerConfig';
import { registerExplorerMenus } from './menus';

export class ExplorerPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.explorer',
        name: 'Explorer',
        version: '0.0.2',
        type: 'feature',
        dependencies: [
            'nh.system.fs-manager',
            'nh.ui.icon-manager',
            'nh.ui.theme-manager',
            'nh.ui.context-menu',
            'nh.ui.dialog-manager'
        ]
    };

    private controller: ExplorerController | null = null;

    /** Menu cleanup function */
    private menuCleanup: (() => void) | null = null;

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Register settings with settings-manager for UI
        registerExplorerSettings(this.app);

        this.controller = new ExplorerController(this.app);

        // Initialize controller
        await this.controller.init();

        // Register context menu providers
        this.menuCleanup = registerExplorerMenus(this.app, this.controller);
        this.log('info', 'Registered context menu providers');

        // Wrap the component with the controller instance
        const ExplorerTreeComponent = () => {
            if (!this.controller) return null;

            return (
                <FileTree
                    controller={this.controller}
                />
            );
        };

        // Register the UI component in the registry
        await this.app.api.invoke('controller:register', 'explorer-tree', ExplorerTreeComponent);

        // Register API to get root path (needed for PathResolver)
        this.registerApi('explorer:get-root', () => this.controller?.root || null);

        // === Event Handlers with proper cleanup tracking ===

        // Handler for 'explorer:open' event
        const openHandler = async (payload: any) => {
            const path = typeof payload === 'string' ? payload : payload.path;
            if (path && this.controller) {
                await this.controller.setRoot(path);
            }
        };
        this.registerEvent('explorer:open', openHandler);

        // Handler for 'app:vault-opened' event
        const vaultOpenedHandler = async (payload: any) => {
            const path = typeof payload === 'string' ? payload : payload.path;
            if (path && this.controller) {
                await this.controller.setRoot(path);
            }
        };
        this.registerEvent('app:vault-opened', vaultOpenedHandler);

        // === Command Registration ===
        // Register commands for command palette (if command-manager is available)
        try {
            this.app.api.invoke('command:register', {
                id: 'explorer:new-file',
                name: 'New File',
                handler: async () => {
                    if (this.controller) {
                        // Get context: try to get selected path from explorer, or current file from editor
                        let contextPath: string | undefined;
                        try {
                            const activePath = await this.app.api.invoke('editor:get-active-path');
                            if (activePath) {
                                // Get the directory of the active file
                                contextPath = (activePath as string).replace(/\/[^/]+$/, '');
                            }
                        } catch {
                            // Fallback to root
                        }
                        await this.controller.createNote(contextPath);
                    }
                },
                areas: ['palette'],
                defaultHotkey: 'Mod+N',
            });

            this.app.api.invoke('command:register', {
                id: 'explorer:new-folder',
                name: 'New Folder',
                handler: async () => {
                    if (this.controller) {
                        // Get context: try to get selected path from explorer, or current file from editor
                        let contextPath: string | undefined;
                        try {
                            const activePath = await this.app.api.invoke('editor:get-active-path');
                            if (activePath) {
                                // Get the directory of the active file
                                contextPath = (activePath as string).replace(/\/[^/]+$/, '');
                            }
                        } catch {
                            // Fallback to root
                        }
                        await this.controller.createFolder(contextPath);
                    }
                },
                areas: ['palette'],
                defaultHotkey: 'Mod+Shift+N',
            });

            this.log('info', 'Registered file/folder commands');
        } catch {
            // Command manager not available, skip registration
        }

        this.log('info', 'Loaded successfully');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        // === LIFECYCLE HYGIENE: Proper cleanup ===

        // 1. Cleanup context menu providers
        if (this.menuCleanup) {
            this.menuCleanup();
            this.menuCleanup = null;
        }

        // 2. Cleanup controller event subscriptions
        if (this.controller) {
            this.controller.cleanup();
        }

        // 3. Unregister the controller component
        this.app.api.invoke('controller:unregister', 'explorer-tree');

        // 4. Clear controller reference
        this.controller = null;

        this.log('info', 'Unloaded - all listeners cleaned up');
    }
}

export default ExplorerPlugin;
