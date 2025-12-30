import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
    checked: boolean;
    onChange?: () => void;
    // Allow onClick to bubble or be captured
    // We will attach the handler in the widget wrapper mostly, 
    // but the component should be UI only.
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked }) => {
    console.log('[Checkbox] Rendering. Checked:', checked);
    return (
        <div
            className={`
                w-4 h-4 rounded border flex items-center justify-center transition-colors
                ${checked
                    ? 'border-[var(--nh-accent-primary)] bg-[var(--nh-accent-primary)]'
                    : 'border-[var(--nh-text-muted)] bg-transparent hover:border-[var(--nh-accent-primary)]'
                }
            `}
        >
            {checked && <Check size={12} className="text-[var(--nh-bg-main)]" strokeWidth={3} />}
        </div>
    );
};
