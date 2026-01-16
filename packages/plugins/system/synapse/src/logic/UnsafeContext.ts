/**
 * @fileoverview Unsafe Context Implementation (God Mode)
 * @module nh.system.synapse
 * 
 * RFC-010 Wave 3: Provides direct access to platform internals for plugins
 * that need low-level control over the editor and application.
 * 
 * WARNING: APIs exposed through UnsafeContext may change without notice.
 * Plugins using this API should be prepared for breakage on core updates.
 */

import { EditorView } from '@codemirror/view';
import type { NotehubCore } from '@notehub/core';

/**
 * Unsafe Context interface - "God Mode" API for plugins.
 * 
 * Provides direct access to:
 * - Global `window` object for native browser/Electron APIs
 * - Root `app` instance for internal services
 * - Active CodeMirror EditorView for direct editor manipulation
 * 
 * @example
 * ```ts
 * export async function onload(ctx: PluginContext) {
 *     // Access the active editor
 *     const view = ctx.unsafe.getActiveEditorView();
 *     if (view) {
 *         // Insert text at cursor
 *         view.dispatch({
 *             changes: { from: view.state.selection.main.head, insert: "Hello!" }
 *         });
 *     }
 * }
 * ```
 */
export interface UnsafeContext {
    /**
     * Direct access to the global Window object.
     * Allows access to localStorage, IndexedDB, Electron IPC, etc.
     */
    readonly window: Window;

    /**
     * Reference to the root application controller.
     * Provides access to internal services like Router, ThemeManager.
     * 
     * @remarks Type is `any` to allow flexibility as internal APIs evolve.
     */
    readonly app: NotehubCore;

    /**
     * Get the currently active CodeMirror EditorView instance.
     * 
     * Uses DOM traversal to find the editor's internal view reference.
     * Returns null if no editor is currently mounted/active.
     * 
     * @returns The active EditorView or null if not available
     * 
     * @remarks
     * The view is obtained via the `.cmView` property on CodeMirror's
     * content DOM element. This is an internal CM6 property but is
     * reliably present in non-minified builds.
     */
    getActiveEditorView(): EditorView | null;

    /**
     * Create a container element for React portal injection.
     * Allows plugins to inject UI anywhere in the application.
     * 
     * @param selector - CSS selector for target container
     * @param position - 'prepend' or 'append' (default: 'prepend')
     * @returns Created container element, or null if target not found
     */
    createPortal(selector: string, position?: 'prepend' | 'append'): HTMLElement | null;
}

/**
 * Implementation of UnsafeContext.
 * Instantiated by PluginLoader for each external plugin.
 * 
 * @internal
 */
export class UnsafeContextImpl implements UnsafeContext {
    private readonly _app: NotehubCore;

    constructor(app: NotehubCore) {
        this._app = app;
    }

    get window(): Window {
        return globalThis.window;
    }

    get app(): NotehubCore {
        return this._app;
    }

    /**
     * Get the active EditorView via the editor plugin's API.
     * 
     * This uses the `editor:get-view` API registered by the editor plugin,
     * which returns the EditorView stored in EditorController.
     */
    getActiveEditorView(): EditorView | null {
        try {
            // Check if the editor:get-view API is registered
            if (!this._app.api.has('editor:get-view')) {
                // Editor plugin not loaded yet
                return null;
            }

            // Access the handler directly for synchronous result
            // The handler is synchronous: () => controller?.getEditorView() ?? null
            const handlers = (this._app.api as any).handlers as Map<string, (...args: unknown[]) => unknown>;
            const handler = handlers.get('editor:get-view');

            if (!handler) {
                return null;
            }

            // Call the handler directly (it's synchronous)
            const view = handler() as EditorView | null;

            if (view) {
                // Verify it's the correct type using instanceof
                // This check confirms our Shared Runtime (ScopeInitializer) is working
                if (view instanceof EditorView) {
                    return view;
                } else {
                    // If this triggers, Shared Runtime is broken (Dual Package Hazard)
                    console.error(
                        '[UnsafeContext] Critical: EditorView instanceof check failed.',
                        'This indicates a Dual Package Hazard - plugin and core have different @codemirror/view instances.',
                        { expectedConstructor: EditorView.name, actualConstructor: (view as object)?.constructor?.name }
                    );
                    // Return anyway, but operations requiring correct prototype chain may fail
                    return view as EditorView;
                }
            }

            // No view available (editor not mounted or no file open)
            return null;
        } catch (e) {
            console.warn('[UnsafeContext] Error getting EditorView:', e);
            return null;
        }
    }

    /**
     * Create a container element for React portal injection.
     * 
     * This allows external plugins to inject UI anywhere in the application
     * by creating a container element inside the specified target.
     * 
     * @param selector - CSS selector for target container
     * @param position - 'prepend' (before first child) or 'append' (after last child)
     * @returns Created container element, or null if target not found
     */
    createPortal(selector: string, position: 'prepend' | 'append' = 'prepend'): HTMLElement | null {
        try {
            const target = document.querySelector(selector);
            if (!target) {
                console.warn(`[UnsafeContext] Portal target not found: ${selector}`);
                return null;
            }

            // Create container element for the portal
            const container = document.createElement('div');
            container.dataset.nhPortal = 'true';
            // Note: Do not set display:contents as it prevents the container from being visible

            if (position === 'prepend') {
                target.insertBefore(container, target.firstChild);
            } else {
                target.appendChild(container);
            }

            return container;
        } catch (e) {
            console.warn('[UnsafeContext] Error creating portal:', e);
            return null;
        }
    }
}
