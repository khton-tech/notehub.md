/**
 * Context Menu Plugin
 *
 * Global context menu system that allows plugins to register menu providers
 * for specific contexts and trigger menus via the API.
 *
 * API Methods:
 * - `context-menu:register(contextId, provider)` - Register a menu provider
 * - `context-menu:trigger(event, contextId, payload)` - Trigger a context menu
 */

import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';
import { createRoot, type Root } from 'react-dom/client';
import { contextMenuRegistry } from './logic/ContextMenuRegistry';
import { ContextMenu } from './components/ContextMenu';
import type { MenuItem, MenuProvider, ContextMenuState } from './types';

// Re-export types for external use
export type { MenuItem, MenuAction, MenuSeparator, SubMenu, MenuProvider } from './types';

/**
 * ContextMenuPlugin - Global context menu system
 *
 * Provides a centralized context menu that other plugins can extend
 * by registering menu providers for specific contexts.
 *
 * @example
 * ```ts
 * // Register a provider for explorer items
 * const unsubscribe = app.api.invoke('context-menu:register', 'explorer-item', (payload) => [
 *     { type: 'action', id: 'open', label: 'Open', icon: 'file-text', onClick: () => open(payload.path) },
 *     { type: 'separator' },
 *     { type: 'action', id: 'delete', label: 'Delete', icon: 'trash-2', color: 'var(--nh-danger)', onClick: () => delete(payload.path) },
 * ]);
 *
 * // Trigger the menu on right-click
 * element.addEventListener('contextmenu', (event) => {
 *     app.api.invoke('context-menu:trigger', event, 'explorer-item', { path: '/path/to/file.md' });
 * });
 * ```
 */
export class ContextMenuPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.ui.context-menu',
        name: 'ContextMenu',
        version: '1.0.0',
        type: 'ui',
    };

    private menuContainer: HTMLDivElement | null = null;
    private menuRoot: Root | null = null;

    /** Bound reference for global context menu handler (for cleanup) */
    private boundGlobalHandler: ((e: MouseEvent) => void) | null = null;

    /** Current menu state */
    private menuState: ContextMenuState = {
        visible: false,
        position: { x: 0, y: 0 },
        items: [],
        payload: null,
    };

    /**
     * Render the context menu with current state
     */
    private renderMenu(): void {
        if (!this.menuRoot) return;

        this.menuRoot.render(
            <ContextMenu
                state={this.menuState}
                onClose={() => this.closeMenu()}
            />
        );
    }

    /**
     * Close the context menu
     */
    private closeMenu(): void {
        this.menuState = {
            ...this.menuState,
            visible: false,
            items: [],
            payload: null,
        };
        this.renderMenu();
    }

    /**
     * Show the context menu at the specified position with items
     */
    private async showMenu(x: number, y: number, items: MenuItem[], payload: any): Promise<void> {
        this.menuState = {
            visible: true,
            position: { x, y },
            items,
            payload,
        };
        this.renderMenu();
    }

    // =============== API Handlers ===============

    /**
     * Handle context-menu:register API call
     *
     * @param contextId - Context identifier (e.g., 'explorer-item')
     * @param provider - Menu provider function
     * @returns Unsubscribe function
     */
    private handleRegister = (contextId: string, provider: MenuProvider): (() => void) => {
        this.log('info', `Registering provider for context: ${contextId}`);
        return contextMenuRegistry.register(contextId, provider);
    };

    /**
     * Handle context-menu:trigger API call
     *
     * @param event - The original contextmenu event
     * @param contextId - Context identifier
     * @param payload - Contextual data to pass to providers
     */
    private handleTrigger = async (
        event: MouseEvent,
        contextId: string,
        payload: any
    ): Promise<void> => {
        // Prevent default browser context menu
        event.preventDefault();
        event.stopPropagation();

        // Close any existing menu
        this.closeMenu();

        // Check if any providers are registered
        if (!contextMenuRegistry.hasProviders(contextId)) {
            this.log('warn', `No providers registered for context: ${contextId}`);
            return;
        }

        // Get items from all providers
        const items = await contextMenuRegistry.getItems(contextId, payload);

        if (items.length === 0) {
            this.log('info', `No items returned for context: ${contextId}`);
            return;
        }

        // Show menu at cursor position
        await this.showMenu(event.clientX, event.clientY, items, payload);
        this.log('info', `Opened context menu for: ${contextId} with ${items.length} items`);
    };

    // =============== Plugin Lifecycle ===============

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Clear any existing providers from previous load (handles React StrictMode double-init)
        contextMenuRegistry.clear();

        // Create menu container
        this.menuContainer = document.createElement('div');
        this.menuContainer.id = 'nh-context-menu-container';
        document.body.appendChild(this.menuContainer);
        this.menuRoot = createRoot(this.menuContainer);


        // Global contextmenu handler - prevents native WebView context menu everywhere
        // Uses capture phase to intercept before any element handlers
        this.boundGlobalHandler = (e: MouseEvent) => {
            // Always prevent the native browser/WebView context menu
            e.preventDefault();

            // If we have a menu open, close it on right-click elsewhere
            if (this.menuState.visible) {
                this.closeMenu();
            }
        };

        document.addEventListener('contextmenu', this.boundGlobalHandler, true);
        this.log('info', 'Installed global context menu interceptor');

        // Register API methods with explicit handler types
        this.registerApi('context-menu:register' as any, this.handleRegister as any);
        this.registerApi('context-menu:trigger' as any, this.handleTrigger as any);

        this.log('info', 'Registered API methods: register, trigger');
        this.log('info', 'Loaded successfully');
    }


    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        // Remove global context menu interceptor
        if (this.boundGlobalHandler) {
            document.removeEventListener('contextmenu', this.boundGlobalHandler, true);
            this.boundGlobalHandler = null;
        }

        // Close any open menu
        this.closeMenu();

        // Cleanup DOM
        if (this.menuRoot) {
            this.menuRoot.unmount();
            this.menuRoot = null;
        }
        if (this.menuContainer) {
            this.menuContainer.remove();
            this.menuContainer = null;
        }

        // Clear registry
        contextMenuRegistry.clear();

        this.log('info', 'Unloaded');
    }

}

// Default export for dynamic loading
export default ContextMenuPlugin;
