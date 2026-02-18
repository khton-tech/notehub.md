import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from '@notehub/icon-manager';

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
 * - Full keyboard navigation (Arrow keys, Enter, Escape)
 * - ARIA combobox pattern
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
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Get selected option label
    const selectedOption = options.find(opt => opt.value === value);
    const displayLabel = selectedOption ? selectedOption.label : placeholder;

    // Reset highlighted index when opening
    useEffect(() => {
        if (isOpen) {
            const selectedIdx = options.findIndex(opt => opt.value === value);
            setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
        }
    }, [isOpen, options, value]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (isOpen && listRef.current && highlightedIndex >= 0) {
            const items = listRef.current.querySelectorAll('[role="option"]');
            const item = items[highlightedIndex];
            if (item) {
                item.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightedIndex, isOpen]);

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

    const handleSelect = useCallback((newValue: string) => {
        onChange(newValue);
        setIsOpen(false);
    }, [onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (disabled) return;

        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (isOpen && highlightedIndex >= 0 && options[highlightedIndex]) {
                    handleSelect(options[highlightedIndex].value);
                } else {
                    setIsOpen(!isOpen);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                } else {
                    setHighlightedIndex(prev =>
                        Math.min(prev + 1, options.length - 1)
                    );
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                } else {
                    setHighlightedIndex(prev => Math.max(prev - 1, 0));
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
            case 'Home':
                if (isOpen) {
                    e.preventDefault();
                    setHighlightedIndex(0);
                }
                break;
            case 'End':
                if (isOpen) {
                    e.preventDefault();
                    setHighlightedIndex(options.length - 1);
                }
                break;
        }
    }, [disabled, isOpen, highlightedIndex, options, handleSelect]);

    return (
        <div
            ref={containerRef}
            className={`relative inline-block w-full min-w-[140px] ${className}`}
        >
            {/* Trigger Button */}
            <button
                type="button"
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between px-3 py-2
                    text-sm rounded-xl text-left
                    transition-[background,color,border-color,box-shadow,transform] duration-[200ms]
                    ${isOpen
                        ? 'border-[var(--nh-accent-primary)] ring-2 ring-[var(--nh-accent-primary)]/40 ring-offset-2 ring-offset-[var(--nh-bg-main)]'
                        : 'border-[var(--nh-border-secondary)] hover:border-[var(--nh-text-muted)]'
                    }
                    border bg-[var(--nh-bg-secondary,#1A1A1A)] text-[var(--nh-text-primary)]
                    ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <span className="truncate mr-2">
                    {displayLabel}
                </span>
                <Icon
                    name="chevron-down"
                    size={14}
                    className={`
                        text-[var(--nh-text-muted)] transition-transform duration-[200ms]
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
                    <div
                        ref={listRef}
                        role="listbox"
                        className="
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

                        {options.map((option, index) => {
                            const isSelected = option.value === value;
                            const isHighlighted = index === highlightedIndex;
                            return (
                                <div
                                    key={option.value}
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleSelect(option.value)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    className={`
                                        flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer
                                        transition-[background,color,box-shadow] duration-150 rounded-lg mx-1
                                        ${isSelected
                                            ? 'bg-[var(--nh-accent-primary)] text-white shadow-nh-glow-accent-sm'
                                            : isHighlighted
                                                ? 'bg-[var(--nh-bg-hover)] text-[var(--nh-text-primary)]'
                                                : 'text-[var(--nh-text-primary)] hover:bg-[var(--nh-bg-hover)]'
                                        }
                                    `}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {isSelected && (
                                        <Icon name="check" size={14} className="ml-2 shrink-0" />
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
