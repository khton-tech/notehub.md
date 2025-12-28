import React, { useEffect, useRef, useState } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import type { EditorController } from '../logic/EditorController';
import { EditorHeader } from './EditorHeader';
import { PortalRenderer } from '../lib/portal-bridge/PortalRenderer';

interface NotehubEditorProps {
    controller: EditorController;
}

/**
 * NotehubEditor - React wrapper around CodeMirror 6
 * 
 * Features:
 * - Lifecycle: Mount EditorView once, destroy on unmount
 * - Theming: Uses CSS variables from theme-manager
 * - Sizing: 100% width/height of parent container
 * - Integration: Wires up controller callbacks for text changes
 */
export const NotehubEditor: React.FC<NotehubEditorProps> = ({ controller }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    // Track file state for header
    const [filePath, setFilePath] = useState<string | null>(controller.getCurrentFilePath());
    const [isDirty, setIsDirty] = useState<boolean>(controller.getIsDirty());
    const viewRef = useRef<EditorView | null>(null);

    // Subscribe to controller state changes
    useEffect(() => {
        const interval = setInterval(() => {
            setFilePath(controller.getCurrentFilePath());
            setIsDirty(controller.getIsDirty());
        }, 100); // Poll every 100ms for state updates

        return () => clearInterval(interval);
    }, [controller]);

    useEffect(() => {
        if (!editorRef.current) return;

        // Create theme extension using CSS variables
        const themeExtension = EditorView.theme({
            '&': {
                height: '100%',
                width: '100%',
                backgroundColor: 'var(--nh-bg-main)',
                color: 'var(--nh-text-primary)',
                fontFamily: 'var(--nh-font-family-mono, monospace)',
                fontSize: '14px',
            },
            '.cm-content': {
                padding: '1rem',
                caretColor: 'var(--nh-accent-primary)',
            },
            '.cm-cursor': {
                borderLeftColor: 'var(--nh-accent-primary)',
            },
            '.cm-selectionBackground, ::selection': {
                backgroundColor: 'var(--nh-accent-primary, #4a90e2)',
                opacity: 0.3,
            },
            '&.cm-focused .cm-selectionBackground': {
                backgroundColor: 'var(--nh-accent-primary, #4a90e2)',
                opacity: 0.3,
            },
            '.cm-activeLine': {
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
            },
            '.cm-gutters': {
                backgroundColor: 'var(--nh-bg-main)',
                color: 'var(--nh-text-muted)',
                border: 'none',
                paddingRight: '0.5rem',
            },
            '.cm-activeLineGutter': {
                backgroundColor: 'transparent',
                color: 'var(--nh-text-primary)',
            },
            '.cm-lineNumbers .cm-gutterElement': {
                minWidth: '2rem',
                textAlign: 'right',
            },
        });

        // Update callback to trigger controller's onTextChange
        const updateListenerExtension = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                controller.onTextChange();
            }
        });

        // Create editor state with extensions
        const startState = EditorState.create({
            doc: '',
            extensions: [
                lineNumbers(),
                highlightActiveLineGutter(),
                highlightActiveLine(),
                history(),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                markdown(),
                syntaxHighlighting(defaultHighlightStyle),
                themeExtension,
                updateListenerExtension,
                controller.getDynamicExtensionsCompartment().of(controller.getDynamicExtensions()), // Initialize with already registered extensions
            ],
        });

        // Create editor view
        const view = new EditorView({
            state: startState,
            parent: editorRef.current,
        });

        // Register view with controller
        viewRef.current = view;
        controller.setView(view);

        // Cleanup on unmount
        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, [controller]);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <EditorHeader filePath={filePath} isDirty={isDirty} />
            <div ref={editorRef} style={{ flex: 1, minHeight: 0 }} />
            <PortalRenderer />
        </div>
    );
};
