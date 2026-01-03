/**
 * @fileoverview EditorController - The Brain of the Editor Plugin
 * 
 * This module contains the `EditorController` class which manages:
 * - File lifecycle (open, save with debounce)
 * - Content state tracking (dirty state, original content)
 * - Status bar updates via EventBus
 * - Error handling with logging and dialogs
 * 
 * ## Debounce Strategy
 * 
 * The controller implements a 1-second debounce for save operations.
 * This prevents excessive disk writes during rapid typing while ensuring
 * changes are persisted after the user stops typing.
 * 
 * ## Status Bar Integration
 * 
 * Status updates are broadcast via the `app:status-report` event:
 * - **Opening**: "Opening [filename]..."
 * - **Ready**: "Ready"
 * - **Unsaved**: "Unsaved changes"
 * - **Saving**: "Saving..."
 * - **Saved**: "Saved" (briefly, then returns to "Ready")
 * - **Error**: "Error: [message]" or "Save failed: [message]"
 * 
 * ## Error Handling
 * 
 * All file system errors are:
 * 1. Logged via `logger:error`
 * 2. Displayed to the user via `dialog:alert`
 * 3. Reflected in the status bar
 * 
 * @module @notehub/editor/logic/EditorController
 * @author Notehub Team
 */

import type { NotehubCore } from '@notehub/core';
import type { EditorView } from '@codemirror/view';
import type { EditorSettings } from './EditorConfig';
import { EDITOR_CONFIG_KEYS, EDITOR_CONFIG_DEFAULTS } from './EditorConfig';

/**
 * Status values for the editor lifecycle.
 * Used internally to track state and for status bar integration.
 */
export type EditorStatus = 'idle' | 'opening' | 'ready' | 'saving' | 'saved' | 'error';

/**
 * Payload structure for status bar updates.
 * Emitted on the `app:status-report` EventBus event.
 */
export interface StatusReport {
    /** Plugin identifier for filtering */
    source: 'editor';
    /** Current status for icon selection */
    status: 'ready' | 'saving' | 'error';
    /** Human-readable message */
    message: string;
}

/**
 * EditorController - Manages editor state and file operations
 * 
 * This class is the "brain" of the editor plugin, handling all business logic
 * while keeping the React components focused on rendering.
 * 
 * ## Usage
 * 
 * ```typescript
 * const controller = new EditorController(app);
 * 
 * // Open a file
 * const content = await controller.openFile('/path/to/file.md');
 * 
 * // Set the CodeMirror view reference
 * controller.setEditorView(view);
 * 
 * // Mark content as changed (triggers debounced save)
 * controller.markDirty();
 * 
 * // Manual save
 * await controller.saveFile();
 * 
 * // Cleanup
 * controller.dispose();
 * ```
 * 
 * @class
 */
export class EditorController {
    /** NotehubCore instance for API calls and events */
    private app: NotehubCore;

    // ========== File State ==========

    /** Currently open file path (null if no file open) */
    private currentPath: string | null = null;

    /** Original content when file was opened (for dirty detection) */
    private originalContent: string = '';

    /** Whether content has been modified since last save */
    private isDirty: boolean = false;

    /** Current editor status for status bar integration */
    private status: EditorStatus = 'idle';

    // ========== CodeMirror Integration ==========

    /** Reference to the CodeMirror EditorView (set by UI component) */
    private editorView: EditorView | null = null;

    // ========== Debounce Configuration ==========

    /** Timer ID for debounced save */
    private saveTimeoutId: ReturnType<typeof setTimeout> | null = null;

    /** Debounce delay in milliseconds (1 second) */
    private readonly SAVE_DEBOUNCE_MS = 1000;

    // ========== Settings State ==========

    /** Current editor settings from config-manager */
    private currentSettings: EditorSettings = { ...EDITOR_CONFIG_DEFAULTS };

    /** Listeners for settings changes (UI re-render trigger) */
    private settingsListeners: Set<(settings: EditorSettings) => void> = new Set();

    // ========== Bound Event Handlers (for unsubscription) ==========

    /** Bound handler for fs:deleted events */
    private readonly handleFsDeleted = (payload: { path: string; isDirectory: boolean }): void => {
        if (!this.currentPath) return;

        const { path, isDirectory } = payload;

        // Check if current file was deleted, or parent folder was deleted
        if (this.currentPath === path ||
            (isDirectory && this.currentPath.startsWith(path + '/')) ||
            (isDirectory && this.currentPath.startsWith(path + '\\'))) {
            this.log('info', `Active file deleted externally: ${path}`);
            this.closeFile();
        }
    };

