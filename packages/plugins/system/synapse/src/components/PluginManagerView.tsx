import React, { useState, useEffect, type FC } from 'react';
import type { NotehubCore } from '@notehub/core';
import { Icon } from '@notehub/icon-manager';

interface PluginMetadata {
    id: string;
    name: string;
    version: string;
    description: string;
    path: string;
    status: string;
    isNhp: boolean;
    loadedAt: Date;
    error?: string;
}

interface PluginManagerViewProps {
    app: NotehubCore;
}

// Toggle Component (Source: @notehub/ck-standard)
interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
}

const Toggle: FC<ToggleProps> = ({
    checked,
    onChange,
    disabled = false,
    className = '',
    'aria-label': ariaLabel,
}) => {
    const handleClick = () => {
        if (!disabled) {
            onChange(!checked);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        }
    };

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={`
                relative inline-flex w-10 h-6 shrink-0 cursor-pointer rounded-full
                border-2 border-transparent transition-all duration-200 ease-in-out
                focus:outline-none focus:ring-2 focus:ring-[var(--nh-accent-primary)] focus:ring-offset-2
                focus:ring-offset-[var(--nh-bg-surface)]
                ${checked
                    ? 'bg-[var(--nh-accent-primary,#6b5ce7)]'
                    : 'bg-[var(--nh-border-secondary,#3a3a3a)]'
                }
                ${disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }
                ${className}
            `}
        >
            {/* Sliding Knob */}
            <span
                className={`
                    pointer-events-none inline-block w-4 h-4 transform rounded-full
                    bg-white shadow-lg ring-0 transition-all duration-200 ease-in-out
                    ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}
                    my-auto
                `}
            />
        </button>
    );
};

