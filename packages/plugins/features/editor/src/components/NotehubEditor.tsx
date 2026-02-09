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
import type { NotehubCore } from '@notehub/core';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, ViewPlugin, ViewUpdate, tooltips } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { notehubMarkdown } from '../lezer';
import { exposeDebugFunction, removeDebugFunction } from '../debug/tree-visualizer';
// EditorPortalRenderer moved to EditorLayout via controller registry
import { livePreviewExtension } from '../cm/live-preview';
import { inlineStylesExtension } from '../cm/inline-styles';
import { listsExtension } from '../cm/lists';
import { linksExtension } from '../cm/links';
import { codeBlocksExtension } from '../cm/code-blocks';
import { portalPlugin } from '../cm/portals';
import { slashMenu } from '../cm/slash-commands';
// import { PortalRegistry } from '../cm/portals/PortalRegistry';
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
const portalsCompartment = new Compartment();

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
    /** Core application instance */
    app: NotehubCore;
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
        transition: 'left 0.1s ease-out, top 0.1s ease-out',
    },
    // Disable transition while typing
    '.cm-editor.is-typing .cm-cursor': {
        transition: 'none !important',
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

    // Links
    '.cm-md-link': {
        color: 'var(--nh-accent-primary, #4a90e2)',
        textDecoration: 'none',
        cursor: 'pointer',
        borderBottom: '1px solid transparent',
        transition: 'all 0.2s ease',
    },
    '.cm-md-link:hover': {
        borderBottomColor: 'var(--nh-accent-primary, #4a90e2)',
    },
    // Specific styling for WikiLinks (internal navigation)
    '.cm-wiki-link': {
        borderBottom: '1px solid var(--nh-accent-primary)', // Always visible underline
        backgroundColor: 'rgba(74, 144, 226, 0.1)', // Subtle background
        padding: '0 2px',
        borderRadius: '3px',
    },
    '.cm-wiki-link:hover': {
        backgroundColor: 'rgba(74, 144, 226, 0.2)',
    },
    '.cm-wiki-link:active': {
        backgroundColor: 'var(--nh-accent-primary, #4a90e2)',
        color: 'var(--nh-bg-main, #1a1a1a)',
        borderBottomColor: 'transparent',
    },
    '.cm-md-link-source': {
        color: 'var(--nh-text-muted, #666)',
        fontStyle: 'italic',
    },

    // Horizontal Rule
    '.cm-hr-source': {
        color: 'var(--nh-text-muted, #666)',
    },

    // Blockquote (handled inline, but add base class)
    '.cm-blockquote': {
        color: 'var(--nh-text-secondary, #999)',
    },

    // Code Blocks
    '.cm-code-info': {
        color: 'var(--nh-text-muted, #666)',
        fontSize: '0.85em',
        fontStyle: 'italic',
    },
    '.cm-code-mark': {
        color: 'var(--nh-text-muted, #666)',
    },

    // Slash Command Menu (Deep Space Theme)
    '.cm-tooltip.cm-tooltip-autocomplete': {
        backgroundColor: 'var(--nh-bg-surface) !important',
        border: '1px solid var(--nh-border-subtle)',
        borderRadius: '8px',
        backdropFilter: 'blur(12px)',
        padding: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        zIndex: '9999 !important', // Ensure it sits on top
    },
    '.cm-tooltip-autocomplete > ul > li': {
        padding: '6px 8px',
        borderRadius: '4px',
        color: 'var(--nh-text-secondary)',
        fontFamily: 'var(--nh-font-family-sans)',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        backgroundColor: 'var(--nh-accent-primary)',
        color: 'var(--nh-bg-main)', // or white, depending on contrast
    },
});



/**
 * Plugin to manage cursor animation state.
 * Adds 'is-typing' class to editor when content changes, removes it after a timeout.
 * Removes it immediately on selection change (navigation).
 */
