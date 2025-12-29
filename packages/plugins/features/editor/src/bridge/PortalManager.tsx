/**
 * @fileoverview Portal Manager - React/CodeMirror Bridge Infrastructure
 * 
 * This module provides the "OS" for widgets, allowing CodeMirror to create
 * DOM slots that React can render into via createPortal.
 * 
 * @module @notehub/editor/bridge/PortalManager
 */

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    type ReactNode,
    type FC
} from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// Types
// ============================================================================

/**
 * A single portal entry in the store
 */
export interface PortalEntry {
    /** The DOM element to render into */
    dom: HTMLElement;
    /** The React component to render */
    component: ReactNode;
}

/**
 * Portal store - maps portal IDs to their entries
 */
export type PortalStore = Map<string, PortalEntry>;

/**
 * Portal Manager API exposed via context
 */
export interface PortalManagerAPI {
    /**
     * Mount a React component into a DOM element
     * @param id - Unique portal identifier
     * @param dom - Target DOM element
     * @param component - React component to render
     */
    mount(id: string, dom: HTMLElement, component: ReactNode): void;

    /**
     * Unmount a portal by ID
     * @param id - Portal identifier to unmount
     */
    unmount(id: string): void;

    /**
     * Check if a portal exists
     * @param id - Portal identifier
     */
    has(id: string): boolean;
}

// ============================================================================
// Context
// ============================================================================

const PortalContext = createContext<PortalManagerAPI | null>(null);

/**
 * Hook to access the Portal Manager API
 * @throws Error if used outside of PortalProvider
 */
export function usePortalManager(): PortalManagerAPI {
    const ctx = useContext(PortalContext);
    if (!ctx) {
        throw new Error('usePortalManager must be used within a PortalProvider');
    }
    return ctx;
}

// ============================================================================
// Custom Event for CodeMirror → React Communication
// ============================================================================

/** Event name for mounting portals */
export const PORTAL_MOUNT_EVENT = 'nh:portal:mount';
/** Event name for unmounting portals */
export const PORTAL_UNMOUNT_EVENT = 'nh:portal:unmount';

/**
 * Event detail for portal mount events
 */
export interface PortalMountEventDetail {
    id: string;
    dom: HTMLElement;
    component: ReactNode;
}

/**
 * Event detail for portal unmount events
 */
export interface PortalUnmountEventDetail {
    id: string;
}

// ============================================================================
// Provider Component
// ============================================================================

interface PortalProviderProps {
    children: ReactNode;
}

/**
 * PortalProvider - Manages the portal store and provides the API context
 * 
 * This component should wrap the entire editor to enable portal functionality.
 * It listens for custom events from CodeMirror widgets and manages the React
 * portal lifecycle.
 */
export const PortalProvider: FC<PortalProviderProps> = ({ children }) => {
    const [portals, setPortals] = useState<PortalStore>(new Map());

    const mount = useCallback((id: string, dom: HTMLElement, component: ReactNode) => {
        setPortals(prev => {
            const next = new Map(prev);
            next.set(id, { dom, component });
            return next;
        });
    }, []);

    const unmount = useCallback((id: string) => {
        setPortals(prev => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const has = useCallback((id: string) => {
        return portals.has(id);
    }, [portals]);

    // Listen for CustomEvents from CodeMirror widgets
    // IMPORTANT: Use useLayoutEffect to subscribe BEFORE first paint
    // This fixes race condition where CodeMirror dispatches events during render
    // but useEffect would run AFTER render, missing those events
    React.useLayoutEffect(() => {
        const handleMount = (e: Event) => {
            const detail = (e as CustomEvent<PortalMountEventDetail>).detail;
            mount(detail.id, detail.dom, detail.component);
        };

        const handleUnmount = (e: Event) => {
            const detail = (e as CustomEvent<PortalUnmountEventDetail>).detail;
            unmount(detail.id);
        };

        window.addEventListener(PORTAL_MOUNT_EVENT, handleMount);
        window.addEventListener(PORTAL_UNMOUNT_EVENT, handleUnmount);

        return () => {
            window.removeEventListener(PORTAL_MOUNT_EVENT, handleMount);
            window.removeEventListener(PORTAL_UNMOUNT_EVENT, handleUnmount);
        };
    }, [mount, unmount]);

    const api = useMemo<PortalManagerAPI>(() => ({
        mount,
        unmount,
        has
    }), [mount, unmount, has]);

    return (
        <PortalContext.Provider value={api}>
            {children}
            <PortalRenderer portals={portals} />
        </PortalContext.Provider>
    );
};

// ============================================================================
// Renderer Component
// ============================================================================

interface PortalRendererProps {
    portals: PortalStore;
}

/**
 * PortalRenderer - Renders all active portals using createPortal
 * 
 * This component iterates through the portal store and renders each
 * React component into its designated DOM element.
 */
const PortalRenderer: FC<PortalRendererProps> = ({ portals }) => {
    return (
        <>
            {Array.from(portals.entries()).map(([id, entry]) => (
                <React.Fragment key={id}>
                    {createPortal(entry.component, entry.dom)}
                </React.Fragment>
            ))}
        </>
    );
};

// ============================================================================
// Utility: Generate Portal ID
// ============================================================================

let portalIdCounter = 0;

/**
 * Generate a unique portal ID
 * BUG-014 fix: Added random component to prevent collision at millisecond precision
 * @param prefix - Optional prefix for the ID
 */
export function generatePortalId(prefix: string = 'portal'): string {
    const random = Math.random().toString(36).substring(2, 6);
    return `${prefix}-${++portalIdCounter}-${Date.now().toString(36)}-${random}`;
}

// ============================================================================
// Utility: Dispatch Portal Events (for use in CodeMirror widgets)
// ============================================================================

/**
 * Dispatch a portal mount event to the window
 * @param id - Unique portal ID
 * @param dom - Target DOM element
 * @param component - React component to render
 */
export function dispatchPortalMount(
    id: string,
    dom: HTMLElement,
    component: ReactNode
): void {
    const event = new CustomEvent<PortalMountEventDetail>(PORTAL_MOUNT_EVENT, {
        detail: { id, dom, component }
    });
    window.dispatchEvent(event);
}

/**
 * Dispatch a portal unmount event to the window
 * @param id - Portal ID to unmount
 */
export function dispatchPortalUnmount(id: string): void {
    const event = new CustomEvent<PortalUnmountEventDetail>(PORTAL_UNMOUNT_EVENT, {
        detail: { id }
    });
    window.dispatchEvent(event);
}
