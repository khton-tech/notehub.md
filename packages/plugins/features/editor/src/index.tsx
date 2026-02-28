/**
 * @fileoverview Editor Plugin Entry Point
 *
 * This is the main entry point for the @notehub/editor plugin.
 * It wires up the EditorController, UI component, and event listeners,
 * then registers the editor as the 'editor-main' controller for use
 * in the EditorLayout.
 *
 * ## Architecture
 *
 * The editor plugin follows the Notehub microkernel architecture:
 * - **Controller**: `EditorController` manages file I/O and state
 * - **View**: `NotehubEditor` wraps CodeMirror 6 with theme integration
 * - **Events**: Uses EventBus for all inter-plugin communication
 *
 * ## Events Consumed
 * - `explorer:file-selected` - When user clicks a file in the explorer
 *
 * ## Events Emitted
 * - `editor:file-opened` - When a file is successfully opened
 * - `app:status-report` - Status updates for the status bar
 *
 * ## Dependencies
 * - `nh.system.fs-manager` - File read/write operations
 * - `nh.system.logger` - Logging
 * - `nh.ui.controllers-manager` - Controller registration
 * - `nh.ui.dialog-manager` - Error dialogs
 * - `nh.ui.icon-manager` - Icon components
 * - `nh.ui.theme-manager` - Theme CSS variables
 *
 * @module @notehub/editor
 * @author Notehub Team
 * @version 0.0.1
 */

import { useState, useEffect } from 'react';
import { SystemPlugin } from '@notehub/core';
import type { PluginManifest, NotehubCore, FileTypeHandler } from '@notehub/core';
import { Icon } from '@notehub/icon-manager';
import { EditorController } from './logic/EditorController';
import { NotehubEditor } from './components/NotehubEditor';
import { registerEditorSettings, type EditorSettings } from './logic/EditorConfig';
import { PortalRegistry } from './cm/portals/PortalRegistry';
import type { PortalSpec } from './cm/portals/types';
import { EditorPortalRenderer } from './bridge';
import en from './locales/en';
import ru from './locales/ru';


/**
 * Payload structure for file selection events
 * @internal
 */
interface FileSelectionPayload {
    /** Absolute path to the selected file */
    path: string;
}

/**
 * Payload structure for file opened events
 * @internal
 */
interface FileOpenedPayload {
    /** Absolute path to the opened file */
    path: string;
    /** File content as string */
    content: string;
}

/**
 * Creates the editor slot component with proper event subscriptions.
 *
 * This factory function creates a React component that:
 * 1. Subscribes to `editor:file-opened` events
 * 2. Displays a placeholder when no file is open
 * 3. Renders the NotehubEditor when a file is loaded
 *
 * @param controller - The EditorController instance for file operations
 * @param app - The NotehubCore instance for event subscriptions
 * @returns A React component to be registered as 'editor-main'
 *
 * @example
 * ```typescript
 * const EditorSlotComponent = createEditorSlotComponent(controller, app);
 * app.api.invoke('controller:register', 'editor-main', EditorSlotComponent);
 * ```
 */
function createEditorSlotComponent(controller: EditorController, app: NotehubCore) {
    /**
     * EditorSlotWrapper - The actual React component that renders in the main area
     */
    return function EditorSlotWrapper() {
        const [content, setContent] = useState<string>(() => controller.getCurrentContent());
        const [filePath, setFilePath] = useState<string | null>(() => controller.activePath);
        const [settings, setSettings] = useState<EditorSettings>(() => controller.getSettings());

        useEffect(() => {
            /**
             * Handler for file opened events (internal communication from controller)
             * Updates state to trigger re-render with new file content
             */
            const handleFileOpened = (payload: unknown) => {
                const data = payload as FileOpenedPayload;
                setFilePath(data.path);
                setContent(data.content);
            };

            /**
             * Handler for file closed events (when file is deleted externally)
             * Resets state to show placeholder
             */
            const handleFileClosed = () => {
                setFilePath(null);
                setContent('');
            };

            // Subscribe to editor events from the EventBus
            app.events.on('editor:file-opened', handleFileOpened);
            app.events.on('editor:file-closed', handleFileClosed);

            // Subscribe to settings changes
            const unsubscribeSettings = controller.subscribeSettings(setSettings);

            // Cleanup subscriptions on unmount
            return () => {
                app.events.off('editor:file-opened', handleFileOpened);
                app.events.off('editor:file-closed', handleFileClosed);
                unsubscribeSettings();
            };
        }, []);

        // If no file is open, show a placeholder with instructions
        if (!filePath) {
            return (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        width: '100%',
                        color: 'var(--nh-text-muted, #666)',
                        backgroundColor: 'var(--nh-bg-main, #1a1a1a)',
                        fontSize: '14px',
                        userSelect: 'none',
                    }}
                >
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '16px', opacity: 0.3 }}>
                            <Icon name="file-text" size={48} />
                        </div>
                        <div>Select a file to begin editing</div>
                    </div>
                </div>
            );
        }

        // Render the CodeMirror editor with current file content
        return (
            <NotehubEditor
                app={app}
                controller={controller}
                content={content}
                filePath={filePath}
                settings={settings}
            />
        );
    };
}

