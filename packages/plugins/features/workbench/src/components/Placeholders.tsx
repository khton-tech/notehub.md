import React from 'react';
import { Files, Search, Box, FileText } from 'lucide-react';
import { RibbonButton, Label } from '@notehub/ck-standard';
import type { NotehubCore } from '@notehub/core';
import { SettingsButton } from './SettingsButton';

// Ribbon Placeholder
interface RibbonPlaceholderProps {
    app?: NotehubCore;
}

export const RibbonPlaceholder: React.FC<RibbonPlaceholderProps> = ({ app }) => {
    return (
        <div className="flex flex-col items-center gap-2 w-full py-2">
            <RibbonButton isActive={true} label="Explorer">
                <Files size={20} />
            </RibbonButton>
            <RibbonButton label="Search">
                <Search size={20} />
            </RibbonButton>

            <div className="mt-auto flex flex-col gap-2">
                <SettingsButton app={app} />
            </div>
        </div>
    );
};

// Explorer Placeholder
export const ExplorerPlaceholder: React.FC = () => {
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="h-9 flex items-center px-4 border-b border-[var(--nh-border-subtle)]">
                <Label variant="caption" className="uppercase tracking-wider font-bold">
                    Explorer
                </Label>
            </div>

            {/* Content */}
            <div className="p-4">
                <div className="flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer transition-colors text-[var(--nh-text-muted)] hover:text-[var(--nh-text-primary)]">
                    <Box size={16} />
                    <Label variant="body" className="text-inherit">
                        Phase 2 (Editor)
                    </Label>
                </div>
            </div>
        </div>
    );
};

// Editor Placeholder
export const EditorPlaceholder: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--nh-text-muted)] select-none">
            <FileText size={64} className="mb-4 opacity-20" />
            <Label variant="h2" className="mb-1">Notehub.md</Label>
            <Label variant="caption" className="opacity-60">No file is open</Label>
        </div>
    );
};
