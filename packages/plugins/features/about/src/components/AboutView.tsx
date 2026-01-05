import React, { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/plugin-shell';
import { Icon } from '@notehub/icon-manager';
import { Card, Label, Button } from '@notehub/ck-standard';

export const AboutView: React.FC = () => {
    const [version, setVersion] = useState<string>('Loading...');

    useEffect(() => {
        getVersion().then(setVersion).catch(() => setVersion('Unknown'));
    }, []);

    const openLink = (url: string) => {
        open(url);
    };

    return (
        <div className="flex flex-col items-center justify-center w-full min-h-full p-8 select-none text-[var(--nh-text-primary,#e0e0e0)]">
            {/* Header */}
            <div className="flex flex-col items-center mb-12">
                <div className="flex items-center justify-center w-32 h-32 mb-6 transition-transform hover:scale-105">
                    <div className="relative flex items-center justify-center w-full h-full rounded-3xl bg-gradient-to-br from-[var(--nh-accent-primary,#6b5ce7)]/10 to-blue-500/10 ring-1 ring-white/10 shadow-2xl shadow-[var(--nh-accent-primary,#6b5ce7)]/20 backdrop-blur-sm">
                        <Icon name="app-logo" size={96} className="text-[var(--nh-accent-primary,#6b5ce7)] drop-shadow-[0_0_15px_rgba(107,92,231,0.4)]" />
                    </div>
                </div>

                <Label variant="logo" className="mb-2 text-4xl">
                    Notehub.md
                </Label>

                <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 text-xs font-semibold tracking-wider text-[var(--nh-accent-primary,#6b5ce7)] uppercase rounded-full bg-[var(--nh-accent-primary,#6b5ce7)]/20 ring-1 ring-[var(--nh-accent-primary,#6b5ce7)]/30 backdrop-blur-md">
                        v{version}
                    </span>
                    <span className="px-3 py-1 text-xs font-semibold tracking-wider text-blue-200 uppercase rounded-full bg-blue-500/20 ring-1 ring-blue-500/30 backdrop-blur-md">
                        BETA
                    </span>
                </div>

                <p className="flex items-center text-sm font-medium text-[var(--nh-text-muted,#888)]">
                    Created by <span className="ml-1 font-bold text-[var(--nh-text-primary,#e0e0e0)]">khton</span>
                </p>
            </div>

            {/* Links */}
            <div className="w-full max-w-md space-y-2">
                <Card variant="interactive" padding="md" onClick={() => openLink('https://github.com/khton-tech')} className="flex items-center group">
                    <div className="flex items-center justify-center p-2 mr-4 transition-colors rounded-lg bg-[var(--nh-bg-surface,#1a1a1a)] group-hover:bg-[var(--nh-accent-primary,#6b5ce7)]/20">
                        <Icon name="git-pull-request" size={20} className="text-[var(--nh-text-muted,#a0a0a0)] group-hover:text-[var(--nh-accent-primary,#6b5ce7)]" />
                    </div>
                    <div className="flex flex-col items-start">
                        <Label variant="body" className="font-medium group-hover:text-white">khton-tech</Label>
                    </div>
                    <div className="ml-auto">
                        <Icon name="chevron-right" size={20} className="text-[var(--nh-text-muted,#666)] transition-transform group-hover:text-white group-hover:translate-x-1" />
                    </div>
                </Card>

                <Card variant="interactive" padding="md" onClick={() => openLink('https://t.me/khton_dev')} className="flex items-center group">
                    <div className="flex items-center justify-center p-2 mr-4 transition-colors rounded-lg bg-[var(--nh-bg-surface,#1a1a1a)] group-hover:bg-[var(--nh-accent-primary,#6b5ce7)]/20">
                        <Icon name="send" size={20} className="text-[var(--nh-text-muted,#a0a0a0)] group-hover:text-[var(--nh-accent-primary,#6b5ce7)]" />
                    </div>
                    <div className="flex flex-col items-start">
                        <Label variant="body" className="font-medium group-hover:text-white">khton.tech</Label>
                    </div>
                    <div className="ml-auto">
                        <Icon name="chevron-right" size={20} className="text-[var(--nh-text-muted,#666)] transition-transform group-hover:text-white group-hover:translate-x-1" />
                    </div>
                </Card>

                <Card variant="interactive" padding="md" onClick={() => openLink('https://github.com/khton-tech/notehub.md')} className="flex items-center group">
                    <div className="flex items-center justify-center p-2 mr-4 transition-colors rounded-lg bg-[var(--nh-bg-surface,#1a1a1a)] group-hover:bg-[var(--nh-accent-primary,#6b5ce7)]/20">
                        <Icon name="box" size={20} className="text-[var(--nh-text-muted,#a0a0a0)] group-hover:text-[var(--nh-accent-primary,#6b5ce7)]" />
                    </div>
                    <div className="flex flex-col items-start">
                        <Label variant="body" className="font-medium group-hover:text-white">notehub.md</Label>
                    </div>
                    <div className="ml-auto">
                        <Icon name="chevron-right" size={20} className="text-[var(--nh-text-muted,#666)] transition-transform group-hover:text-white group-hover:translate-x-1" />
                    </div>
                </Card>
            </div>

            <div className="mt-12 text-xs text-[var(--nh-text-muted,#666)]">
                &copy; {new Date().getFullYear()} Notehub.md. All rights reserved.
            </div>
        </div>
    );
};
