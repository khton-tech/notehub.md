/**
 * @fileoverview Docbar Plugin - Editor Toolbar
 * 
 * Demonstrates the Sovereign Architecture plugin system by:
 * 1. Using ctx.unsafe.createPortal() to inject UI at editor bottom
 * 2. Using editor:get-selection API to get cursor/selection position
 * 3. Using ctx.unsafe.getActiveEditorView() to manipulate editor content
 */

import { createRoot } from 'react-dom/client';
import type { EditorView } from '@codemirror/view';

/**
 * Plugin context interface (from @notehub.md/api)
 */
interface PluginContext {
    registerApi(name: string, handler: (...args: unknown[]) => unknown): void;
    invokeApi<T = unknown>(name: string, ...args: unknown[]): Promise<T>;
    subscribe<T = unknown>(event: string, handler: (payload: T) => void): void;
    readonly unsafe: {
        readonly window: Window;
        readonly app: unknown;
        getActiveEditorView(): EditorView | null;
        createPortal(selector: string, position?: 'prepend' | 'append'): HTMLElement | null;
    };
}

interface Selection {
    from: number;
    to: number;
}

/**
 * Docbar toolbar component
 */
function DocbarToolbar({
    ctx,
    log
}: {
    ctx: PluginContext;
    log: (msg: string) => void;
}) {
    const handleBoldClick = async () => {
        try {
            // Get selection from editor API (reliable, persisted)
            const { from, to } = await ctx.invokeApi<Selection>('editor:get-selection');
            log(`Selection: from=${from}, to=${to}`);

            const view = ctx.unsafe.getActiveEditorView();
            if (!view) {
                log('No active editor view');
                return;
            }

            if (from === to) {
                // No selection: insert **|**
                log('No selection, inserting ****');
                await ctx.invokeApi('editor:insert-content', '****', {
                    from,
                    anchor: from + 2
                });
            } else {
                // Has selection: wrap with **text**
                const text = view.state.sliceDoc(from, to);
                log(`Wrapping "${text}" with **`);
                await ctx.invokeApi('editor:insert-content', `**${text}**`, {
                    from,
                    to,
                    anchor: from + text.length + 4
                });
            }
        } catch (error) {
            log(`Error: ${error}`);
        }
    };

    return (
        <div className="docbar-container">
            <button
                className="docbar-button"
                onClick={handleBoldClick}
                title="Bold (Wrap with **)"
            >
                <strong>B</strong>
            </button>
        </div>
    );
}

/**
 * NotehubPlugin class implementation
 */
export class DocbarPlugin {
    private container: HTMLElement | null = null;
    private root: ReturnType<typeof createRoot> | null = null;
    private ctx: PluginContext | null = null;
    private portalCreated = false;
    private retryTimer: ReturnType<typeof setInterval> | null = null;
    private retryCount = 0;
    private readonly MAX_RETRIES = 50;

    /**
     * Log helper using logger API
     */
    private log = (message: string): void => {
        console.log(`[Docbar] ${message}`);
        this.ctx?.invokeApi('logger:info', 'ext.docbar', message).catch(() => { });
    };

    /**
     * Try to create the portal container with retry logic
     */
    private tryCreatePortal(): boolean {
        if (this.portalCreated || !this.ctx) {
            return true;
        }

        this.container = this.ctx.unsafe.createPortal('[data-nh-portal="editor"]', 'append');

        if (!this.container) {
            this.retryCount++;
            if (this.retryCount >= this.MAX_RETRIES) {
                this.log('Max retries reached, giving up on portal creation');
                this.stopRetrying();
                return false;
            }
            return false;
        }

        this.portalCreated = true;
        this.stopRetrying();

        this.container.className = 'docbar-portal';

        this.root = createRoot(this.container);
        this.root.render(
            <DocbarToolbar ctx={this.ctx} log={this.log} />
        );

        this.log('Portal created successfully!');
        return true;
    }

    private startRetrying(): void {
        if (this.retryTimer) return;

        this.retryTimer = setInterval(() => {
            if (this.tryCreatePortal()) {
                this.stopRetrying();
            }
        }, 100);
    }

    private stopRetrying(): void {
        if (this.retryTimer) {
            clearInterval(this.retryTimer);
            this.retryTimer = null;
        }
    }

    async onload(ctx: PluginContext): Promise<void> {
        this.log('Loading...');
        this.ctx = ctx;

        ctx.subscribe('editor:file-opened', () => {
            if (!this.portalCreated) {
                this.tryCreatePortal();
            }
        });

        this.startRetrying();
        this.log('Loaded - polling for editor...');
    }

    async onunload(): Promise<void> {
        this.log('Unloading...');

        this.stopRetrying();

        if (this.root) {
            this.root.unmount();
            this.root = null;
        }

        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.container = null;
        }

        this.portalCreated = false;
        this.ctx = null;
        this.log('Unloaded');
    }
}

export default new DocbarPlugin();
