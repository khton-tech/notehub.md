/**
 * @fileoverview Generic Portal Widget
 * 
 * A generic wrapper that allows any PortalSpec to be rendered as a CodeMirror widget.
 * Extends ReactBridgeWidget to provide React context and lifecycle management.
 */

import { ReactBridgeWidget } from '../../bridge/widget';
import { portalStore } from '../../bridge/store';
import type { PortalSpec } from './types';
import type { EditorView } from '@codemirror/view';

interface PortalWidgetProps {
    spec: PortalSpec;
    match: RegExpExecArray;
}

export class PortalWidget extends ReactBridgeWidget<PortalWidgetProps> {
    constructor(spec: PortalSpec, match: RegExpExecArray) {
        super(spec.component, { spec, match });
    }

    /**
     * Override eq to provide robust equality checking.
     * We compare the spec ID and the match content.
     */
    eq(other: PortalWidget): boolean {
        if (!(other instanceof PortalWidget)) return false;

        // 1. Same Portal Definition?
        if (this.props.spec.id !== other.props.spec.id) return false;

        // 2. Same Match Content?
        // We compare the full match string match[0]
        if (this.props.match[0] !== other.props.match[0]) return false;

        // Optimization: We don't need to deep compare the whole spec or match array
        // if the ID and the raw text are the same, it's the same portal instance.

        return true;
    }

    /**
     * Prevent CodeMirror from trying to handle events inside this widget.
     * This fixes the "RangeError: Invalid child in posBefore" crash.
     */
    ignoreEvent(_event: Event): boolean {
        return true;
    }

    /**
     * Create the DOM node.
     * We set the dataset.bridgeId so updateDOM can find it later.
     */
    toDOM(view: EditorView): HTMLElement {
        const dom = super.toDOM(view);
        dom.dataset.bridgeId = this.id;
        return dom;
    }

    /**
     * Update the existing DOM node.
     * We reuse the existing bridgeId to prevent re-renders.
     */
    updateDOM(dom: HTMLElement, _view: EditorView): boolean {
        const bridgeId = dom.dataset.bridgeId;
        if (bridgeId) {
            this.id = bridgeId;
            // Update the React component via the bridge
            portalStore.update(this.id, this.props);
            return true;
        }
        return false;
    }
}
