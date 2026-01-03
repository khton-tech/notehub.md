/**
 * Context Menu Types
 * 
 * Strict type definitions for menu items supporting actions,
 * submenus, and separators with full TypeScript safety.
 */

/**
 * Type discriminator for menu items
 */
export type MenuItemType = 'action' | 'submenu' | 'separator';

/**
 * Clickable menu action item
 */
export interface MenuAction {
    type: 'action';
    /** Unique identifier for the action */
    id: string;
    /** Display label */
    label: string;
    /** Lucide icon name (kebab-case) */
    icon?: string;
    /** CSS class for styling, e.g., 'text-red-500' for destructive actions */
    color?: string;
    /** Whether the action is disabled */
    disabled?: boolean;
    /** Click handler, receives contextual payload */
    onClick: (payload: any) => void;
}

/**
 * Visual separator between menu groups
 */
export interface MenuSeparator {
    type: 'separator';
}

/**
 * Nested submenu with recursive items
 */
export interface SubMenu {
    type: 'submenu';
    /** Display label */
    label: string;
    /** Lucide icon name (kebab-case) */
    icon?: string;
    /** Nested menu items */
    items: MenuItem[];
}

/**
 * Union type for all menu item types
 */
export type MenuItem = MenuAction | MenuSeparator | SubMenu;

/**
 * Dynamic menu provider function
 * 
 * Called when a context menu is triggered to generate items dynamically.
 * The payload contains contextual information (e.g., file path, selection).
 * 
 * @param payload - Context-specific data passed from the trigger
 * @returns Array of menu items or Promise resolving to items
 */
export type MenuProvider = (payload: any) => MenuItem[] | Promise<MenuItem[]>;

/**
 * Internal state for the context menu component
 */
export interface ContextMenuState {
    /** Whether the menu is visible */
    visible: boolean;
    /** Menu position (client coordinates) */
    position: { x: number; y: number };
    /** Current menu items to display */
    items: MenuItem[];
    /** Payload to pass to onClick handlers */
    payload: any;
}
