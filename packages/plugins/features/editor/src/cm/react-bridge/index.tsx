/**
 * React Bridge for CodeMirror 6 Widgets
 * 
 * Implements the "Portal Bridge" pattern from RFC-002.
 * Allows rendering React components inside CodeMirror widgets via portals.
 * 
 * @module react-bridge
 */

import {
    createContext,
    useContext,
    useState,
    useEffect,
    type ReactNode,
    type FC
} from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Entry in the widget store
 */
export interface WidgetEntry<P = unknown> {
    /** React component to render */
    component: FC<P>;
    /** Props to pass to the component */
    props: P;
    /** DOM element to render into (created by CM6 widget) */
    domElement: HTMLElement;
}

/**
 * Widget store type - maps widget IDs to their entries
 */
export type WidgetStore = Map<string, WidgetEntry>;

/**
 * Subscription callback type
 */
type Subscriber = () => void;

// ============================================================================
// BRIDGE SERVICE
// ============================================================================

/**
 * BridgeService - Manages widget mount/unmount lifecycle
 * 
 * Singleton service that maintains a store of mounted widgets and
 * notifies subscribers when the store changes.
 */
class BridgeServiceClass {
    private store: WidgetStore = new Map();
    private subscribers: Set<Subscriber> = new Set();

    /**
     * Get current widget store snapshot
     */
    getStore(): WidgetStore {
        return this.store;
    }

    /**
     * Subscribe to store changes
     */
    subscribe(callback: Subscriber): () => void {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * Notify all subscribers of store changes
     */
    private notify(): void {
        this.subscribers.forEach((callback) => callback());
    }

    /**
     * Mount a React component into a DOM element
     */
    mount<P>(id: string, domElement: HTMLElement, component: FC<P>, props: P): void {
        this.store.set(id, {
            component: component as FC<unknown>,
            props,
            domElement
        });
        this.notify();
    }

    /**
     * Unmount a widget by ID
     */
    unmount(id: string): void {
        if (this.store.has(id)) {
            this.store.delete(id);
            this.notify();
        }
    }

    /**
     * Update props for an existing widget
     */
    update<P extends Record<string, unknown>>(id: string, props: Partial<P>): void {
        const entry = this.store.get(id);
        if (entry) {
            const updatedProps = { ...(entry.props as Record<string, unknown>), ...props };
            this.store.set(id, {
                ...entry,
                props: updatedProps
            });
            this.notify();
        }
    }

    /**
     * Clear all widgets (cleanup on unmount)
     */
    clear(): void {
        this.store.clear();
        this.notify();
    }
}

/** Singleton instance */
export const bridgeService = new BridgeServiceClass();

// ============================================================================
// REACT CONTEXT & HOOKS
// ============================================================================

const BridgeContext = createContext<BridgeServiceClass | null>(null);

/**
 * Provider component for the Bridge context
 */
export const BridgeProvider: FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <BridgeContext.Provider value={bridgeService}>
            {children}
        </BridgeContext.Provider>
    );
};

/**
 * Hook to access the bridge service
 */
export function useBridgeService(): BridgeServiceClass {
    const context = useContext(BridgeContext);
    if (!context) {
        // Fallback to singleton if used outside provider
        return bridgeService;
    }
    return context;
}

/**
 * Hook to subscribe to widget store updates
 * Returns the current widget store and triggers re-render on changes
 */
export function useWidgetBridge(): WidgetStore {
    const service = useBridgeService();
    const [store, setStore] = useState<WidgetStore>(() => new Map(service.getStore()));

    useEffect(() => {
        const unsubscribe = service.subscribe(() => {
            setStore(new Map(service.getStore()));
        });
        return unsubscribe;
    }, [service]);

    return store;
}

// ============================================================================
// PORTAL RENDERER
// ============================================================================

/**
 * EditorPortalRenderer - Renders all mounted widgets via React portals
 * 
 * This component should be rendered inside the editor container as a sibling
 * to the CodeMirror host element. It creates portals for each widget in the store.
 */
export const EditorPortalRenderer: FC = () => {
    const store = useWidgetBridge();

    return (
        <>
            {Array.from(store.entries()).map(([id, entry]) => {
                const { component: Component, props, domElement } = entry;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return createPortal(
                    <Component key={id} {...(props as Record<string, unknown>)} />,
                    domElement
                );
            })}
        </>
    );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

let widgetIdCounter = 0;

/**
 * Generate a unique widget ID
 */
export function generateWidgetId(): string {
    return `widget-${++widgetIdCounter}`;
}

// Re-export for convenience
export { BridgeServiceClass };
