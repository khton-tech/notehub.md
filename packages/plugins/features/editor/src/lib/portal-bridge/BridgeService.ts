import type React from 'react';
import type { PortalItem } from './types';

/**
 * BridgeService - Manages the portal items map and notifies React when changes occur.
 *
 * Uses the useSyncExternalStore pattern to allow React components to subscribe to changes.
 * This service is responsible for:
 * - Mounting new portal items (adding React components to DOM elements)
 * - Updating existing portal items (changing props)
 * - Unmounting portal items (cleaning up)
 *
 * Performance:
 * - Fast Map operations for managing portals
 * - Efficient listener notification (only triggers React render when map changes)
 */
export class BridgeService {
    private portals: Map<string, PortalItem> = new Map();
    private listeners: Set<() => void> = new Set();
    private cachedSnapshot: PortalItem[] = [];

    /**
     * Mount a new portal item.
     * Creates a mapping between a DOM element and a React component.
     *
     * @template P - The props type for the component
     * @param id - Unique identifier for this portal
     * @param domElement - DOM element to render into
     * @param component - React component to render
     * @param props - Props to pass to the component
     */
    mount<P = unknown>(
        id: string,
        domElement: HTMLElement,
        component: React.FC<P>,
        props: P
    ): void {
        this.portals.set(id, {
            id,
            component: component as React.FC<unknown>,
            props,
            domElement,
        });
        this.invalidateCache();
        this.notifyListeners();
    }

    /**
     * Update the props of an existing portal item.
     *
     * @template P - The props type for the component
     * @param id - Portal identifier
     * @param props - New props to pass to the component
     */
    update<P = unknown>(id: string, props: P): void {
        const item = this.portals.get(id);
        if (item) {
            item.props = props;
            this.invalidateCache();
            this.notifyListeners();
        }
    }

    /**
     * Unmount a portal item.
     * Removes the portal from the map and triggers cleanup.
     *
     * @param id - Portal identifier
     */
    unmount(id: string): void {
        this.portals.delete(id);
        this.invalidateCache();
        this.notifyListeners();
    }

    /**
     * Subscribe to changes in the portals map.
     * Used by React's useSyncExternalStore.
     *
     * @param listener - Callback to invoke when portals change
     * @returns Unsubscribe function
     */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Get a snapshot of the current portals.
     * Used by React's useSyncExternalStore.
     * 
     * IMPORTANT: This method is cached to prevent infinite loops.
     * React's useSyncExternalStore uses strict equality (===) to compare snapshots.
     * We only create a new array when data actually changes.
     *
     * @returns Array of portal items (cached)
     */
    getSnapshot(): PortalItem[] {
        return this.cachedSnapshot;
    }

    /**
     * Invalidate the snapshot cache and create a new one.
     * Called whenever portals are added, updated, or removed.
     */
    private invalidateCache(): void {
        this.cachedSnapshot = Array.from(this.portals.values());
    }

    /**
     * Notify all listeners that the portals map has changed.
     * This triggers React re-renders for components using useSyncExternalStore.
     */
    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener());
    }
}

// Singleton instance
let bridgeInstance: BridgeService | null = null;

/**
 * Get the singleton BridgeService instance.
 * Creates the instance on first call.
 */
export function getBridgeService(): BridgeService {
    if (!bridgeInstance) {
        bridgeInstance = new BridgeService();
    }
    return bridgeInstance;
}
