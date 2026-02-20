/**
 * ContextMenu Component
 * 
 * Renders a context menu with smart positioning, click-outside handling,
 * and recursive submenu support. Uses React Portal for proper z-index layering.
 */

import {
    useState,
    useEffect,
    useRef,
    type FC,
    type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@notehub/icon-manager';
import { ChevronRight } from 'lucide-react';
import type { MenuItem, MenuAction, SubMenu, ContextMenuState } from '../types';

// =============== Constants ===============

const MENU_MIN_WIDTH = 180;
const MENU_PADDING = 8; // Padding from screen edges
const SUBMENU_OFFSET = 4; // Gap between parent and submenu

// =============== Styles ===============

const menuStyles = `
    .nh-context-menu {
        position: fixed;
        min-width: ${MENU_MIN_WIDTH}px;
        background: var(--nh-bg-secondary, #1e1e2e);
        border: 1px solid var(--nh-border-subtle, #313244);
        border-radius: 8px;
        box-shadow: 
            0 10px 40px rgba(0, 0, 0, 0.4),
            0 2px 10px rgba(0, 0, 0, 0.2);
        padding: 4px;
        z-index: 9999;
        animation: contextMenuFadeIn 0.15s ease-out;
        font-family: var(--nh-font-family, system-ui);
    }

    @keyframes contextMenuFadeIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    .nh-context-menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        color: var(--nh-text-primary, #cdd6f4);
        transition: background-color 0.1s ease;
        user-select: none;
        position: relative;
    }

    .nh-context-menu-item:hover {
        background: var(--nh-bg-hover, #1E1E1E);
        color: var(--nh-text-primary, #e0e0e0);
    }

    .nh-context-menu-item:hover .nh-context-menu-icon {
        color: var(--nh-accent-primary, #6b5ce7);
    }

    .nh-context-menu-item.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
    }

    .nh-context-menu-icon {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
        color: var(--nh-text-secondary, #a6adc8);
        transition: color 0.1s ease;
    }

    .nh-context-menu-label {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .nh-context-menu-arrow {
        flex-shrink: 0;
        width: 14px;
        height: 14px;
        color: var(--nh-text-secondary, #a6adc8);
    }

    .nh-context-menu-item:hover .nh-context-menu-arrow {
        color: var(--nh-text-secondary, #a6adc8);
    }

    .nh-context-menu-separator {
        height: 1px;
        background: var(--nh-border-subtle, #313244);
        margin: 4px 8px;
    }

    .nh-context-menu-submenu {
        position: absolute;
        top: -4px;
    }
`;

// =============== Helper Hooks ===============

/**
 * Hook to detect clicks outside a referenced element
 */
function useClickOutside(
    ref: React.RefObject<HTMLElement | null>,
    handler: () => void,
    enabled: boolean
) {
    useEffect(() => {
        if (!enabled) return;

        const handleClick = (event: PointerEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                handler();
            }
        };

        // Use pointerdown (covers both mouse and touch) in capture phase
        document.addEventListener('pointerdown', handleClick, true);
        return () => document.removeEventListener('pointerdown', handleClick, true);
    }, [ref, handler, enabled]);
}

/**
 * Calculate menu position with edge detection
 */
function calculatePosition(
    x: number,
    y: number,
    menuWidth: number,
    menuHeight: number
): { x: number; y: number; flipX: boolean; flipY: boolean } {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let finalX = x;
    let finalY = y;
    let flipX = false;
    let flipY = false;

    // Check if menu would overflow right edge
    if (x + menuWidth + MENU_PADDING > viewportWidth) {
        finalX = x - menuWidth;
        flipX = true;
    }

    // Check if menu would overflow bottom edge
    if (y + menuHeight + MENU_PADDING > viewportHeight) {
        finalY = y - menuHeight;
        flipY = true;
    }

    // Ensure menu doesn't go off-screen (clamp to edges)
    finalX = Math.max(MENU_PADDING, Math.min(finalX, viewportWidth - menuWidth - MENU_PADDING));
    finalY = Math.max(MENU_PADDING, Math.min(finalY, viewportHeight - menuHeight - MENU_PADDING));

    return { x: finalX, y: finalY, flipX, flipY };
}

// =============== Menu Item Components ===============

interface MenuItemActionProps {
    item: MenuAction;
    payload: any;
    onClose: () => void;
}

const MenuItemAction: FC<MenuItemActionProps> = ({ item, payload, onClose }) => {
    const handleClick = (e: ReactMouseEvent) => {
        e.stopPropagation();
        if (!item.disabled) {
            item.onClick(payload);
            onClose();
        }
    };

    return (
        <div
            className={`nh-context-menu-item ${item.disabled ? 'disabled' : ''}`}
            onClick={handleClick}
            style={item.color ? { color: item.color } : undefined}
        >
            {item.icon && (
                <span className="nh-context-menu-icon">
                    <Icon name={item.icon} size={16} />
                </span>
            )}
            <span className="nh-context-menu-label">{item.label}</span>
        </div>
    );
};

