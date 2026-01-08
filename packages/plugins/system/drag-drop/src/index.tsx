/**
 * @fileoverview Drag & Drop Plugin Installer
 * 
 * System plugin that enables users to install .nhp plugins by dragging
 * them onto the application window. Shows a beautiful overlay during
 * drag operations and handles the installation flow.
 * 
 * Dependencies:
 * - nh.ui.icon-manager - For plugin-default icon
 * - nh.ui.dialog-manager - For confirmation/alert dialogs
 * - nh.system.fs-manager - For file operations
 * - nh.system.synapse - For loading installed plugins
 */

import type { IPlugin, PluginManifest, NotehubCore } from '@notehub/core';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DragController } from './logic/DragController.js';
import { DropOverlay } from './components/DropOverlay.js';

// Declare Tauri global for type checking (Tauri v2 uses __TAURI_INTERNALS__)
declare global {
    interface Window {
        __TAURI_INTERNALS__?: unknown;
    }
}

/**
 * DragDropPlugin - Drag & Drop installer for .nhp plugins
 * 
 * Lifecycle:
 * 1. `load()`: Skip if not in Tauri environment
 * 2. `onReady()`: Initialize drag controller and render overlay
 * 3. `unload()`: Stop controller and cleanup UI
 */
export class DragDropPlugin implements IPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.drag-drop',
        name: 'DragDropInstaller',
        version: '0.0.0',
        type: 'system',
    };

    private app: NotehubCore | null = null;
    private controller: DragController | null = null;
    private overlayRoot: Root | null = null;
    private overlayContainer: HTMLDivElement | null = null;
    private isDragging: boolean = false;
    private iconComponent: React.ElementType | null = null;

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        if (this.app) {
            this.app.api.invoke(`logger:${level}`, this.manifest.id, message);
        }
    }

    /**
     * Load the plugin - minimal setup, main work in onReady
     */
    async load(app: NotehubCore): Promise<void> {
        this.app = app;
        this.log('info', 'Loading...');

        // Skip if not in Tauri environment (Tauri v2 uses __TAURI_INTERNALS__)
        if (!('__TAURI_INTERNALS__' in window)) {
            this.log('info', 'Not in Tauri environment, skipping initialization');
            return;
        }

        this.log('info', 'Loaded - will initialize on ready');
    }

    /**
     * Called after all plugins are loaded - initialize drag handling
     */
    async onReady(app: NotehubCore): Promise<void> {
        // Skip if not in Tauri
        if (!('__TAURI_INTERNALS__' in window)) {
            return;
        }

        this.log('info', 'Initializing drag & drop...');

        try {
            // Get the plugin-default icon from icon-manager
            this.iconComponent = await app.api.invoke('icon:get', 'plugin-default') as React.ElementType;

            // Create overlay container
            this.overlayContainer = document.createElement('div');
            this.overlayContainer.id = 'nh-drag-drop-overlay';
            document.body.appendChild(this.overlayContainer);

            // Create React root for overlay
            this.overlayRoot = createRoot(this.overlayContainer);

            // Initial render (hidden)
            this.renderOverlay();

            // Initialize drag controller with state callback
            this.controller = new DragController(app, (isDragging) => {
                this.isDragging = isDragging;
                this.renderOverlay();
            });

            // Start listening for drag events
            await this.controller.start();

            this.log('info', 'Drag & drop ready');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log('error', `Failed to initialize: ${errorMessage}`);
        }
    }

    /**
     * Render the overlay with current state
     */
    private renderOverlay(): void {
        if (!this.overlayRoot || !this.iconComponent) {
            return;
        }

        this.overlayRoot.render(
            createElement(DropOverlay, {
                isDragging: this.isDragging,
                IconComponent: this.iconComponent,
            })
        );
    }

    /**
     * Unload the plugin and cleanup
     */
    async unload(_app: NotehubCore): Promise<void> {
        this.log('info', 'Unloading...');

        // Stop the drag controller
        this.controller?.stop();
        this.controller = null;

        // Unmount overlay
        this.overlayRoot?.unmount();
        this.overlayRoot = null;

        // Remove overlay container
        this.overlayContainer?.remove();
        this.overlayContainer = null;

        // Clear state
        this.isDragging = false;
        this.iconComponent = null;

        this.log('info', 'Unloaded');
        this.app = null;
    }
}

// Default export for dynamic loading
export default DragDropPlugin;
