import { NotehubCore } from '@notehub/core';
import { EditorView } from '@codemirror/view';

/**
 * EditorController - Manages editor state and file operations
 * 
 * Features:
 * - Debounced auto-save (1000ms)
 * - Load/save files via fs-manager
 * - Dirty state tracking
 * - Beforeunload warning for unsaved changes
 */
export class EditorController {
    private app: NotehubCore;
    private view: EditorView | null = null;

    // State
    private _currentPath: string | null = null;
    private _isDirty: boolean = false;

    // Debounce
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly DEBOUNCE_MS = 1000;

    // Subscribers for React re-renders
    private listeners: Set<() => void> = new Set();

    // Bound handlers for cleanup
    private boundBeforeUnload: (e: BeforeUnloadEvent) => void;

    constructor(app: NotehubCore) {
        this.app = app;
        this.boundBeforeUnload = this.handleBeforeUnload.bind(this);
    }

    get currentPath(): string | null {
        return this._currentPath;
    }

    get isDirty(): boolean {
        return this._isDirty;
    }

    /**
     * Initialize the controller
     */
    init(): void {
        // Add beforeunload listener for unsaved changes warning
        window.addEventListener('beforeunload', this.boundBeforeUnload);
        this.log('info', 'EditorController initialized');
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        window.removeEventListener('beforeunload', this.boundBeforeUnload);
        this.clearDebounce();
        if (this.view) {
            this.view.destroy();
            this.view = null;
        }
        this.log('info', 'EditorController destroyed');
    }

    /**
     * Set the CodeMirror view instance
     */
    setView(view: EditorView): void {
        this.view = view;
    }

    /**
     * Subscribe to state changes (for React re-renders)
     */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        this.listeners.forEach(l => l());
    }

    /**
     * Load a file into the editor
     */
    async loadFile(path: string): Promise<void> {
        this.log('info', `Opening file: ${path}`);

        // Save current file if dirty
        if (this._isDirty && this._currentPath) {
            this.log('info', 'Saving previous file before loading new one');
            await this.save();
        }

        try {
            // Read file content
            const content = await this.app.api.invoke('fs:read-text-file', path);

            // Update state
            this._currentPath = path;
            this._isDirty = false;

            // Update CodeMirror content
            if (this.view) {
                this.view.dispatch({
                    changes: {
                        from: 0,
                        to: this.view.state.doc.length,
                        insert: content
                    }
                });
            }

            this.log('info', `File loaded: ${path}`);
            this.notify();
        } catch (error) {
            this.log('error', `Failed to load file: ${error}`);
            throw error;
        }
    }

    /**
     * Save current file
     */
    async save(): Promise<void> {
        if (!this._currentPath || !this.view) {
            return;
        }

        this.clearDebounce();

        try {
            const content = this.view.state.doc.toString();
            await this.app.api.invoke('fs:write-text-file', this._currentPath, content);

            this._isDirty = false;
            this.log('info', `File saved: ${this._currentPath}`);
            this.notify();
        } catch (error) {
            this.log('error', `Failed to save file: ${error}`);
            throw error;
        }
    }

    /**
     * Called on every document change from CodeMirror
     */
    handleDocChange(): void {
        if (!this._currentPath) return;

        this._isDirty = true;
        this.scheduleSave();
        this.notify();
    }

    /**
     * Schedule a debounced save
     */
    private scheduleSave(): void {
        this.clearDebounce();
        this.saveTimer = setTimeout(() => {
            this.save().catch(err => {
                this.log('error', `Auto-save failed: ${err}`);
            });
        }, this.DEBOUNCE_MS);
    }

    /**
     * Clear the debounce timer
     */
    private clearDebounce(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
    }

    /**
     * Handle beforeunload event - warn about unsaved changes
     */
    private handleBeforeUnload(e: BeforeUnloadEvent): void {
        if (this._isDirty) {
            // Attempt force save
            this.log('warn', 'Unsaved changes detected on close - attempting save');

            // Note: async save may not complete before unload
            // But we try anyway and also show browser warning
            this.save().catch(() => {
                this.log('error', 'Force save on unload failed');
            });

            // Show browser warning
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        }
    }

    /**
     * Get current document content
     */
    getContent(): string {
        return this.view?.state.doc.toString() ?? '';
    }

    /**
     * Log via logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.features.editor', message);
    }
}
