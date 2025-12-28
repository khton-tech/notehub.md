/**
 * @fileoverview Bridge Widget - Abstract WidgetType for Portal Integration
 * 
 * This abstract class provides the foundation for CodeMirror widgets that
 * render React components via the Portal system.
 * 
 * @module @notehub/editor/bridge/BridgeWidget
 */

import { WidgetType } from '@codemirror/view';
import type { ReactNode } from 'react';
import {
    generatePortalId,
    dispatchPortalMount,
    dispatchPortalUnmount
} from './PortalManager';

/**
 * Abstract Bridge Widget - Base class for React-powered CodeMirror widgets
 * 
 * Subclasses must implement:
 * - `renderComponent()`: Returns the React component to render
 * 
 * Lifecycle:
 * 1. `toDOM()` is called by CodeMirror when the widget is created
 * 2. The widget creates a container div and dispatches a portal mount event
 * 3. React's PortalManager picks up the event and renders the component
 * 4. `destroy()` is called when the widget is removed
 * 5. A portal unmount event is dispatched, cleaning up the React component
 */
export abstract class BridgeWidget extends WidgetType {
    /** Unique identifier for this widget's portal */
    protected portalId: string | null = null;

    /** The DOM container created for this widget */
    protected container: HTMLElement | null = null;

    /**
     * Create the React component to render in this widget
     * @returns React component (JSX)
     */
    protected abstract renderComponent(): ReactNode;

    /**
     * Optional: CSS class names for the container element
     */
    protected containerClassName(): string {
        return 'nh-bridge-widget';
    }

    /**
     * Create the DOM element for this widget
     * Called by CodeMirror when the widget is inserted into the document
     */
    toDOM(): HTMLElement {
        // If already mounted, return existing container
        if (this.container && this.portalId) {
            return this.container;
        }

        // Create container element
        this.container = document.createElement('span');
        this.container.className = this.containerClassName();

        // Generate unique portal ID
        this.portalId = generatePortalId('widget');

        // Store the ID on the element for debugging
        this.container.dataset.portalId = this.portalId;

        // Dispatch mount event - React will render the component
        dispatchPortalMount(
            this.portalId,
            this.container,
            this.renderComponent()
        );

        return this.container;
    }

    /**
     * Clean up when the widget is removed from the document
     * Called by CodeMirror when the decoration is removed
     */
    destroy(): void {
        if (this.portalId) {
            dispatchPortalUnmount(this.portalId);
            this.portalId = null;
        }
        this.container = null;
    }

    /**
     * Compare this widget to another for equality
     * Used by CodeMirror to determine if a widget needs to be recreated
     * 
     * Subclasses should override this if they have meaningful properties
     * to compare (e.g., label text, configuration options)
     */
    eq(other: WidgetType): boolean {
        return other.constructor === this.constructor;
    }

    /**
     * Estimate the length of this widget in the document
     * Used for cursor positioning and selection
     * 
     * Override if your widget represents more than one "character" of space
     */
    get estimatedHeight(): number {
        return -1; // -1 means inline, use line height
    }

    /**
     * Whether to ignore events on this widget
     * Generally return true for bridge widgets since they're replaced content
     */
    ignoreEvent(): boolean {
        return true;
    }
}
