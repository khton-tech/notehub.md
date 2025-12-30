/**
* @fileoverview Portal Store - Micro-state manager for React/CodeMirror bridge
* 
* Implements the subscription pattern for rendering React components
* inside CodeMirror widgets using portals (RFC-005).
* 
* ## Pattern
* 
* 1. CodeMirror widget calls `mount()` with a container element
* 2. React renderer subscribes via `useSyncExternalStore`
* 3. Renderer uses `createPortal()` to render into container
* 4. Widget calls `unmount()` on destroy
* 
* @module @notehub/editor/bridge/store
*/

import type { FC } from 'react';

/**
 * Entry representing a single portal mount point.
 */
export interface PortalEntry<P = unknown> {
    /** Unique identifier for this portal */
    id: string;
    /** DOM container element created by the widget */
    container: HTMLElement;
    /** React component to render */
    component: FC<P>;
    /** Props to pass to the component */
    props: P;
}

/**
 * Listener callback type for store subscriptions.
 */
type Listener = () => void;

/**
 * Portal Store class implementing the subscription pattern.
 * Designed for use with React's `useSyncExternalStore`.
 */
class PortalStore {
    /** Map of active portal entries by ID */
    private portals: Map<string, PortalEntry> = new Map();

    /** Set of subscribed listeners */
    private listeners: Set<Listener> = new Set();

    /** Snapshot array for React reconciliation */
    private snapshot: PortalEntry[] = [];

    /**
     * Mount a new portal entry.
     * Called by CodeMirror widget's `toDOM()` method.
     * 
     * @param id - Unique portal identifier
     * @param container - DOM element to render into
     * @param component - React component to render
     * @param props - Props for the component
     */
    mount<P>(id: string, container: HTMLElement, component: FC<P>, props: P): void {
        this.portals.set(id, { id, container, component, props } as PortalEntry);
        this.emitChange();
    }

    /**
     * Update props for an existing portal.
     * Called by CodeMirror widget's `updateDOM()` method.
     * 
     * @param id - Portal identifier to update
     * @param props - New props for the component
     */
    update<P>(id: string, props: P): void {
        const entry = this.portals.get(id);
        if (entry) {
            this.portals.set(id, { ...entry, props } as PortalEntry);
            this.emitChange();
        }
    }

    /**
     * Unmount and remove a portal entry.
     * Called by CodeMirror widget's `destroy()` method.
     * 
     * @param id - Portal identifier to remove
     */
    unmount(id: string): void {
        if (this.portals.delete(id)) {
            this.emitChange();
        }
    }

    /**
     * Subscribe to store changes.
     * Returns unsubscribe function.
     * 
     * @param listener - Callback to invoke on changes
     * @returns Unsubscribe function
     */
    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /**
     * Get current snapshot of all portal entries.
     * Used by `useSyncExternalStore` for React rendering.
     * 
     * @returns Array of portal entries
     */
    getSnapshot = (): PortalEntry[] => {
        return this.snapshot;
    };

    /**
     * Notify all listeners of a change and update snapshot.
     * @internal
     */
    private emitChange(): void {
        this.snapshot = Array.from(this.portals.values());
        this.listeners.forEach(listener => listener());
    }
}

/**
 * Singleton instance of the Portal Store.
 * Used by both CodeMirror widgets and React renderer.
 */
export const portalStore = new PortalStore();
