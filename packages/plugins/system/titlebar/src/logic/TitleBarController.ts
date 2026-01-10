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
    };
    private subscribers = new Set<StateSubscriber>();
    private tauriWindow: any = null;

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
        } catch (error) {
            this.log('error', `Failed to initialize Tauri window: ${error}`);
        }
    }

    /**
     * Check if running in Tauri environment
     */
    isTauri(): boolean {
        return '__TAURI_INTERNALS__' in window;
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
            await this.tauriWindow.close();
        } catch (error) {
            this.log('error', `Failed to close: ${error}`);
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
        this.subscribers.clear();
        this.tauriWindow = null;
    }
}
