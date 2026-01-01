/**
 * @fileoverview SettingField Component - Smart input for individual settings
 * 
 * Renders the appropriate input control based on the setting type.
 * Reads value from config-manager and subscribes to updates.
 * 
 * @module @notehub/settings-manager/components/SettingField
 */

import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import type { NotehubCore } from '@notehub/core';
import { Toggle, Select, Input, ColorPicker } from '@notehub/ck-standard';
import { Check } from 'lucide-react';
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
 * - Reads initial value from config:get (async)
 * - Subscribes to config:updated events
 * - Renders toggle, text, number, select, or color inputs
 * - Calls config:set on change
 * - Shows save indicator after value change
 */
export const SettingField: FC<SettingFieldProps> = ({ item, app }) => {
    const [value, setValue] = useState<unknown>(item.defaultValue);
    const [isLoading, setIsLoading] = useState(true);
    const [showSaved, setShowSaved] = useState(false);
    const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ========================================================================
    // Load value on mount and subscribe to updates
    // ========================================================================

    useEffect(() => {
        let isMounted = true;

        // Load current value asynchronously
        const loadValue = async () => {
            try {
                const configValue = await app.api.invoke('config:get', item.key);
                if (isMounted) {
                    if (configValue !== undefined) {
                        setValue(configValue);
                    } else {
                        setValue(item.defaultValue);
                    }
                    setIsLoading(false);
                }
            } catch (error) {
                if (isMounted) {
                    setValue(item.defaultValue);
                    setIsLoading(false);
                }
            }
        };

        loadValue();

        // Subscribe to config updates (for external changes)
        const handleConfigUpdate = (payload: unknown) => {
            const event = payload as { key: string; value: unknown };
            if (event.key === item.key && isMounted) {
                setValue(event.value);
            }
        };

        app.events.on('config:updated', handleConfigUpdate);

        return () => {
            isMounted = false;
            app.events.off('config:updated', handleConfigUpdate);
            if (savedTimeoutRef.current) {
                clearTimeout(savedTimeoutRef.current);
            }
        };
    }, [app, item.key, item.defaultValue]);

    // ========================================================================
    // Change Handlers
    // ========================================================================

    const handleChange = useCallback(async (newValue: unknown) => {
        setValue(newValue);

        // Show saving indicator
        setShowSaved(false);

        await app.api.invoke('config:set', item.key, newValue);

        // Show saved indicator
        setShowSaved(true);

        // Clear saved indicator after 2 seconds
        if (savedTimeoutRef.current) {
            clearTimeout(savedTimeoutRef.current);
        }
        savedTimeoutRef.current = setTimeout(() => {
            setShowSaved(false);
        }, 2000);
    }, [app, item.key]);

    const handleToggle = useCallback(() => {
        handleChange(!value);
    }, [value, handleChange]);

    const handleTextChange = useCallback((newValue: string) => {
        handleChange(newValue);
    }, [handleChange]);

    const handleNumberChange = useCallback((newValue: string) => {
        const numValue = parseFloat(newValue);
        if (!isNaN(numValue)) {
            handleChange(numValue);
        } else if (newValue === '') {
            // Allow empty input temporarily
            setValue('');
        }
    }, [handleChange]);



    // ========================================================================
    // Render Input by Type
    // ========================================================================

    const renderInput = () => {
        if (isLoading) {
            return (
                <div className="h-6 w-20 bg-[var(--nh-bg-secondary)] rounded animate-pulse" />
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
                    <Input
                        type="text"
                        value={String(value ?? '')}
                        onChange={handleTextChange}
                        placeholder={item.placeholder}
                    />
                );

            case 'number':
                return (
                    <Input
                        type="number"
                        value={value !== undefined && value !== '' ? String(value) : ''}
                        onChange={handleNumberChange}
                        min={item.min}
                        max={item.max}
                        step={item.step}
                        placeholder={item.placeholder ?? String(item.defaultValue ?? '')}
                    />
                );

            case 'select':
                return (
                    <Select
                        value={String(value ?? '')}
                        onChange={(newValue: string) => {
                            // If original option was not a string, try to parse
                            // This is heuristic; ideally we track types better
                            try {
                                if (newValue.startsWith('{') || newValue.startsWith('[')) {
                                    const parsed = JSON.parse(newValue);
                                    handleChange(parsed);
                                } else {
                                    handleChange(newValue);
                                }
                            } catch {
                                handleChange(newValue);
                            }
                        }}
                        options={(item.options ?? []).map(opt => ({
                            label: opt.label,
                            value: typeof opt.value === 'string' ? opt.value : JSON.stringify(opt.value)
                        }))}
                    />
                );

            case 'color':
                return (
                    <ColorPicker
                        value={String(value ?? '#000000')}
                        onChange={handleTextChange}
                    />
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
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-[var(--nh-text-primary)]">
                        {item.label}
                    </label>
                    {/* Save indicator */}
                    {showSaved && (
                        <span className="flex items-center gap-1 text-xs text-green-500 animate-fade-in">
                            <Check size={12} />
                            Saved
                        </span>
                    )}
                </div>
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
