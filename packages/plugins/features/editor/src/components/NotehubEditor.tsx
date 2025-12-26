import React, { useRef, useEffect, useState } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorController } from '../logic/EditorController';
import { livePreview } from '../cm/live-preview';
import { BridgeProvider, EditorPortalRenderer } from '../cm/react-bridge';
import { FileText } from 'lucide-react';

/**
 * CodeMirror theme using CSS variables from theme-manager
 * Includes Live Preview styling for hidden/visible Markdown syntax
 */
const notehubTheme = EditorView.theme({
    '&': {
        height: '100%',
        backgroundColor: 'var(--nh-bg-main)',
        color: 'var(--nh-text-primary)',
        fontFamily: 'var(--nh-font-family-mono, "JetBrains Mono", monospace)',
        fontSize: '14px',
        lineHeight: '1.6'
    },
    '.cm-content': {
        caretColor: 'var(--nh-accent-primary)',
        padding: '1rem',
        transition: 'padding 0.3s ease'
    },
    '.cm-cursor': {
        borderLeftColor: 'var(--nh-accent-primary)'
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: 'var(--nh-accent-primary)',
        opacity: '0.3'
    },
    '.cm-activeLine': {
        backgroundColor: 'transparent !important',
        position: 'relative'
    },
    '.cm-activeLine::before': {
        content: '""',
        position: 'absolute',
        left: '0',
        top: '0',
        width: '3px',
        height: '100%',
        backgroundColor: 'var(--nh-accent-primary)',
        transition: 'opacity 0.2s ease-in-out'
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'rgba(255, 255, 255, 0.03)'
    },


    // ===== STYLES INJECTED GLOBALLY VIA <style> TAG =====
    // This resolves scoping issues with CodeMirror's ViewPlugin decorations
    /*
     * Structural styles for:
     * - .cm-code-block, .cm-code-block-bg
     * - .cm-blockquote (Standard Quotes)
     * - .cm-callout, .cm-callout-header (Admonitions)
     * are now in the render() method.
     */

    '.cm-gutters': {
        backgroundColor: 'var(--nh-bg-sidebar)',
        color: 'var(--nh-text-muted)',
        border: 'none',
        borderRight: '1px solid var(--nh-border-subtle)'
    },
    '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 0.5rem 0 1rem'
    },
    '.cm-scroller': {
        overflow: 'auto'
    },
    // ===== LIVE PREVIEW STYLES =====
    // Bold text
    '.cm-nh-bold': {
        fontWeight: 'bold',
        color: 'var(--nh-text-primary)'
    },
    // Italic text
    '.cm-nh-italic': {
        fontStyle: 'italic'
    },
    // Links
    '.cm-nh-link': {
        color: 'var(--nh-accent-primary)',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    // Strikethrough
    '.cm-nh-strikethrough': {
        textDecoration: 'line-through',
        opacity: '0.7'
    },
    // Inline code
    '.cm-nh-inline-code': {
        fontFamily: 'var(--nh-font-family-mono)',
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        padding: '0.15em 0.4em',
        borderRadius: '4px',
        color: 'var(--nh-accent-primary)'
    },
    // Heading text marks (inline styling)
    '.cm-nh-h1': { fontSize: '2em', fontWeight: '600' },
    '.cm-nh-h2': { fontSize: '1.6em', fontWeight: '600' },
    '.cm-nh-h3': { fontSize: '1.3em', fontWeight: '600' },
    '.cm-nh-h4': { fontSize: '1.1em', fontWeight: '600' },
    '.cm-nh-h5': { fontSize: '1.05em', fontWeight: '600' },
    '.cm-nh-h6': { fontSize: '1em', fontWeight: '600' },
    // Heading line decorations (line container styling)
    '.cm-nh-h1-line': {
        paddingTop: '0.5em',
        paddingBottom: '0.25em',
        borderBottom: '2px solid var(--nh-border-subtle)'
    },
    '.cm-nh-h2-line': {
        paddingTop: '0.4em',
        paddingBottom: '0.2em',
        borderBottom: '1px solid var(--nh-border-subtle)'
    },
    '.cm-nh-h3-line': { paddingTop: '0.3em', paddingBottom: '0.15em' },
    '.cm-nh-h4-line': { paddingTop: '0.2em', paddingBottom: '0.1em' },
    '.cm-nh-h5-line': { paddingTop: '0.15em', paddingBottom: '0.075em' },
    '.cm-nh-h6-line': { paddingTop: '0.1em', paddingBottom: '0.05em' },
    // Bullet points
    '.cm-nh-bullet': {
        color: 'var(--nh-text-muted)',
        display: 'inline-block',
        width: '1em',
        textAlign: 'center'
    }
}, { dark: true });

