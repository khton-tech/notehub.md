/**
 * @fileoverview NotehubEditor - CodeMirror 6 React Wrapper
 * 
 * This module provides a React component that wraps CodeMirror 6,
 * integrating it with the Notehub theme system via CSS variables.
 * 
 * ## Theme Integration
 * 
 * The editor inherits colors from the Notehub theme manager:
 * - `--nh-bg-main` → Editor background
 * - `--nh-text-primary` → Text and caret color
 * - `--nh-accent-primary` → Selection and cursor
 * - `--nh-text-muted` → Line numbers
 * - `--nh-font-family-mono` → Editor font
 * 
 * ## Lifecycle
 * 
 * - **Mount**: Creates EditorView, registers with controller
 * - **Update**: Syncs content when file changes (avoids cursor jump)
 * - **Unmount**: Destroys EditorView, clears controller reference
 * 
 * ## Extensions Included
 * 
 * - Line numbers
 * - Active line highlighting
 * - Selection drawing
 * - Undo/redo history (Ctrl+Z, Ctrl+Shift+Z)
 * - Default keybindings
 * - Markdown syntax highlighting
 * 
 * @module @notehub/editor/components/NotehubEditor
 * @author Notehub Team
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { notehubMarkdown } from '../lezer';
import { exposeDebugFunction, removeDebugFunction } from '../debug/tree-visualizer';
import { EditorPortalRenderer } from '../bridge';
import { livePreviewExtension } from '../cm/live-preview';
import { inlineStylesExtension } from '../cm/inline-styles';
import { listsExtension } from '../cm/lists';
import { createDynamicWidgetExtension } from '../cm/DynamicWidgetPlugin';
import type { EditorController } from '../logic/EditorController';
import type { EditorSettings } from '../logic/EditorConfig';
import { EDITOR_CONFIG_DEFAULTS } from '../logic/EditorConfig';

// ========== CodeMirror Compartments ==========
// Compartments allow dynamic reconfiguration of extensions at runtime.
// They must be module-level singletons to preserve identity across renders.

/** Compartment for toggling line numbers on/off */
const lineNumbersCompartment = new Compartment();

/** Compartment for toggling line wrapping on/off */
const lineWrappingCompartment = new Compartment();

/** Compartment for dynamic font size changes */
const fontSizeCompartment = new Compartment();

/** Compartment for dynamic path/regex widgets */
const dynamicWidgetsCompartment = new Compartment();

/**
 * Create a theme extension with dynamic font size.
 * @param fontSize - Font size in pixels
 * @returns CodeMirror theme extension
 */
function createFontSizeTheme(fontSize: number) {
    return EditorView.theme({
        '&': { fontSize: `${fontSize}px` },
        '.cm-content': { fontSize: `${fontSize}px` },
    });
}

/**
 * Props for the NotehubEditor component
 */
interface NotehubEditorProps {
    /** Controller managing file operations and state */
    controller: EditorController;
    /** Initial/current content to display */
    content: string;
    /** Current file path (used as key for content change detection) */
    filePath?: string;
    /** Editor settings for dynamic reconfiguration */
    settings?: EditorSettings;
}

/**
 * CodeMirror theme that inherits from Notehub CSS variables.
 * Uses dark mode compatible styling.
 * @internal
 */
const notehubTheme = EditorView.theme({
    // Root editor element
    '&': {
        height: '100%',
        fontSize: '14px',
        fontFamily: 'var(--nh-font-family-mono, "JetBrains Mono", Consolas, monospace)',
    },

    // Scroller container
    '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'inherit',
    },

    // Content area
    '.cm-content': {
        caretColor: 'var(--nh-text-primary, #e0e0e0)',
        color: 'var(--nh-text-primary, #e0e0e0)',
        padding: '16px 0',
    },

    // Cursor styling
    '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--nh-accent-primary, #4a90e2)',
        borderLeftWidth: '2px',
    },

    // Selection styling
    '.cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--nh-accent-primary, #4a90e2) !important',
        opacity: '0.3',
    },
    '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--nh-accent-primary, #4a90e2)',
        opacity: '0.3',
    },

    // Active line highlight
    '.cm-activeLine': {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },

    // Gutter (line numbers) styling
    '.cm-gutters': {
        backgroundColor: 'var(--nh-bg-main, #1a1a1a)',
        color: 'var(--nh-text-muted, #666)',
        border: 'none',
        paddingRight: '8px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
        paddingLeft: '16px',
        paddingRight: '8px',
        minWidth: '3em',
    },

    // Line content padding
    '.cm-line': {
        padding: '0 16px',
    },
}, { dark: true });

