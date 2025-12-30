/**
 * @fileoverview Editor Portal Renderer - React component for rendering widgets
 * 
 * Implements RFC-005: Portal Pattern. This component lives in the main React tree
 * and renders React components into CodeMirror widget containers using createPortal.
 * 
 * ## Performance Notes:
 * - createPortal is generally cheap (no extra DOM reconciliation)
 * - We use useSyncExternalStore for optimal subscription handling
 * - Each portal entry renders independently
 * 
 * @module @notehub/editor/bridge/renderer
 * @author Notehub Team
 */

import React, { useSyncExternalStore, memo } from 'react';
import { createPortal } from 'react-dom';
import { portalStore, type PortalEntry } from './store';

/**
 * Individual portal renderer - renders a single React component into its container.
 * Memoized to prevent unnecessary re-renders when other portals change.
 */
const PortalItem = memo<{ entry: PortalEntry }>(({ entry }) => {
    const { component: Component, props, container } = entry;

    return createPortal(
        <Component {...props} />,
        container
    );
});

PortalItem.displayName = 'PortalItem';

/**
 * EditorPortalRenderer - Main renderer component for React-CodeMirror bridge.
 * 
 * Place this component inside your editor container (as a sibling to the CM div).
 * It subscribes to the portal store and renders all active portals.
 * 
 * @example
 * ```tsx
 * <div className="editor-wrapper">
 *     <div ref={cmContainerRef} />
 *     <EditorPortalRenderer />
 * </div>
 * ```
 * 
 * @component
 */
export const EditorPortalRenderer: React.FC = () => {
    // Subscribe to portal store using React 18's useSyncExternalStore
    const portals = useSyncExternalStore(
        portalStore.subscribe,
        portalStore.getSnapshot,
        portalStore.getSnapshot // Server snapshot (same for our use case)
    );

    // Render nothing if no portals
    if (portals.length === 0) {
        return null;
    }

    // Render all active portals
    return (
        <>
            {portals.map(entry => (
                <PortalItem key={entry.id} entry={entry} />
            ))}
        </>
    );
};

EditorPortalRenderer.displayName = 'EditorPortalRenderer';
