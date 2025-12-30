/**
 * @fileoverview React Bridge Widget - Abstract widget for React-CodeMirror bridge
 * 
 * Implements RFC-005: Portal Pattern. Extend this class to create CodeMirror widgets
 * that render React components without performance penalties from createRoot.
 * 
 * ## Usage:
 * ```ts
 * class MyWidget extends ReactBridgeWidget {
 *     constructor(props: MyProps) {
 *         super(MyComponent, props);
 *     }
 * }
 * ```
 * 
 * @module @notehub/editor/bridge/widget
 * @author Notehub Team
 */

import { WidgetType } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';
import type { FC } from 'react';
import { portalStore } from './store';

/**
 * Generate a unique ID for portal entries.
 * Uses crypto.randomUUID if available, falls back to timestamp + random.
 */
function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older environments
    return `portal-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * ReactBridgeWidget - Abstract class for creating React-powered CodeMirror widgets.
 * 
 * This widget creates a DOM container and signals the PortalStore to render
 * a React component into it. The actual React rendering is done by
 * EditorPortalRenderer using createPortal.
 * 
 * ## Benefits:
 * - No createRoot per widget (performance)
 * - Full React context access (theme, state, etc.)
 * - Proper React lifecycle management
 * 
 * @abstract
 * @extends WidgetType
 */
export abstract class ReactBridgeWidget<P = any> extends WidgetType {
    /** Unique identifier for this widget instance */
    protected readonly id: string;

    /** React component to render */
    protected readonly component: FC<P>;

    /** Current props for the component */
    protected props: P;

    /** Container element (set in toDOM) */
    protected container: HTMLElement | null = null;

    /**
     * Creates a new ReactBridgeWidget.
     * 
     * @param component - React component to render in this widget
     * @param props - Initial props for the component
     */
    constructor(component: FC<P>, props: P) {
        super();
        this.id = generateId();
        this.component = component;
        this.props = props;
    }

    /**
     * Called by CodeMirror to create the DOM element for this widget.
     * Creates container and signals PortalStore to mount the React component.
     * 
     * @param view - The EditorView instance
     * @returns The container DOM element
     */
    toDOM(_view: EditorView): HTMLElement {
        // Create container element
        const container = document.createElement('span');
        container.className = 'cm-react-widget';
        container.style.display = 'inline-block';

        // Store reference
        this.container = container;

        // Signal portal store to mount
        portalStore.mount(this.id, container, this.component, this.props);

        return container;
    }

    /**
     * Called by CodeMirror when widget should update.
     * Updates props in PortalStore without recreating DOM.
     * 
     * @param dom - The existing DOM element
     * @param view - The EditorView instance  
     * @returns true to prevent CM6 from recreating the DOM
     */
    updateDOM(_dom: HTMLElement, _view: EditorView): boolean {
        // Update props in portal store
        portalStore.update(this.id, this.props);

        // Return true to tell CM6 we handled the update
        return true;
    }

    /**
     * Called by CodeMirror when the widget is being destroyed.
     * Signals PortalStore to unmount the React component.
     * 
     * @param dom - The DOM element being destroyed
     */
    destroy(_dom: HTMLElement): void {
        portalStore.unmount(this.id);
        this.container = null;
    }

    /**
     * Comparison function for widget equality.
     * Override this in subclasses to customize equality behavior.
     * 
     * @param other - Widget to compare against
     * @returns true if widgets are equal
     */
    eq(other: WidgetType): boolean {
        if (!(other instanceof ReactBridgeWidget)) {
            return false;
        }
        // Default: compare by id (same widget instance)
        return this.id === other.id;
    }

    /**
     * Update the props for this widget.
     * Call this before returning from a updateDOM if props changed.
     * 
     * @param newProps - New props to set
     */
    protected updateProps(newProps: Partial<P>): void {
        this.props = { ...this.props, ...newProps };
        if (this.container) {
            portalStore.update(this.id, this.props);
        }
    }

    /**
     * Get the current props.
     * 
     * @returns Current props
     */
    protected getProps(): P {
        return this.props;
    }

    /**
     * Get the unique ID of this widget.
     * 
     * @returns Widget ID
     */
    getId(): string {
        return this.id;
    }
}
