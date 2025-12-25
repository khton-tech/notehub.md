import React from 'react';

export interface RibbonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isActive?: boolean;
    label?: string; // For tooltip or aria-label
}

export const RibbonButton: React.FC<RibbonButtonProps> = ({ children, isActive, className, ...props }) => {
    return (
        <button
            className={`w-[40px] h-[40px] flex items-center justify-center text-[var(--nh-text-muted)] hover:text-[var(--nh-text-primary)] hover:bg-white/5 transition-colors focus:outline-none ${isActive ? 'text-[var(--nh-text-primary)] bg-white/5' : ''} ${className || ''}`}
            {...props}
        >
            {children}
        </button>
    );
};
