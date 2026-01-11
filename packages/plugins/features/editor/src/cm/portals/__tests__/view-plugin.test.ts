import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { PortalViewPlugin } from '../view-plugin';
import { PortalRegistry } from '../PortalRegistry';
import type { PortalSpec } from '../types';

describe('PortalViewPlugin', () => {
    let registry: PortalRegistry;
    let view: EditorView;

    // Helper to create a basic view state
    const createView = (doc: string, selection = { anchor: 0 }) => {
        const state = EditorState.create({
            doc,
            selection
        });

        return {
            state,
            visibleRanges: [{ from: 0, to: doc.length }],
            requestMeasure: vi.fn(),
            // Mock other necessary properties if needed
        } as unknown as EditorView;
    };

    beforeEach(() => {
        registry = PortalRegistry.getInstance();
        registry.clear();
    });

    afterEach(() => {
        registry.clear();
    });

    it('should register decorations for matching portals', () => {
        const spec: PortalSpec = {
            id: 'test',
            regex: /\[\[(.+?)\]\]/g,
            component: () => null
        };
        registry.register(spec);

        const text = 'Hello [[World]] here.';
        view = createView(text);

        const plugin = new PortalViewPlugin(view);

        // Access private computations via public property if exposed, 
        // or check the resulting decorations.
        // Since decorations is public:
        const iter = plugin.decorations.iter();

        let found = false;
        while (iter.value) {
            // Check if it's a replacement decoration (widget)
            // widget decorations have spec properties usually not easily accessible, 
            // but we can check the range.
            if (iter.from === 6 && iter.to === 15) {
                found = true;
            }
            iter.next();
        }

        expect(found).toBe(true);
    });

    it('should show source (Edit Mode) when cursor overlaps', () => {
        const spec: PortalSpec = {
            id: 'test',
            regex: /\[\[(.+?)\]\]/g,
            component: () => null
        };
        registry.register(spec);

        const text = 'Hello [[World]] here.';
        // Cursor at 8: Inside [[World]] (starts at 6, ends at 15)
        view = createView(text, { anchor: 8 });

        const plugin = new PortalViewPlugin(view);
        const iter = plugin.decorations.iter();

        let foundSource = false;
        while (iter.value) {
            // Check for mark decoration with class cm-portal-source
            // logic: builder.add(start, end, Decoration.mark({...}))
            // We can't easily check class directly on the internal object without casting,
            // generally Decoration.mark objects have spec.class
            const deco = iter.value as any;
            if (deco.spec?.class === 'cm-portal-source' && iter.from === 6 && iter.to === 15) {
                foundSource = true;
            }
            iter.next();
        }

        expect(foundSource).toBe(true);
    });

    it('should update decorations when registry updates', () => {
        const text = 'Hello [[World]]';
        view = createView(text);

        const plugin = new PortalViewPlugin(view);

        // Initially no portals
        expect(plugin.decorations.size).toBe(0);

        // Register portal
        const spec: PortalSpec = {
            id: 'test',
            regex: /\[\[(.+?)\]\]/g,
            component: () => null
        };
        registry.register(spec);

        // Trigger update (simulate what happens in onUpdate callback)
        // In the real code, onUpdate calls view.requestMeasure().
        // Here we can manually verify that computeDecorations uses the new registry state.
        // We'll simulate a view update cycle.

        // Force update call
        plugin.update({
            view,
            state: view.state,
            viewportChanged: false,
            docChanged: true, // Force recompute
            selectionSet: false
        } as any);

        expect(plugin.decorations.size).toBeGreaterThan(0);
    });

    it('should ensure global regex flag to avoid infinite loops', () => {
        // Register with non-global regex
        const spec: PortalSpec = {
            id: 'test-nonglobal',
            regex: /word/, // No 'g' flag
            component: () => null
        };
        registry.register(spec);

        const text = 'word word word';
        view = createView(text);

        // This should NOT hang
        const plugin = new PortalViewPlugin(view);

        // Should find all 3 matches
        let count = 0;
        const iter = plugin.decorations.iter();
        while (iter.value) {
            count++;
            iter.next();
        }

        expect(count).toBe(3);
    });
});