/**
 * Base theme for scrollbar and background styling.
 * Separated from main theme for clarity.
 * @internal
 */
const baseTheme = EditorView.baseTheme({
    // Background color
    '&': {
        backgroundColor: 'var(--nh-bg-main, #1a1a1a)',
    },

    // Custom scrollbar styling (WebKit browsers)
    '.cm-scroller::-webkit-scrollbar': {
        width: '8px',
        height: '8px',
    },
    '.cm-scroller::-webkit-scrollbar-track': {
        background: 'transparent',
    },
    '.cm-scroller::-webkit-scrollbar-thumb': {
        background: 'var(--nh-border-subtle, #333)',
        borderRadius: '4px',
    },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': {
        background: 'var(--nh-border-secondary, #444)',
    },
});

/**
 * Theme for inline markdown styles (bold, italic, code, strikethrough).
 * @internal
 */
const inlineStylesTheme = EditorView.baseTheme({
    '.cm-md-bold': { fontWeight: 'bold', color: 'var(--nh-text-primary)' },
    '.cm-md-italic': { fontStyle: 'italic' },
    '.cm-md-code': {
        fontFamily: 'monospace',
        backgroundColor: 'var(--nh-bg-secondary)',
        borderRadius: '4px',
        padding: '0.1em 0.3em',
        color: 'var(--nh-accent-primary)',
    },
    '.cm-md-strikethrough': { textDecoration: 'line-through' },
    '.cm-list-bullet': {
        fontSize: '1.2em',
        lineHeight: '1',
        verticalAlign: 'middle',
    },
    '.cm-list-mark-ordered': {
        color: 'var(--nh-text-muted, #666)',
    },
    '.nh-checkbox-widget': {
        cursor: 'pointer',
        marginRight: '0.5em',
        verticalAlign: 'middle',
        accentColor: 'var(--nh-accent-primary)',
    },

    // Heading Marker (the ### when cursor is inside)
    '.cm-heading-marker': {
        color: 'var(--nh-text-muted, #666)',
        fontWeight: 'normal',
    },

    // Heading Levels (1-6)
    '.cm-heading-1': {
        fontSize: '2em',
        fontWeight: 'bold',
        color: 'var(--nh-text-primary)',
    },
    '.cm-heading-2': {
        fontSize: '1.6em',
        fontWeight: 'bold',
        color: 'var(--nh-text-primary)',
    },
    '.cm-heading-3': {
        fontSize: '1.3em',
        fontWeight: 'bold',
    },
    '.cm-heading-4': {
        fontSize: '1.15em',
        fontWeight: 'bold',
    },
    '.cm-heading-5': {
        fontSize: '1.05em',
        fontWeight: 'bold',
    },
    '.cm-heading-6': {
        fontSize: '1em',
        fontWeight: 'bold',
        color: 'var(--nh-text-muted, #999)',
    },
});



/**
 * NotehubEditor - CodeMirror 6 React wrapper component
 * 
 * Renders a fully-featured Markdown editor with:
 * - Theme integration via CSS variables
 * - Document change notifications to controller
 * - Content sync when file changes
 * - Proper cleanup on unmount
 * 
 * @example
 * ```tsx
 * <NotehubEditor
 *     controller={editorController}
 *     content={fileContent}
 *     filePath={currentFilePath}
 * />
 * ```
 * 
 * @component
 */
