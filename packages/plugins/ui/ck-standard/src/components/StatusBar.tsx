import React from 'react';
import { CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';

export interface StatusBarProps {
    status: 'ready' | 'saving' | 'error';
    message?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status, message }) => {
    return (
        <div className="h-[24px] w-full flex items-center px-2 text-xs select-none bg-[var(--nh-bg-sidebar)] text-[var(--nh-text-muted)] border-t border-[var(--nh-accent-primary)]">
            <div className="flex items-center gap-2">
                {status === 'ready' && <CheckCircle2 size={12} className="text-[var(--nh-text-muted)]" />}
                {status === 'saving' && <RefreshCw size={12} className="animate-spin text-[var(--nh-text-muted)]" />}
                {status === 'error' && <AlertCircle size={12} className="text-red-500" />}

                <span>{message || (status === 'ready' ? 'Ready' : status === 'saving' ? 'Saving...' : 'Error')}</span>
            </div>
            <div className="ml-auto opacity-50">
                UTF-8
            </div>
        </div>
    );
};
