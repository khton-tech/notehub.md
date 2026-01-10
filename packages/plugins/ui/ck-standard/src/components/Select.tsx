import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

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
 * Select - Modern glassmorphism dropdown
 * 
 * Features:
 * - Floating panel with backdrop blur
 * - Scale animation on open
 * - Hover glow effect on selected item
 */
export const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    options,
    disabled = false,
    className = '',
    placeholder = 'Select...',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Get selected option label
    const selectedOption = options.find(opt => opt.value === value);
    const displayLabel = selectedOption ? selectedOption.label : placeholder;

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (newValue: string) => {
        onChange(newValue);
        setIsOpen(false);
    };

    return (
        <div
            ref={containerRef}
            className={`relative inline-block w-full min-w-[140px] ${className}`}
        >
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between px-3 py-2
                    text-sm rounded-xl text-left
                    transition-all duration-200
                    ${isOpen
                        ? 'border-[var(--nh-accent-primary)] shadow-[0_0_0_2px_var(--nh-bg-main),0_0_0_4px_var(--nh-accent-primary)]'
                        : 'border-[var(--nh-border-secondary)] hover:border-[var(--nh-text-muted)]'
                    }
                    border bg-[var(--nh-bg-secondary,#1A1A1A)] text-[var(--nh-text-primary)]
                    ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <span className="truncate mr-2">
                    {displayLabel}
                </span>
                <ChevronDown
                    size={14}
                    className={`
                        text-[var(--nh-text-muted)] transition-transform duration-200
                        ${isOpen ? 'transform rotate-180' : ''}
                    `}
                />
            </button>

            {/* Dropdown Menu - Glass Panel */}
            {isOpen && (
                <div className="
                    absolute z-50 mt-2 w-full 
                    bg-[var(--nh-glass-bg,rgba(20,20,20,0.85))]
                    backdrop-blur-xl
                    border border-[var(--nh-glass-border,rgba(255,255,255,0.08))]
                    rounded-xl shadow-[var(--nh-shadow-lg)] overflow-hidden
                    animate-in fade-in zoom-in-95 duration-150
                ">
                    <div className="
                        max-h-60 overflow-auto py-1
                        [&::-webkit-scrollbar]:w-1.5
                        [&::-webkit-scrollbar-track]:bg-transparent
                        [&::-webkit-scrollbar-thumb]:bg-[var(--nh-border-secondary)]
                        [&::-webkit-scrollbar-thumb]:rounded-full
                        hover:[&::-webkit-scrollbar-thumb]:bg-[var(--nh-text-muted)]
                    ">
                        {placeholder && !selectedOption && (
                            <div className="px-3 py-2 text-sm text-[var(--nh-text-muted)] italic">
                                {placeholder}
                            </div>
                        )}

                        {options.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <div
                                    key={option.value}
                                    onClick={() => handleSelect(option.value)}
                                    className={`
                                        flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer
                                        transition-all duration-150 rounded-lg mx-1
                                        ${isSelected
                                            ? 'bg-[var(--nh-accent-primary)] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]'
                                            : 'text-[var(--nh-text-primary)] hover:bg-[var(--nh-bg-hover)]'
                                        }
                                    `}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {isSelected && (
                                        <Check size={14} className="ml-2 shrink-0" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Select;

