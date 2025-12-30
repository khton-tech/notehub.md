/**
 * @fileoverview Portal Store - Micro-state manager for React-CodeMirror Bridge
 * 
 * Implements RFC-005: Portal Pattern for rendering React components inside
 * CodeMirror documents without using ReactDOM.createRoot inside widgets.
 * 
 * ## How it works:
 * 1. CodeMirror Widget creates a DOM container
 * 2. Widget calls `portalStore.mount(...)` with component info
 * 3. React Renderer (in main tree) subscribes to store changes
 * 4. Renderer uses `ReactDOM.createPortal` to render into containers
 * 
 * @module @notehub/editor/bridge/store
 * @author Notehub Team
 */

import type { FC } from 'react';

/**
 * Entry describing a React component to be portaled into CodeMirror
 */
export interface PortalEntry {
    /** Unique identifier for this portal */
    id: string;
    /** DOM element container (created by widget.toDOM) */
    container: HTMLElement;
    /** React component to render */
    component: FC<any>;
    /** Props to pass to the component */
    props: any;
}

/**
 * Listener callback type for store subscriptions
 */
type Listener = () => void;

/**
 * Creates the Portal Store singleton.
 * Uses subscription pattern compatible with React's useSyncExternalStore.
 */
function createPortalStore() {
    /** Internal state: Map of portal ID to entry */
    const portals = new Map<string, PortalEntry>();

    /** Set of subscribed listeners */
    const listeners = new Set<Listener>();

    /** Cached snapshot array - CRITICAL for useSyncExternalStore */
    let cachedSnapshot: PortalEntry[] = [];

    /**
     * Updates the cached snapshot when state changes.
     * This ensures getSnapshot returns the same reference
     * unless actual data has changed.
     */
    function updateSnapshot() {
        cachedSnapshot = Array.from(portals.values());
    }

    /**
     * Notifies all listeners that state has changed
     */
    function notifyListeners() {
        updateSnapshot();
        listeners.forEach(listener => listener());
    }

    /**
     * Mount a React component into a container.
     * Called by ReactBridgeWidget.toDOM()
     * 
     * @param id - Unique portal identifier
     * @param container - DOM element to render into
     * @param component - React component to render
     * @param props - Props for the component
     */
    function mount(
        id: string,
        container: HTMLElement,
        component: FC<any>,
        props: any
    ): void {
        portals.set(id, { id, container, component, props });
        notifyListeners();
    }

    /**
     * Update props for an existing portal.
     * Called by ReactBridgeWidget.updateDOM()
     * 
     * @param id - Portal identifier to update
     * @param props - New props for the component
     */
    function update(id: string, props: any): void {
        const entry = portals.get(id);
        if (entry) {
            portals.set(id, { ...entry, props });
            notifyListeners();
        }
    }

    /**
     * Unmount a portal.
     * Called by ReactBridgeWidget.destroy()
     * 
     * @param id - Portal identifier to remove
     */
    function unmount(id: string): void {
        if (portals.has(id)) {
            portals.delete(id);
            notifyListeners();
        }
    }

    /**
     * Subscribe to store changes.
     * Compatible with useSyncExternalStore pattern.
     * 
     * @param listener - Callback to invoke on state change
     * @returns Unsubscribe function
     */
    function subscribe(listener: Listener): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    /**
     * Get current snapshot of all portal entries.
     * Compatible with useSyncExternalStore pattern.
     * 
     * CRITICAL: This returns a cached reference to prevent
     * infinite re-renders in useSyncExternalStore.
     * 
     * @returns Array of all active portal entries
     */
    function getSnapshot(): PortalEntry[] {
        return cachedSnapshot;
    }

    /**
     * Get a specific portal entry by ID.
     * 
     * @param id - Portal identifier
     * @returns Portal entry or undefined
     */
    function getEntry(id: string): PortalEntry | undefined {
        return portals.get(id);
    }

    /**
     * Check if a portal exists.
     * 
     * @param id - Portal identifier
     * @returns True if portal exists
     */
    function has(id: string): boolean {
        return portals.has(id);
    }

    return {
        mount,
        update,
        unmount,
        subscribe,
        getSnapshot,
        getEntry,
        has,
    };
}

/**
 * Singleton instance of the Portal Store.
 * Used by both widgets (mount/update/unmount) and renderer (subscribe/getSnapshot).
 */
export const portalStore = createPortalStore();

/**
 * Type of the portal store for external typing needs
 */
export type PortalStore = ReturnType<typeof createPortalStore>;
