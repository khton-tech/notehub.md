import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { EditorController } from './logic/EditorController';
import { NotehubEditor } from './components/NotehubEditor';

/**
 * EditorPlugin - CodeMirror 6 based markdown editor
 * 
 * Features:
 * - Debounced auto-save (1000ms)
 * - Theme integration via CSS variables
 * - File loading via fs-manager
 */
export class EditorPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.editor',
        name: 'Editor',
        version: '0.0.0',
        type: 'feature',
    };

    private app: NotehubCore | null = null;
    private controller: EditorController | null = null;

    /** Event cleanup functions for lifecycle hygiene */
    private eventCleanups: Array<() => void> = [];

    /**
     * Log via logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Create controller
        this.controller = new EditorController(app);
        this.controller.init();

        // Create wrapper component with controller bound via closure
        const EditorComponent = () => {
            if (!this.controller) return null;
            return <NotehubEditor controller={this.controller} />;
        };

        // Register UI component
        await app.api.invoke('controller:register', 'notehub-editor', EditorComponent);

        // Register API methods
        app.api.register('editor:open', async (path: string) => {
            if (this.controller) {
                await this.controller.loadFile(path);
            }
        });

        app.api.register('editor:save', async () => {
            if (this.controller) {
                await this.controller.save();
            }
        });

        // === Event Handlers ===

        // Handler for file selection from explorer
        const fileSelectedHandler = async (payload: unknown) => {
            const path = typeof payload === 'string'
                ? payload
                : (payload as { path?: string })?.path;

            if (path && this.controller) {
                // Only open markdown files
                if (path.endsWith('.md') || path.endsWith('.markdown') || path.endsWith('.txt')) {
                    await this.controller.loadFile(path);
                }
            }
        };

        app.events.on('explorer:file-selected', fileSelectedHandler);
        this.eventCleanups.push(() => app.events.off('explorer:file-selected', fileSelectedHandler));

        this.log('info', 'Loaded successfully');
    }

    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // === LIFECYCLE HYGIENE ===

        // 1. Force save if dirty
        if (this.controller?.isDirty) {
            this.log('info', 'Force saving before unload...');
            try {
                await this.controller.save();
            } catch (error) {
                this.log('error', `Failed to save on unload: ${error}`);
            }
        }

        // 2. Cleanup event handlers
        for (const cleanup of this.eventCleanups) {
            try {
                cleanup();
            } catch (error) {
                this.log('warn', `Error during event cleanup: ${error}`);
            }
        }
        this.eventCleanups = [];

        // 3. Unregister controller component
        app.api.invoke('controller:unregister', 'notehub-editor');

        // 4. Unregister API methods
        app.api.unregister('editor:open');
        app.api.unregister('editor:save');

        // 5. Destroy controller
        if (this.controller) {
            this.controller.destroy();
            this.controller = null;
        }

        // 6. Clear app reference
        this.app = null;

        this.log('info', 'Unloaded - all resources cleaned up');
    }
}

export default EditorPlugin;
