import type { FC, ReactNode, MouseEventHandler } from 'react';
import { Icon } from '@notehub/icon-manager';

/**
 * Button component props
 */
export interface ButtonProps {
    /** Button variant style */
    variant?: 'primary' | 'ghost' | 'danger';
    /** Button size */
    size?: 'sm' | 'md' | 'lg';
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
}

/**
 * Size mappings for padding and text
 */
const sizeStyles: Record<string, string> = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
};

/**
 * Icon size mappings
 */
const iconSizes: Record<string, number> = {
    sm: 12,
    md: 16,
    lg: 20,
};

/**
 * Variant styles using CSS variables
 */
const variantStyles: Record<string, string> = {
    primary: `
        bg-[color:var(--nh-border-accent,#5483B3)]
        text-white
        hover:brightness-110
        active:brightness-90
    `,
    ghost: `
        bg-transparent
        text-[color:var(--nh-text-primary,#C1E8FF)]
        hover:bg-white/10
        active:bg-white/20
    `,
    danger: `
        bg-red-600
        text-white
        hover:bg-red-500
        active:bg-red-700
    `,
};

/**
 * Button Component
 *
 * Themeable button with icon support using CSS variables.
 *
 * @example
 * ```tsx
 * <Button variant="primary" icon="plus" onClick={handleAdd}>
 *   Add Item
 * </Button>
 * ```
 */
export const Button: FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    icon,
    onClick,
    children,
    className = '',
    disabled = false,
}) => {
    const baseStyles = `
        inline-flex items-center justify-center
        rounded-md font-medium
        transition-all duration-150 ease-in-out
        cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
    `;

    const combinedStyles = [
        baseStyles,
        sizeStyles[size] || sizeStyles.md,
        variantStyles[variant] || variantStyles.primary,
        className,
    ]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    return (
        <button
            className={combinedStyles}
            onClick={onClick}
            disabled={disabled}
        >
            {icon && <Icon name={icon} size={iconSizes[size] || 16} />}
            {children}
        </button>
    );
};

export default Button;
