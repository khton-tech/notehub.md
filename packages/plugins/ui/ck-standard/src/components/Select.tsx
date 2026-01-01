/**
 * @fileoverview Select Component - Styled dropdown
 * 
 * A styled native select dropdown for settings.
 * 
 * @module @notehub/ck-standard/components/Select
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface SelectOption {
    /** Display label */
    label: string;
    /** Option value */
    value: string;
}

export interface SelectProps {
    /** Current selected value */
    value: string;
    /** Change handler */
    onChange: (value: string) => void;
    /** Available options */
    options: SelectOption[];
    /** Disabled state */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Placeholder when no value selected */
    placeholder?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Select - Styled dropdown component
 * 
 * Features:
 * - Native select for accessibility and mobile support
 * - Custom styling with theme variables
 * - Chevron indicator
 * 
 * @example
 * ```tsx
 * <Select
 *     value={theme}
 *     onChange={setTheme}
 *     options={[
 *         { label: 'Light', value: 'light' },
 *         { label: 'Dark', value: 'dark' },
 *     ]}
 * />
 * ```
 */
export const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    options,
    disabled = false,
    className = '',
    placeholder,
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value);
    };

    return (
        <div className={`relative inline-block ${className}`}>
            <select
                value={value}
                onChange={handleChange}
                disabled={disabled}
                className={`
                    appearance-none w-full min-w-[120px] px-3 py-1.5 pr-8
                    text-sm rounded-md cursor-pointer
                    bg-[var(--nh-bg-secondary)] border border-[var(--nh-border-subtle)]
                    text-[var(--nh-text-primary)]
                    focus:outline-none focus:border-[var(--nh-accent-primary)]
                    focus:ring-1 focus:ring-[var(--nh-accent-primary)]
                    transition-colors
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>

            {/* Chevron Indicator */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDown
                    size={14}
                    className="text-[var(--nh-text-muted)]"
                />
            </div>
        </div>
    );
};

export default Select;
