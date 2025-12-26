import type { FC, ReactNode } from 'react';

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
 * Variant class mappings - using Tailwind utilities with CSS variables
 */
const variantClasses: Record<string, string> = {
    h1: 'text-3xl font-bold text-[var(--nh-text-primary,#e0e0e0)]',
    h2: 'text-xl font-semibold text-[var(--nh-text-primary,#e0e0e0)]',
    body: 'text-base font-normal text-[var(--nh-text-primary,#e0e0e0)]',
    caption: 'text-sm font-normal text-[var(--nh-text-secondary,#a0a0a0)]',
    muted: 'text-xs font-normal text-[var(--nh-text-muted,#888888)]',
    logo: 'text-2xl font-bold tracking-tight text-[var(--nh-text-primary,#e0e0e0)]',
};

/**
 * Label Component
 *
 * Typography component for text with semantic variants.
 * Uses Tailwind CSS utilities and CSS variables for theme-aware coloring.
 */
export const Label: FC<LabelProps> = ({
    variant = 'body',
    children,
    className = '',
}) => {
    const variantClass = variantClasses[variant] || variantClasses.body;

    // Use semantic HTML elements based on variant
    const Tag = variant === 'h1' || variant === 'logo' ? 'h1' : variant === 'h2' ? 'h2' : 'span';

    return (
        <Tag className={`${variantClass} ${className}`}>
            {children}
        </Tag>
    );
};

export default Label;