export const PluginManagerView: FC<PluginManagerViewProps> = ({ app }) => {
    const [plugins, setPlugins] = useState<PluginMetadata[]>([]);
    const [loading, setLoading] = useState<string | null>(null);
    const [installing, setInstalling] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const fetchPlugins = async () => {
            try {
                const data = await app.api.invoke('synapse:get-details') as PluginMetadata[];
                setPlugins(data);
            } catch (error) {
                console.error('Failed to fetch plugins:', error);
            }
        };

        fetchPlugins();
    }, [refreshTrigger, app]);

    const handleToggle = async (plugin: PluginMetadata) => {
        if (loading) return;
        setLoading(plugin.id);

        try {
            if (plugin.status === 'Active') {
                await app.api.invoke('synapse:disable-plugin', plugin.id);
            } else {
                await app.api.invoke('synapse:enable-plugin', plugin.id);
            }
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error(`Failed to toggle plugin ${plugin.id}:`, error);
            app.api.invoke('logger:error', 'nh.system.synapse', `Failed to toggle ${plugin.id}`);
        } finally {
            setLoading(null);
        }
    };

    const handleDelete = async (plugin: PluginMetadata) => {
        if (loading) return;

        try {
            const confirmed = await app.api.invoke('dialog:confirm', `Delete "${plugin.name}"? This will permanently remove all plugin files from disk.`) as boolean;
            if (!confirmed) return;
        } catch {
            // dialog:confirm not available, proceed without confirmation
        }

        setLoading(plugin.id);
        try {
            await app.api.invoke('synapse:delete-plugin', plugin.id);
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error(`Failed to delete plugin ${plugin.id}:`, error);
            app.api.invoke('logger:error', 'nh.system.synapse', `Failed to delete ${plugin.id}`);
        } finally {
            setLoading(null);
        }
    };

    const handleInstall = async () => {
        if (installing) return;
        setInstalling(true);
        try {
            const result = await app.api.invoke('synapse:install-plugin') as { success: boolean; pluginId?: string; error?: string };
            if (result.success) {
                setRefreshTrigger(prev => prev + 1);
            } else if (result.error && result.error !== 'No file selected') {
                app.api.invoke('logger:error', 'nh.system.synapse', `Failed to install plugin: ${result.error}`);
            }
        } catch (error) {
            console.error('Failed to install plugin:', error);
            app.api.invoke('logger:error', 'nh.system.synapse', `Install failed: ${error}`);
        } finally {
            setInstalling(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--nh-bg-main)]">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-[var(--nh-text-primary)] mb-1">External Plugins</h2>
                        <p className="text-sm text-[var(--nh-text-muted)]">Managed by Synapse Engine</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleInstall}
                            disabled={installing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--nh-accent-primary,#6b5ce7)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            title="Add Plugin (.nhp)"
                        >
                            <Icon name="plus" size={16} />
                            {installing ? 'Installing...' : 'Add Plugin'}
                        </button>
                        <button
                            onClick={() => setRefreshTrigger(prev => prev + 1)}
                            className="p-2 rounded-md hover:bg-[var(--nh-bg-surface)] text-[var(--nh-text-muted)] hover:text-[var(--nh-text-primary)] transition-colors"
                            title="Refresh List"
                        >
                            <Icon name="rotate-cw" size={18} />
                        </button>
                    </div>
                </div>

                {plugins.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-[var(--nh-text-muted)] bg-[var(--nh-bg-surface)] rounded-lg border border-[var(--nh-border-subtle)] border-dashed">
                        <Icon name="package" size={48} className="mb-4 opacity-50" />
                        <p className="text-lg font-medium">No external plugins loaded</p>
                        <p className="text-sm mt-2">Place plugins in your vault's <code className="bg-[var(--nh-bg-main)] px-1 py-0.5 rounded text-xs">.notehub/plugins</code> directory or use <strong>Add Plugin</strong></p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {plugins.map(plugin => (
                            <div
                                key={plugin.id}
                                className="group flex items-start p-4 bg-[var(--nh-bg-surface)] rounded-lg border border-[var(--nh-border-subtle)] hover:border-[var(--nh-border-focus)] transition-all"
                            >
                                <div className="p-3 mr-4 bg-[var(--nh-bg-main)] rounded-md text-[var(--nh-accent-color)]">
                                    <Icon name="plugin-default" size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-[var(--nh-text-primary)] truncate">
                                            {plugin.name}
                                        </h3>
                                        <span className="px-1.5 py-0.5 text-xs font-mono bg-[var(--nh-bg-main)] rounded text-[var(--nh-text-muted)]">
                                            v{plugin.version}
                                        </span>
                                        {plugin.isNhp && (
                                            <span className="px-1.5 py-0.5 text-xs bg-amber-500/10 text-amber-500 rounded border border-amber-500/20">
                                                NHP
                                            </span>
                                        )}
                                        {plugin.status === 'Error' && (
                                            <span className="px-1.5 py-0.5 text-xs bg-red-500/10 text-red-500 rounded border border-red-500/20">
                                                Error
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-[var(--nh-text-secondary)] mb-3 line-clamp-2">
                                        {plugin.description || 'No description provided.'}
                                    </p>
                                    <div className="flex items-center gap-4 text-xs text-[var(--nh-text-muted)]">
                                        <span className={`flex items-center gap-1.5 ${plugin.status === 'Active' ? 'text-emerald-500' : 'text-[var(--nh-text-muted)]'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${plugin.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-current'}`} />
                                            {plugin.status}
                                        </span>
                                        <span className="flex items-center gap-1 opacity-70 truncate max-w-[300px]" title={plugin.path}>
                                            <Icon name="folder-open" size={12} />
                                            {plugin.path}
                                        </span>
                                    </div>
                                    {plugin.error && (
                                        <div className="mt-2 text-xs text-red-500 bg-red-500/5 p-2 rounded border border-red-500/10">
                                            {plugin.error}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <button
                                        onClick={() => handleDelete(plugin)}
                                        disabled={loading !== null}
                                        className="p-1.5 rounded-md text-[var(--nh-text-muted)] hover:text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete Plugin"
                                        aria-label={`Delete ${plugin.name}`}
                                    >
                                        <Icon name="trash-2" size={16} />
                                    </button>
                                    <Toggle
                                        checked={plugin.status === 'Active'}
                                        onChange={() => handleToggle(plugin)}
                                        disabled={loading !== null}
                                        aria-label={`Toggle ${plugin.name}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
