/**
 * @fileoverview Notehub Editor Component
 * 
 * Main editor component that integrates CodeMirror with the Portal system
 * for rendering React widgets inline.
 * 
 * @module @notehub/editor/components/NotehubEditor
 */

import React, { useEffect, useRef, useCallback } from 'react';
import type { FC } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, drawSelection, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { PortalProvider } from '../bridge/PortalManager';
import { livePreviewExtension } from '../cm/view-plugin';

// ============================================================================
// Types
// ============================================================================

export interface NotehubEditorProps {
    /** Initial content to display */
    initialContent?: string;
    /** Called when content changes */
    onChange?: (content: string) => void;
    /** Optional CSS class for the container */
    className?: string;
}

// ============================================================================
// Theme Configuration
// ============================================================================

/**
 * Editor theme using Notehub CSS variables
 */
const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '14px',
        fontFamily: 'var(--nh-font-family, system-ui, sans-serif)'
    },
    '&.cm-focused': {
        outline: 'none'
    },
    '.cm-scroller': {
        fontFamily: 'var(--nh-font-family-mono, monospace)',
        lineHeight: '1.6',
        padding: '0.5rem 0'
    },
    '.cm-content': {
        caretColor: 'var(--nh-accent-primary, #6366f1)',
        padding: '0 1rem'
    },
    '.cm-line': {
        padding: '0.125rem 0'
    },
    '.cm-activeLine': {
        backgroundColor: 'var(--nh-bg-surface, rgba(99, 102, 241, 0.08))'
    },
    '.cm-selectionBackground': {
        backgroundColor: 'var(--nh-accent-primary, #6366f1) !important',
        opacity: '0.3'
    },
    '.cm-gutters': {
        backgroundColor: 'var(--nh-bg-sidebar, #1e1e2e)',
        color: 'var(--nh-text-muted, #6b7280)',
        border: 'none',
        borderRight: '1px solid var(--nh-border-subtle, #333348)'
    },
    '.cm-gutterElement': {
        padding: '0 0.75rem 0 0.5rem'
    },
    '.cm-cursor': {
        borderLeftColor: 'var(--nh-accent-primary, #6366f1)',
        borderLeftWidth: '2px'
    },
    // Bridge widget styles
    '.nh-bridge-widget': {
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle'
    }
}, { dark: true });

// ============================================================================
// Base Editor Styles (injected CSS)
// ============================================================================

const editorStyles = `
/* Base editor container */
.nh-editor-container {
    width: 100%;
    height: 100%;
    background-color: var(--nh-bg-main, #11111b);
    color: var(--nh-text-primary, #cdd6f4);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.nh-editor-container .cm-editor {
    flex: 1;
    overflow: auto;
}

/* Smart button widget */
.nh-smart-button {
    font-family: var(--nh-font-family, system-ui, sans-serif) !important;
}

.nh-smart-button:hover {
    filter: brightness(1.1);
}

.nh-smart-button:active {
    transform: scale(0.98);
}

/* Bridge widget container */
.nh-bridge-widget {
    display: inline-flex !important;
    align-items: center;
    vertical-align: middle;
}
`;

// ============================================================================
// Editor Component Implementation
// ============================================================================

/**
 * Core editor component (without Portal wrapper)
 */
const EditorCore: FC<NotehubEditorProps> = ({
    initialContent = '',
    onChange,
    className = ''
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    // Handle content changes
    const handleUpdate = useCallback((update: { docChanged: boolean; state: EditorState }) => {
        if (update.docChanged && onChange) {
            onChange(update.state.doc.toString());
        }
    }, [onChange]);

    // Initialize CodeMirror
    useEffect(() => {
        if (!containerRef.current) return;

        // Inject styles if not already present
        if (!document.getElementById('nh-editor-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'nh-editor-styles';
            styleEl.textContent = editorStyles;
            document.head.appendChild(styleEl);
        }

        const state = EditorState.create({
            doc: initialContent,
            extensions: [
                // Basic editing functionality
                lineNumbers(),
                highlightActiveLine(),
                drawSelection(),
                history(),
                keymap.of([...defaultKeymap, ...historyKeymap]),

                // Syntax highlighting
                syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

                // Theme
                editorTheme,

                // Live Preview with Portal widgets
                livePreviewExtension,

                // Update listener
                EditorView.updateListener.of(handleUpdate)
            ]
        });

        const view = new EditorView({
            state,
            parent: containerRef.current
        });

        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, []); // Only run once on mount

    // Update content if initialContent prop changes (for external updates)
    useEffect(() => {
        const view = viewRef.current;
        if (view && initialContent !== view.state.doc.toString()) {
            view.dispatch({
                changes: {
                    from: 0,
                    to: view.state.doc.length,
                    insert: initialContent
                }
            });
        }
    }, [initialContent]);

    return (
        <div
            ref={containerRef}
            className={`nh-editor-container ${className}`.trim()}
        />
    );
};

// ============================================================================
// Exported Component (with Portal Provider)
// ============================================================================

/**
 * NotehubEditor - Full editor component with Portal support
 * 
 * This component provides:
 * - CodeMirror-based text editing
 * - Live Preview of [[BUTTON::label]] syntax
 * - React widget rendering via Portal Bridge
 * - Theme-aware styling using CSS variables
 */
export const NotehubEditor: FC<NotehubEditorProps> = (props) => {
    return (
        <PortalProvider>
            <EditorCore {...props} />
        </PortalProvider>
    );
};

export default NotehubEditor;
