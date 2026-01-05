/**
 * @fileoverview Dynamic Widget Plugin - Renders widgets from the registry
 * 
 * Uses CodeMirror's MatchDecorator to scan for patterns defined in the
 * WidgetRegistry and renders them using ReactBridgeWidget.
 */

import { Decoration, MatchDecorator, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { FC } from 'react';
import { ReactBridgeWidget } from '../bridge/widget';
import { WidgetRegistry } from '../logic/WidgetRegistry';

/**
 * Concrete implementation of ReactBridgeWidget for dynamic widgets.
 * Passes the regex match result as props to the component.
 */
class DynamicReactWidget extends ReactBridgeWidget<{ match: RegExpMatchArray }> {
    constructor(component: FC<{ match: RegExpMatchArray }>, match: RegExpMatchArray) {
        super(component, { match });
    }

    // Use default eq (by ID) - MatchDecorator recreates widgets, 
    // but ReactBridgeWidget.updateDOM handles DOM reuse and prop updates.
}

/**
 * Creates the extension list for all registered widgets.
 * 
 * @param registry - The widget registry
 * @returns Array of CodeMirror extensions
 */
export function createDynamicWidgetExtension(registry: WidgetRegistry): Extension {
    const widgets = registry.getAll();

    return widgets.map(def => {
        // Normalize regex: handle string input and ensure 'g' flag
        let normalizedRegex: RegExp;
        try {
            if (def.regex instanceof RegExp) {
                const flags = (def.regex.flags || '').includes('g') ? (def.regex.flags || '') : (def.regex.flags || '') + 'g';
                normalizedRegex = new RegExp(def.regex.source, flags);
            } else {
                // Assume string input
                normalizedRegex = new RegExp(def.regex, 'g');
            }
        } catch (e) {
            console.error(`[DynamicWidgetPlugin] Invalid regex for widget ${def.id}:`, def.regex, e);
            return null;
        }

        if (!normalizedRegex) return null;

        const decorator = new MatchDecorator({
            regexp: normalizedRegex,
            decoration: (match) => Decoration.replace({
                widget: new DynamicReactWidget(def.component, match),
            })
        });

        return ViewPlugin.fromClass(class {
            decorations: DecorationSet;
            constructor(view: EditorView) {
                this.decorations = decorator.createDeco(view);
            }
            update(update: ViewUpdate) {
                this.decorations = decorator.updateDeco(update, this.decorations);
            }
        }, {
            decorations: v => v.decorations
        });
    }).filter((ext) => ext !== null) as Extension[];
}
