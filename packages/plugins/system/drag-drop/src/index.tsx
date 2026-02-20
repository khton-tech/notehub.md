/**
 * @fileoverview Drag & Drop Plugin Installer
 */

import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DragController, type DragType } from './logic/DragController.js';
import { DropOverlay } from './components/DropOverlay.js';

// ... (existing code)

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
    private dragType: DragType = 'unknown';
    private pluginIcon: React.ElementType | null = null;
    private markdownIcon: React.ElementType | null = null;
    private unsupportedIcon: React.ElementType | null = null;
    private layersIcon: React.ElementType | null = null;

    protected async onLoad(): Promise<void> {
        // ... (existing code, unchanged logic)
    }

    protected async onPluginReady(): Promise<void> {
        // Skip if not in Tauri
        if (!('__TAURI_INTERNALS__' in window)) {
            return;
        }

        this.log('info', 'Initializing drag & drop...');

        try {
            // Get icons from icon-manager
            this.pluginIcon = await this.app.api.invoke('icon:get', 'plugin-default') as React.ElementType;
            this.markdownIcon = await this.app.api.invoke('icon:get', 'file-text') as React.ElementType;
            this.unsupportedIcon = await this.app.api.invoke('icon:get', 'circle-slash') as React.ElementType;
            this.layersIcon = await this.app.api.invoke('icon:get', 'layers') as React.ElementType;

            // Create overlay container
            this.overlayContainer = document.createElement('div');
            this.overlayContainer.id = 'nh-drag-drop-overlay';
            document.body.appendChild(this.overlayContainer);

            // Create React root for overlay
            this.overlayRoot = createRoot(this.overlayContainer);

            // Initial render (hidden)
            this.renderOverlay();

            // Initialize drag controller with state callback
            this.controller = new DragController(this.app, (isDragging, dragType) => {
                this.isDragging = isDragging;
                this.dragType = dragType;
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
        if (!this.overlayRoot || !this.pluginIcon || !this.markdownIcon || !this.unsupportedIcon || !this.layersIcon) {
            return;
        }
        this.overlayRoot.render(
            createElement(DropOverlay, {
                isDragging: this.isDragging,
                dragType: this.dragType,
                PluginIcon: this.pluginIcon,
                MarkdownIcon: this.markdownIcon,
                UnsupportedIcon: this.unsupportedIcon,
                LayersIcon: this.layersIcon,
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
        this.dragType = 'unknown';
        this.pluginIcon = null;
        this.markdownIcon = null;
        this.unsupportedIcon = null;
        this.layersIcon = null;

        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default DragDropPlugin;