    /** Bound handler for fs:renamed events */
    private readonly handleFsRenamed = (payload: { oldPath: string; newPath: string }): void => {
        if (!this.currentPath) return;

        const { oldPath, newPath } = payload;

        // Direct file rename
        if (this.currentPath === oldPath) {
            this.log('info', `Active file renamed: ${oldPath} -> ${newPath}`);
            this.currentPath = newPath;
            this.app.events.emit('editor:path-changed', { oldPath, newPath });
            return;
        }

        // Parent folder renamed (need to update path)
        if (this.currentPath.startsWith(oldPath + '/') ||
            this.currentPath.startsWith(oldPath + '\\')) {
            const relativePart = this.currentPath.slice(oldPath.length);
            this.currentPath = newPath + relativePart;
            this.log('info', `Parent renamed, new path: ${this.currentPath}`);
            this.app.events.emit('editor:path-changed', { oldPath, newPath: this.currentPath });
        }
    };

    /**
     * Create a new EditorController
     * @param app - The NotehubCore instance for API and event access
     */
    constructor(app: NotehubCore) {
        this.app = app;

        // Subscribe to config changes
        this.app.events.on('config:updated', (payload) => {
            const { key, value } = payload as { key: string; value: unknown };
            if (key.startsWith('editor.')) {
                this.handleSettingChange(key, value);
            }
        });

        // Subscribe to bulk config reloads
        this.app.events.on('config:reloaded', () => {
            this.log('info', 'Config reloaded, refreshing editor settings...');
            this.loadSettings();
        });

        // Subscribe to FS events for sync with Explorer
        this.app.events.on('fs:deleted', this.handleFsDeleted as (payload: unknown) => void);
        this.app.events.on('fs:renamed', this.handleFsRenamed as (payload: unknown) => void);
    }

    // ========== Private Helpers ==========

    /**
     * Log a message via the Logger plugin
     * @param level - Log level (info, warn, error)
     * @param message - Message to log
     * @private
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.features.editor', message);
    }

    /**
     * Emit a status report to the EventBus for status bar consumption
     * @param status - Status type for icon selection
     * @param message - Human-readable message
     * @private
     */
    private emitStatusReport(status: 'ready' | 'saving' | 'error', message: string): void {
        const report: StatusReport = {
            source: 'editor',
            status,
            message
        };
        this.app.events.emit('app:status-report', report);
    }

    /**
     * Handle a setting change from config:updated event
     * @param key - The config key that changed
     * @param value - The new value
     * @private
     */
    private handleSettingChange(key: string, value: unknown): void {
        let changed = false;

        switch (key) {
            case EDITOR_CONFIG_KEYS.SHOW_LINE_NUMBERS:
                if (typeof value === 'boolean') {
                    this.currentSettings.showLineNumbers = value;
                    changed = true;
                }
                break;
            case EDITOR_CONFIG_KEYS.WORD_WRAP:
                if (typeof value === 'boolean') {
                    this.currentSettings.wordWrap = value;
                    changed = true;
                }
                break;
            case EDITOR_CONFIG_KEYS.FONT_SIZE:
                if (typeof value === 'number') {
                    this.currentSettings.fontSize = value;
                    changed = true;
                }
                break;
        }

        if (changed) {
            this.log('info', `Setting changed: ${key} = ${value}`);
            this.notifySettingsListeners();
        }
    }

    /**
     * Notify all settings listeners of a change
     * @private
     */
    private notifySettingsListeners(): void {
        const settings = { ...this.currentSettings };
        this.settingsListeners.forEach(listener => listener(settings));
    }

    // ========== Public API: State Access ==========

    /**
     * Set the CodeMirror EditorView reference.
     * Called by the UI component when the editor mounts/unmounts.
     * @param view - The EditorView instance, or null on unmount
     */
    setEditorView(view: EditorView | null): void {
        this.editorView = view;
    }

    /**
     * Get the currently open file path
     * @returns The absolute path to the open file, or null
     */
    getCurrentPath(): string | null {
        return this.currentPath;
    }

    /**
     * Get the current content from the editor.
     * Reads directly from CodeMirror if available.
     * @returns The current document content as a string
     */
    getCurrentContent(): string {
        if (this.editorView) {
            return this.editorView.state.doc.toString();
        }
        return this.originalContent;
    }

    /**
     * Check if there are unsaved changes
     * @returns true if content has been modified since last save
     */
    getIsDirty(): boolean {
        return this.isDirty;
    }

