import { type FC } from 'react';
import { Controller } from '@notehub/controllers-manager';

/**
 * WelcomeLayout - Initial welcome screen layout
 *
 * Features:
 * - Rich Black background with floating sidebar
 * - Desktop: 2-column Split (Left Sidebar, Right Content)
 * - Mobile: Vertical Stack (Sidebar Top, Content Bottom)
 */
export const WelcomeLayout: FC = () => {
    return (
        <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[var(--nh-bg-main)] text-[var(--nh-text-primary)] font-sans">
            {/* Sidebar - Recent Vaults (Floating with shadow) */}
            <div className="
                flex-shrink-0 w-full md:w-80 lg:w-96 
                bg-[var(--nh-bg-sidebar)] 
                border-b md:border-b-0 md:border-r border-[var(--nh-border-secondary)]
                shadow-[var(--nh-shadow-sm)]
                flex flex-col
                max-h-[40vh] md:max-h-full
            ">
                <Controller type="vault-list" />
            </div>

            {/* Main Area - Logo & Actions */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                <Controller type="vault-actions" />
            </div>
        </div>
    );
};

export default WelcomeLayout;