/**
 * EditorPlugin - Main plugin class for the Notehub Markdown Editor
 *
 * This plugin provides the core editing functionality for Notehub.md,
 * wrapping CodeMirror 6 in the microkernel architecture.
 *
 * ## Lifecycle
 *
 * 1. **load**: Creates controller, registers UI component, subscribes to events
 * 2. **unload**: Cleans up event handlers, unregisters components, disposes controller
 *
 * ## Registration
 *
 * The plugin registers a React component as 'editor-main' which is rendered
 * by the EditorLayout in the main content area.
 *
 * @extends {SystemPlugin}
 */
export class EditorPlugin extends SystemPlugin {
    /**
     * Plugin manifest defining identity and dependencies
     * @readonly
     */
    readonly manifest: PluginManifest = {
        id: 'nh.features.editor',
        name: 'Editor',
        version: '0.0.1',
        type: 'feature',
        dependencies: [
            'nh.system.fs-manager',
            'nh.system.logger',
            'nh.ui.controllers-manager',
            'nh.ui.dialog-manager',
            'nh.ui.icon-manager',
            'nh.ui.theme-manager',
            'nh.system.i18n'
        ]
    };

    /** EditorController instance managing file state */
    private controller: EditorController | null = null;

    /** Registered file type handlers */
    private fileTypeHandlers: Map<string, FileTypeHandler> = new Map();

    /**
     * Handler for file selection events from the explorer plugin.
     *
     * This method:
     * 1. Extracts the file path from the event payload
     * 2. Validates the file is a markdown file (.md)
     * 3. Delegates to the controller to open the file
     *
     * @param payload - Event payload containing the file path
     * @private
     */
    private handleFileSelected = async (payload: unknown): Promise<void> => {
        if (!this.controller) return;

        // Extract path from payload (supports both string and object formats)
        let path: string | undefined;
        if (typeof payload === 'string') {
            path = payload;
        } else if (payload && typeof payload === 'object' && 'path' in payload) {
            path = (payload as FileSelectionPayload).path;
        }

        if (!path) {
            this.log('warn', 'File selected event received without path');
            return;
        }

        // Check if any registered handler supports this file type
        if (!this.canOpenFile(path)) {
            this.log('info', `No handler registered for: ${path}`);
            return;
        }

        try {
            await this.controller.openFile(path);
        } catch (error) {
            // Error already handled by controller (logged + dialog shown)
        }
    };

    /**
     * Find the best handler for a given file path by extension.
     * Returns the highest-priority handler whose extensions match.
     */
    private getHandlerForFile(filePath: string): FileTypeHandler | null {
        const lower = filePath.toLowerCase();
        let best: FileTypeHandler | null = null;
        for (const handler of this.fileTypeHandlers.values()) {
            if (handler.extensions.some((ext: string) => lower.endsWith(ext))) {
                if (!best || (handler.priority ?? 0) > (best.priority ?? 0)) {
                    best = handler;
                }
            }
        }
        return best;
    }

    /**
     * Check if a file path is supported by any registered handler.
     */
    private canOpenFile(filePath: string): boolean {
        return this.getHandlerForFile(filePath) !== null;
    }

    /**
     * Initialize the plugin.
     *
     * This method:
     * 1. Creates the EditorController for file operations
     * 2. Creates and registers the editor UI component
     * 3. Subscribes to file selection events from the explorer
     */
    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Register the default markdown handler
        this.fileTypeHandlers.set('markdown', {
            id: 'markdown',
            name: 'Markdown Editor',
            extensions: ['.md', '.markdown', '.mdx'],
            priority: 0,
        });

        // Register file type handler APIs
        this.registerApi('editor:register-handler', (handler: FileTypeHandler) => {
            if (!handler?.id || !handler.extensions?.length) {
                this.log('warn', 'Invalid file type handler');
                return;
            }
            this.fileTypeHandlers.set(handler.id, handler);
            this.log('info', `Registered file type handler: ${handler.id} (${handler.extensions.join(', ')})`);
        });

        this.registerApi('editor:unregister-handler', (handlerId: string) => {
            if (this.fileTypeHandlers.delete(handlerId)) {
                this.log('info', `Unregistered file type handler: ${handlerId}`);
            }
        });

        this.registerApi('editor:get-handler', (filePath: string) => {
            return this.getHandlerForFile(filePath);
        });

