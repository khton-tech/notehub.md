import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
    checked: boolean;
    onChange?: () => void;
}

/**
 * Checkbox - Modern rounded checkbox with glow effect
 * 
 * Features:
 * - Rounded corners (rounded-lg)
 * - Glow effect when checked
 * - Scale animation on check
 */
export const Checkbox: React.FC<CheckboxProps> = ({ checked }) => {
    return (
        <div
            className={`
                w-[18px] h-[18px] rounded-lg border-2 flex items-center justify-center 
                transition-all duration-200 ease-out cursor-pointer
                ${checked
                    ? 'border-[var(--nh-accent-primary)] bg-[var(--nh-accent-primary)] shadow-nh-glow-accent scale-100'
                    : 'border-[var(--nh-text-muted)] bg-transparent hover:border-[var(--nh-accent-primary)] hover:bg-[var(--nh-accent-secondary)] hover:scale-105'
                }
            `}
        >
            {checked && (
                <Check
                    size={12}
                    className="text-[var(--nh-button-text)] animate-in zoom-in-50 duration-150"
                    strokeWidth={3}
                />
            )}
        </div>
    );
};
