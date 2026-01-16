/**
 * Docbar Plugin
 * 
 * @module ext.docbar
 * 
 * Demonstrates Wave 4: Dynamic Portal API
 * Toolbar with BOLD button that:
 * - Wraps selected text in **
 * - Inserts ** | ** if no selection
 */

import { NotehubPlugin, PluginContext } from '@notehub.md/api';
import type { EditorView } from '@codemirror/view';

// Store last known cursor position
let lastSelection: { from: number; to: number } | null = null;
let cachedView: EditorView | null = null;

class ExtDocbarPlugin extends NotehubPlugin {
    private portalContainer: HTMLElement | null = null;
    private observer: MutationObserver | null = null;
    private selectionInterval: ReturnType<typeof setInterval> | null = null;

    async onload(ctx: PluginContext): Promise<void> {
        console.log('[Docbar] Plugin loaded!');

        // Try to create portal immediately or wait for editor to appear
        if (!this.tryInitPortal(ctx)) {
            // Use MutationObserver to wait for editor element
            this.observer = new MutationObserver(() => {
                if (this.tryInitPortal(ctx)) {
                    this.observer?.disconnect();
                    this.observer = null;
                }
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
        }

        // Cache selection periodically while editor has focus
        this.selectionInterval = setInterval(() => {
            const view = (ctx as any).unsafe?.getActiveEditorView?.() as EditorView | null;
            if (view && view.hasFocus) {
                cachedView = view;
                lastSelection = {
                    from: view.state.selection.main.from,
                    to: view.state.selection.main.to
                };
            }
        }, 100);
    }

    private tryInitPortal(ctx: PluginContext): boolean {
        if (this.portalContainer) { // Already initialized
            return true;
        }

        // Check if target exists before trying to create portal
        const target = document.querySelector('[data-nh-portal="editor"]');
        if (!target) {
            return false;
        }

        // Use Portal API to inject into editor area
        const container = (ctx as any).unsafe.createPortal(
            '[data-nh-portal="editor"]',
            'prepend'
        );

        if (!container) {
            console.warn('[Docbar] Could not create portal - editor not ready');
            return false;
        }

        this.portalContainer = container;

        // Style the container
        this.portalContainer.style.cssText = `
            display: block !important;
            width: 100%;
            flex-shrink: 0;
            position: relative;
            z-index: 10;
        `;

        this.renderPortalContent(ctx);
        return true;
    }

    private renderPortalContent(ctx: PluginContext): void {
        if (!this.portalContainer) {
            console.warn('[Docbar] Portal container not available for rendering.');
            return;
        }

        // Render the toolbar
        this.portalContainer.innerHTML = `
            <div style="
                padding: 6px 12px;
                background-color: var(--nh-bg-surface, #2a2a2a);
                border-bottom: 1px solid var(--nh-border-subtle, #333);
                display: flex;
                gap: 4px;
                align-items: center;
            ">
                <button id="docbar-bold-btn" title="Bold (Ctrl+B)" style="
                    padding: 4px 10px;
                    background-color: var(--nh-bg-secondary, #333);
                    border: 1px solid var(--nh-border-subtle, #444);
                    border-radius: 4px;
                    color: var(--nh-text-primary, #e0e0e0);
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 13px;
                ">B</button>
                <span style="
                    color: var(--nh-text-muted, #666);
                    font-size: 11px;
                    margin-left: 8px;
                ">Docbar (Portal API)</span>
            </div>
        `;

        // Attach event handler - use mousedown to prevent focus loss
        const btn = this.portalContainer.querySelector('#docbar-bold-btn');
        if (btn) {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent focus from leaving editor
                this.handleBold();
            });
        }

        console.log('[Docbar] Portal mounted successfully!');
    }

    private handleBold(): void {
        console.log('[Docbar] Bold button clicked!');
        console.log('[Docbar] Cached selection:', lastSelection);
        console.log('[Docbar] Cached view:', cachedView);

        if (!cachedView || !lastSelection) {
            console.warn('[Docbar] No cached selection available');
            return;
        }

        const { from, to } = lastSelection;

        if (from === to) {
            // No selection - insert template
            const template = '**  **';
            cachedView.dispatch({
                changes: { from, insert: template },
                selection: { anchor: from + 3 }
            });
        } else {
            // Wrap selection with **
            const selectedText = cachedView.state.sliceDoc(from, to);
            const wrapped = `**${selectedText}**`;
            cachedView.dispatch({
                changes: { from, to, insert: wrapped },
                selection: { anchor: from + 2, head: from + 2 + selectedText.length }
            });
        }

        cachedView.focus();
        console.log('[Docbar] Bold applied at position', from);
    }

    async onunload(): Promise<void> {
        console.log('[Docbar] Plugin unloaded!');

        // Clean up interval
        if (this.selectionInterval) {
            clearInterval(this.selectionInterval);
            this.selectionInterval = null;
        }

        // Clean up observer
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // Clean up portal
        if (this.portalContainer && this.portalContainer.parentNode) {
            this.portalContainer.parentNode.removeChild(this.portalContainer);
        }
        this.portalContainer = null;

        // Clear cache
        lastSelection = null;
        cachedView = null;
    }
}

export default new ExtDocbarPlugin();
