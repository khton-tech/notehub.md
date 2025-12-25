import { useState, type FC, type ReactNode, type MouseEventHandler, type CSSProperties } from 'react';

/**
 * Card component props
 */
export interface CardProps {
    /** Card variant style */
    variant?: 'default' | 'interactive';
    /** Card content */
    children?: ReactNode;
    /** Additional CSS class names */
    className?: string;
    /** Padding size */
    padding?: 'none' | 'sm' | 'md' | 'lg';
    /** Click handler (for interactive variant) */
    onClick?: MouseEventHandler<HTMLDivElement>;
}

/**
 * Padding size values
 */
const paddingValues: Record<string, string> = {
    none: '0',
    sm: '8px',
    md: '16px',
    lg: '24px',
};

/**
 * Card Component
 *
 * Container component with themed background and border.
 * Uses CSS variables for theme-aware styling.
 * Interactive cards support keyboard navigation with focus states.
 */
export const Card: FC<CardProps> = ({
    variant = 'default',
    children,
    className = '',
    padding = 'md',
    onClick,
}) => {
    const isInteractive = variant === 'interactive';
    const [isFocused, setIsFocused] = useState(false);

    const baseStyle: CSSProperties = {
        backgroundColor: 'var(--nh-bg-surface, #2a2a2a)',
        border: '1px solid var(--nh-border-secondary, #3a3a3a)',
        borderRadius: '8px',
        padding: paddingValues[padding] || paddingValues.md,
        cursor: isInteractive ? 'pointer' : 'default',
        transition: 'filter 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        outline: 'none',
        boxShadow: isInteractive && isFocused ? '0 0 0 2px var(--nh-accent-primary, #6b5ce7)' : 'none',
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isInteractive) {
            e.currentTarget.style.filter = 'brightness(1.1)';
            e.currentTarget.style.borderColor = 'var(--nh-accent-primary, #6b5ce7)';
        }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isInteractive) {
            e.currentTarget.style.filter = 'none';
            e.currentTarget.style.borderColor = 'var(--nh-border-secondary, #3a3a3a)';
        }
    };

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isInteractive && onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
    };

    return (
        <div
            style={baseStyle}
            className={className}
            onClick={onClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            tabIndex={isInteractive ? 0 : undefined}
            role={isInteractive ? 'button' : undefined}
        >
            {children}
        </div>
    );
};

export default Card;

