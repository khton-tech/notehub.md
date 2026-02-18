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
import type { PluginManifest } from '@notehub/core';
import type { VisibleCommand } from '@notehub.md/api';
import { Card, ListItem } from '@notehub/ck-standard';
import { Icon } from '@notehub/icon-manager';
import { getSearchCandidates } from './utils/layoutEngine';

// ============================================================================
// PaletteModal Component
// ============================================================================

interface PaletteModalProps {
    commands: VisibleCommand[];
    onExecute: (id: string) => void;
    onClose: () => void;
}

const PaletteModal: FC<PaletteModalProps> = ({ commands, onExecute, onClose }) => {
    const [query, setQuery] = useState('');
    const [filteredCommands, setFilteredCommands] = useState<VisibleCommand[]>(commands);
    const [selectedIndex, setSelectedIndex] = useState(0);
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
            className="fixed inset-0 z-[400] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm animate-[paletteIn_0.15s_ease-out]"
            onClick={handleBackdropClick}
        >
            <Card
                variant="glass"
                padding="none"
                className="w-full max-w-lg shadow-2xl overflow-hidden animate-[paletteSlide_0.15s_ease-out]"
            >
                {/* Search Input */}
                <div className="p-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Type a command..."
                        onKeyDown={handleKeyDown}
                        data-palette-input="true"
                        autoFocus
                        className="
                            w-full px-4 py-3 text-lg
                            bg-transparent
                            border-0 border-b border-[var(--nh-border-subtle,rgba(255,255,255,0.08))]
                            text-[var(--nh-text-primary,#E0E0E0)]
                            placeholder:text-[var(--nh-text-muted,rgba(255,255,255,0.4))]
                            focus:outline-none
                            focus:border-[var(--nh-accent-primary,#7c3aed)]
                            transition-colors duration-200
                        "
                    />
                </div>

                {/* Command List */}
                <div
                    ref={listRef}
                    role="listbox"
                    className="max-h-80 overflow-y-auto border-t border-[var(--nh-border-subtle,rgba(255,255,255,0.08))]"
                >
                    {filteredCommands.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-[var(--nh-text-muted,rgba(255,255,255,0.4))]">
                            <Icon name="search-x" size={32} />
                            <span className="mt-2 text-sm">No commands found</span>
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
                <div className="flex items-center gap-4 px-4 py-2 text-xs text-[var(--nh-text-muted,rgba(255,255,255,0.4))] border-t border-[var(--nh-border-subtle,rgba(255,255,255,0.08))]">
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded bg-[var(--nh-bg-secondary,#1A1A1A)] font-mono">↑↓</kbd>
                        navigate
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded bg-[var(--nh-bg-secondary,#1A1A1A)] font-mono">↵</kbd>
                        select
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded bg-[var(--nh-bg-secondary,#1A1A1A)] font-mono">esc</kbd>
                        close
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

        // Create palette container (mounted to body, like dialog-manager)
        this.paletteContainer = document.createElement('div');
        this.paletteContainer.id = 'nh-command-palette';
        document.body.appendChild(this.paletteContainer);
        this.paletteRoot = createRoot(this.paletteContainer);

        // Register the palette:open command with hotkeys
        this.app.api.invoke('command:register', {
            id: 'palette:open',
            name: 'Open Command Palette',
            handler: this.openPalette,
            areas: ['global', 'palette'],
            defaultHotkey: 'Mod+P',
        });

        // Also register F1 as an alternative (hidden from palette display)
        this.app.api.invoke('command:register', {
            id: 'palette:open-f1',
            name: 'Open Command Palette (F1)',
            handler: this.openPalette,
            areas: ['global'],  // Hidden from palette itself (doesn't include 'palette')
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
