/**
 * @fileoverview Input Component - Styled text/number input
 * 
 * A styled input component for settings and forms.
 * 
 * @module @notehub/ck-standard/components/Input
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    /** Input value */
    value: string | number;
    /** Change handler */
    onChange: (value: string) => void;
    /** Input type */
    type?: 'text' | 'number' | 'email' | 'password' | undefined;
    /** Placeholder text */
    placeholder?: string | undefined;
    /** Disabled state */
    disabled?: boolean | undefined;
    /** Additional CSS classes */
    className?: string | undefined;
    /** Minimum value for number inputs */
    min?: number | undefined;
    /** Maximum value for number inputs */
    max?: number | undefined;
    /** Step value for number inputs */
    step?: number | undefined;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Input - Styled text/number input
 * 
 * Features:
 * - Dark theme styling with CSS variables
 * - Focus state with accent color
 * - Support for text and number types
 * 
 * @example
 * ```tsx
 * <Input
 *     type="number"
 *     value={fontSize}
 *     onChange={(val) => setFontSize(Number(val))}
 *     min={8}
 *     max={32}
 * />
 * ```
 */
export const Input: React.FC<InputProps> = ({
    value,
    onChange,
    type = 'text',
    placeholder,
    disabled = false,
    className = '',
    min,
    max,
    step,
    ...rest
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    return (
        <input
            type={type}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            className={`
                px-3 py-1.5 text-sm rounded-md
                bg-[var(--nh-bg-secondary)] border border-[var(--nh-border-subtle)]
                text-[var(--nh-text-primary)] placeholder:text-[var(--nh-text-muted)]
                focus:outline-none focus:border-[var(--nh-accent-primary)]
                focus:ring-1 focus:ring-[var(--nh-accent-primary)]
                transition-colors
                ${type === 'number' ? 'w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' : 'w-full max-w-xs'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${className}
            `}
            {...rest}
        />
    );
};

export default Input;
