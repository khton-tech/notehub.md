/**
 * @fileoverview ListItem Component - Interactive list item for menus and palettes
 * 
 * A styled list item with hover effects, icon support, and active state.
 * 
 * @module @notehub/ck-standard/components/ListItem
 */

import type { FC, ReactNode, KeyboardEvent, MouseEvent } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ListItemProps {
    /** Unique identifier */
    id?: string;
    /** Primary text content */
    children: ReactNode;
    /** Secondary text (e.g., description or hotkey) */
    secondary?: ReactNode;
    /** Left icon element */
    icon?: ReactNode;
    /** Right accessory element (e.g., hotkey badge) */
    accessory?: ReactNode;
    /** Whether this item is currently active/selected */
    active?: boolean;
    /** Whether this item is disabled */
    disabled?: boolean;
    /** Click handler */
    onClick?: (e: MouseEvent<HTMLDivElement>) => void;
    /** Additional CSS classes */
    className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ListItem - Interactive list item for menus and palettes
 * 
 * Features:
 * - Hover state with subtle background change
 * - Active state with accent color indication
 * - Icon slot on the left
 * - Accessory slot on the right (for hotkeys, badges)
 * - Keyboard navigation support (Enter/Space to activate)
 * 
 * @example
 * ```tsx
 * <ListItem
 *     icon={<Icon name="save" size={16} />}
 *     accessory={<kbd>⌘S</kbd>}
 *     onClick={() => handleSave()}
 *     active={selectedIndex === 0}
 * >
 *     Save File
 * </ListItem>
 * ```
 */
export const ListItem: FC<ListItemProps> = ({
    id,
    children,
    secondary,
    icon,
    accessory,
    active = false,
    disabled = false,
    onClick,
    className = '',
}) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(e as unknown as MouseEvent<HTMLDivElement>);
        }
    };

    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
        if (disabled) return;
        onClick?.(e);
    };

    return (
        <div
            id={id}
            role="option"
            aria-selected={active}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={`
                flex items-center gap-3 px-4 py-2.5
                cursor-pointer select-none
                transition-colors duration-150 ease-out
                
                ${active
                    ? 'bg-[var(--nh-accent-primary,#7c3aed)]/10 text-[var(--nh-text-primary,#E0E0E0)] border border-[var(--nh-accent-primary,#7c3aed)]'
                    : 'text-[var(--nh-text-primary,#E0E0E0)] hover:bg-[var(--nh-bg-hover,rgba(255,255,255,0.05))] border border-transparent'
                }
                
                ${disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : ''
                }
                
                focus:outline-none
                focus:bg-[var(--nh-bg-hover,rgba(255,255,255,0.05))]
                
                ${className}
            `}
        >
            {/* Icon slot */}
            {icon && (
                <span className="flex-shrink-0 text-[var(--nh-text-muted,rgba(255,255,255,0.5))]">
                    {icon}
                </span>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">
                    {children}
                </div>
                {secondary && (
                    <div className="truncate text-xs text-[var(--nh-text-muted,rgba(255,255,255,0.5))]">
                        {secondary}
                    </div>
                )}
            </div>

            {/* Accessory slot (e.g., hotkey) */}
            {accessory && (
                <span className="flex-shrink-0 text-xs text-[var(--nh-text-muted,rgba(255,255,255,0.4))] font-mono">
                    {accessory}
                </span>
            )}
        </div>
    );
};

export default ListItem;
