/**
 * @fileoverview Command Palette Plugin Entry Point
 *
 * Provides a spotlight-style command palette for quick command execution.
 * Uses createRoot to mount the modal directly to the DOM, similar to dialog-manager.
 *
 * ## Usage
 * - Press `Mod+P` or `F1` to open the palette
 * - Type to filter commands
 * - Arrow keys to navigate, Enter to execute
 *
 * @module @notehub/command-palette
 */

import { useState, useEffect, useRef, useCallback, type FC, type KeyboardEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SystemPlugin } from '@notehub/core';
import type { PluginManifest, NotehubCore } from '@notehub/core';
import type { VisibleCommand } from '@notehub.md/api';
import { Card, ListItem } from '@notehub/ck-standard';
import { Icon } from '@notehub/icon-manager';
import { getSearchCandidates } from './utils/layoutEngine';
import en from './locales/en';
import ru from './locales/ru';

// ============================================================================
// PaletteModal Component
// ============================================================================

interface PaletteModalProps {
    commands: VisibleCommand[];
    onExecute: (id: string) => void;
    onClose: () => void;
    app: NotehubCore;
}

const PALETTE_DEFAULTS = {
    placeholder: 'Type a command...',
    noResults: 'No commands found',
    navigate: 'navigate',
    select: 'select',
    close: 'close',
};

