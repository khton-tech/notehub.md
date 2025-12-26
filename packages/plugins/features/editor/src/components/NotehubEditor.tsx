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
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        /* ==================== CODE BLOCKS ==================== */
                        .cm-code-block-bg {
                            font-family: 'JetBrains Mono', 'Consolas', monospace !important;
                            background-color: var(--nh-bg-surface) !important;
                            border-left: 1px solid var(--nh-border-subtle);
                            border-right: 1px solid var(--nh-border-subtle);
                            padding: 0 16px !important;
                            line-height: 1.5 !important;
                        }
                        
                        .cm-code-block-first {
                            border-top: 1px solid var(--nh-border-subtle);
                            border-top-left-radius: 8px;
                            border-top-right-radius: 8px;
                            padding-top: 12px !important;
                            margin-top: 8px;
                        }
                        
                        .cm-code-block-last {
                            border-bottom: 1px solid var(--nh-border-subtle);
                            border-bottom-left-radius: 8px;
                            border-bottom-right-radius: 8px;
                            padding-bottom: 12px !important;
                            margin-bottom: 8px;
                        }
                        
                        .cm-code-block-badge {
                            position: absolute;
                            top: 4px;
                            right: 12px;
                            background-color: rgba(0, 0, 0, 0.4);
                            color: var(--nh-text-muted);
                            padding: 3px 8px;
                            font-size: 0.75em;
                            border-radius: 4px;
                            font-family: var(--nh-font-family-sans);
                            font-weight: 500;
                            pointer-events: none;
                            user-select: none;
                            z-index: 10;
                        }

                        /* ==================== STANDARD QUOTES ==================== */
                        .cm-blockquote {
                            border-left: 4px solid var(--nh-accent-secondary);
                            border-right: 1px solid transparent;
                            padding: 0 16px;
                            background-color: rgba(96, 165, 250, 0.05);
                            color: var(--nh-text-primary);
                            font-style: normal;
                            display: block;
                        }

                        .cm-blockquote-first {
                            border-top: 1px solid var(--nh-accent-secondary);
                            border-top-left-radius: 6px;
                            border-top-right-radius: 6px;
                            border-right: 1px solid var(--nh-accent-secondary);
                            padding-top: 8px;
                            margin-top: 8px;
                        }

                        .cm-blockquote-last {
                            border-bottom: 1px solid var(--nh-accent-secondary);
                            border-bottom-left-radius: 6px;
                            border-bottom-right-radius: 6px;
                            border-right: 1px solid var(--nh-accent-secondary);
                            padding-bottom: 8px;
                            margin-bottom: 8px;
                        }

                        /* ==================== CALLOUTS ==================== */
                        
                        /* HEADER WIDGET */
                        .cm-callout-header {
                            display: flex;
                            align-items: center;
                            padding: 10px 14px;
                            background-color: var(--nh-bg-surface);
                            border: 1px solid var(--nh-border-subtle);
                            border-left: 4px solid;
                            border-top-left-radius: 6px;
                            border-top-right-radius: 6px;
                            font-weight: 600;
                            user-select: none;
                            gap: 10px;
                        }
                        
                        .cm-callout-icon {
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }

                        /* HEADER LINE CONTAINER */
                        .cm-callout-header-line {
                            padding-left: 0 !important; 
                        }
                        
                        /* BODY LINE CONTAINER */
                        .cm-callout-body {
                            background-color: var(--nh-bg-surface);
                            border-left: 1px solid var(--nh-border-subtle);
                            border-right: 1px solid var(--nh-border-subtle);
                            padding: 8px 16px;
                        }

                        .cm-callout-last {
                            border-bottom: 1px solid var(--nh-border-subtle);
                            border-bottom-left-radius: 6px;
                            border-bottom-right-radius: 6px;
                            padding-bottom: 12px;
                            margin-bottom: 8px;
                        }
                        
                        /* MARGINS & RADIUS managed by FIRST/LAST classes */
                        .cm-callout-first.cm-callout-header-line {
                            margin-top: 0.5em;
                        }
                        
                        .cm-callout-last.cm-callout-body {
                            border-bottom: 1px solid var(--nh-border-subtle);
                            border-bottom-left-radius: 6px;
                            border-bottom-right-radius: 6px;
                            padding-bottom: 8px;
                            margin-bottom: 0.5em;
                        }

                        /* Callout Type Border Colors */
                        .cm-callout-note .cm-callout-header, 
                        .cm-callout-info .cm-callout-header { 
                            border-left-color: #60a5fa; 
                        }

                        .cm-callout-success .cm-callout-header, 
                        .cm-callout-check .cm-callout-header { 
                            border-left-color: #4ade80; 
                        }

                        .cm-callout-warning .cm-callout-header, 
                        .cm-callout-caution .cm-callout-header { 
                            border-left-color: #fb923c; 
                        }

                        .cm-callout-danger .cm-callout-header, 
                        .cm-callout-error .cm-callout-header { 
                            border-left-color: #f87171; 
                        }

                        .cm-callout-tip .cm-callout-header, 
                        .cm-callout-important .cm-callout-header { 
                            border-left-color: #c084fc; 
                        }

                        .cm-callout-quote .cm-callout-header, 
                        .cm-callout-abstract .cm-callout-header { 
                            border-left-color: #cbd5e1; 
                        }

                        /* Callout Type Text Colors */
                        .cm-callout-info .cm-callout-header, 
                        .cm-callout-note .cm-callout-header { 
                            color: #60a5fa; 
                        }
                        
                        .cm-callout-success .cm-callout-header, 
                        .cm-callout-check .cm-callout-header { 
                            color: #4ade80; 
                        }
                        
                        .cm-callout-warning .cm-callout-header, 
                        .cm-callout-caution .cm-callout-header { 
                            color: #fb923c; 
                        }
                        
                        .cm-callout-danger .cm-callout-header, 
                        .cm-callout-error .cm-callout-header { 
                            color: #f87171; 
                        }
                        
                        .cm-callout-tip .cm-callout-header, 
                        .cm-callout-important .cm-callout-header { 
                            color: #c084fc; 
                        }
                        
                        .cm-callout-quote .cm-callout-header, 
                        .cm-callout-abstract .cm-callout-header { 
                            color: #cbd5e1; 
                        }
                        
                        /* Hide elements */
                        .cm-code-block-fence-hide { 
                            display: none !important; 
                        }

                        /* Link Hover Effect */
                        .cm-nh-link:hover {
                            text-decoration: underline;
                            opacity: 0.8;
                        }
                    ` }} />
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
        </BridgeProvider>
    );
};

export default NotehubEditor;