    // ========== Public API: Settings ==========

    /**
     * Load settings from config-manager.
     * Should be called during plugin initialization.
     */
    async loadSettings(): Promise<void> {
        try {
            const showLineNumbers = await this.app.api.invoke<boolean>(
                'config:get',
                EDITOR_CONFIG_KEYS.SHOW_LINE_NUMBERS,
                EDITOR_CONFIG_DEFAULTS.showLineNumbers
            );
            const wordWrap = await this.app.api.invoke<boolean>(
                'config:get',
                EDITOR_CONFIG_KEYS.WORD_WRAP,
                EDITOR_CONFIG_DEFAULTS.wordWrap
            );
            const fontSize = await this.app.api.invoke<number>(
                'config:get',
                EDITOR_CONFIG_KEYS.FONT_SIZE,
                EDITOR_CONFIG_DEFAULTS.fontSize
            );

            this.currentSettings = {
                showLineNumbers: showLineNumbers ?? EDITOR_CONFIG_DEFAULTS.showLineNumbers,
                wordWrap: wordWrap ?? EDITOR_CONFIG_DEFAULTS.wordWrap,
                fontSize: fontSize ?? EDITOR_CONFIG_DEFAULTS.fontSize,
            };

            this.log('info', `Settings loaded: ${JSON.stringify(this.currentSettings)}`);
        } catch (error) {
            this.log('warn', `Failed to load settings, using defaults: ${error}`);
            this.currentSettings = { ...EDITOR_CONFIG_DEFAULTS };
        }
    }

    /**
     * Get current editor settings.
     * @returns A copy of the current settings
     */
    getSettings(): EditorSettings {
        return { ...this.currentSettings };
    }

    /**
     * Subscribe to settings changes.
     * @param listener - Callback invoked when settings change
     * @returns Unsubscribe function
     */
    subscribeSettings(listener: (settings: EditorSettings) => void): () => void {
        this.settingsListeners.add(listener);
        return () => this.settingsListeners.delete(listener);
    }

    // ========== Public API: File Operations ==========

    /**
     * Open a file and load its content.
     * 
     * This method:
     * 1. Updates status to "Opening..."
     * 2. Reads the file via fs-manager
     * 3. Updates internal state
     * 4. Emits `editor:file-opened` event
     * 5. Updates status to "Ready"
     * 
     * On error:
     * - Logs the error
     * - Shows a dialog to the user
     * - Updates status to "Error"
     * 
     * @param path - Absolute path to the file to open
     * @returns The file content as a string
     * @throws Error if file cannot be read
     * 
     * @example
     * ```typescript
     * try {
     *     const content = await controller.openFile('/vault/note.md');
     *     console.log('Opened file with', content.length, 'characters');
     * } catch (error) {
     *     console.error('Failed to open file');
     * }
     * ```
     */
    async openFile(path: string): Promise<string> {
        this.log('info', `Opening file: ${path}`);
        this.status = 'opening';

        // Extract filename for status message
        const filename = path.split(/[\\/]/).pop() || path;
        this.emitStatusReport('ready', `Opening ${filename}...`);

        try {
            // Read file via fs-manager API
            const content = await this.app.api.invoke('fs:read-text-file', path) as string;

            // Update internal state
            this.currentPath = path;
            this.originalContent = content;
            this.isDirty = false;
            this.status = 'ready';

            this.emitStatusReport('ready', 'Ready');
            this.log('info', `File opened successfully: ${path}`);

            // Emit file opened event for other plugins (and our own UI)
            this.app.events.emit('editor:file-opened', { path, content });

            return content;
        } catch (error) {
            this.status = 'error';
            const errorMessage = error instanceof Error ? error.message : String(error);

            this.log('error', `Failed to open file: ${errorMessage}`);
            this.emitStatusReport('error', `Error: ${errorMessage}`);

            // Show error dialog to user
            try {
                await this.app.api.invoke('dialog:alert', 'Error Opening File', errorMessage);
            } catch {
                // Dialog manager might not be available
            }

            throw error;
        }
    }

    /**
     * Mark the current content as changed.
     * 
     * Called by the UI component on every document change.
     * This method:
     * 1. Sets the dirty flag (if not already dirty)
     * 2. Updates the status bar to "Unsaved changes"
     * 3. Triggers the debounced save
     */
    markDirty(): void {
        if (!this.isDirty) {
            this.isDirty = true;
            this.status = 'ready';
            this.emitStatusReport('ready', 'Unsaved changes');
        }

        // Trigger debounced save
        this.debouncedSave();
    }

