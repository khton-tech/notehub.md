/**
 * @fileoverview Bridge Module - React/CodeMirror Portal Bridge
 * 
 * Exports all bridge components for rendering React inside CodeMirror.
 * 
 * @module @notehub/editor/bridge
 */

// Store
export { portalStore, type PortalEntry } from './store';

// React Renderer
export { EditorPortalRenderer } from './renderer';

// Abstract Widget
export { ReactBridgeWidget } from './widget';