interface MenuItemSubmenuProps {
    item: SubMenu;
    payload: any;
    onClose: () => void;
    parentFlipX: boolean;
}

const MenuItemSubmenu: FC<MenuItemSubmenuProps> = ({ item, payload, onClose, parentFlipX }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [submenuStyle, setSubmenuStyle] = useState<React.CSSProperties>({});
    const itemRef = useRef<HTMLDivElement>(null);
    const submenuRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        // Delay closing to allow moving to submenu
        timeoutRef.current = window.setTimeout(() => {
            setIsOpen(false);
        }, 150);
    };

    // On touch devices (no hover capability), toggle submenu on tap
    const handleClick = (e: React.MouseEvent) => {
        if (!window.matchMedia('(hover: hover)').matches) {
            e.stopPropagation();
            setIsOpen(prev => !prev);
        }
    };

    // Calculate submenu position when it opens
    useEffect(() => {
        if (isOpen && itemRef.current) {
            const rect = itemRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;

            // Estimate submenu width (we'll adjust after render if needed)
            const estimatedWidth = MENU_MIN_WIDTH;

            let left: string | number;
            if (parentFlipX || rect.right + estimatedWidth + SUBMENU_OFFSET > viewportWidth) {
                // Flip to left side
                left = -(estimatedWidth + SUBMENU_OFFSET);
            } else {
                // Open to right side
                left = `calc(100% + ${SUBMENU_OFFSET}px)`;
            }

            setSubmenuStyle({
                left: typeof left === 'number' ? `${left}px` : left,
            });
        }
    }, [isOpen, parentFlipX]);

    // Cleanup timeout
    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <div
            ref={itemRef}
            className="nh-context-menu-item"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            {item.icon && (
                <span className="nh-context-menu-icon">
                    <Icon name={item.icon} size={16} />
                </span>
            )}
            <span className="nh-context-menu-label">{item.label}</span>
            <ChevronRight className="nh-context-menu-arrow" size={14} />

            {isOpen && (
                <div
                    ref={submenuRef}
                    className="nh-context-menu nh-context-menu-submenu"
                    style={submenuStyle}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <MenuItems
                        items={item.items}
                        payload={payload}
                        onClose={onClose}
                        flipX={parentFlipX}
                    />
                </div>
            )}
        </div>
    );
};

interface MenuItemsProps {
    items: MenuItem[];
    payload: any;
    onClose: () => void;
    flipX?: boolean;
}

const MenuItems: FC<MenuItemsProps> = ({ items, payload, onClose, flipX = false }) => {
    return (
        <>
            {items.map((item, index) => {
                if (item.type === 'separator') {
                    return <div key={`sep-${index}`} className="nh-context-menu-separator" />;
                }

                if (item.type === 'submenu') {
                    return (
                        <MenuItemSubmenu
                            key={`submenu-${item.label}-${index}`}
                            item={item}
                            payload={payload}
                            onClose={onClose}
                            parentFlipX={flipX}
                        />
                    );
                }

                return (
                    <MenuItemAction
                        key={item.id}
                        item={item}
                        payload={payload}
                        onClose={onClose}
                    />
                );
            })}
        </>
    );
};

// =============== Main Context Menu Component ===============

interface ContextMenuProps {
    state: ContextMenuState;
    onClose: () => void;
}

export const ContextMenu: FC<ContextMenuProps> = ({ state, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ x: number; y: number; flipX: boolean }>({
        x: state.position.x,
        y: state.position.y,
        flipX: false,
    });

    // Handle click outside
    useClickOutside(menuRef, onClose, state.visible);

    // Handle escape key
    useEffect(() => {
        if (!state.visible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [state.visible, onClose]);

    // Calculate position after initial render
    useEffect(() => {
        if (state.visible && menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const calculated = calculatePosition(
                state.position.x,
                state.position.y,
                rect.width,
                rect.height
            );
            setPosition({
                x: calculated.x,
                y: calculated.y,
                flipX: calculated.flipX,
            });
        }
    }, [state.visible, state.position.x, state.position.y]);

    if (!state.visible) {
        return null;
    }

    const menuContent = (
        <>
            <style>{menuStyles}</style>
            <div
                ref={menuRef}
                className="nh-context-menu"
                style={{
                    left: position.x,
                    top: position.y,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <MenuItems
                    items={state.items}
                    payload={state.payload}
                    onClose={onClose}
                    flipX={position.flipX}
                />
            </div>
        </>
    );

    return createPortal(menuContent, document.body);
};

export default ContextMenu;
