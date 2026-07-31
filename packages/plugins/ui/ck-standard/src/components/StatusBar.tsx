import React from 'react';
import { Icon } from '@notehub/icon-manager';

export interface StatusBarProps {
    status: 'ready' | 'saving' | 'error';
    message?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status, message }) => {
    return (
        <div className="h-full w-full flex items-center justify-between text-[11px] font-medium tracking-tight select-none bg-transparent text-[var(--nh-text-muted)]">
            <div className="flex items-center gap-1.5">
                {status === 'ready' && <Icon name="check-circle" size={12} className="text-[var(--nh-accent-primary)] opacity-80" />}
                {status === 'saving' && <Icon name="refresh-cw" size={12} className="animate-spin text-[var(--nh-accent-primary)]" />}
                {status === 'error' && <Icon name="alert-circle" size={12} className="text-red-400" />}

                <span className="text-[var(--nh-text-secondary)]">{message || (status === 'ready' ? 'Ready' : status === 'saving' ? 'Saving...' : 'Error')}</span>
            </div>
            <div className="ml-auto opacity-70 text-[10px] font-mono tracking-wider uppercase">
                UTF-8
            </div>
        </div>
    );
};
