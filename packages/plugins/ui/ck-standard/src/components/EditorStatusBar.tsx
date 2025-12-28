import React, { useEffect, useState } from 'react';
import { useNotehub } from '@notehub/core';
import { StatusBar } from './StatusBar';

// Editor status type (mirrors @notehub/editor EditorController status)
type EditorStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

/**
 * EditorStatusBar - Wrapper for StatusBar that syncs with editor state
 * 
 * Subscribes to state-manager to get real-time editor status updates
 */
export const EditorStatusBar: React.FC = () => {
    const app = useNotehub();
    const [editorStatus, setEditorStatus] = useState<EditorStatus>('idle');
    const [currentFile, setCurrentFile] = useState<string | null>(null);

    useEffect(() => {
        if (!app) return;

        // Poll state-manager for editor status
        const interval = setInterval(async () => {
            try {
                const status = (await app.api.invoke('state:get', 'editor:status')) as EditorStatus | undefined;
                const file = (await app.api.invoke('state:get', 'editor:current-file')) as string | null | undefined;

                if (status !== undefined) {
                    setEditorStatus(status);
                }
                if (file !== undefined) {
                    setCurrentFile(file);
                }
            } catch {
                // Ignore errors during polling
            }
        }, 100);

        return () => clearInterval(interval);
    }, [app]);

    // Map EditorStatus to StatusBar status
    const mapStatus = (status: EditorStatus): 'ready' | 'saving' | 'error' => {
        switch (status) {
            case 'saving':
                return 'saving';
            case 'error':
                return 'error';
            case 'idle':
            case 'loading':
            case 'saved':
            default:
                return 'ready';
        }
    };

    // Generate message
    const getMessage = (): string => {
        if (!currentFile) {
            return 'No file open';
        }

        const fileName = currentFile.split(/[/\\]/).pop() || 'Untitled';

        switch (editorStatus) {
            case 'loading':
                return `Loading ${fileName}...`;
            case 'saving':
                return `Saving ${fileName}...`;
            case 'saved':
                return `Saved ${fileName}`;
            case 'error':
                return `Error with ${fileName}`;
            case 'idle':
            default:
                return fileName;
        }
    };

    return <StatusBar status={mapStatus(editorStatus)} message={getMessage()} />;
};