interface NotehubEditorProps {
    controller: EditorController;
}

/**
 * NotehubEditor - React wrapper for CodeMirror 6
 */
export const NotehubEditor: React.FC<NotehubEditorProps> = ({ controller }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [, forceUpdate] = useState({});

    // Subscribe to controller changes for re-renders
    useEffect(() => {
        const unsubscribe = controller.subscribe(() => {
            forceUpdate({});
        });
        return unsubscribe;
    }, [controller]);

    // Initialize CodeMirror
    useEffect(() => {
        if (!containerRef.current) return;

        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                controller.handleDocChange();
            }
        });

        const state = EditorState.create({
            doc: '',
            extensions: [
                keymap.of([...defaultKeymap, ...historyKeymap, ...closeBracketsKeymap]),
                history(),
                markdown({ base: markdownLanguage }),
                notehubTheme,
                livePreview(),
                closeBrackets(),
                updateListener,
                EditorView.lineWrapping
            ]
        });

        const view = new EditorView({
            state,
            parent: containerRef.current
        });

        viewRef.current = view;
        controller.setView(view);

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, [controller]);

    const currentPath = controller.currentPath;
    const isDirty = controller.isDirty;
    const fileName = currentPath ? (currentPath.split(/[\\/]/).pop() || currentPath) : '';

    return (
        <BridgeProvider>
            <div
                className="flex flex-col h-full w-full"
                style={{
                    backgroundColor: 'var(--nh-bg-main)',
                    position: 'relative'
                }}
            >
                {/* Header bar - only show when file is open */}
                {currentPath && (
                    <div
                        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
                        style={{
                            borderColor: 'var(--nh-border-subtle)',
                            backgroundColor: 'var(--nh-bg-sidebar)'
                        }}
                    >
                        <span className="text-sm font-medium" style={{ color: 'var(--nh-text-primary)' }}>
                            {fileName}
                            {isDirty && <span className="ml-1 text-[var(--nh-accent-primary)]">•</span>}
                        </span>
                        {isDirty && (
                            <span className="text-xs italic" style={{ color: 'var(--nh-text-muted)' }}>
                                unsaved
                            </span>
                        )}
                    </div>
                )}

                {/* Editor container - ALWAYS rendered so CodeMirror can mount */}
                <div
                    ref={containerRef}
                    className="flex-1 overflow-hidden"
                    style={{
                        display: currentPath ? 'block' : 'none'
                    }}
                >
                </div>

                {/* Portal Renderer for React widgets inside CodeMirror */}
                <EditorPortalRenderer />

                {/* Placeholder - shown when no file is open, positioned over editor area */}
                {!currentPath && (
                    <div
                        className="flex flex-col items-center justify-center flex-1 text-[var(--nh-text-muted)] select-none"
                    >
                        <FileText size={64} className="mb-4 opacity-20" />
                        <h2 className="text-xl font-medium mb-1">Notehub.md</h2>
                        <p className="text-sm opacity-60">Select a file from the explorer</p>
                    </div>
                )}
            </div>
        </BridgeProvider >
    );
};

export default NotehubEditor;
