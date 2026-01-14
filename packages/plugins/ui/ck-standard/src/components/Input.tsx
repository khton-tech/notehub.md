/**
 * @fileoverview Input Component - Modern glass-style text/number input
 * 
 * A styled input with glassmorphism aesthetic.
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
    /** 
     * Input variant style
     * - 'default': Standard bordered input
     * - 'search': Clean spotlight-style, no borders, large text
     */
    variant?: 'default' | 'search';
}

// ============================================================================
// Component
// ============================================================================

/**
 * Input - Modern glass-style text/number input
 * 
 * Features:
 * - Glass background with subtle transparency
 * - Border only visible on focus (floating aesthetic)
 * - Inner shadow for depth perception
 * - Smooth focus transitions
 * - Search variant for command palette / spotlight UI
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
 * 
 * // Search variant for command palette
 * <Input
 *     variant="search"
 *     value={query}
 *     onChange={setQuery}
 *     placeholder="Type a command..."
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
    variant = 'default',
    ...rest
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    // Variant-specific classes
    const variantClasses = variant === 'search'
        ? `
            px-4 py-3 text-lg rounded-none
            bg-transparent
            border-0 border-b border-[var(--nh-border-subtle,rgba(255,255,255,0.08))]
            text-[var(--nh-text-primary,#E0E0E0)]
            placeholder:text-[var(--nh-text-muted,rgba(255,255,255,0.4))]
            focus:outline-none
            focus:border-[var(--nh-accent-primary,#7c3aed)]
            transition-colors duration-200
            w-full
        `
        : `
            px-3 py-2 text-sm rounded-xl
            bg-[var(--nh-bg-secondary,#1A1A1A)]
            border border-[var(--nh-border-secondary,rgba(255,255,255,0.08))]
            text-[var(--nh-text-primary,#E0E0E0)]
            placeholder:text-[var(--nh-text-muted,rgba(255,255,255,0.4))]
            focus:outline-none
            focus:border-[var(--nh-accent-primary,#7c3aed)]
            focus:ring-2 focus:ring-[var(--nh-accent-primary)]/40 focus:ring-offset-2 focus:ring-offset-[var(--nh-bg-main)]
            transition-all duration-200
            hover:bg-[var(--nh-bg-hover,#1E1E1E)]
            ${type === 'number' ? 'w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' : 'w-full max-w-xs'}
        `;

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
                ${variantClasses}
                ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
                ${className}
            `}
            {...rest}
        />
    );
};

export default Input;
