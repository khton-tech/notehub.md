/**
 * @fileoverview ColorPicker Component - Styled hex color picker
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
 * ColorPicker - A styled color picker with swatch and hex input
 * 
 * Features:
 * - Color swatch button
 * - Popover with HexColorPicker
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
                        w-10 h-8 rounded border border-[var(--nh-border-subtle)]
                        cursor-pointer focus:outline-none focus:ring-2 
                        focus:ring-[var(--nh-accent-primary)] transition-shadow
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    style={{ backgroundColor: value }}
                    aria-label="Pick color"
                />
                <span className="text-xs text-[var(--nh-text-muted)] font-mono">
                    {value.toUpperCase()}
                </span>
            </div>

            {/* Popover */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    className="
                        absolute z-50 top-full mt-2 right-0 
                        p-3 rounded-lg shadow-xl
                        bg-[var(--nh-bg-sidebar)] border border-[var(--nh-border-secondary)]
                    "
                    style={{ width: '200px' }}
                >
                    <div className="custom-color-picker mb-3">
                        <HexColorPicker
                            color={value}
                            onChange={handleColorChange}
                            style={{ width: '100%', height: '150px' }}
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
