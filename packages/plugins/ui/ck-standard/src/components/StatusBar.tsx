import React, { useState, useEffect } from 'react';
import { useNotehub } from '@notehub/core';
import { Icon } from '@notehub/icon-manager';

export interface StatusBarProps {
    status?: 'ready' | 'saving' | 'loading' | 'error';
    message?: string;
}

interface StatusState {
    status: 'ready' | 'saving' | 'loading' | 'error';
    message: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status: initialStatus, message: initialMessage }) => {
    const app = useNotehub();
    const [state, setState] = useState<StatusState>({
        status: initialStatus || 'ready',
        message: initialMessage || 'No file open'
    });

    // BUG-017 fix: Sync state when props change externally
    useEffect(() => {
        if (initialStatus !== undefined || initialMessage !== undefined) {
            setState(prev => ({
                status: initialStatus ?? prev.status,
                message: initialMessage ?? prev.message
            }));
        }
    }, [initialStatus, initialMessage]);

    // Subscribe to editor status events
    useEffect(() => {
        if (!app) return;

        const handleStatusChange = (payload: unknown) => {
            const { status, message } = payload as { status: StatusState['status']; message: string };
            setState({ status, message });
        };

        app.events.on('editor:status-changed', handleStatusChange);

        return () => {
            app.events.off('editor:status-changed', handleStatusChange);
        };
    }, [app]);

    const getIcon = () => {
        switch (state.status) {
            case 'ready':
                return <Icon name="check-circle" size={12} className="text-green-500" />;
            case 'loading':
                return <Icon name="refresh-cw" size={12} className="animate-spin text-blue-400" />;
            case 'saving':
                return <Icon name="save" size={12} className="animate-pulse text-yellow-400" />;
            case 'error':
                return <Icon name="alert-circle" size={12} className="text-red-500" />;
            default:
                return <Icon name="info" size={12} className="text-[var(--nh-text-muted)]" />;
        }
    };

    return (
        <div className="h-[24px] w-full flex items-center px-2 text-xs select-none bg-[var(--nh-bg-sidebar)] text-[var(--nh-text-muted)] border-t border-[var(--nh-accent-primary)]">
            <div className="flex items-center gap-2">
                {getIcon()}
                <span>{state.message}</span>
            </div>
            <div className="ml-auto opacity-50">
                UTF-8
            </div>
        </div>
    );
};
