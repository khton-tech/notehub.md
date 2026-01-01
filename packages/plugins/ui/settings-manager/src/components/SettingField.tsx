/**
 * @fileoverview SettingField Component - Smart input for individual settings
 * 
 * Renders the appropriate input control based on the setting type.
 * Reads value from config-manager and subscribes to updates.
 * 
 * @module @notehub/settings-manager/components/SettingField
 */

import { useState, useEffect, useCallback, type FC, type ChangeEvent } from 'react';
import type { NotehubCore } from '@notehub/core';
import { Toggle, Select } from '@notehub/ck-standard';
import type { SettingsItem } from '../types';

// ============================================================================
// Props
// ============================================================================

interface SettingFieldProps {
    /** The settings item definition */
    item: SettingsItem;
    /** Reference to NotehubCore for API access */
    app: NotehubCore;
}

// ============================================================================
// Component
// ============================================================================

/**
 * SettingField - Renders the appropriate input for a setting item
 * 
 * Features:
 * - Reads initial value from config:get
 * - Subscribes to config:updated events
 * - Renders toggle, text, number, select, or color inputs
 * - Calls config:set on change
 */
export const SettingField: FC<SettingFieldProps> = ({ item, app }) => {
    const [value, setValue] = useState<unknown>(item.defaultValue);
    const [isLoading, setIsLoading] = useState(true);

    // ========================================================================
    // Load initial value and subscribe to updates
    // ========================================================================

    useEffect(() => {
        // Load initial value from config
        const loadValue = () => {
            const configValue = app.api.invoke('config:get', item.key, item.defaultValue);
            setValue(configValue);
            setIsLoading(false);
        };

        loadValue();

        // Subscribe to config updates
        const handleConfigUpdate = (payload: unknown) => {
            const event = payload as { key: string; value: unknown };
            if (event.key === item.key) {
                setValue(event.value);
            }
        };

        app.events.on('config:updated', handleConfigUpdate);

        return () => {
            app.events.off('config:updated', handleConfigUpdate);
        };
    }, [app, item.key, item.defaultValue]);

    // ========================================================================
    // Change Handlers
    // ========================================================================

    const handleChange = useCallback(async (newValue: unknown) => {
        setValue(newValue);
        await app.api.invoke('config:set', item.key, newValue);
    }, [app, item.key]);

    const handleToggle = useCallback(() => {
        handleChange(!value);
    }, [value, handleChange]);

    const handleTextChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleChange(e.target.value);
    }, [handleChange]);

    const handleNumberChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const numValue = parseFloat(e.target.value);
        if (!isNaN(numValue)) {
            handleChange(numValue);
        }
    }, [handleChange]);

    const handleColorChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleChange(e.target.value);
    }, [handleChange]);

    // ========================================================================
    // Render Input by Type
    // ========================================================================

    const renderInput = () => {
        if (isLoading) {
            return (
                <div className="h-6 w-20 bg-[var(--nh-bg-main)] rounded animate-pulse" />
            );
        }

        switch (item.type) {
            case 'toggle':
                return (
                    <Toggle
                        checked={Boolean(value)}
                        onChange={handleToggle}
                        aria-label={item.label}
                    />
                );

            case 'text':
                return (
                    <input
                        type="text"
                        value={String(value ?? '')}
                        onChange={handleTextChange}
                        placeholder={item.placeholder}
                        className="
                            w-full max-w-xs px-3 py-1.5 text-sm rounded-md
                            bg-[var(--nh-bg-main)] border border-[var(--nh-border-secondary)]
                            text-[var(--nh-text-primary)] placeholder:text-[var(--nh-text-muted)]
                            focus:outline-none focus:border-[var(--nh-accent-primary)]
                            focus:ring-1 focus:ring-[var(--nh-accent-primary)]
                            transition-colors
                        "
                    />
                );

            case 'number':
                return (
                    <input
                        type="number"
                        value={typeof value === 'number' ? value : ''}
                        onChange={handleNumberChange}
                        min={item.min}
                        max={item.max}
                        step={item.step}
                        placeholder={item.placeholder}
                        className="
                            w-24 px-3 py-1.5 text-sm rounded-md
                            bg-[var(--nh-bg-main)] border border-[var(--nh-border-secondary)]
                            text-[var(--nh-text-primary)] placeholder:text-[var(--nh-text-muted)]
                            focus:outline-none focus:border-[var(--nh-accent-primary)]
                            focus:ring-1 focus:ring-[var(--nh-accent-primary)]
                            transition-colors
                            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                            [&::-webkit-inner-spin-button]:appearance-none
                        "
                    />
                );

            case 'select':
                return (
                    <Select
                        value={String(value ?? '')}
                        onChange={(newValue: string) => {
                            // Try to parse as JSON to handle non-string values
                            try {
                                const parsed = JSON.parse(newValue);
                                handleChange(parsed);
                            } catch {
                                handleChange(newValue);
                            }
                        }}
                        options={(item.options ?? []).map(opt => ({
                            label: opt.label,
                            value: JSON.stringify(opt.value)
                        }))}
                    />
                );

            case 'color':
                return (
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={String(value ?? '#000000')}
                            onChange={handleColorChange}
                            className="
                                w-10 h-8 rounded cursor-pointer border border-[var(--nh-border-secondary)]
                                bg-transparent
                            "
                        />
                        <span className="text-xs text-[var(--nh-text-muted)] font-mono">
                            {String(value ?? '#000000')}
                        </span>
                    </div>
                );

            default:
                return (
                    <span className="text-xs text-[var(--nh-text-muted)]">
                        Unknown type: {item.type}
                    </span>
                );
        }
    };

    // ========================================================================
    // Layout
    // ========================================================================

    return (
        <div className="flex items-start justify-between gap-4 py-3 border-b border-[var(--nh-border-subtle)] last:border-0">
            {/* Label & Description */}
            <div className="flex-1 min-w-0">
                <label className="text-sm font-medium text-[var(--nh-text-primary)]">
                    {item.label}
                </label>
                {item.description && (
                    <p className="mt-0.5 text-xs text-[var(--nh-text-muted)] leading-relaxed">
                        {item.description}
                    </p>
                )}
            </div>

            {/* Input Control */}
            <div className="shrink-0">
                {renderInput()}
            </div>
        </div>
    );
};

export default SettingField;
