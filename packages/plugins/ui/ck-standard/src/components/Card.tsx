import type { FC, ReactNode } from 'react';

/**
 * Card component props
 */
export interface CardProps {
    /** Card content */
    children?: ReactNode;
    /** Additional CSS class names */
    className?: string;
    /** Padding size */
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Padding size mappings
 */
const paddingStyles: Record<string, string> = {
    none: 'p-0',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
};

/**
 * Card Component
 *
 * Container component with themed background and border.
 * Uses CSS variables for theme-aware styling.
 *
 * @example
 * ```tsx
 * <Card padding="md">
 *   <Label variant="h2">Card Title</Label>
 *   <Label variant="body">Card content goes here...</Label>
 * </Card>
 * ```
 */
export const Card: FC<CardProps> = ({
    children,
    className = '',
    padding = 'md',
}) => {
    const baseStyles = `
        bg-[color:var(--nh-bg-surface,#052659)]
        border border-[color:var(--nh-border-secondary,#7DA0CA)]
        rounded-lg
    `;

    const combinedStyles = [
        baseStyles,
        paddingStyles[padding] || paddingStyles.md,
        className,
    ]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    return <div className={combinedStyles}>{children}</div>;
};

export default Card;
