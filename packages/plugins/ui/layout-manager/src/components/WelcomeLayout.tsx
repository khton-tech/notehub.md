import { type FC, type CSSProperties } from 'react';

/**
 * WelcomeLayout - Initial welcome screen layout
 *
 * Uses CSS Grid to create a 2-column layout with:
 * - Left sidebar (300px) - for vault list
 * - Right column split vertically:
 *   - Top (30%) - App info/branding
 *   - Bottom (70%) - Actions/quick start
 *
 * All colors use CSS variables from theme-manager.
 */
export const WelcomeLayout: FC = () => {
    return (
        <div style={styles.container}>
            {/* Sidebar - Left Column */}
            <div style={styles.sidebar}>
                <div style={styles.slotContent}>
                    <span style={styles.slotLabel}>📁</span>
                    <span style={styles.slotTitle}>Recent Vaults</span>
                    <span style={styles.slotPlaceholder}>Placeholder</span>
                </div>
            </div>

            {/* Header - Top Right */}
            <div style={styles.header}>
                <div style={styles.slotContent}>
                    <span style={styles.slotLabel}>ℹ️</span>
                    <span style={styles.slotTitle}>App Info</span>
                    <span style={styles.slotPlaceholder}>Placeholder</span>
                </div>
            </div>

            {/* Content - Bottom Right */}
            <div style={styles.content}>
                <div style={styles.slotContent}>
                    <span style={styles.slotLabel}>⚡</span>
                    <span style={styles.slotTitle}>Actions</span>
                    <span style={styles.slotPlaceholder}>Placeholder</span>
                </div>
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
        gridTemplateColumns: '300px 1fr',
        gridTemplateRows: '30% 1fr',
        gridTemplateAreas: `
            "sidebar header"
            "sidebar content"
        `,
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--nh-bg-main, #021024)',
        color: 'var(--nh-text-primary, #C1E8FF)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
    },
    sidebar: {
        gridArea: 'sidebar',
        backgroundColor: 'var(--nh-bg-surface, #052659)',
        borderRight: '1px solid var(--nh-border-secondary, #7DA0CA)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
    },
    header: {
        gridArea: 'header',
        borderBottom: '1px solid var(--nh-border-secondary, #7DA0CA)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
    },
    content: {
        gridArea: 'content',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
    },
    slotContent: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '32px',
        border: '2px dashed var(--nh-border-accent, #5483B3)',
        borderRadius: '12px',
        backgroundColor: 'rgba(84, 131, 179, 0.1)',
    },
    slotLabel: {
        fontSize: '32px',
    },
    slotTitle: {
        fontSize: '18px',
        fontWeight: 600,
        color: 'var(--nh-text-primary, #C1E8FF)',
    },
    slotPlaceholder: {
        fontSize: '14px',
        color: 'var(--nh-text-secondary, #7DA0CA)',
        opacity: 0.7,
    },
};

export default WelcomeLayout;
