import type { FC, ReactNode, MouseEventHandler, KeyboardEventHandler } from 'react';

/**
 * Card component props
 */
export interface CardProps {
    /** Card variant style */
    variant?: 'default' | 'interactive' | 'glass' | 'floating';
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
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
};

/**
 * Variant class mappings - floating design with shadows instead of borders
 */
const variantClasses: Record<string, string> = {
    default: [
        'bg-[var(--nh-bg-surface,#141414)]',
        // No border - floating effect
    ].join(' '),
    interactive: [
        'bg-[var(--nh-bg-surface,#141414)]',
        'cursor-pointer',
        'shadow-[var(--nh-shadow-sm)]',
        // Hover: lift up with glow
        'hover:shadow-[var(--nh-shadow-md)]',
        'hover:-translate-y-0.5',
        'hover:bg-[var(--nh-bg-hover)]',
        // Active state
        'active:translate-y-0',
        'active:shadow-[var(--nh-shadow-sm)]',
    ].join(' '),
    glass: [
        'bg-[var(--nh-glass-bg,rgba(20,20,20,0.7))]',
        'backdrop-blur-xl',
        'border border-[var(--nh-glass-border,rgba(255,255,255,0.08))]',
    ].join(' '),
    floating: [
        'bg-[var(--nh-bg-surface,#141414)]',
        'shadow-[var(--nh-shadow-lg)]',
        'border border-[var(--nh-border-subtle)]',
    ].join(' '),
};

/**
 * Card Component
 *
 * Modern container with floating aesthetic.
 * Uses shadows instead of borders for depth perception.
 * Supports glass variant with backdrop blur.
 */
export const Card: FC<CardProps> = ({
    variant = 'default',
    children,
    className = '',
    padding = 'md',
    onClick,
}) => {
    const isInteractive = variant === 'interactive' || !!onClick;

    const baseClasses = [
        // Shape - rounded corners
        'rounded-xl',
        // Transitions
        'transition-all duration-200 ease-out',
        // Focus states
        'outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--nh-accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nh-bg-main)]',
    ].join(' ');

    const variantClass = variantClasses[variant] || variantClasses.default;
    const paddingClass = paddingClasses[padding] || paddingClasses.md;

    // Add interactive styles if onClick is present but variant isn't interactive
    const interactiveOverride = onClick && variant !== 'interactive'
        ? 'cursor-pointer hover:shadow-[var(--nh-shadow-md)] hover:-translate-y-0.5'
        : '';

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (e) => {
        if (isInteractive && onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
    };

    return (
        <div
            className={`${baseClasses} ${variantClass} ${paddingClass} ${interactiveOverride} ${className}`}
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

