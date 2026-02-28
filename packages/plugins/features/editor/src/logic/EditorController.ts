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



    /** 
     * The latest content pushed from the UI.
     * This is the SINGLE SOURCE OF TRUTH for saving.
     */
    private lastKnownContent: string = '';

    /** Whether content has been modified since last save */
    private isDirty: boolean = false;

    /** Current editor status for status bar integration */
    private status: EditorStatus = 'idle';

    // ========== CodeMirror Integration ==========

    /** EditorView reference for programmatic access */
    private editorView: EditorView | null = null;

    // ========== Debounce Configuration ==========

    /** Timer ID for debounced save */
    private saveTimeoutId: ReturnType<typeof setTimeout> | null = null;

    /** 
     * Flag to indicate content is being loaded programmatically.
     * When true, markDirty() is skipped to prevent saving old content.
     */
    private isLoadingContent: boolean = false;

    /**
     * Map of active file open promises.
     * Used to deduplicate concurrent requests for the same file.
     */
    private activeOpens: Map<string, Promise<string>> = new Map();

    // ========== Settings State ==========

    /** Current editor settings from config-manager */
    private currentSettings: EditorSettings = { ...EDITOR_CONFIG_DEFAULTS };

    /** Listeners for settings changes (UI re-render trigger) */
    private settingsListeners: Set<(settings: EditorSettings) => void> = new Set();



    // ========== Bound Event Handlers (for unsubscription) ==========

    // Bound handler for fs:deleted events
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

    // Getters for UI state initialization
    public get activePath(): string | null { return this.currentPath; }

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

    // ⚡ FIX B1: Bound handlers for config events (for cleanup in dispose)
    private readonly handleConfigUpdated = (payload: unknown): void => {
        const { key, value } = payload as { key: string; value: unknown };
        if (key.startsWith('editor.')) {
            this.handleSettingChange(key, value);
        }
    };

    private readonly handleConfigReloaded = (): void => {
        this.log('info', 'Config reloaded, refreshing editor settings...');
        this.loadSettings();
        // Try to restore file if not already open
        if (!this.currentPath) {
            this.restoreLastFile();
        }
    };

    /**
     * Create a new EditorController
     * @param app - The NotehubCore instance for API and event access
     */
    constructor(app: NotehubCore) {
        this.app = app;

        // Subscribe to config changes (using bound methods for cleanup)
        this.app.events.on('config:updated', this.handleConfigUpdated);
        this.app.events.on('config:reloaded', this.handleConfigReloaded);

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
        this.app.events.emit('app:status-report', report as any);
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
            case EDITOR_CONFIG_KEYS.TAB_SIZE:
                if (typeof value === 'number') {
                    this.currentSettings.tabSize = value;
                    changed = true;
                }
                break;
            case EDITOR_CONFIG_KEYS.AUTO_CLOSE_BRACKETS:
                if (typeof value === 'boolean') {
                    this.currentSettings.autoCloseBrackets = value;
                    changed = true;
                }
                break;
            case EDITOR_CONFIG_KEYS.FONT_FAMILY:
                if (typeof value === 'string') {
                    this.currentSettings.fontFamily = value;
                    changed = true;
                }
                break;
            case EDITOR_CONFIG_KEYS.FORMAT_ON_SAVE:
                if (typeof value === 'boolean') {
                    this.currentSettings.formatOnSave = value;
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
     * Get the current CodeMirror EditorView reference.
     * @returns The EditorView instance or null if not mounted
     */
    getEditorView(): EditorView | null {
        return this.editorView;
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
     * @returns The last known content buffer
     */
    getCurrentContent(): string {
        return this.lastKnownContent;
    }

    /**
     * Check if there are unsaved changes
     * @returns true if content has been modified since last save
     */
    getIsDirty(): boolean {
        return this.isDirty;
    }

    /**
     * Signal that content is being loaded programmatically (not user edit).
     * Call this before dispatching content to CodeMirror on file switch.
     */
    beginContentLoad(): void {
        this.isLoadingContent = true;
    }

    /**
     * Signal that content loading is complete.
     * Call this after dispatching content to CodeMirror.
     */
    endContentLoad(): void {
        this.isLoadingContent = false;
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
            const tabSize = await this.app.api.invoke<number>(
                'config:get',
                EDITOR_CONFIG_KEYS.TAB_SIZE,
                EDITOR_CONFIG_DEFAULTS.tabSize
            );
            const autoCloseBrackets = await this.app.api.invoke<boolean>(
                'config:get',
                EDITOR_CONFIG_KEYS.AUTO_CLOSE_BRACKETS,
                EDITOR_CONFIG_DEFAULTS.autoCloseBrackets
            );
            const fontFamily = await this.app.api.invoke<string>(
                'config:get',
                EDITOR_CONFIG_KEYS.FONT_FAMILY,
                EDITOR_CONFIG_DEFAULTS.fontFamily
            );
            const formatOnSave = await this.app.api.invoke<boolean>(
                'config:get',
                EDITOR_CONFIG_KEYS.FORMAT_ON_SAVE,
                EDITOR_CONFIG_DEFAULTS.formatOnSave
            );
            this.currentSettings = {
                showLineNumbers: showLineNumbers ?? EDITOR_CONFIG_DEFAULTS.showLineNumbers,
                wordWrap: wordWrap ?? EDITOR_CONFIG_DEFAULTS.wordWrap,
                fontSize: fontSize ?? EDITOR_CONFIG_DEFAULTS.fontSize,
                tabSize: tabSize ?? EDITOR_CONFIG_DEFAULTS.tabSize,
                autoCloseBrackets: autoCloseBrackets ?? EDITOR_CONFIG_DEFAULTS.autoCloseBrackets,
                fontFamily: fontFamily ?? EDITOR_CONFIG_DEFAULTS.fontFamily,
                formatOnSave: formatOnSave ?? EDITOR_CONFIG_DEFAULTS.formatOnSave,
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
        // Guard against duplicate opens of the same file
        if (this.currentPath === path) {
            this.log('info', `File already open, skipping reload: ${path}`);
            return this.lastKnownContent;
        }

        // ⚡ FIX A1: Flush pending save BEFORE switching files
        // This prevents race condition where debounced save overwrites new file
        if (this.isDirty && this.currentPath) {
            this.log('info', `Flushing unsaved changes before switching: ${this.currentPath}`);
            await this.saveFile();
        }

        // Return existing promise if file is already being opened (Promise Lock)
        if (this.activeOpens.has(path)) {
            this.log('info', `Joining existing open request for: ${path}`);
            return this.activeOpens.get(path)!;
        }

        const openPromise = (async () => {
            this.log('info', `Opening file: ${path}`);
            this.status = 'opening';

            // Extract filename for status message
            const filename = path.split(/[\\/]/).pop() || path;
            this.emitStatusReport('ready', `Opening ${filename}...`);

            try {
                // Read file via fs-manager API
                const content = await this.app.api.invoke('fs:read-text-file', path) as string;

                // Sync source of truth IMMEDIATELY after load, before any await
                this.currentPath = path;
                this.lastKnownContent = content;
                this.isDirty = false;
                this.status = 'ready';

                this.emitStatusReport('ready', 'Ready');
                this.log('info', `File opened successfully: ${path}`);

                // Emit file opened event for other plugins (and our own UI)
                this.app.events.emit('editor:file-opened', { path, content });

                // Update title bar with file name
                const fileTitle = filename.replace('.md', '');
                this.app.api.invoke('titlebar:set-title', fileTitle);
                this.app.api.invoke('titlebar:set-icon', 'file-text');

                // Persist last opened file
                this.app.api.invoke('config:set', 'editor.last-opened', path).catch(err => {
                    this.log('warn', `Failed to save last opened file: ${err}`);
                });

                return content;
            } catch (error) {
                this.status = 'error';
                const errorMessage = error instanceof Error ? error.message : String(error);

                this.log('error', `Failed to open file: ${errorMessage}`);
                this.emitStatusReport('error', `Error: ${errorMessage}`);

                // Show error dialog to user
                try {
                    await this.app.api.invoke('dialog:alert', 'Error Opening File', errorMessage);
                } catch (dialogError) {
                    // Dialog manager might not be available
                    this.log('warn', `Failed to show dialog: ${dialogError}`);
                }

                throw error;
            } finally {
                // Clear the promise from map so future opens can proceed fresh
                this.activeOpens.delete(path);
            }
        })();

        this.activeOpens.set(path, openPromise);
        return openPromise;
    }


    /**
     * Update the known content state.
     * Called by the UI component when content changes.
     * 
     * @param content - The new content string
     */
    updateContent(content: string): void {
        this.lastKnownContent = content;
        this.markDirty();
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
        // Skip if we're programmatically loading content (file switch, not user edit)
        if (this.isLoadingContent) {
            this.log('info', 'Skipping markDirty during content load');
            return;
        }

        if (!this.isDirty) {
            this.isDirty = true;
            this.status = 'ready';
            this.emitStatusReport('ready', 'Unsaved changes');
        }

        this.debouncedSave();
    }

    /**
     * Debounced save - waits for user to stop typing before saving.
     * 
     * Clears any existing timer and sets a new one. The actual save
     * will occur after autosaveDelay milliseconds of inactivity.
     * @private
     */
    private debouncedSave(): void {
        // Clear any existing timer
        if (this.saveTimeoutId !== null) {
            clearTimeout(this.saveTimeoutId);
        }

        this.saveTimeoutId = setTimeout(() => {
            this.saveFile();
        }, 1000);
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

        // Use lastKnownContent as the source of truth
        const contentToSave = this.lastKnownContent;
        this.log('info', `Saving file: ${this.currentPath} (Length: ${contentToSave.length})`);

        try {
            // Write file via fs-manager API
            await this.app.api.invoke('fs:write-text-file', this.currentPath, contentToSave);

            // Update internal state
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
            } catch (dialogError) {
                // Dialog manager might not be available
                this.log('warn', `Failed to show dialog: ${dialogError}`);
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
    /**
     * Resets internal file state without emitting any events.
     * Called when an external source (e.g. tab bar) has already emitted
     * `editor:file-closed` and we only need to clear the controller state
     * so that `openFile()` doesn't treat the path as "already open".
     */
    resetCurrentFile(): void {
        if (this.saveTimeoutId !== null) {
            clearTimeout(this.saveTimeoutId);
            this.saveTimeoutId = null;
        }
        this.currentPath = null;
        this.lastKnownContent = '';
        this.isDirty = false;
        this.status = 'idle';
    }

    closeFile(): void {
        // Clear pending save timer
        if (this.saveTimeoutId !== null) {
            clearTimeout(this.saveTimeoutId);
            this.saveTimeoutId = null;
        }

        this.currentPath = null;
        this.lastKnownContent = '';
        this.isDirty = false;
        this.status = 'idle';

        // Update status bar
        this.emitStatusReport('ready', 'No file open');

        // Reset title bar
        this.app.api.invoke('titlebar:set-title', 'Notehub');
        this.app.api.invoke('titlebar:set-icon', null);

        // Notify UI
        this.app.events.emit('editor:file-closed', {});

        // Clear persisted state
        this.app.api.invoke('config:delete', 'editor.last-opened').catch(err => {
            this.log('warn', `Failed to clear last opened file: ${err}`);
        });

        this.log('info', 'File closed');
    }

    // ========== Lifecycle ==========

    /**
     * Restore the last opened file upon startup.
     */
    async restoreLastFile(): Promise<void> {
        try {
            const lastPath = await this.app.api.invoke('config:get', 'editor.last-opened') as string | undefined;
            if (lastPath) {
                const exists = await this.app.api.invoke('fs:exists', lastPath) as boolean;
                if (exists) {
                    this.log('info', `Restoring last opened file: ${lastPath}`);
                    await this.openFile(lastPath);
                } else {
                    this.log('warn', `Last opened file not found: ${lastPath}`);
                    await this.app.api.invoke('config:delete', 'editor.last-opened');
                }
            }
        } catch (error) {
            this.log('warn', `Failed to restore last file: ${error}`);
        }
    }

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

        // ⚡ FIX B1: Unsubscribe from config events
        this.app.events.off('config:updated', this.handleConfigUpdated);
        this.app.events.off('config:reloaded', this.handleConfigReloaded);

        // Clear pending save timer
        if (this.saveTimeoutId !== null) {
            clearTimeout(this.saveTimeoutId);
            this.saveTimeoutId = null;
        }

        // Clear references
        this.currentPath = null;
        this.lastKnownContent = '';
        this.isDirty = false;
        this.status = 'idle';
        this.activeOpens.clear();
    }
}


