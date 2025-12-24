import type { FC, ReactNode, MouseEventHandler, CSSProperties } from 'react';
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
}

/**
 * Size styles (padding, fontSize, gap, minWidth)
 */
const sizeStyles: Record<string, CSSProperties> = {
    sm: { padding: '4px 8px', fontSize: '12px', gap: '4px' },
    md: { padding: '6px 12px', fontSize: '14px', gap: '6px' },
    lg: { padding: '8px 16px', fontSize: '16px', gap: '8px' },
    xl: { padding: '12px 32px', fontSize: '16px', gap: '12px', minWidth: '200px' },
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
 * Variant base styles
 */
const variantStyles: Record<string, CSSProperties> = {
    primary: {
        backgroundColor: 'var(--nh-accent-primary, #6b5ce7)',
        color: '#ffffff',
        border: 'none',
    },
    purple: {
        backgroundColor: 'var(--nh-accent-primary, #6b5ce7)',
        color: '#ffffff',
        border: 'none',
    },
    secondary: {
        backgroundColor: 'var(--nh-accent-secondary, #3a3a3a)',
        color: 'var(--nh-text-primary, #e0e0e0)',
        border: 'none',
    },
    ghost: {
        backgroundColor: 'transparent',
        color: 'var(--nh-text-primary, #e0e0e0)',
        border: 'none',
    },
    danger: {
        backgroundColor: '#dc2626',
        color: '#ffffff',
        border: 'none',
    },
};

/**
 * Button Component
 *
 * Themeable button with icon support using CSS variables.
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
    const baseStyle: CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
        fontFamily: 'inherit',
        ...sizeStyles[size],
        ...variantStyles[variant],
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!disabled) {
            e.currentTarget.style.filter = 'brightness(1.15)';
        }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.filter = 'none';
    };

    return (
        <button
            style={baseStyle}
            className={className}
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {icon && <Icon name={icon} size={iconSizes[size] || 16} />}
            {children}
        </button>
    );
};

export default Button;