        this.registerApi('editor:list-handlers', () => {
            return Array.from(this.fileTypeHandlers.values());
        });

        this.registerApi('editor:can-open', (filePath: string) => {
            return this.canOpenFile(filePath);
        });

        // Update settings string translations on language change
        this.registerEvent('i18n:language-changed', async () => {
            await registerEditorSettings(this.app);
        });

        // Register translations
        this.app.api.invoke('i18n:register-namespace', 'editor', { en: en.editor, ru: ru.editor });

        // Register settings with settings-manager for UI
        await registerEditorSettings(this.app);

        // Create the controller for managing file state and operations
        this.controller = new EditorController(this.app);

        // Load settings from config-manager
        try {
            await this.controller.loadSettings();
        } catch (error) {
            this.log('warn', `Failed to load settings (using defaults): ${error}`);
        }

        // Restore last opened file
        // We don't await this to avoid blocking the UI render
        this.controller.restoreLastFile();

        // Create the slot component with controller in closure
        const EditorSlotComponent = createEditorSlotComponent(this.controller, this.app);

        // Register the UI component as 'editor-main' for EditorLayout to render
        this.app.api.invoke('controller:register', 'editor-main', EditorSlotComponent);

        // Register the singleton Portal Renderer (to be placed in EditorLayout root)
        this.app.api.invoke('controller:register', 'editor-portal-renderer', EditorPortalRenderer);

        // === Event Subscription via EventBus ===
        // Listen for file selection events from the explorer plugin
        this.registerEvent('explorer:file-selected', this.handleFileSelected);

        // When the tab bar closes all tabs it emits editor:file-closed directly
        // (without going through EditorController.closeFile). Reset internal state
        // so that openFile() doesn't skip reopening the same path next time.
        this.registerEvent('editor:file-closed', () => {
            this.controller?.resetCurrentFile();
        });

        // Register API for Portals (replacing dynamic widgets)
        this.registerApi('editor:register-portal', (spec: PortalSpec) => {
            // Validate incoming spec
            if (!spec || !spec.id || !spec.component) {
                this.log('warn', 'Invalid portal spec registered');
                return;
            }

            // Convert string regex to RegExp if needed (for JSON-based plugins)
            let regex = spec.regex;
            if (typeof regex === 'string') {
                try {
                    // Start simplified: assume basic regex string, or full pattern?
                    // Usually JSON passes string. Let's assume it might need parsing if it comes from JSON.
                    // For now, let's just use the object references as requested by the user.
                    // User said: "If spec.regex comes as a string ... convert it ... But preferably ... accept raw objects"
                    // So we trust it's a RegExp or convertible.
                    regex = new RegExp(regex);
                } catch (e) {
                    this.log('warn', `Invalid regex for portal ${spec.id}: ${e}`);
                    return;
                }
            }

            // Normalize
            const safeSpec: PortalSpec = {
                ...spec,
                regex: regex
            };

            PortalRegistry.getInstance().register(safeSpec);
            this.log('info', `Registered portal: ${spec.id}`);
        });

        // Register API for unregistering portals
        this.registerApi('editor:unregister-portal', (id: string) => {
            PortalRegistry.getInstance().unregister(id);
            this.log('info', `Unregistered portal: ${id}`);
        });

        // Register API for checking dirty state (used by titlebar on close)
        this.registerApi('editor:is-dirty', () => {
            return this.controller?.getIsDirty() ?? false;
        });

        // Register API for opening files (used by Backlinks/WikiLinks)
        this.registerApi('editor:open', async (path: unknown) => {
            if (typeof path === 'string' && this.controller) {
                await this.controller.openFile(path);
            }
        });

        // Register API for getting active path
        this.registerApi('editor:get-active-path', () => {
            return this.controller?.getCurrentPath() ?? null;
        });

        // =====================================================================
        // NEW Editor API: Text Manipulation
        // =====================================================================

        // Get full document content
        this.registerApi('editor:get-content', () => {
            return this.controller?.getCurrentContent() ?? '';
        });

