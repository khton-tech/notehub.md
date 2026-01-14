import React, { useState, useEffect, useMemo } from 'react';
import type { NotehubCore } from '@notehub/core';
import { HotkeyRecorder, Input, ListItem } from '@notehub/ck-standard';

interface KeybindingsViewProps {
    app: NotehubCore;
}

interface CommandDef {
    id: string;
    name: string;
    description?: string;
    defaultHotkey?: string;
}

export const KeybindingsView: React.FC<KeybindingsViewProps> = ({ app }) => {
    const [commands, setCommands] = useState<CommandDef[]>([]);
    const [query, setQuery] = useState('');
    const [bindings, setBindings] = useState<Record<string, string[]>>({});

    // Fetch initial data
    useEffect(() => {
        const loadData = async () => {
            const cmds = await app.api.invoke('command:get-all') as CommandDef[];
            setCommands(cmds || []);

            const newBindings: Record<string, string[]> = {};
            for (const cmd of cmds || []) {
                const b = await app.api.invoke('keymap:get-bindings', cmd.id);
                if (Array.isArray(b)) {
                    newBindings[cmd.id] = b as string[];
                }
            }
            setBindings(newBindings);
        };
        loadData();
    }, [app]);

    const handleAdd = async (commandId: string, hotkey: string) => {
        // Prevent duplicates locally before calling API to avoid flicker
        if (bindings[commandId]?.includes(hotkey)) return;

        await app.api.invoke('keymap:add-binding', commandId, hotkey);
        setBindings(prev => ({
            ...prev,
            [commandId]: [...(prev[commandId] || []), hotkey]
        }));
    };

    const handleRemove = async (commandId: string, hotkey: string) => {
        await app.api.invoke('keymap:remove-binding', commandId, hotkey);
        setBindings(prev => ({
            ...prev,
            [commandId]: (prev[commandId] || []).filter(k => k !== hotkey)
        }));
    };

    const handleReset = async (commandId: string) => {
        await app.api.invoke('keymap:reset', commandId);
        const b = await app.api.invoke('keymap:get-bindings', commandId);
        setBindings(prev => ({
            ...prev,
            [commandId]: b as string[]
        }));
    };

    const filteredCommands = useMemo(() => {
        let cmds = commands;
        // Filter out redundant F1 command
        cmds = cmds.filter(c => c.id !== 'palette:open-f1');

        if (!query) return cmds;
        const lower = query.toLowerCase();
        return cmds.filter(cmd =>
            cmd.name.toLowerCase().includes(lower) ||
            cmd.id.toLowerCase().includes(lower) ||
            (cmd.description && cmd.description.toLowerCase().includes(lower))
        );
    }, [commands, query]);

    return (
        <div className="flex flex-col h-full gap-6 p-4 md:p-8">
            <div className="flex-shrink-0">
                <Input
                    placeholder="Search commands..."
                    value={query}
                    onChange={(e: any) => setQuery(e.target.value)}
                    autoFocus
                    className="w-full"
                />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[var(--nh-ring-focus)] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[var(--nh-accent-primary)]">
                {filteredCommands.length > 0 ? (
                    <div>
                        <h3 className="
                            text-xs font-semibold uppercase tracking-wider
                            text-[var(--nh-text-muted)] mb-3 pb-2
                            border-b border-[var(--nh-border-subtle)]
                        ">
                            Commands
                        </h3>
                        <div className="bg-[var(--nh-bg-surface)] rounded-lg overflow-hidden border border-[var(--nh-border-subtle)]">
                            {filteredCommands.map(cmd => (
                                <div key={cmd.id} className="border-b border-[var(--nh-border-subtle)] last:border-0">
                                    <ListItem
                                        secondary={<span className="font-mono text-[10px] opacity-70">{cmd.id}</span>}
                                        accessory={
                                            <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-3">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    {(bindings[cmd.id] || []).map(hotkey => (
                                                        <div key={hotkey} className="
                                                            flex items-center gap-1.5 px-2 py-1 
                                                            bg-[var(--nh-bg-element)] border border-[var(--nh-border-subtle)] 
                                                            rounded text-xs font-mono
                                                        ">
                                                            <span>{hotkey}</span>
                                                            <button
                                                                onClick={() => handleRemove(cmd.id, hotkey)}
                                                                className="opacity-50 hover:opacity-100 hover:text-red-500"
                                                                title="Remove binding"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="w-[1px] h-4 bg-[var(--nh-border-subtle)]" />
                                                <div className="flex items-center gap-2">
                                                    <div className="w-28 text-xs scale-90 origin-right">
                                                        <HotkeyRecorder
                                                            value=""
                                                            placeholder="Add..."
                                                            onChange={(hotkey) => handleAdd(cmd.id, hotkey)}
                                                        />
                                                    </div>
                                                    {(bindings[cmd.id]?.length !== (cmd.defaultHotkey ? 1 : 0) || bindings[cmd.id]?.[0] !== cmd.defaultHotkey) && (
                                                        <button
                                                            onClick={() => handleReset(cmd.id)}
                                                            className="text-[10px] text-[var(--nh-accent-primary)] hover:underline whitespace-nowrap"
                                                        >
                                                            Reset
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        }
                                        className="py-3"
                                    >
                                        {cmd.name}
                                    </ListItem>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-[var(--nh-text-muted)] text-sm border-2 border-dashed border-[var(--nh-border-subtle)] rounded-lg bg-[var(--nh-bg-surface)]/50">
                        No commands found matching "{query}"
                    </div>
                )}
            </div>
        </div>
    );
};
