import { type FC, type ReactNode, type MouseEventHandler } from 'react';
import { Icon } from '@notehub/icon-manager';

/**
 * Button component props
 */
export interface ButtonProps {
    /** Button variant style */
    variant?: 'primary' | 'ghost' | 'danger' | 'purple' | 'secondary';
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
 * Size class mappings - Tailwind utility classes
 */
const sizeClasses: Record<string, string> = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
    xl: 'px-8 py-3 text-base gap-3 min-w-[200px]',
};

/**
 * Icon sizes per button size
 */
const iconSizes: Record<string, number> = {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 22,
};

/**
 * Variant class mappings - using CSS variables for theming
 */
const variantClasses: Record<string, string> = {
    primary: 'bg-[var(--nh-accent-primary,#6b5ce7)] text-[var(--nh-button-text,#ffffff)] border-none',
    purple: 'bg-[var(--nh-accent-primary,#6b5ce7)] text-[var(--nh-button-text,#ffffff)] border-none',
    secondary: 'bg-[var(--nh-accent-secondary,#3a3a3a)] text-[var(--nh-text-primary,#e0e0e0)] border-none',
    ghost: 'bg-transparent text-[var(--nh-text-primary,#e0e0e0)] border-none',
    danger: 'bg-[var(--nh-danger,#dc2626)] text-[var(--nh-button-text,#ffffff)] border-none',
};

/**
 * Button Component
 *
 * Themeable button with icon support using Tailwind CSS and CSS variables.
 * Includes hover, focus, disabled, and loading states.
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
        'font-medium font-sans',
        // Shape
        'rounded-lg',
        // Transitions - specific properties only to avoid "jelly effect"
        'transition-[filter,background-color,box-shadow] duration-150 ease-out',
        // Focus states
        'outline-none focus:ring-2 focus:ring-[var(--nh-accent-primary,#6b5ce7)] focus:ring-offset-1 focus:ring-offset-transparent',
        // Hover states
        'hover:brightness-[1.15]',
        // Active states
        'active:brightness-95',
        // Disabled states
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100',
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