const cursorAnimationPlugin = ViewPlugin.fromClass(class {
    typingTimeout: number = -1;

    update(update: ViewUpdate) {
        if (update.docChanged) {
            // Content changed -> User is typing
            update.view.dom.classList.add('is-typing');

            // Clear existing timeout
            if (this.typingTimeout > -1) {
                clearTimeout(this.typingTimeout);
            }

            // Remove class after 100ms
            this.typingTimeout = window.setTimeout(() => {
                update.view.dom.classList.remove('is-typing');
                this.typingTimeout = -1;
            }, 100);
        } else if (update.selectionSet && !update.docChanged) {
            // Selection changed without content change -> Navigation
            // Remove typing state immediately so movement is smooth
            if (update.view.dom.classList.contains('is-typing')) {
                update.view.dom.classList.remove('is-typing');
                if (this.typingTimeout > -1) {
                    clearTimeout(this.typingTimeout);
                    this.typingTimeout = -1;
                }
            }
        }
    }
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
    app,
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
        if (viewRef.current) {
            const content = viewRef.current.state.doc.toString();
            controller.updateContent(content);
        }
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
                portalsCompartment.of(portalPlugin),
                cursorAnimationPlugin,

                // Core functionality
                tooltips(), // Default parent is editor wrapper, ensures consistent theming
                highlightActiveLine(),
                drawSelection(),
                history(),
                closeBrackets(),

                // Keymaps for editing
                keymap.of([
                    ...defaultKeymap,
                    ...historyKeymap,
                    ...closeBracketsKeymap,
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
                ...linksExtension,
                ...codeBlocksExtension,

                // Slash Menu (Must be last to override other autocompletions if any)
                slashMenu(),

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
     * Listen for external link events from editor widgets.
     * This effect is added based on the user's instruction, assuming `app.api`
     * is available in the scope where this component is used, or that `controller`
     * provides a similar mechanism. For the purpose of this edit, `app.api`
     * is treated as an external dependency that would be provided.
     * The `editorContainer.current` is mapped to `containerRef.current`.
     */
    useEffect(() => {
        // This part of the provided snippet seems to be from a different context
        // if (editor.current) {
        //     // Forward editor ready event
        //     editor.current.focus();
        // }

        // Listen for external link events from editor widgets
        const handleExternalLink = (e: Event) => {
            const customEvent = e as CustomEvent<{ url: string }>;
            if (customEvent.detail && customEvent.detail.url) {
                app.api.invoke('shell:open', customEvent.detail.url).catch(err => {
                    console.error('Failed to open external link:', err);
                });
            }
        };

        // Listen for internal wiki link events
        const handleWikiLink = async (e: Event) => {
            const customEvent = e as CustomEvent<{ target: string }>;
            if (customEvent.detail && customEvent.detail.target) {
                let target = customEvent.detail.target;
                console.log(`WikiLink Clicked: ${target}`);

                // Basic extension handling
                if (!target.toLowerCase().endsWith('.md')) {
                    target += '.md';
                }

                // Resolve path relative to current file
                let resolvedPath = target;
                if (filePath) {
                    // Handle both / and \ separators, and URL encoded content URIs
                    const separator = filePath.includes('\\') ? '\\' : '/';
                    const lastSepIndex = filePath.lastIndexOf(separator);

                    if (lastSepIndex !== -1) {
                        const parentDir = filePath.substring(0, lastSepIndex);
                        resolvedPath = `${parentDir}${separator}${target}`;
                    }
                }

                console.log(`Resolved WikiLink path: ${resolvedPath}`);

                try {
                    await controller.openFile(resolvedPath);
                } catch (err) {
                    console.error('Failed to open wiki link:', err);
                    // Optional: Ask to create file if not exists?
                    // For now, controller shows error dialog which is fine.
                }
            }
        };

        const currentContainer = containerRef.current; // Using containerRef.current as equivalent to editorContainer.current
        if (currentContainer) {
            currentContainer.addEventListener('notehub:external-link', handleExternalLink);
            currentContainer.addEventListener('notehub:wiki-link', handleWikiLink);
        }

        return () => {
            if (currentContainer) {
                currentContainer.removeEventListener('notehub:external-link', handleExternalLink);
                currentContainer.removeEventListener('notehub:wiki-link', handleWikiLink);
            }
        };
    }, [app, controller, filePath]); // Added filePath and controller to deps

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
     * Subscribe to portal registry changes.
     * With the new ViewPlugin, we might not need to reconfigure the compartment entirely,
     * but if the registry updates, we want to make sure the plugin catches it.
     * THE NEW PLUGIN listens to the registry itself!
     * So we MIGHT NOT need this useEffect at all if the plugin is standalone.
     * 
     * However, if we want to support hot-reloading of the plugin extension itself (rare),
     * we can keep it. But the requirement says the plugin listens to onUpdate.
     * 
     * Let's REMOVE this effect because the ViewPlugin handles updates internally 
     * via `registry.onUpdate` -> `view.requestMeasure`.
     */
    // useEffect(() => {
    //     return PortalRegistry.getInstance().onUpdate(() => { ... });
    // }, []);

    /**
     * Handle focus to set command context
     */
    const handleFocus = useCallback(() => {
        app.api.invoke('command:set-context', 'editor');
    }, [app]);

    /**
     * Handle blur to reset command context
     */
    const handleBlur = useCallback(() => {
        app.api.invoke('command:set-context', 'global');
    }, [app]);

    return (
        <>
            <div
                ref={containerRef}
                className="notehub-editor"
                style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'var(--nh-bg-main)',
                    // overflow: 'hidden', // Removed to prevent clipping of tooltips
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
                tabIndex={-1}
            />
            {/* Styles for Portal Source (Edit Mode) */}
            <style>{`
                .cm-portal-source {
                    opacity: 0.5;
                    background-color: rgba(128, 128, 128, 0.1);
                    border-radius: 4px;
                }
            `}</style>
        </>
    );
};
