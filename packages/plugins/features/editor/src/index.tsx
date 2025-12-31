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
import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { Icon } from '@notehub/icon-manager';
import { EditorController } from './logic/EditorController';
import { NotehubEditor } from './components/NotehubEditor';
import type { EditorSettings } from './logic/EditorConfig';

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
        const [content, setContent] = useState<string>('');
        const [filePath, setFilePath] = useState<string | null>(null);
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

            // Subscribe to editor:file-opened events from the EventBus
            app.events.on('editor:file-opened', handleFileOpened);

            // Subscribe to settings changes
            const unsubscribeSettings = controller.subscribeSettings(setSettings);

            // Cleanup subscriptions on unmount
            return () => {
                app.events.off('editor:file-opened', handleFileOpened);
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
 * @implements {IPlugin}
 */
export class EditorPlugin implements IPlugin {
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
            'nh.ui.theme-manager'
        ]
    };

    /** Reference to the NotehubCore instance */
    private app: NotehubCore | null = null;

    /** EditorController instance managing file state */
    private controller: EditorController | null = null;

    /**
     * Event cleanup functions for lifecycle hygiene.
     * Called during unload to prevent memory leaks.
     * @private
     */
    private eventCleanups: Array<() => void> = [];

    /**
     * Log a message via the Logger plugin
     * @param level - Log level (info, warn, error)
     * @param message - Message to log
     * @private
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

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

        // Only open markdown files - other file types are ignored
        if (!path.endsWith('.md')) {
            this.log('info', `Ignoring non-markdown file: ${path}`);
            return;
        }

        try {
            await this.controller.openFile(path);
        } catch (error) {
            // Error already handled by controller (logged + dialog shown)
        }
    };

    /**
     * Initialize the plugin.
     * 
     * This method:
     * 1. Creates the EditorController for file operations
     * 2. Creates and registers the editor UI component
     * 3. Subscribes to file selection events from the explorer
     * 
     * @param app - The NotehubCore instance
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Create the controller for managing file state and operations
        this.controller = new EditorController(app);

        // Load settings from config-manager
        await this.controller.loadSettings();

        // Create the slot component with controller in closure
        const EditorSlotComponent = createEditorSlotComponent(this.controller, app);

        // Register the UI component as 'editor-main' for EditorLayout to render
        app.api.invoke('controller:register', 'editor-main', EditorSlotComponent);

        // === Event Subscription via EventBus ===
        // Listen for file selection events from the explorer plugin
        app.events.on('explorer:file-selected', this.handleFileSelected);
        this.eventCleanups.push(() => app.events.off('explorer:file-selected', this.handleFileSelected));

        this.log('info', 'Loaded successfully');
    }

    /**
     * Cleanup the plugin.
     * 
     * This method ensures proper lifecycle hygiene:
     * 1. Unsubscribes all event handlers
     * 2. Unregisters the controller component
     * 3. Disposes the controller (clears timers, state)
     * 4. Clears all references
     * 
     * @param app - The NotehubCore instance
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // 1. Unsubscribe all event handlers to prevent memory leaks
        for (const cleanup of this.eventCleanups) {
            try {
                cleanup();
            } catch (error) {
                this.log('warn', `Error during event cleanup: ${error}`);
            }
        }
        this.eventCleanups = [];

        // 2. Unregister the controller component from the registry
        app.api.invoke('controller:unregister', 'editor-main');

        // 3. Dispose controller (clears debounce timers, internal state)
        if (this.controller) {
            this.controller.dispose();
            this.controller = null;
        }

        // 4. Clear app reference
        this.app = null;

        this.log('info', 'Unloaded - all listeners cleaned up');
    }
}

export default EditorPlugin;
