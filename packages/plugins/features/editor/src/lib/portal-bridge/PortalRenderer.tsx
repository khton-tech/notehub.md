import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getBridgeService } from './BridgeService';

/**
 * PortalRenderer - Renders all active portal items.
 *
 * This component:
 * - Subscribes to BridgeService using useSyncExternalStore
 * - Renders each portal item using ReactDOM.createPortal
 * - Re-renders efficiently when portals are added/removed/updated
 *
 * Usage:
 * Place this component in the editor's React tree, typically as a sibling
 * to the CodeMirror container. It doesn't render anything visible itself,
 * but manages the portal lifecycle.
 */
export const PortalRenderer: React.FC = () => {
    const bridge = getBridgeService();

    // Subscribe to portal changes using useSyncExternalStore
    const portals = useSyncExternalStore(
        (listener) => bridge.subscribe(listener),
        () => bridge.getSnapshot()
    );

    return (
        <>
            {portals.map((item) => {
                const Component = item.component as React.FC<any>;
                return createPortal(
                    <Component {...(item.props as any)} />,
                    item.domElement,
                    item.id
                );
            })}
        </>
    );
};
