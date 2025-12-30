/**
 * @fileoverview Bridge Module - React-CodeMirror Portal Bridge
 * 
 * This module provides the infrastructure for rendering React components
 * inside CodeMirror documents using the Portal Pattern (RFC-005).
 * 
 * ## Exports:
 * - `portalStore` - Singleton store managing portal entries
 * - `EditorPortalRenderer` - React component to place in editor container
 * - `ReactBridgeWidget` - Base class for creating React-powered widgets
 * 
 * ## Usage Example:
 * 
 * ### Creating a widget:
 * ```ts
 * import { ReactBridgeWidget } from '@notehub/editor/bridge';
 * import { MyComponent } from './MyComponent';
 * 
 * class MyWidget extends ReactBridgeWidget<{ text: string }> {
 *     constructor(text: string) {
 *         super(MyComponent, { text });
 *     }
 * }
 * ```
 * 
 * ### Setting up the renderer:
 * ```tsx
 * import { EditorPortalRenderer } from '@notehub/editor/bridge';
 * 
 * function Editor() {
 *     return (
 *         <div>
 *             <div ref={cmRef} />
 *             <EditorPortalRenderer />
 *         </div>
 *     );
 * }
 * ```
 * 
 * @module @notehub/editor/bridge
 * @author Notehub Team
 */

// Store
export { portalStore } from './store';
export type { PortalEntry, PortalStore } from './store';

// Renderer
export { EditorPortalRenderer } from './renderer';

// Widget base class
export { ReactBridgeWidget } from './widget';
