import React, { useState, useEffect, useCallback } from 'react';
import { Files, Search, Box, FileText } from 'lucide-react';
import { RibbonButton, Label } from '@notehub/ck-standard';
import type { NotehubCore } from '@notehub/core';
import { SettingsButton } from './SettingsButton';

// Ribbon Placeholder
interface RibbonPlaceholderProps {
    app?: NotehubCore;
}

export const RibbonPlaceholder: React.FC<RibbonPlaceholderProps> = ({ app }) => {
    const [explorerLabel, setExplorerLabel] = useState('Explorer');
    const [searchLabel, setSearchLabel] = useState('Search');

    const loadStrings = useCallback(async () => {
        if (!app) return;
        try {
            const t = (key: string) => app.api.invoke<string>('i18n:t', key);
            const [e, s] = await Promise.all([t('workbench.explorer'), t('workbench.search')]);
            setExplorerLabel(e ?? 'Explorer');
            setSearchLabel(s ?? 'Search');
        } catch { /* use defaults */ }
    }, [app]);

    useEffect(() => {
        if (!app) return;
        loadStrings();
        app.events.on('i18n:language-changed', loadStrings);
        return () => app.events.off('i18n:language-changed', loadStrings);
    }, [app, loadStrings]);

    return (
        <div className="flex flex-col items-center gap-2 w-full py-2">
            <RibbonButton isActive={true} label={explorerLabel}>
                <Files size={20} />
            </RibbonButton>
            <RibbonButton label={searchLabel}>
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
interface EditorPlaceholderProps {
    app?: NotehubCore;
}

export const EditorPlaceholder: React.FC<EditorPlaceholderProps> = ({ app }) => {
    const [noFileLabel, setNoFileLabel] = useState('No file is open');

    const loadStrings = useCallback(async () => {
        if (!app) return;
        try {
            const v = await app.api.invoke<string>('i18n:t', 'workbench.noFileOpen');
            setNoFileLabel(v ?? 'No file is open');
        } catch { /* use defaults */ }
    }, [app]);

    useEffect(() => {
        if (!app) return;
        loadStrings();
        app.events.on('i18n:language-changed', loadStrings);
        return () => app.events.off('i18n:language-changed', loadStrings);
    }, [app, loadStrings]);

    return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--nh-text-muted)] select-none">
            <FileText size={64} className="mb-4 opacity-20" />
            <Label variant="h2" className="mb-1">Notehub.md</Label>
            <Label variant="caption" className="opacity-60">{noFileLabel}</Label>
        </div>
    );
};
