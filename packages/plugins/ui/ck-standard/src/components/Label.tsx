import type { FC, ReactNode } from 'react';

/**
 * Label component props
 */
export interface LabelProps {
    /** Typography variant */
    variant?: 'h1' | 'h2' | 'body' | 'caption';
    /** Label content */
    children?: ReactNode;
    /** Additional CSS class names */
    className?: string;
}

/**
 * Variant styles using CSS variables
 */
const variantStyles: Record<string, string> = {
    h1: `
        text-3xl font-bold
        text-[color:var(--nh-text-primary,#C1E8FF)]
    `,
    h2: `
        text-xl font-semibold
        text-[color:var(--nh-text-primary,#C1E8FF)]
    `,
    body: `
        text-base font-normal
        text-[color:var(--nh-text-primary,#C1E8FF)]
    `,
    caption: `
        text-sm font-normal
        text-[color:var(--nh-text-secondary,#7DA0CA)]
    `,
};

/**
 * Label Component
 *
 * Typography component for text with semantic variants.
 * Uses CSS variables for theme-aware coloring.
 *
 * @example
 * ```tsx
 * <Label variant="h1">Welcome to Notehub</Label>
 * <Label variant="caption">Last updated 5 minutes ago</Label>
 * ```
 */
export const Label: FC<LabelProps> = ({
    variant = 'body',
    children,
    className = '',
}) => {
    const combinedStyles = [
        variantStyles[variant] || variantStyles.body,
        className,
    ]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Use semantic HTML elements based on variant
    const Tag = variant === 'h1' ? 'h1' : variant === 'h2' ? 'h2' : 'span';

    return <Tag className={combinedStyles}>{children}</Tag>;
};

export default Label;
