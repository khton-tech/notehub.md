/**
 * @fileoverview The Master Decorator Plugin
 * 
 * A single ViewPlugin that manages ALL portal decorations.
 * - Iterates over all registered portals in PortalRegistry
 * - Implements "Live Preview" (Edit Mode) logic
 * - Handles updates efficiently
 */

import { Decoration, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { PortalRegistry } from './PortalRegistry';
import { PortalWidget } from './PortalWidget';

/**
 * Ensures a regex has the global flag for iteration.
 */
function ensureGlobal(regex: RegExp): RegExp {
    if (regex.flags.includes('g')) return regex;
    return new RegExp(regex.source, regex.flags + 'g');
}

export class PortalViewPlugin {
    decorations: DecorationSet;
    private unsubscribe: () => void;
    private registry: PortalRegistry;

    constructor(view: EditorView) {
        this.registry = PortalRegistry.getInstance();
        this.decorations = this.computeDecorations(view);

        // Listen for registry updates (new portals registered)
        this.unsubscribe = this.registry.onUpdate(() => {
            // Force re-decoration by dispatching a dummy effect or reconfiguring
            // Since this is a ViewPlugin, we can't easily force a re-init, 
            // but we can trigger a measure request which might help, 
            // or we rely on the fact that computeDecorations reads from registry.
            // Best way to force semantic update:
            view.requestMeasure();
        });
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = this.computeDecorations(update.view);
        }
    }

    destroy() {
        this.unsubscribe();
    }

    private computeDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const { state, visibleRanges } = view;
        const selectionPromises = state.selection.ranges;
        const portals = this.registry.getAll();

        // sort portals by some priority? For now, order of registration.

        for (const { from, to } of visibleRanges) {
            const text = state.doc.sliceString(from, to);

            // Iterate ALL portals
            for (const spec of portals) {
                try {
                    const regex = ensureGlobal(spec.regex);
                    regex.lastIndex = 0; // Essential reset

                    let match;
                    while ((match = regex.exec(text))) {
                        const start = from + match.index;
                        const end = start + match[0].length;

                        // LIVE PREVIEW CHECK:
                        // If selection overlaps with the range, show source (Edit Mode)
                        // otherwise show widget (View Mode)
                        let isIntersecting = false;
                        for (const range of selectionPromises) {
                            // Touch logic: if cursor touches the edges, it's inside?
                            // Usually: range.from <= end && range.to >= start
                            // Let's use strict overlap for now
                            if (range.from <= end && range.to >= start) {
                                isIntersecting = true;
                                break;
                            }
                        }

                        if (isIntersecting) {
                            // Edit Mode: Show Source + Styling
                            builder.add(start, end, Decoration.mark({
                                class: 'cm-portal-source'
                            }));
                        } else {
                            // View Mode: Replace with Widget
                            builder.add(start, end, Decoration.replace({
                                widget: new PortalWidget(spec, match),
                                inclusive: false // allow cursor to enter from sides?
                            }));
                        }
                    }
                } catch (e) {
                    console.error(`[PortalPlugin] Error processing portal ${spec.id}`, e);
                }
            }
        }

        return builder.finish();
    }
}

export const portalPlugin = ViewPlugin.fromClass(PortalViewPlugin, {
    decorations: v => v.decorations,
    provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.decorations || Decoration.none)
});
