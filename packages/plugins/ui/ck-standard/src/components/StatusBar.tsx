import React from 'react';
import { Icon } from '@notehub/icon-manager';

export interface StatusBarProps {
    status: 'ready' | 'saving' | 'error';
    message?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status, message }) => {
    return (
        <div className="h-[24px] w-full flex items-center px-2 text-xs select-none bg-transparent text-[var(--nh-text-muted)]">
            <div className="flex items-center gap-2">
                {status === 'ready' && <Icon name="check-circle" size={12} className="text-[var(--nh-text-muted)]" />}
                {status === 'saving' && <Icon name="refresh-cw" size={12} className="animate-spin text-[var(--nh-text-muted)]" />}
                {status === 'error' && <Icon name="alert-circle" size={12} className="text-red-500" />}

                <span>{message || (status === 'ready' ? 'Ready' : status === 'saving' ? 'Saving...' : 'Error')}</span>
            </div>
            <div className="ml-auto opacity-50">
                UTF-8
            </div>
        </div>
    );
};
