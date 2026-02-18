/**
 * @fileoverview Toggle Component - Modern iOS-style boolean switch
 * 
 * A styled toggle switch with glow effects and smooth animations.
 * 
 * @module @notehub/ck-standard/components/Toggle
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ToggleProps {
    /** Current checked state */
    checked: boolean;
    /** Change handler */
    onChange: (checked: boolean) => void;
    /** Disabled state */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Accessible label */
    'aria-label'?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Toggle - Modern iOS-style boolean switch
 * 
 * Features:
 * - Larger pill container (w-11 h-7)
 * - Sliding circle knob with shadow
 * - Glow effect when checked
 * - Smooth spring animation (300ms)
 * 
 * @example
 * ```tsx
 * <Toggle 
 *     checked={enabled} 
 *     onChange={setEnabled}
 *     aria-label="Enable feature"
 * />
 * ```
 */
export const Toggle: React.FC<ToggleProps> = ({
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
                relative inline-flex w-11 h-7 shrink-0 cursor-pointer rounded-full
                border-2 border-transparent transition-all duration-300 ease-out
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nh-accent-primary)]
                focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nh-bg-surface)]
                ${checked
                    ? 'bg-[var(--nh-accent-primary,#7c3aed)] shadow-nh-glow-accent'
                    : 'bg-black/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]'
                }
                ${disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : ''
                }
                ${className}
            `}
        >
            {/* Sliding Knob */}
            <span
                className={`
                    pointer-events-none inline-block w-5 h-5 transform rounded-full
                    bg-white transition-all duration-300 ease-out
                    ${checked ? 'translate-x-[18px] shadow-nh-glow-accent-sm' : 'translate-x-[2px] shadow-md'}
                    my-auto
                `}
            />
        </button>
    );
};

export default Toggle;

