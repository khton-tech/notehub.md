import { type FC, type ReactNode, type MouseEventHandler } from 'react';
import { Icon } from '@notehub/icon-manager';

/**
 * Button component props
 */
export interface ButtonProps {
    /** Button variant style */
    variant?: 'primary' | 'ghost' | 'danger' | 'secondary' | 'glass';
    /** Button size */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** Icon name from icon-manager registry */
    icon?: string;
    /** Click handler */
    onClick?: MouseEventHandler<HTMLButtonElement>;
    /** Button content */
    children?: ReactNode;
    /** Additional CSS class names */
    className?: string;
    /** Disabled state */
    disabled?: boolean;
    /** Loading state - shows spinner and disables button */
    isLoading?: boolean;
}

/**
 * Size class mappings - rounded-xl for softer corners
 */
const sizeClasses: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
    xl: 'px-8 py-3.5 text-base gap-3 min-w-[200px]',
};

/**
 * Icon sizes per button size
 */
const iconSizes: Record<string, number> = {
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
};

/**
 * Variant class mappings - using CSS variables for theming
 * Now includes glass variant and hover glow effects
 */
const variantClasses: Record<string, string> = {
    primary: [
        'bg-[var(--nh-accent-primary,#7c3aed)]',
        'text-[var(--nh-button-text,#ffffff)]',
        'shadow-[var(--nh-shadow-sm)]',
        'hover:shadow-nh-glow-accent',
        'hover:brightness-110',
    ].join(' '),
    secondary: [
        'bg-[var(--nh-bg-secondary,#1A1A1A)]',
        'text-[var(--nh-text-primary,#E0E0E0)]',
        'border border-[var(--nh-border-secondary)]',
        'hover:bg-[var(--nh-bg-hover)]',
        'hover:border-[var(--nh-text-muted)]',
    ].join(' '),
    ghost: [
        'bg-transparent',
        'text-[var(--nh-text-primary,#E0E0E0)]',
        'hover:bg-[var(--nh-bg-hover,#1E1E1E)]',
    ].join(' '),
    danger: [
        'bg-[var(--nh-danger,#ef4444)]',
        'text-[var(--nh-button-text,#ffffff)]',
        'shadow-[var(--nh-shadow-sm)]',
        'hover:shadow-[0_0_20px_rgba(239,68,68,0.35)]',
        'hover:brightness-110',
    ].join(' '),
    glass: [
        'bg-[var(--nh-glass-bg,rgba(20,20,20,0.7))]',
        'bg-gradient-to-b from-white/[0.08] to-transparent',
        'backdrop-blur-xl',
        'text-[var(--nh-text-primary,#E0E0E0)]',
        'border border-[var(--nh-glass-border,rgba(255,255,255,0.1))]',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]',
        'hover:bg-[rgba(255,255,255,0.12)]',
        'hover:border-[rgba(255,255,255,0.2)]',
    ].join(' '),
};

/**
 * Button Component
 *
 * Modern themeable button with glassmorphism support.
 * Features rounded-xl corners, hover glow effects, and smooth transitions.
 */
export const Button: FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    icon,
    onClick,
    children,
    className = '',
    disabled = false,
    isLoading = false,
}) => {
    const baseClasses = [
        // Layout
        'inline-flex items-center justify-center',
        // Typography
        'font-medium',
        // Shape - softer corners
        'rounded-xl',
        // Transitions - smooth for glow effect
        'transition-[background,color,box-shadow,transform,opacity] duration-[200ms] ease-out',
        // Tactile click feedback
        'active:scale-[0.97]',
        // Focus states - glow ring
        'outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--nh-accent-primary,#7c3aed)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nh-bg-main)]',
        // Disabled states
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:brightness-100 disabled:active:scale-100',
        // Cursor
        'cursor-pointer',
    ].join(' ');

    const sizeClass = sizeClasses[size] || sizeClasses.md;
    const variantClass = variantClasses[variant] || variantClasses.primary;
    const isDisabled = disabled || isLoading;

    return (
        <button
            className={`${baseClasses} ${sizeClass} ${variantClass} ${className}`}
            onClick={onClick}
            disabled={isDisabled}
            aria-busy={isLoading}
        >
            {isLoading ? (
                <Icon name="loader" size={iconSizes[size] || 16} className="animate-spin" />
            ) : (
                icon && <Icon name={icon} size={iconSizes[size] || 16} />
            )}
            {children}
        </button>
    );
};

export default Button;
