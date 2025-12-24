import type { FC, ReactNode, CSSProperties } from 'react';

/**
 * Label component props
 */
export interface LabelProps {
    /** Typography variant */
    variant?: 'h1' | 'h2' | 'body' | 'caption' | 'muted' | 'logo';
    /** Label content */
    children?: ReactNode;
    /** Additional CSS class names */
    className?: string;
}

/**
 * Variant styles
 */
const variantStyles: Record<string, CSSProperties> = {
    h1: {
        fontSize: '30px',
        fontWeight: 700,
        color: 'var(--nh-text-primary, #e0e0e0)',
    },
    h2: {
        fontSize: '20px',
        fontWeight: 600,
        color: 'var(--nh-text-primary, #e0e0e0)',
    },
    body: {
        fontSize: '16px',
        fontWeight: 400,
        color: 'var(--nh-text-primary, #e0e0e0)',
    },
    caption: {
        fontSize: '14px',
        fontWeight: 400,
        color: 'var(--nh-text-secondary, #a0a0a0)',
    },
    muted: {
        fontSize: '12px',
        fontWeight: 400,
        color: 'var(--nh-text-muted, #888888)',
    },
    logo: {
        fontSize: '24px',
        fontWeight: 700,
        letterSpacing: '-0.5px',
        color: 'var(--nh-text-primary, #e0e0e0)',
    },
};

/**
 * Label Component
 *
 * Typography component for text with semantic variants.
 * Uses CSS variables for theme-aware coloring.
 */
export const Label: FC<LabelProps> = ({
    variant = 'body',
    children,
    className = '',
}) => {
    const style = variantStyles[variant] || variantStyles.body;

    // Use semantic HTML elements based on variant
    const Tag = variant === 'h1' || variant === 'logo' ? 'h1' : variant === 'h2' ? 'h2' : 'span';

    return (
        <Tag style={style} className={className}>
            {children}
        </Tag>
    );
};

export default Label;

