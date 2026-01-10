/**
 * @fileoverview ColorPicker Component - Glassmorphism hex color picker
 * 
 * Uses react-colorful for a modern, touch-friendly color picker.
 * 
 * @module @notehub/ck-standard/components/ColorPicker
 */

import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { colord } from 'colord';
import { Input } from './Input';

// ============================================================================
// Props
// ============================================================================

export interface ColorPickerProps {
    /** Current color value (hex) */
    value: string;
    /** Change handler */
    onChange: (value: string) => void;
    /** Disabled state */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ColorPicker - Glassmorphism color picker with floating popover
 * 
 * Features:
 * - Color swatch button
 * - Glass popover with backdrop blur
 * - Manual hex input
 * - Click outside to close
 */
export const ColorPicker: React.FC<ColorPickerProps> = ({
    value,
    onChange,
    disabled = false,
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // ========================================================================
    // Effects
    // ========================================================================

    // Handle click outside to close popover
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
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

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleSwatchClick = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    const handleColorChange = (newColor: string) => {
        onChange(newColor);
    };

    const handleHexInputChange = (newHex: string) => {
        if (colord(newHex).isValid()) {
            onChange(newHex);
        }
    };

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div
            ref={containerRef}
            className={`relative inline-block ${className}`}
        >
            {/* Color Swatch / Trigger */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleSwatchClick}
                    disabled={disabled}
                    className={`
                        w-10 h-8 rounded-xl border border-[var(--nh-border-secondary)]
                        cursor-pointer focus:outline-none focus-visible:ring-2 
                        focus-visible:ring-[var(--nh-accent-primary)] 
                        focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nh-bg-main)]
                        transition-all duration-200 shadow-sm
                        hover:shadow-md hover:scale-105
                        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
                    `}
                    style={{ backgroundColor: value }}
                    aria-label="Pick color"
                />
                <span className="text-xs text-[var(--nh-text-muted)] font-mono">
                    {value.toUpperCase()}
                </span>
            </div>

            {/* Glass Popover */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    className="
                        absolute z-50 top-full mt-2 right-0 
                        p-4 rounded-xl shadow-[var(--nh-shadow-lg)]
                        bg-[var(--nh-glass-bg,rgba(20,20,20,0.85))]
                        backdrop-blur-xl
                        border border-[var(--nh-glass-border,rgba(255,255,255,0.08))]
                        animate-in fade-in zoom-in-95 duration-150
                    "
                    style={{ width: '220px' }}
                >
                    <div className="custom-color-picker mb-3">
                        <HexColorPicker
                            color={value}
                            onChange={handleColorChange}
                            style={{ width: '100%', height: '160px' }}
                        />
                    </div>

                    <Input
                        value={value}
                        onChange={handleHexInputChange}
                        className="w-full text-center font-mono"
                        placeholder="#000000"
                    />
                </div>
            )}
        </div>
    );
};

export default ColorPicker;

