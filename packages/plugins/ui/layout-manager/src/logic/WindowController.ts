import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import type { NotehubCore } from '@notehub/core';

interface WindowBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class WindowController {
    private app: NotehubCore;
    private saveTimeout: NodeJS.Timeout | null = null;
    private readonly DEBOUNCE_MS = 500;
    private unlisteners: Array<() => void> = [];

    constructor(app: NotehubCore) {
        this.app = app;
    }

    /**
     * Initialize listeners and restore state
     */
    async init(): Promise<void> {
        await this.restore();
        await this.startListening();
    }

    /**
     * Clean up listeners
     */
    async destroy(): Promise<void> {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Unlisten tauri events
        for (const unlisten of this.unlisteners) {
            unlisten();
        }
        this.unlisteners = [];
    }

    /**
     * Restore window position and size from config
     */
    /**
     * Restore window position and size from config
     */
    private async restore(): Promise<void> {
        try {
            this.app.api.invoke('logger:info', 'layout-manager', 'Attempting to restore window bounds...');
            const bounds = await this.app.api.invoke('config:get', 'window.bounds') as WindowBounds | undefined;

            if (bounds) {
                this.app.api.invoke('logger:info', 'layout-manager', `Restoring bounds: ${JSON.stringify(bounds)}`);
                const win = getCurrentWindow();

                // Restore position
                if (typeof bounds.x === 'number' && typeof bounds.y === 'number') {
                    await win.setPosition(new LogicalPosition(bounds.x, bounds.y));
                }

                // Restore size
                if (typeof bounds.width === 'number' && typeof bounds.height === 'number') {
                    await win.setSize(new LogicalSize(bounds.width, bounds.height));
                }
            } else {
                this.app.api.invoke('logger:info', 'layout-manager', 'No saved window bounds found.');
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.app.api.invoke('logger:warn', 'layout-manager', `Failed to restore window bounds: ${msg}`);
        }
    }

    /**
     * Start listening to window events
     */
    private async startListening(): Promise<void> {
        const win = getCurrentWindow();

        const handleUpdate = () => {
            this.scheduleSave();
        };

        const unlistenMove = await win.onMoved(handleUpdate);
        const unlistenResize = await win.onResized(handleUpdate);

        this.unlisteners.push(unlistenMove, unlistenResize);
    }

    /**
     * Schedule a save operation (debounced)
     */
    private scheduleSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            this.saveBounds();
        }, this.DEBOUNCE_MS);
    }

    /**
     * Save current bounds to config
     */
    private async saveBounds(): Promise<void> {
        try {
            const win = getCurrentWindow();
            const position = await win.innerPosition();
            const size = await win.innerSize();
            const factor = await win.scaleFactor();

            const logicalPos = position.toLogical(factor);
            const logicalSize = size.toLogical(factor);

            const bounds: WindowBounds = {
                x: logicalPos.x,
                y: logicalPos.y,
                width: logicalSize.width,
                height: logicalSize.height
            };

            await this.app.api.invoke('config:set', 'window.bounds', bounds);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.app.api.invoke('logger:warn', 'layout-manager', `Failed to save window state: ${msg}`);
        }
    }
}
