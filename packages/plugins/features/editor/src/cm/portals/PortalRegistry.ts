import type { PortalSpec } from './types';

/**
 * Registry for managing all active Portals.
 * Implements a Singleton pattern.
 */
export class PortalRegistry {
    private static instance: PortalRegistry;
    private portals: Map<string, PortalSpec> = new Map();
    private listeners: Set<() => void> = new Set();

    private constructor() { }

    /**
     * Get the singleton instance of the registry.
     */
    public static getInstance(): PortalRegistry {
        if (!PortalRegistry.instance) {
            PortalRegistry.instance = new PortalRegistry();
        }
        return PortalRegistry.instance;
    }

    /**
     * Register a new portal definition.
     * @param spec The portal specification to register
     */
    public register(spec: PortalSpec): void {
        this.portals.set(spec.id, spec);
        this.notifyListeners();
    }

    /**
     * Unregister a portal by its ID.
     * @param id The ID of the portal to unregister
     */
    public unregister(id: string): void {
        if (this.portals.delete(id)) {
            this.notifyListeners();
        }
    }

    /**
     * Get all registered portals.
     */
    public getAll(): PortalSpec[] {
        return Array.from(this.portals.values());
    }

    /**
     * Clear all portals and listeners.
     * @internal For testing purposes only.
     */
    public clear(): void {
        this.portals.clear();
        this.listeners.clear();
    }

    /**
     * Get a specific portal by ID.
     */
    public get(id: string): PortalSpec | undefined {
        return this.portals.get(id);
    }

    /**
     * Subscribe to registry updates.
     * Use this in the ViewPlugin to trigger re-parsing when portals change.
     * @param listener Callback function
     * @returns Unsubscribe function
     */
    public onUpdate(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener());
    }
}
