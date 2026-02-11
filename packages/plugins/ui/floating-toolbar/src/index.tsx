/**
 * Floating Toolbar Plugin
 *
 * A floating formatting toolbar that appears when text is selected.
 * Provides quick access to formatting commands like Bold, Italic, Code, and Link.
 *
 * API Methods:
 * - `floating-toolbar:show(x, y)` - Show toolbar at position
 * - `floating-toolbar:hide` - Hide toolbar
 * - `floating-toolbar:toggle` - Toggle toolbar visibility
 */

import React from 'react';
import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { createRoot, type Root } from 'react-dom/client';
import { FloatingToolbar } from './components/FloatingToolbar.js';

// Re-export component for external use
export { FloatingToolbar } from './components/FloatingToolbar.js';

/**
 * State of the toolbar
 */
export interface ToolbarState {
    visible: boolean;
    position: { x: number; y: number };
    selectedText: string;
}

/**
 * FloatingToolbarPlugin - Floating formatting toolbar
 *
 * Shows a toolbar above selected text with formatting buttons.
 * Uses the command system to apply formatting.
 */
export class FloatingToolbarPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.floating-toolbar',
        name: 'FloatingToolbar',
        version: '0.0.1',
        type: 'ui',
    };

    private toolbarContainer: HTMLDivElement | null = null;
    private toolbarRoot: Root | null = null;
    private boundSelectionHandler: ((e: Event) => void) | null = null;
    private boundMouseUpHandler: ((e: MouseEvent) => void) | null = null;

    /** Current toolbar state */
    private state: ToolbarState = {
        visible: false,
        position: { x: 0, y: 0 },
        selectedText: '',
    };

    /**
     * Render the toolbar with current state
     */
    private renderToolbar(): void {
        if (!this.toolbarRoot) return;

        this.toolbarRoot.render(
            <FloatingToolbar
                state={this.state}
                onAction={(command: string) => this.handleAction(command)}
            />
        );
    }

    /**
     * Show the toolbar at the specified position
     */
    private showToolbar(x: number, y: number, text: string): void {
        this.state = {
            visible: true,
            position: { x, y },
            selectedText: text,
        };
        this.renderToolbar();
        this.log('info', `Toolbar shown at (${x}, ${y})`);
    }

    /**
     * Hide the toolbar
     */
    private hideToolbar(): void {
        if (!this.state.visible) return;

        this.state = {
            ...this.state,
            visible: false,
            selectedText: '',
        };
        this.renderToolbar();
    }

    /**
     * Handle toolbar button action
     */
    private handleAction(command: string): void {
        this.log('info', `Executing command: ${command}`);

        // Execute the command via API
        this.app?.api.invoke('command:execute', command);
    }

    /**
     * Handle text selection change
     */
    private handleSelectionChange = (): void => {
        const selection = window.getSelection();

        // Debug logging
        this.log('info', `Selection event: ${selection?.toString()?.substring(0, 50) || '(empty)'}, collapsed: ${selection?.isCollapsed}`);

        if (!selection || selection.isCollapsed) {
            // No selection, hide toolbar
            this.hideToolbar();
            return;
        }

        const text = selection.toString().trim();
        if (text.length === 0) {
            this.hideToolbar();
            return;
        }

        // Get selection position
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Position toolbar above selection
        const x = rect.left + rect.width / 2;
        const y = rect.top - 10; // 10px above

        this.showToolbar(x, y, text);
    };

    /**
     * Debounced selection handler (only triggers after mouse up)
     */
    private handleMouseUp = (): void => {
        // Small delay to ensure selection is complete
        setTimeout(() => {
            this.handleSelectionChange();
        }, 10);
    };

    // =============== API Handlers ===============

    /**
     * Show toolbar API handler
     */
    private handleShow = (x: number, y: number): void => {
        const selection = window.getSelection();
        const text = selection?.toString() ?? '';
        this.showToolbar(x, y, text);
    };

    /**
     * Hide toolbar API handler
     */
    private handleHide = (): void => {
        this.hideToolbar();
    };

    /**
     * Toggle toolbar API handler
     */
    private handleToggle = (): void => {
        if (this.state.visible) {
            this.hideToolbar();
        } else {
            this.handleSelectionChange();
        }
    };

    // =============== Plugin Lifecycle ===============

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Create toolbar container
        this.toolbarContainer = document.createElement('div');
        this.toolbarContainer.id = 'nh-floating-toolbar-container';
        document.body.appendChild(this.toolbarContainer);
        this.toolbarRoot = createRoot(this.toolbarContainer);

        // Initial render
        this.renderToolbar();

        // Listen for mouseup to detect selection changes
        this.boundMouseUpHandler = this.handleMouseUp;
        document.addEventListener('mouseup', this.boundMouseUpHandler);

        // Listen for selection changes (for keyboard selection)
        this.boundSelectionHandler = this.handleSelectionChange;
        document.addEventListener('selectionchange', this.boundSelectionHandler);

        // Close toolbar on click outside
        document.addEventListener('mousedown', (e) => {
            if (this.state.visible && this.toolbarContainer) {
                if (!this.toolbarContainer.contains(e.target as Node)) {
                    // Allow selection, don't hide immediately
                }
            }
        });

        // Register API methods
        this.registerApi('floating-toolbar:show' as any, this.handleShow as any);
        this.registerApi('floating-toolbar:hide' as any, this.handleHide as any);
        this.registerApi('floating-toolbar:toggle' as any, this.handleToggle as any);

        this.log('info', 'Registered API methods: show, hide, toggle');
        this.log('info', 'Loaded successfully');
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        // Remove event listeners
        if (this.boundMouseUpHandler) {
            document.removeEventListener('mouseup', this.boundMouseUpHandler);
            this.boundMouseUpHandler = null;
        }
        if (this.boundSelectionHandler) {
            document.removeEventListener('selectionchange', this.boundSelectionHandler);
            this.boundSelectionHandler = null;
        }

        // Hide toolbar
        this.hideToolbar();

        // Cleanup DOM
        if (this.toolbarRoot) {
            this.toolbarRoot.unmount();
            this.toolbarRoot = null;
        }
        if (this.toolbarContainer) {
            this.toolbarContainer.remove();
            this.toolbarContainer = null;
        }

        this.log('info', 'Unloaded');
    }
}

// Default export for dynamic loading
export default FloatingToolbarPlugin;