        // Set full document content
        this.registerApi('editor:set-content', (content: unknown) => {
            const view = this.controller?.getEditorView();
            if (view && typeof content === 'string') {
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: content }
                });
            }
        });

        // Get current selection text
        this.registerApi('editor:get-selection', () => {
            const view = this.controller?.getEditorView();
            if (!view) return '';
            const { from, to } = view.state.selection.main;
            return view.state.sliceDoc(from, to);
        });

        // Replace current selection with text
        this.registerApi('editor:replace-selection', (text: unknown) => {
            const view = this.controller?.getEditorView();
            if (view && typeof text === 'string') {
                view.dispatch(view.state.replaceSelection(text));
            }
        });

        // Insert text at cursor
        this.registerApi('editor:insert-text', (text: unknown) => {
            const view = this.controller?.getEditorView();
            if (view && typeof text === 'string') {
                const pos = view.state.selection.main.head;
                view.dispatch({
                    changes: { from: pos, insert: text },
                    selection: { anchor: pos + text.length }
                });
            }
        });

        // Get specific line content (0-indexed)
        this.registerApi('editor:get-line', (lineNumber: unknown) => {
            const view = this.controller?.getEditorView();
            if (!view || typeof lineNumber !== 'number') return '';
            const doc = view.state.doc;
            if (lineNumber < 0 || lineNumber >= doc.lines) return '';
            return doc.line(lineNumber + 1).text; // CodeMirror uses 1-indexed lines
        });

        // Get total line count
        this.registerApi('editor:get-line-count', () => {
            const view = this.controller?.getEditorView();
            return view?.state.doc.lines ?? 0;
        });

        // =====================================================================
        // NEW Editor API: Cursor Control
        // =====================================================================

        // Get cursor position
        this.registerApi('editor:get-cursor', () => {
            const view = this.controller?.getEditorView();
            if (!view) return { line: 0, ch: 0 };
            const pos = view.state.selection.main.head;
            const line = view.state.doc.lineAt(pos);
            return { line: line.number - 1, ch: pos - line.from }; // Convert to 0-indexed
        });

        // Set cursor position
        this.registerApi('editor:set-cursor', (pos: unknown) => {
            const view = this.controller?.getEditorView();
            if (!view || !pos || typeof pos !== 'object') return;
            const { line, ch } = pos as { line?: number; ch?: number };
            if (typeof line !== 'number' || typeof ch !== 'number') return;
            const doc = view.state.doc;
            const lineNum = Math.max(1, Math.min(doc.lines, line + 1)); // Clamp and convert to 1-indexed
            const lineObj = doc.line(lineNum);
            const offset = Math.max(0, Math.min(lineObj.length, ch));
            const absPos = lineObj.from + offset;
            view.dispatch({ selection: { anchor: absPos } });
        });

        // Get selection range
        this.registerApi('editor:get-selection-range', () => {
            const view = this.controller?.getEditorView();
            if (!view) return { from: { line: 0, ch: 0 }, to: { line: 0, ch: 0 } };
            const { from, to } = view.state.selection.main;
            const fromLine = view.state.doc.lineAt(from);
            const toLine = view.state.doc.lineAt(to);
            return {
                from: { line: fromLine.number - 1, ch: from - fromLine.from },
                to: { line: toLine.number - 1, ch: to - toLine.from }
            };
        });

        // Set selection range
        this.registerApi('editor:set-selection-range', (range: unknown) => {
            const view = this.controller?.getEditorView();
            if (!view || !range || typeof range !== 'object') return;
            const { from, to } = range as { from?: { line?: number; ch?: number }; to?: { line?: number; ch?: number } };
            if (!from || !to) return;
            const doc = view.state.doc;

            const getAbsPos = (pos: { line?: number; ch?: number }) => {
                if (typeof pos.line !== 'number' || typeof pos.ch !== 'number') return 0;
                const lineNum = Math.max(1, Math.min(doc.lines, pos.line + 1));
                const lineObj = doc.line(lineNum);
                return lineObj.from + Math.max(0, Math.min(lineObj.length, pos.ch));
            };

            view.dispatch({ selection: { anchor: getAbsPos(from), head: getAbsPos(to) } });
        });

        // =====================================================================
        // NEW Editor API: Unsafe / Advanced
        // =====================================================================

        // Get direct CodeMirror EditorView access
        this.registerApi('editor:unsafe_get-view', () => {
            return this.controller?.getEditorView() ?? null;
        });


        // === Command Registration (context-aware) ===
        // Register save command only active when editor is focused
        this.app.api.invoke('command:register', {
            id: 'editor:save',
            name: 'Save File',
            handler: async () => {
                if (this.controller) {
                    await this.controller.saveFile();
                }
            },
            areas: ['palette', 'global'],
            context: 'editor',
            defaultHotkey: 'Mod+S',
        });

        this.log('info', 'Loaded successfully');
    }

    /**
     * Cleanup the plugin.
     *
     * This method ensures proper lifecycle hygiene:
     * 1. Unregisters the controller component
     * 2. Disposes the controller (clears timers, state)
     *
     * Note: API unregistration and event cleanup are handled automatically
     * by SystemPlugin's cleanup mechanism.
     */
    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        // Unregister the controller component from the registry
        this.app.api.invoke('controller:unregister', 'editor-main');
        this.app.api.invoke('controller:unregister', 'editor-portal-renderer');

        // Dispose controller (clears debounce timers, internal state)
        if (this.controller) {
            this.controller.dispose();
            this.controller = null;
        }

        this.log('info', 'Unloaded - all listeners cleaned up');
    }
}

export default EditorPlugin;
