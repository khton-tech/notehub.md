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
 * Converts string to RegExp if needed.
 */
function ensureGlobal(regex: RegExp | string): RegExp {
    if (typeof regex === 'string') {
        return new RegExp(regex, 'g');
    }
    if (regex.flags.includes('g')) return regex;
    return new RegExp(regex.source, regex.flags + 'g');
}

export class PortalViewPlugin {
    decorations: DecorationSet;
    atomicDecorations: DecorationSet;
    private unsubscribe: () => void;
    private registry: PortalRegistry;
    private view: EditorView;

    constructor(view: EditorView) {
        this.view = view;
        this.registry = PortalRegistry.getInstance();
        const { main, atomic } = this.computeDecorations(view);
        this.decorations = main;
        this.atomicDecorations = atomic;

        // Listen for registry updates (new portals registered)
        this.unsubscribe = this.registry.onUpdate(() => {
            const { main, atomic } = this.computeDecorations(this.view);
            this.decorations = main;
            this.atomicDecorations = atomic;
            this.view.requestMeasure();
        });
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            const { main, atomic } = this.computeDecorations(update.view);
            this.decorations = main;
            this.atomicDecorations = atomic;
        }
    }

    destroy() {
        this.unsubscribe();
    }

    private computeDecorations(view: EditorView): { main: DecorationSet, atomic: DecorationSet } {
        const builder = new RangeSetBuilder<Decoration>();
        const atomicBuilder = new RangeSetBuilder<Decoration>();
        const { state, visibleRanges } = view;
        const selectionPromises = state.selection.ranges;
        const portals = this.registry.getAll();
        // console.log('[PortalViewPlugin] Compute decorations. Portals:', portals.map(p => p.id));
        // console.log('[PortalViewPlugin] Visible ranges:', visibleRanges);

        // sort portals by some priority? For now, order of registration.

        for (const { from, to } of visibleRanges) {
            const text = state.doc.sliceString(from, to);
            // console.log('[PortalViewPlugin] Scanning text:', text);

            // Iterate ALL portals
            for (const spec of portals) {
                try {
                    const regex = ensureGlobal(spec.regex);
                    regex.lastIndex = 0; // Essential reset

                    let match;
                    while ((match = regex.exec(text))) {
                        const start = from + match.index;
                        const end = start + match[0].length;

                        const matchRange = { from: start, to: end };

                        // LIVE PREVIEW CHECK:
                        // If selection overlaps with the range (touching edges counts), show source (Edit Mode)
                        let isIntersecting = false;
                        for (const range of selectionPromises) {
                            if (range.from <= matchRange.to && range.to >= matchRange.from) {
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
                            const widgetDeco = Decoration.replace({
                                widget: new PortalWidget(spec, match),
                                inclusive: false
                            });
                            builder.add(start, end, widgetDeco);
                            atomicBuilder.add(start, end, widgetDeco);
                        }
                    }
                } catch (e) {
                    console.error(`[PortalPlugin] Error processing portal ${spec.id}`, e);
                }
            }
        }

        return { main: builder.finish(), atomic: atomicBuilder.finish() };
    }
}

export const portalPlugin = ViewPlugin.fromClass(PortalViewPlugin, {
    decorations: v => v.decorations,
    provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.atomicDecorations || Decoration.none)
});
