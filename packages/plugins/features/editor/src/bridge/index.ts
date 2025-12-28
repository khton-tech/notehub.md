/**
 * Portal Bridge Infrastructure
 * @module @notehub/editor/bridge
 */

export {
    PortalProvider,
    usePortalManager,
    generatePortalId,
    dispatchPortalMount,
    dispatchPortalUnmount,
    PORTAL_MOUNT_EVENT,
    PORTAL_UNMOUNT_EVENT,
    type PortalEntry,
    type PortalStore,
    type PortalManagerAPI,
    type PortalMountEventDetail,
    type PortalUnmountEventDetail
} from './PortalManager';

export { BridgeWidget } from './BridgeWidget';
