import type { NotehubCore } from '@notehub/core';
import type { EditorView } from '@codemirror/view';

/**
 * EditorController - Manages editor state and file I/O
 * 
 * Responsibilities:
 * - Track current file path and dirty state
 * - Implement debounced auto-save (1000ms)
 * - Integrate with fs-manager for file operations
 * - Provide text getter/setter for view integration
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
