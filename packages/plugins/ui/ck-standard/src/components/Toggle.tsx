/**
 * @fileoverview Toggle Component - iOS/Obsidian-style boolean switch
 * 
 * A styled toggle switch for boolean settings.
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
 * Toggle - iOS/Obsidian-style boolean switch
 * 
 * Features:
 * - Rounded pill container (w-10 h-6)
 * - Sliding circle knob (w-4 h-4)
 * - Smooth transition animation
 * - Gray when off, Accent when on
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
                relative inline-flex w-10 h-6 shrink-0 cursor-pointer rounded-full
                border-2 border-transparent transition-all duration-200 ease-in-out
                focus:outline-none focus:ring-2 focus:ring-[var(--nh-accent-primary)] focus:ring-offset-2
                focus:ring-offset-[var(--nh-bg-surface)]
                ${checked
                    ? 'bg-[var(--nh-accent-primary)]'
                    : 'bg-[var(--nh-border-secondary)]'
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

export default Toggle;