export const NotehubEditor: React.FC<NotehubEditorProps> = ({
    controller,
    content,
    filePath,
    settings = EDITOR_CONFIG_DEFAULTS
}) => {
    /** Ref to the container div where CodeMirror will mount */
    const containerRef = useRef<HTMLDivElement>(null);

    /** Ref to the EditorView instance */
    const viewRef = useRef<EditorView | null>(null);

    /**
     * Stable callback for handling content changes.
     * Notifies the controller when the document is modified.
     * The controller handles the isLoadingContent check internally.
     */
    const handleChange = useCallback(() => {
        controller.markDirty();
    }, [controller]);

    /**
     * Initialize CodeMirror on mount.
     * Creates the EditorState, EditorView, and registers extensions.
     */
    useEffect(() => {
        if (!containerRef.current) return;

        // Create editor state with initial content and extensions
        const state = EditorState.create({
            doc: content,
            extensions: [
                // Configurable extensions via Compartments
                lineNumbersCompartment.of(settings.showLineNumbers ? lineNumbers() : []),
                lineWrappingCompartment.of(settings.wordWrap ? EditorView.lineWrapping : []),
                fontSizeCompartment.of(createFontSizeTheme(settings.fontSize)),
                dynamicWidgetsCompartment.of(createDynamicWidgetExtension(controller.widgetRegistry)),

                // Core functionality
                highlightActiveLine(),
                drawSelection(),
                history(),

                // Keymaps for editing
                keymap.of([
                    ...defaultKeymap,
                    ...historyKeymap,
                ]),

                // Notehub Markdown (with Callout + WikiLink parsers)
                notehubMarkdown(),

                // Notehub theme integration
                notehubTheme,
                baseTheme,
                inlineStylesTheme,

                // Live Preview (callout decorations + lists)
                ...livePreviewExtension,
                ...inlineStylesExtension,
                ...listsExtension,

                // Document change listener
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        handleChange();
                    }
                }),
            ],
        });

        // Create editor view and mount to container
        const view = new EditorView({
            state,
            parent: containerRef.current,
        });

        // Store view reference and register with controller
        viewRef.current = view;
        controller.setEditorView(view);

        // Expose debug function for DevTools
        exposeDebugFunction(view);

        // Cleanup on unmount
        return () => {
            removeDebugFunction();
            controller.setEditorView(null);
            view.destroy();
            viewRef.current = null;
        };
    }, []); // Only run on mount/unmount

    /**
     * Sync content when file changes.
     * Only updates if content actually differs to prevent cursor jump.
     */
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;

        // Only update if content actually differs
        const currentContent = view.state.doc.toString();
        if (currentContent !== content) {
            // Set flag to prevent markDirty during programmatic content update
            controller.beginContentLoad();

            // Replace entire document content
            const transaction = view.state.update({
                changes: {
                    from: 0,
                    to: view.state.doc.length,
                    insert: content,
                },
            });
            view.dispatch(transaction);

            // Clear flag after dispatch
            // The update listener runs synchronously during dispatch, so we can clear immediately
            controller.endContentLoad();
        }
    }, [content, filePath, controller]);

    /**
     * Reconfigure compartments when settings change.
     * Dispatches effects to dynamically update line numbers, word wrap, and font size.
     */
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;

        // Collect all reconfiguration effects
        const effects = [
            lineNumbersCompartment.reconfigure(
                settings.showLineNumbers ? lineNumbers() : []
            ),
            lineWrappingCompartment.reconfigure(
                settings.wordWrap ? EditorView.lineWrapping : []
            ),
            fontSizeCompartment.reconfigure(
                createFontSizeTheme(settings.fontSize)
            ),
        ];

        // Dispatch all effects in a single transaction
        view.dispatch({ effects });
    }, [settings.showLineNumbers, settings.wordWrap, settings.fontSize]);

    /**
     * Subscribe to dynamic widget registry changes.
     * Reconfigures the editor extensions when new widgets are registered.
     */
    useEffect(() => {
        return controller.widgetRegistry.subscribe(() => {
            const view = viewRef.current;
            if (view) {
                view.dispatch({
                    effects: dynamicWidgetsCompartment.reconfigure(
                        createDynamicWidgetExtension(controller.widgetRegistry)
                    )
                });
            }
        });
    }, [controller]);

    return (
        <>
            <div
                ref={containerRef}
                className="notehub-editor"
                style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'var(--nh-bg-main)',
                    overflow: 'hidden',
                }}
            />
            <EditorPortalRenderer />
        </>
    );
};
