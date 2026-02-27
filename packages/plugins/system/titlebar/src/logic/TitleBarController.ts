/**
 * @fileoverview TitleBar Controller
 * 
 * Manages the state of the custom title bar and provides methods
 * for window control operations via Tauri API.
 * 
 * @module @notehub/titlebar
 */

import type { NotehubCore } from '@notehub/core';

// Declare Tauri global for type checking
declare global {
    interface Window {
        __TAURI_INTERNALS__?: unknown;
    }
}

/**
 * State of the title bar
 */
interface TitleBarState {
    title: string;
    icon: string | null;
    isMaximized: boolean;
    isDirty: boolean;  // ⚡ FIX E1: Track unsaved changes
}

/**
 * Subscriber callback type
 */
type StateSubscriber = (state: TitleBarState) => void;

/**
 * TitleBarController - Manages title bar state and window controls
 * 
 * Provides:
 * - State management for title and icon
 * - Window control methods (minimize, maximize, close)
 * - Subscriber pattern for UI updates
 */
export class TitleBarController {
    private app: NotehubCore;
    private state: TitleBarState = {
        title: 'Notehub',
        icon: null,
        isMaximized: false,
        isDirty: false,  // ⚡ FIX E1
    };
    private subscribers = new Set<StateSubscriber>();
    private tauriWindow: any = null;
    private dirtyCheckInterval: ReturnType<typeof setInterval> | null = null;  // ⚡ FIX E1

    constructor(app: NotehubCore) {
        this.app = app;
    }

    /**
     * Initialize the controller - load Tauri window API
     */
    async init(): Promise<void> {
        if (!this.isTauri()) {
            return;
        }

        try {
            // Dynamic import of Tauri window API
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            this.tauriWindow = getCurrentWindow();

            // Get initial maximized state
            this.state.isMaximized = await this.tauriWindow.isMaximized();

            // ⚡ FIX E1: Poll dirty state from editor
            if (this.dirtyCheckInterval) {
                clearInterval(this.dirtyCheckInterval);
            }
            this.dirtyCheckInterval = setInterval(async () => {
                try {
                    const isDirty = await this.app.api.invoke<boolean>('editor:is-dirty');
                    if (this.state.isDirty !== isDirty) {
                        this.state.isDirty = isDirty;
                        this.notifySubscribers();
                    }
                } catch { /* editor not ready yet */ }
            }, 500);
        } catch (error) {
            this.log('error', `Failed to initialize Tauri window: ${error}`);
        }
    }

    /**
     * Check if running in Tauri environment
     */
    isTauri(): boolean {
        // Check for various Tauri indicators
        // @ts-ignore
        return !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
    }

    /**
     * Check if running on mobile
     */
    isMobile(): boolean {
        const ua = navigator.userAgent.toLowerCase();
        return ua.includes('android') || ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod');
    }

    /**
     * Log a message via the Logger plugin
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        this.app.api.invoke(`logger:${level}`, 'nh.system.titlebar', message);
    }

    /**
     * Get current state
     */
    getState(): TitleBarState {
        return { ...this.state };
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback: StateSubscriber): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Notify all subscribers of state change
     */
    private notifySubscribers(): void {
        const state = this.getState();
        for (const subscriber of this.subscribers) {
            subscriber(state);
        }
    }

    /**
     * Set the title bar title
     */
    setTitle(title: string): void {
        if (this.state.title !== title) {
            this.state.title = title;
            this.notifySubscribers();
            this.app.events.emit('titlebar:title-changed', { title });
        }
    }

    /**
     * Set the title bar icon
     */
    setIcon(icon: string | null): void {
        if (this.state.icon !== icon) {
            this.state.icon = icon;
            this.notifySubscribers();
        }
    }

    /**
     * Get current title
     */
    getTitle(): string {
        return this.state.title;
    }

    // ========================================================================
    // Window Control Methods
    // ========================================================================

    /**
     * Minimize the window
     */
    async minimize(): Promise<void> {
        if (!this.tauriWindow) return;

        try {
            await this.tauriWindow.minimize();
        } catch (error) {
            this.log('error', `Failed to minimize: ${error}`);
        }
    }

    /**
     * Toggle maximize/restore window
     */
    async toggleMaximize(): Promise<void> {
        if (!this.tauriWindow) return;

        try {
            if (this.state.isMaximized) {
                await this.tauriWindow.unmaximize();
            } else {
                await this.tauriWindow.maximize();
            }
            this.state.isMaximized = !this.state.isMaximized;
            this.notifySubscribers();
        } catch (error) {
            this.log('error', `Failed to toggle maximize: ${error}`);
        }
    }

    /**
     * Close the window
     */
    async close(): Promise<void> {
        if (!this.tauriWindow) return;

        try {
            // ⚡ FIX E2: Check for unsaved changes before closing
            const isDirty = await this.checkForUnsavedChanges();
            if (isDirty) {
                const confirmed = await this.confirmClose();
                if (!confirmed) {
                    return; // User cancelled
                }
            }
            await this.tauriWindow.close();
        } catch (error) {
            this.log('error', `Failed to close: ${error}`);
        }
    }

    /**
     * Check if editor has unsaved changes
     */
    private async checkForUnsavedChanges(): Promise<boolean> {
        try {
            return await this.app.api.invoke<boolean>('editor:is-dirty');
        } catch {
            return false; // API not available, assume no changes
        }
    }

    /**
     * Show confirmation dialog for closing with unsaved changes
     */
    private async confirmClose(): Promise<boolean> {
        try {
            return await this.app.api.invoke<boolean>(
                'dialog:confirm',
                'Unsaved Changes',
                'You have unsaved changes. Close anyway?'
            );
        } catch {
            return true; // Dialog not available, allow close
        }
    }

    /**
     * Start window dragging
     */
    async startDrag(): Promise<void> {
        if (!this.tauriWindow) return;

        try {
            await this.tauriWindow.startDragging();
        } catch (error) {
            // Dragging errors are usually fine to ignore
        }
    }

    /**
     * Cleanup controller
     */
    dispose(): void {
        // ⚡ FIX E1: Clear dirty check interval
        if (this.dirtyCheckInterval) {
            clearInterval(this.dirtyCheckInterval);
            this.dirtyCheckInterval = null;
        }
        this.subscribers.clear();
        this.tauriWindow = null;
    }
}
