import React, { memo, useCallback } from 'react';
import { Check } from 'lucide-react';

/**
 * Checkbox component props
 */
export interface CheckboxProps {
    /** Whether the checkbox is checked */
    checked: boolean;
    /** Callback when checkbox state changes */
    onChange: (checked: boolean) => void;
    /** Additional CSS class names */
    className?: string;
}

/**
 * Interactive Checkbox Component
 * 
 * Designed to be rendered inside CodeMirror via Portal Bridge.
 * Uses Tailwind CSS with CSS variables for theming.
 */
export const Checkbox = memo<CheckboxProps>(({ checked, onChange, className = '' }) => {
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(!checked);
    }, [checked, onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onChange(!checked);
        }
    }, [checked, onChange]);

    const baseClasses = [
        'inline-flex items-center justify-center',
        'w-4 h-4 rounded',
        'border cursor-pointer',
        'align-middle',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-[var(--nh-accent-primary)] focus:ring-offset-1'
    ].join(' ');
    ].join(' ');

const stateClasses = checked
    ? 'bg-[var(--nh-accent-primary)] border-[var(--nh-accent-primary)]'
    : 'bg-transparent border-[var(--nh-text-muted)] hover:border-[var(--nh-accent-primary)]';

return (
    <span
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        className={`${baseClasses} ${stateClasses} ${className}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
    >
        {checked && <Check size={14} className="text-white" strokeWidth={3} />}
    </span>
);
});

Checkbox.displayName = 'Checkbox';

export default Checkbox;
