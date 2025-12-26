import React, { useRef, useEffect, useState } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorController } from '../logic/EditorController';
import { FileText } from 'lucide-react';

/**
 * CodeMirror theme using CSS variables from theme-manager
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
        padding: '1rem'
    },
    '.cm-cursor': {
        borderLeftColor: 'var(--nh-accent-primary)'
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: 'var(--nh-accent-primary)',
        opacity: '0.3'
    },
    '.cm-activeLine': {
        backgroundColor: 'rgba(255, 255, 255, 0.03)'
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'rgba(255, 255, 255, 0.03)'
    },
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
                keymap.of([...defaultKeymap, ...historyKeymap]),
                history(),
                markdown(),
                notehubTheme,
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
            />

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
    );
};

export default NotehubEditor;
