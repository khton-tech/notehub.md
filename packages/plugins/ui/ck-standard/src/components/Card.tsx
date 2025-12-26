import type { FC, ReactNode, MouseEventHandler, KeyboardEventHandler } from 'react';

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
 * Padding size class mappings
 */
const paddingClasses: Record<string, string> = {
    none: 'p-0',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
};

/**
 * Card Component
 *
 * Container component with themed background and border using Tailwind CSS.
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

    const baseClasses = [
        // Background and border using CSS variables
        'bg-[var(--nh-bg-surface,#2a2a2a)]',
        'border border-[var(--nh-border-secondary,#3a3a3a)]',
        // Shape
        'rounded-lg',
        // Transitions - specific properties only to avoid "jelly effect"
        'transition-[filter,border-color,box-shadow] duration-150 ease-out',
        // Focus states
        'outline-none',
    ].join(' ');

    const interactiveClasses = isInteractive ? [
        // Cursor
        'cursor-pointer',
        // Hover states
        'hover:brightness-110 hover:border-[var(--nh-accent-primary,#6b5ce7)]',
        // Focus states
        'focus:ring-2 focus:ring-[var(--nh-accent-primary,#6b5ce7)]',
        // Active states
        'active:brightness-95',
    ].join(' ') : '';

    const paddingClass = paddingClasses[padding] || paddingClasses.md;

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (e) => {
        if (isInteractive && onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
    };

    return (
        <div
            className={`${baseClasses} ${interactiveClasses} ${paddingClass} ${className}`}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            tabIndex={isInteractive ? 0 : undefined}
            role={isInteractive ? 'button' : undefined}
        >
            {children}
        </div>
    );
};

export default Card;
