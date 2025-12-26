import { useState, useEffect, type FC, type CSSProperties } from 'react';
import { Controller } from '@notehub/controllers-manager';

/**
 * WelcomeLayout - Initial welcome screen layout
 *
 * Uses CSS Grid to create a 2-column layout with:
 * - Left sidebar (20rem) - for vault list
 * - Right content area (1fr) - centered logo and actions
 *
 * Responsive: Switches to single column on mobile (<768px)
 * All colors use CSS variables from theme-manager.
 */
export const WelcomeLayout: FC = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const containerStyle: CSSProperties = {
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '20rem 1fr',
        gridTemplateRows: isMobile ? 'auto 1fr' : '1fr',
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--nh-bg-main, #1a1a1a)',
        color: 'var(--nh-text-primary, #e0e0e0)',
        fontFamily: 'var(--nh-font-family, system-ui, -apple-system, sans-serif)',
        overflow: 'hidden',
    };

    const sidebarStyle: CSSProperties = {
        backgroundColor: 'var(--nh-bg-sidebar, #232323)',
        borderRight: isMobile ? 'none' : '1px solid var(--nh-border-subtle, #333333)',
        borderBottom: isMobile ? '1px solid var(--nh-border-subtle, #333333)' : 'none',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        maxHeight: isMobile ? '40vh' : 'none',
    };

    const contentStyle: CSSProperties = {
        backgroundColor: 'var(--nh-bg-main, #1a1a1a)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem',
    };

    return (
        <div style={containerStyle}>
            {/* Sidebar - Left Column: vault-list slot */}
            <div style={sidebarStyle}>
                <Controller type="vault-list" />
            </div>

            {/* Content - Right Column: vault-actions slot */}
            <div style={contentStyle}>
                <Controller type="vault-actions" />
            </div>
        </div>
    );
};

export default WelcomeLayout;
