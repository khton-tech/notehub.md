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
 * Custom comparison to ensure re-render when props change.
 */
const PortalItem = memo<{ entry: PortalEntry }>(
    ({ entry }) => {
        const { component: Component, props, container } = entry;
        console.log('[PortalItem] Rendering portal:', entry.id, 'props:', props);

        return createPortal(
            <Component {...props} />,
            container
        );
    },
    // Custom comparison: re-render if id changes or props change
    (prevProps, nextProps) => {
        const same = prevProps.entry.id === nextProps.entry.id &&
            JSON.stringify(prevProps.entry.props) === JSON.stringify(nextProps.entry.props);
        console.log('[PortalItem] memo check:', {
            id: prevProps.entry.id,
            prevProps: prevProps.entry.props,
            nextProps: nextProps.entry.props,
            same
        });
        return same;
    }
);

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
