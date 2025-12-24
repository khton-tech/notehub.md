import { type FC, type CSSProperties } from 'react';
import { Controller } from '@notehub/controllers-manager';

/**
 * WelcomeLayout - Initial welcome screen layout
 *
 * Uses CSS Grid to create a 2-column layout with:
 * - Left sidebar (320px) - for vault list
 * - Right content area (1fr) - centered logo and actions
 *
 * All colors use CSS variables from theme-manager.
 * Uses Controller components from controllers-manager.
 * 
 * Smart Slots:
 * - Sidebar slot: Renders `vault-list` controller if registered
 * - Content slot: Renders `vault-actions` controller if registered
 */
export const WelcomeLayout: FC = () => {
    return (
        <div style={styles.container}>
            {/* Sidebar - Left Column: vault-list slot */}
            <div style={styles.sidebar}>
                <Controller type="vault-list" />
            </div>

            {/* Content - Right Column: vault-actions slot */}
            <div style={styles.content}>
                <Controller type="vault-actions" />
            </div>
        </div>
    );
};

/**
 * Styles using CSS variables from theme-manager
 */
const styles: Record<string, CSSProperties> = {
    container: {
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--nh-bg-main, #1a1a1a)',
        color: 'var(--nh-text-primary, #e0e0e0)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
    },
    sidebar: {
        backgroundColor: 'var(--nh-bg-sidebar, #232323)',
        borderRight: '1px solid var(--nh-border-subtle, #333333)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
    },
    content: {
        backgroundColor: 'var(--nh-bg-main, #1a1a1a)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
    },
};

export default WelcomeLayout;