const PaletteModal: FC<PaletteModalProps> = ({ commands, onExecute, onClose, app }) => {
    const [query, setQuery] = useState('');
    const [filteredCommands, setFilteredCommands] = useState<VisibleCommand[]>(commands);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [strings, setStrings] = useState(PALETTE_DEFAULTS);

    useEffect(() => {
        const load = async () => {
            try {
                const t = (key: string) => app.api.invoke<string>('i18n:t', key);
                const results = await Promise.all([
                    t('command-palette.placeholder'),
                    t('command-palette.noResults'),
                    t('command-palette.hints.navigate'),
                    t('command-palette.hints.select'),
                    t('command-palette.hints.close'),
                ]);
                setStrings({
                    placeholder: results[0] ?? PALETTE_DEFAULTS.placeholder,
                    noResults: results[1] ?? PALETTE_DEFAULTS.noResults,
                    navigate: results[2] ?? PALETTE_DEFAULTS.navigate,
                    select: results[3] ?? PALETTE_DEFAULTS.select,
                    close: results[4] ?? PALETTE_DEFAULTS.close,
                });
            } catch { /* use defaults */ }
        };
        load();
        app.events.on('i18n:language-changed', load);
        return () => app.events.off('i18n:language-changed', load);
    }, [app]);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Focus input on mount
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

    // Filter commands based on query (with cross-layout support)
    useEffect(() => {
        if (!query.trim()) {
            setFilteredCommands(commands);
            setSelectedIndex(0);
            return;
        }

        // Generate search candidates for all layout interpretations
        const candidates = getSearchCandidates(query.toLowerCase());

        // Filter commands: match if ANY candidate is a substring of the command name or id
        const filtered = commands.filter(cmd => {
            const name = cmd.name.toLowerCase();
            const id = cmd.id.toLowerCase();
            return candidates.some(
                variant => name.includes(variant) || id.includes(variant)
            );
        });
        setFilteredCommands(filtered);
        setSelectedIndex(0);
    }, [query, commands]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    Math.min(prev + 1, filteredCommands.length - 1)
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    onExecute(filteredCommands[selectedIndex].id);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [filteredCommands, selectedIndex, onExecute, onClose]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current && listRef.current.children[selectedIndex]) {
            const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
            selectedItem.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    // Handle click outside to close
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[400] flex items-start justify-center pt-[8vh] bg-black/55 backdrop-blur-xl animate-[paletteIn_0.15s_ease-out]"
            onClick={handleBackdropClick}
        >
            <Card
                variant="glass"
                padding="none"
                className="w-full max-w-2xl shadow-[0_24px_64px_rgba(0,0,0,0.65)] rounded-2xl border border-[var(--nh-border-secondary,rgba(255,255,255,0.08))] overflow-hidden animate-[paletteSlide_0.15s_cubic-bezier(0.16,1,0.3,1)] bg-[var(--nh-glass-bg,rgba(20,22,29,0.85))]"
            >
                {/* Search Input Header */}
                <div className="relative flex items-center px-4 py-3 border-b border-[var(--nh-border-subtle,rgba(255,255,255,0.06))]">
                    <Icon name="search" size={18} className="text-[var(--nh-text-muted)] mr-3 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={strings.placeholder}
                        onKeyDown={handleKeyDown}
                        data-palette-input="true"
                        autoFocus
                        className="
                            w-full text-base font-medium
                            bg-transparent border-0
                            text-[var(--nh-text-primary,#F1F5F9)]
                            placeholder:text-[var(--nh-text-muted,rgba(255,255,255,0.45))]
                            focus:outline-none
                        "
                    />
                </div>

                {/* Command List */}
                <div
                    ref={listRef}
                    role="listbox"
                    className="max-h-[400px] overflow-y-auto p-1.5"
                >
                    {filteredCommands.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-[var(--nh-text-muted,rgba(255,255,255,0.45))]">
                            <Icon name="search" size={28} className="opacity-40 mb-2" />
                            <span className="text-sm">{strings.noResults}</span>
                        </div>
                    ) : (
                        filteredCommands.map((cmd, index) => (
                            <ListItem
                                key={cmd.id}
                                active={index === selectedIndex}
                                accessory={cmd.hotkey}
                                onClick={() => onExecute(cmd.id)}
                            >
                                {cmd.name}
                            </ListItem>
                        ))
                    )}
                </div>

                {/* Footer hint */}
                <div className="flex items-center justify-between px-4 py-2.5 text-[11px] text-[var(--nh-text-muted,rgba(255,255,255,0.45))] border-t border-[var(--nh-border-subtle,rgba(255,255,255,0.06))] bg-[var(--nh-bg-sidebar)]">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[10px] font-mono text-[var(--nh-text-secondary)] shadow-sm">↑↓</kbd>
                            {strings.navigate}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[10px] font-mono text-[var(--nh-text-secondary)] shadow-sm">↵</kbd>
                            {strings.select}
                        </span>
                    </div>
                    <span className="flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[10px] font-mono text-[var(--nh-text-secondary)] shadow-sm">esc</kbd>
                        {strings.close}
                    </span>
                </div>
            </Card>

            {/* CSS Keyframes */}
            <style>{`
                @keyframes paletteIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes paletteSlide {
                    from { transform: scale(0.95) translateY(-10px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

// ============================================================================
// Plugin
// ============================================================================

/**
 * CommandPalettePlugin - Spotlight-style command palette
 */
export class CommandPalettePlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.features.command-palette',
        name: 'Command Palette',
        version: '0.1.5',
        type: 'feature',
        dependencies: [
            'nh.system.command-manager',
            'nh.system.logger',
            'nh.system.i18n',
            'nh.ui.ck-standard',
            'nh.ui.icon-manager',
        ],
    };

    private paletteContainer: HTMLDivElement | null = null;
    private paletteRoot: Root | null = null;
    private isOpen = false;

    /**
     * Open the palette
     */
    private openPalette = async (): Promise<void> => {
        if (this.isOpen || !this.paletteRoot) return;

        this.isOpen = true;

        // Fetch visible commands
        const commands = await this.app.api.invoke('command:get-visible');

        this.log('info', `Opening palette with ${commands.length} commands`);

        this.paletteRoot.render(
            <PaletteModal
                commands={commands}
                onExecute={(id) => this.executeAndClose(id)}
                onClose={() => this.closePalette()}
                app={this.app}
            />
        );
    };

    /**
     * Execute a command and close the palette
     */
    private executeAndClose = async (id: string): Promise<void> => {
        this.closePalette();
        await this.app.api.invoke('command:execute', id);
    };

    /**
     * Close the palette
     */
    private closePalette = (): void => {
        if (!this.isOpen) return;

        this.isOpen = false;
        if (this.paletteRoot) {
            this.paletteRoot.render(null);
        }
        this.log('info', 'Palette closed');
    };

    /**
     * Initialize the plugin
     */
    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading...');

        // Register i18n namespace
        this.app.api.invoke('i18n:register-namespace', 'command-palette', {
            en: en['command-palette'],
            ru: ru['command-palette'],
        });

        // Create palette container (mounted to body, like dialog-manager)
        this.paletteContainer = document.createElement('div');
        this.paletteContainer.id = 'nh-command-palette';
        document.body.appendChild(this.paletteContainer);
        this.paletteRoot = createRoot(this.paletteContainer);

        const t = (key: string) => this.app.api.invoke<string>('i18n:t', key);

        // Register the palette:open command with hotkeys
        this.app.api.invoke('command:register', {
            id: 'palette:open',
            name: await t('command-palette.commands.open'),
            handler: this.openPalette,
            areas: ['global', 'palette'],
            defaultHotkey: 'Mod+P',
        });

        // Also register F1 as an alternative (hidden from palette display)
        this.app.api.invoke('command:register', {
            id: 'palette:open-f1',
            name: await t('command-palette.commands.openF1'),
            handler: this.openPalette,
            areas: ['global'],
            defaultHotkey: 'F1',
        });

        this.log('info', 'Loaded successfully');
    }

    /**
     * Cleanup the plugin
     */
    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading...');

        // Cleanup container
        if (this.paletteRoot) {
            this.paletteRoot.unmount();
            this.paletteRoot = null;
        }
        if (this.paletteContainer) {
            this.paletteContainer.remove();
            this.paletteContainer = null;
        }

        this.log('info', 'Unloaded');
    }
}

export default CommandPalettePlugin;
