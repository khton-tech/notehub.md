/**
 * @fileoverview Drag & Drop Plugin Installer
 */

import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
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
 */
export class DragDropPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.drag-drop',
        name: 'DragDropInstaller',
        version: '0.0.0',
        type: 'system',
    };

    private controller: DragController | null = null;
    private overlayRoot: Root | null = null;
    private overlayContainer: HTMLDivElement | null = null;
    private isDragging: boolean = false;
    private iconComponent: React.ElementType | null = null;

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Skip if not in Tauri environment
        if (!('__TAURI_INTERNALS__' in window)) {
            this.log('info', 'Not in Tauri environment, skipping initialization');
            return;
        }

        this.log('info', 'Loaded - will initialize on ready');
    }

    protected async onPluginReady(): Promise<void> {
        // Skip if not in Tauri
        if (!('__TAURI_INTERNALS__' in window)) {
            return;
        }

        this.log('info', 'Initializing drag & drop...');

        try {
            // Get the plugin-default icon from icon-manager
            this.iconComponent = await this.app.api.invoke('icon:get', 'plugin-default') as React.ElementType;

            // Create overlay container
            this.overlayContainer = document.createElement('div');
            this.overlayContainer.id = 'nh-drag-drop-overlay';
            document.body.appendChild(this.overlayContainer);

            // Create React root for overlay
            this.overlayRoot = createRoot(this.overlayContainer);

            // Initial render (hidden)
            this.renderOverlay();

            // Initialize drag controller with state callback
            this.controller = new DragController(this.app, (isDragging) => {
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

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        this.controller?.stop();
        this.controller = null;

        this.overlayRoot?.unmount();
        this.overlayRoot = null;

        this.overlayContainer?.remove();
        this.overlayContainer = null;

        this.isDragging = false;
        this.iconComponent = null;

        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default DragDropPlugin;
