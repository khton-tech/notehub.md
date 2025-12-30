/**
 * @fileoverview React Portal Renderer - Bridge component for CodeMirror widgets
 * 
 * Renders React components into DOM containers created by CodeMirror widgets
 * using React's `createPortal` API. Subscribes to the Portal Store for updates.
 * 
 * @module @notehub/editor/bridge/renderer
 */

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { portalStore, type PortalEntry } from './store';

/**
 * Single portal wrapper component.
 * Memoized to prevent unnecessary re-renders when other portals change.
 */
const PortalItem = React.memo(({ entry }: { entry: PortalEntry }) => {
    const { component: Component, props, container } = entry;
    // Cast props to object for safe spreading (type assertion is safe here
    // since we control what gets passed to the store)
    const safeProps = props as Record<string, unknown>;
    return createPortal(<Component {...safeProps} />, container);
});

PortalItem.displayName = 'PortalItem';

/**
 * EditorPortalRenderer - Renders all active React portals.
 * 
 * This component should be rendered as a sibling to the CodeMirror container
 * within the NotehubEditor component. It subscribes to the Portal Store and
 * creates React portals for each registered widget.
 * 
 * @example
 * ```tsx
 * <div className="notehub-editor">
 *     <div ref={cmContainer} />
 *     <EditorPortalRenderer />
 * </div>
 * ```
 */
export const EditorPortalRenderer: React.FC = () => {
    // Subscribe to portal store using React 18's useSyncExternalStore
    const portals = useSyncExternalStore(
        portalStore.subscribe,
        portalStore.getSnapshot,
        portalStore.getSnapshot // SSR snapshot (same as client)
    );

    // Render nothing if no portals are active
    if (portals.length === 0) {
        return null;
    }

    // Render all active portals with proper React keys
    return (
        <>
            {portals.map((entry) => (
                <PortalItem key={entry.id} entry={entry} />
            ))}
        </>
    );
};

EditorPortalRenderer.displayName = 'EditorPortalRenderer';