    /**
     * Debounced save - waits for user to stop typing before saving.
     * 
     * Clears any existing timer and sets a new one. The actual save
     * will occur after SAVE_DEBOUNCE_MS milliseconds of inactivity.
     * @private
     */
    private debouncedSave(): void {
        // Clear any existing timer
        if (this.saveTimeoutId !== null) {
            clearTimeout(this.saveTimeoutId);
        }

        // Set new timer
        this.saveTimeoutId = setTimeout(() => {
            this.saveFile();
        }, this.SAVE_DEBOUNCE_MS);
    }

    /**
     * Save the current file immediately.
     * 
     * This method:
     * 1. Validates there's a file open and changes to save
     * 2. Clears any pending debounce timer
     * 3. Updates status to "Saving..."
     * 4. Writes the file via fs-manager
     * 5. Updates status to "Saved" then "Ready"
     * 
     * On error:
     * - Logs the error
     * - Shows a dialog to the user
     * - Updates status to "Save failed"
     * 
     * @example
     * ```typescript
     * await controller.saveFile();
     * ```
     */
    async saveFile(): Promise<void> {
        if (!this.currentPath) {
            this.log('warn', 'No file open to save');
            return;
        }

        if (!this.isDirty) {
            this.log('info', 'No changes to save');
            return;
        }

        // Clear any pending debounce timer
        if (this.saveTimeoutId !== null) {
            clearTimeout(this.saveTimeoutId);
            this.saveTimeoutId = null;
        }

        this.status = 'saving';
        this.emitStatusReport('saving', 'Saving...');
        this.log('info', `Saving file: ${this.currentPath}`);

        try {
            const content = this.getCurrentContent();

            // Write file via fs-manager API
            await this.app.api.invoke('fs:write-text-file', this.currentPath, content);

            // Update internal state
            this.originalContent = content;
            this.isDirty = false;
            this.status = 'saved';

            this.emitStatusReport('ready', 'Saved');
            this.log('info', `File saved successfully: ${this.currentPath}`);

            // Emit file saved event for other plugins
            this.app.events.emit('editor:file-saved', { path: this.currentPath });

            // Reset status to "Ready" after a brief moment
            setTimeout(() => {
                if (this.status === 'saved') {
                    this.status = 'ready';
                    this.emitStatusReport('ready', 'Ready');
                }
            }, 2000);

        } catch (error) {
            this.status = 'error';
            const errorMessage = error instanceof Error ? error.message : String(error);

            this.log('error', `Failed to save file: ${errorMessage}`);
            this.emitStatusReport('error', `Save failed: ${errorMessage}`);

            // Show error dialog to user
            try {
                await this.app.api.invoke('dialog:alert', 'Error Saving File', errorMessage);
            } catch {
                // Dialog manager might not be available
            }
        }
    }

    // ========== File Close ==========

    /**
     * Close the current file and clear editor state.
     * 
     * This method:
     * 1. Clears any pending debounce timer
     * 2. Clears file state (path, content, dirty flag)
     * 3. Updates status bar to "No file open"
     * 4. Emits `editor:file-closed` event for UI
     * 
     * Called when the active file is deleted externally.
     */
    closeFile(): void {
        // Clear pending save timer
        if (this.saveTimeoutId !== null) {
            clearTimeout(this.saveTimeoutId);
            this.saveTimeoutId = null;
        }

        // Clear state
        this.currentPath = null;
        this.originalContent = '';
        this.isDirty = false;
        this.status = 'idle';

        // Update status bar
        this.emitStatusReport('ready', 'No file open');

        // Notify UI
        this.app.events.emit('editor:file-closed', {});

        this.log('info', 'File closed');
    }

    // ========== Lifecycle ==========

    /**
     * Dispose the controller and clean up resources.
     * 
     * This method:
     * 1. Clears any pending debounce timer
     * 2. Clears the EditorView reference
     * 3. Resets all state
     * 
     * Called during plugin unload.
     */
    dispose(): void {
        // Unsubscribe from FS events
        this.app.events.off('fs:deleted', this.handleFsDeleted as (payload: unknown) => void);
        this.app.events.off('fs:renamed', this.handleFsRenamed as (payload: unknown) => void);

        // Clear pending save timer
        if (this.saveTimeoutId !== null) {
            clearTimeout(this.saveTimeoutId);
            this.saveTimeoutId = null;
        }

        // Clear references
        this.editorView = null;
        this.currentPath = null;
        this.originalContent = '';
        this.isDirty = false;
        this.status = 'idle';
    }
}
