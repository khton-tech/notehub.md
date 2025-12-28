import type { NotehubCore } from '@notehub/core';
import type { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { Compartment } from '@codemirror/state';

/**
 * EditorController - Manages editor state and file I/O
 * 
 * Responsibilities:
 * - Track current file path and dirty state
 * - Implement debounced auto-save (1000ms)
 * - Integrate with fs-manager for file operations
 * - Provide text getter/setter for view integration
 * - Manage dynamic extensions from portal plugins
 */
export type EditorStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export class EditorController {
    private app: NotehubCore;
    private view: EditorView | null = null;

    /** Currently open file path */
    private currentFilePath: string | null = null;

    /** Whether the current file has unsaved changes */
    private isDirty: boolean = false;

    /** Current editor status */
    private status: EditorStatus = 'idle';

    /** Debounce timer for auto-save */
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    /** Auto-save delay in milliseconds */
    private readonly SAVE_DELAY_MS = 1000;

    /** Compartment for dynamic extensions */
    private dynamicExtensionsCompartment = new Compartment();

    /** Array of dynamically registered extensions */
    private dynamicExtensions: Extension[] = [];

    constructor(app: NotehubCore) {
        this.app = app;
    }

    /**
     * Set the EditorView instance
     */
    setView(view: EditorView): void {
        this.view = view;
    }

    /**
     * Load a file into the editor
     */
    async loadFile(path: string): Promise<void> {
        try {
            this.setStatus('loading');

            // Save current file before loading new one
            if (this.isDirty && this.currentFilePath) {
                await this.saveFile();
            }

            // Read new file
            this.log('info', `Loading file: ${path}`);
            const content = await this.app.api.invoke('fs:read-text-file', path);

            // Update state
            this.currentFilePath = path;
            this.isDirty = false;

            // Update view if available
            if (this.view) {
                this.view.dispatch({
                    changes: {
                        from: 0,
                        to: this.view.state.doc.length,
                        insert: content
                    }
                });
            }

            this.setStatus('idle');
            this.broadcastState();
            this.log('info', `File loaded: ${path}`);
        } catch (error) {
            this.setStatus('error');
            this.log('error', `Failed to load file: ${error}`);
            throw error;
        }
    }

    /**
     * Save the current file
     */
    async saveFile(): Promise<void> {
        if (!this.currentFilePath) {
            this.log('warn', 'No file is currently open');
            return;
        }

        if (!this.isDirty) {
            this.log('info', 'No changes to save');
            return;
        }

        try {
            this.setStatus('saving');
            const content = this.getText();
            this.log('info', `Saving file: ${this.currentFilePath}`);

            await this.app.api.invoke('fs:write-text-file', this.currentFilePath, content);

            this.isDirty = false;
            this.setStatus('saved');
            this.broadcastState();
            this.log('info', `File saved: ${this.currentFilePath}`);

            // Reset to idle after 1 second
            setTimeout(() => {
                if (this.status === 'saved') {
                    this.setStatus('idle');
                    this.broadcastState();
                }
            }, 1000);
        } catch (error) {
            this.setStatus('error');
            this.broadcastState();
            this.log('error', `Failed to save file: ${error}`);
            throw error;
        }
    }

    /**
     * Handle text changes from the editor
     * Triggers debounced auto-save
     */
    onTextChange(): void {
        this.isDirty = true;

        // Clear existing timer
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        // Set new timer
        this.saveTimer = setTimeout(() => {
            this.saveFile().catch(error => {
                this.log('error', `Auto-save failed: ${error}`);
            });
        }, this.SAVE_DELAY_MS);
    }

    /**
     * Get current editor text
     */
    getText(): string {
        if (!this.view) {
            return '';
        }
        return this.view.state.doc.toString();
    }

    /**
     * Set editor text programmatically
     */
    setText(content: string): void {
        if (!this.view) {
            return;
        }

        this.view.dispatch({
            changes: {
                from: 0,
                to: this.view.state.doc.length,
                insert: content
            }
        });
    }

    /**
     * Get current file path
     */
    getCurrentFilePath(): string | null {
        return this.currentFilePath;
    }

    /**
     * Check if file has unsaved changes
     */
    getIsDirty(): boolean {
        return this.isDirty;
    }

    /**
     * Get current editor status
     */
    getStatus(): EditorStatus {
        return this.status;
    }

    /**
     * Set editor status and broadcast to state
     */
    private setStatus(status: EditorStatus): void {
        this.status = status;
        this.broadcastState();
    }

    /**
     * Broadcast current editor state to state-manager
     */
    private broadcastState(): void {
        this.app.api.invoke('state:set', 'editor:current-file', this.currentFilePath);
        this.app.api.invoke('state:set', 'editor:is-dirty', this.isDirty);
        this.app.api.invoke('state:set', 'editor:status', this.status);
    }

    /**
     * Get the dynamic extensions compartment for initial setup
     */
    getDynamicExtensionsCompartment(): typeof this.dynamicExtensionsCompartment {
        return this.dynamicExtensionsCompartment;
    }

    /**
     * Get the currently registered dynamic extensions
     * Used by NotehubEditor to initialize with already-registered extensions
     */
    getDynamicExtensions(): Extension[] {
        return this.dynamicExtensions;
    }

    /**
     * Register a dynamic extension (for portal plugins)
     * 
     * @param id - Unique identifier for the extension
     * @param extension - CodeMirror extension to register
     */
    registerExtension(id: string, extension: Extension): void {
        this.log('info', `Registering extension: ${id}`);
        console.log('[EditorController] registerExtension called, id:', id);
        console.log('[EditorController] view exists?', !!this.view);
        console.log('[EditorController] current extensions count:', this.dynamicExtensions.length);

        // Add extension to array
        this.dynamicExtensions.push(extension);
        console.log('[EditorController] after push, extensions count:', this.dynamicExtensions.length);

        // Reconfigure the compartment
        if (this.view) {
            console.log('[EditorController] Dispatching reconfigure...');
            this.view.dispatch({
                effects: this.dynamicExtensionsCompartment.reconfigure(this.dynamicExtensions),
            });
            console.log('[EditorController] Dispatch complete');
        } else {
            console.warn('[EditorController] ⚠️ View not available, extension will be applied when view is created');
        }
    }

    /**
     * Unregister a dynamic extension
     * 
     * @param id - Unique identifier for the extension
     */
    unregisterExtension(id: string): void {
        this.log('info', `Unregistering extension: ${id}`);

        // For now, we'll keep extensions registered since we don't track them by ID
        // In the future, we can maintain a Map<string, Extension> for proper removal
        // This is a simple implementation for the demo
    }

    /**
     * Cleanup - cancel pending save and force save if dirty
     */
    async cleanup(): Promise<void> {
        // Cancel pending save timer
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }

        // Force save if dirty
        if (this.isDirty && this.currentFilePath) {
            await this.saveFile();
        }
    }

    /**
     * Log helper
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.features.editor', message);
    }
}
