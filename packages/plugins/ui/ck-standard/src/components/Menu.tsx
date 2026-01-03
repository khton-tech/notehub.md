import type { FC, ReactNode, ButtonHTMLAttributes, HTMLAttributes } from 'react';

// --- Menu Container ---

export interface MenuProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

export const Menu: FC<MenuProps> = ({ children, className = '', ...props }) => {
    return (
        <div
            className={`
                min-w-[180px] py-1
                bg-[var(--nh-bg-surface,#2a2a2a)]
                border border-[var(--nh-border-subtle,#3a3a3a)]
                shadow-xl rounded-md
                overflow-hidden
                flex flex-col
                ${className}
            `}
            {...props}
        >
            {children}
        </div>
    );
};

// --- Menu Item ---

export interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    icon?: ReactNode;
    active?: boolean;
}

export const MenuItem: FC<MenuItemProps> = ({
    children,
    className = '',
    icon,
    active,
    ...props
}) => {
    return (
        <button
            className={`
                w-full text-left px-3 py-1.5 text-xs
                flex items-center gap-2
                transition-colors duration-100
                outline-none
                ${active
                    ? 'bg-[var(--nh-accent-primary)] text-white'
                    : 'text-[var(--nh-text-primary,#eeeeee)] hover:bg-[var(--nh-bg-hover,#3a3a3a)] focus:bg-[var(--nh-bg-hover,#3a3a3a)]'
                }
                ${className}
            `}
            {...props}
        >
            {icon && (
                <span className={`flex items-center justify-center w-4 h-4 ${active ? 'text-white' : 'text-[var(--nh-text-secondary,#a0a0a0)]'}`}>
                    {icon}
                </span>
            )}
            <span className="flex-1 truncate">{children}</span>
        </button>
    );
};

// --- Menu Separator ---

export const MenuSeparator: FC<HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => {
    return (
        <div
            className={`h-px bg-[var(--nh-border-subtle,#333333)] my-1 mx-0 ${className}`}
            {...props}
        />
    );
};
