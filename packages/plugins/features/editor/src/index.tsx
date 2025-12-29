/**
 * @fileoverview Editor Plugin Entry Point
 * 
 * Registers the NotehubEditor component and provides API integration
 * with the Notehub ecosystem.
 * 
 * @module @notehub/editor
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { useNotehub } from '@notehub/core';
import { NotehubEditor } from './components/NotehubEditor';

// ============================================================================
// Demo Content for Testing
// ============================================================================

const DEMO_CONTENT = `# Welcome to Notehub Editor

This is a **live preview** editor with Portal-based widgets.

## Interactive Widgets

Try clicking this button: [[BUTTON::Click Me]]

Here's another one: [[BUTTON::Save Document]]

## How it Works

1. When your cursor is **outside** the button syntax, you see the React widget
2. When your cursor **enters** the range, the widget hides and shows raw text
3. You can edit the label, then move your cursor away to see the updated button

## Navigation

Use arrow keys to navigate - the cursor will skip over widgets atomically.

Try it: Place cursor before [[BUTTON::Test]] and press Right arrow.
`;

// ============================================================================
// Editor Controller Component
// ============================================================================

/**
 * EditorController - Stateful wrapper that handles file loading
 * 
 * This component:
 * - Subscribes to file selection events
 * - Loads file content from fs-manager
 * - Passes content to NotehubEditor
 * - Auto-saves with debounce
 */
const EditorController: React.FC = () => {
    const app = useNotehub();
    const [content, setContent] = useState<string>(DEMO_CONTENT);
    const [currentPath, setCurrentPath] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const pathRef = React.useRef<string | null>(null);
    const isLoadingRef = React.useRef(false); // Ref to prevent saves during loading

    // Keep pathRef in sync with currentPath
    React.useEffect(() => {
        pathRef.current = currentPath;
    }, [currentPath]);

    // Save file content with debounce
    const saveFile = useCallback(async (path: string, newContent: string) => {
        if (!app) return;

        const filename = path.split('/').pop() || path.split('\\').pop() || path;

        try {
            // Emit saving status
            app.events.emit('editor:status-changed', {
                status: 'saving',
                message: `Сохраняю ${filename}...`
            });

            await app.api.invoke('fs:write-text-file', path, newContent);
            console.log(`[Editor] Saved file: ${path}`);

            // Emit saved status
            app.events.emit('editor:status-changed', {
                status: 'ready',
                message: filename
            });
        } catch (error) {
            console.error(`[Editor] Error saving file:`, error);
            app.events.emit('editor:status-changed', {
                status: 'error',
                message: `Ошибка сохранения: ${filename}`
            });
        }
    }, [app]);

    // Load file content
    const loadFile = useCallback(async (path: string) => {
        if (!app) return;

        // Extract filename from path
        const filename = path.split('/').pop() || path.split('\\').pop() || path;

        try {
            setIsLoading(true);
            isLoadingRef.current = true; // Prevent saves during loading

            // Emit loading status
            app.events.emit('editor:status-changed', {
                status: 'loading',
                message: `Открываю ${filename}...`
            });

            // Read file content from fs-manager
            const fileContent = await app.api.invoke('fs:read-text-file', path) as string | null;

            if (fileContent !== null) {
                setContent(fileContent);
                setCurrentPath(path);
                console.log(`[Editor] Loaded file: ${path}, ${fileContent.length} bytes`);

                // Emit ready status with filename
                app.events.emit('editor:status-changed', {
                    status: 'ready',
                    message: filename
                });
            } else {
                console.warn(`[Editor] Failed to read file: ${path}`);
                app.events.emit('editor:status-changed', {
                    status: 'error',
                    message: `Не удалось открыть ${filename}`
                });
            }
        } catch (error) {
            console.error(`[Editor] Error loading file:`, error);
            app.events.emit('editor:status-changed', {
                status: 'error',
                message: `Ошибка: ${filename}`
            });
        } finally {
            setIsLoading(false);
            // Reset loading flag after a small delay to allow React render cycle
            setTimeout(() => {
                isLoadingRef.current = false;
            }, 100);
        }
    }, [app]);

    // Handle content changes with debounced auto-save
    const handleChange = useCallback((newContent: string) => {
        setContent(newContent);

        // Cancel previous save timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Skip saves during file loading to prevent false saves
        if (isLoadingRef.current) {
            console.log('[Editor] Skipping save during file loading');
            return;
        }

        // Only auto-save if we have a current file path
        const path = pathRef.current;
        if (path) {
            const filename = path.split('/').pop() || path.split('\\').pop() || path;

            // Show "modified" status immediately
            app?.events.emit('editor:status-changed', {
                status: 'saving',
                message: `Изменено: ${filename}`
            });

            // BUG-011 fix: Debounced save - read current path at execution time
            // to prevent saving to wrong file if user switches during debounce
            saveTimeoutRef.current = setTimeout(() => {
                const currentPath = pathRef.current;
                if (currentPath) {
                    saveFile(currentPath, newContent);
                }
            }, 500);
        } else {
            console.log('[Editor] No file open, skipping save');
        }
    }, [saveFile, app]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Subscribe to file selection events
    useEffect(() => {
        if (!app) return;

        const handleFileSelected = (payload: unknown) => {
            const { path } = payload as { path: string };
            loadFile(path);
        };

        app.events.on('explorer:file-selected', handleFileSelected);

        return () => {
            app.events.off('explorer:file-selected', handleFileSelected);
        };
    }, [app, loadFile]);

    return (
        <NotehubEditor
            initialContent={content}
            onChange={handleChange}
            className={isLoading ? 'loading' : ''}
        />
    );
};

// ============================================================================
// Plugin Implementation
// ============================================================================

/**
 * EditorPlugin - Core editor functionality for Notehub
 * 
 * Provides:
 * - CodeMirror-based text editing
 * - Portal system for React widget integration
 * - Live Preview of custom syntax
 */
export class EditorPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.editor',
        name: 'Editor',
        version: '0.1.0',
        type: 'feature',
        dependencies: [
            'nh.system.fs-manager',
            'nh.system.logger',
            'nh.ui.theme-manager'
        ]
    };

    private app: NotehubCore | null = null;

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    /**
     * Load the plugin
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading Editor plugin...');

        // Register the EditorController component as a controller
        // It handles file loading internally
        app.api.invoke('controller:register', 'notehub-editor', EditorController);

        // Register in the editor zone
        app.api.invoke('zone:register', 'main.editor', {
            component: 'notehub-editor',
            priority: 100
        });

        this.log('info', 'Editor plugin loaded successfully');
    }

    /**
     * Called after all plugins are loaded
     */
    async onReady(app: NotehubCore): Promise<void> {
        this.log('info', 'Editor plugin ready');
    }

    /**
     * Unload the plugin
     */
    async unload(app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading Editor plugin...');

        // Unregister controller
        app.api.invoke('controller:unregister', 'notehub-editor');

        // Clear zone registration
        app.api.invoke('zone:clear', 'main.editor');

        this.app = null;
        this.log('info', 'Editor plugin unloaded');
    }
}

// ============================================================================
// Exports
// ============================================================================

export { NotehubEditor } from './components/NotehubEditor';
export { PortalProvider, usePortalManager, BridgeWidget } from './bridge';
export { livePreviewExtension, SmartButtonWidget } from './cm';

export default EditorPlugin;
