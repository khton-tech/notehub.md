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
    protected id: string;

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
        container.dataset.portalId = this.id;

        // CRITICAL: Prevent CodeMirror from walking into React-managed DOM
        // This prevents "RangeError: Invalid child in posBefore" during position calculations
        container.setAttribute('contenteditable', 'false');

        // Additional CM6 hint that this content should not be parsed
        container.setAttribute('data-cm-ignore', 'true');

        // CSS safeguards
        container.style.userSelect = 'none';
        container.style.webkitUserSelect = 'none';

        // Eliminate 300ms tap delay on mobile and prevent double-tap zoom
        container.style.touchAction = 'manipulation';

        // CAPTURE PHASE: Stop propagation so CodeMirror (which listens on bubble) never sees events.
        // IMPORTANT: We only preventDefault on mousedown (desktop) to prevent CM text selection.
        // We must NOT preventDefault on touchstart — doing so kills the touchstart→touchend→click
        // chain, which means React onClick handlers never fire on mobile.
        const captureOptions = { capture: true };

        container.addEventListener('mousedown', (e: Event) => {
            e.stopPropagation();
            e.preventDefault(); // Prevent CM text selection on desktop
        }, captureOptions);

        container.addEventListener('pointerdown', (e: Event) => {
            e.stopPropagation();
            // No preventDefault — let the pointer event chain complete for touch devices
        }, captureOptions);

        container.addEventListener('touchstart', (e: Event) => {
            e.stopPropagation();
            // NO preventDefault here! It would kill the click event on mobile.
        }, captureOptions);

        container.addEventListener('touchend', (e: Event) => {
            e.stopPropagation();
            // Let touchend propagate to React — this is part of the tap→click chain
        }, captureOptions);

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
    updateDOM(dom: HTMLElement, _view: EditorView): boolean {
        // Check if we can reuse the existing portal
        const existingId = dom.dataset.portalId;
        if (existingId) {
            // Adopt the existing ID
            this.id = existingId;
            this.container = dom;

            console.log(`[ReactBridgeWidget] Updating existing portal: ${this.id}`);
            // Update props in portal store
            portalStore.update(this.id, this.props);

            // Return true to tell CM6 we handled the update
            return true;
        }

        console.log('[ReactBridgeWidget] updateDOM failed - no existing ID found, forcing recreate');
        return false;
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
     * Tells CodeMirror to ignore events inside this widget's DOM.
     * 
     * This prevents the `RangeError: Invalid child in posBefore` crash that occurs
     * when CodeMirror tries to calculate cursor positions inside React-managed DOM
     * during mouse events (click, mousedown, etc.).
     * 
     * @param _event - The DOM event
     * @returns true to tell CodeMirror to ignore the event
     */
    ignoreEvent(_event: Event): boolean {
        // Tell CodeMirror: "I handle my own events, don't try to calculate 
        // cursor positions inside my React-managed DOM structure"
        return true;
    }

    /**
     * Comparison function for widget equality.
     * Uses JSON comparison of props to prevent unnecessary re-renders/recreations.
     * 
     * @param other - Widget to compare against
     * @returns true if widgets are equal (same component, same props)
     */
    eq(other: WidgetType): boolean {
        if (!(other instanceof ReactBridgeWidget)) {
            return false;
        }

        // Must be the same component type
        if (this.component !== other.component) {
            return false;
        }

        // Deep compare props using JSON serialization
        // This prevents destroying/recreating widgets when props haven't changed
        try {
            return JSON.stringify(this.props) === JSON.stringify(other.props);
        } catch {
            // If props aren't serializable, fall back to reference equality
            return this.props === other.props;
        }
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
