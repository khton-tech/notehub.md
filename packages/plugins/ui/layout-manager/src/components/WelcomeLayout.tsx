import { type FC, type CSSProperties } from 'react';
import { Controller } from '@notehub/controllers-manager';
import { Icon } from '@notehub/icon-manager';

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
 * Uses Controller components from controllers-manager.
 */
export const WelcomeLayout: FC = () => {
    return (
        <div style={styles.container}>
            {/* Sidebar - Left Column */}
            <div style={styles.sidebar}>
                <Controller type="card" className="w-full h-full flex flex-col">
                    <div style={styles.cardHeader}>
                        <Icon name="folder-open" size={32} className="text-yellow-400" />
                        <Controller type="label" variant="h2">
                            Recent Vaults
                        </Controller>
                    </div>
                    <div style={styles.cardContent}>
                        <Controller type="label" variant="caption">
                            No recent vaults
                        </Controller>
                    </div>
                    <div style={styles.cardFooter}>
                        <Controller
                            type="button"
                            variant="primary"
                            icon="folder-open"
                            className="w-full"
                        >
                            Open Vault
                        </Controller>
                    </div>
                </Controller>
            </div>

            {/* Header - Top Right */}
            <div style={styles.header}>
                <Controller type="card" className="w-full h-full flex flex-col items-center justify-center">
                    <div style={styles.brandingWrapper}>
                        <Icon name="zap" size={64} className="text-blue-400" />
                        <Controller type="label" variant="h1">
                            Notehub.md
                        </Controller>
                        <Controller type="label" variant="caption">
                            Your modular note-taking system
                        </Controller>
                    </div>
                </Controller>
            </div>

            {/* Content - Bottom Right */}
            <div style={styles.content}>
                <Controller type="card" className="w-full h-full flex flex-col">
                    <div style={styles.cardHeader}>
                        <Icon name="zap" size={32} className="text-orange-400" />
                        <Controller type="label" variant="h2">
                            Quick Actions
                        </Controller>
                    </div>
                    <div style={styles.actionsGrid}>
                        <Controller
                            type="button"
                            variant="primary"
                            icon="plus"
                            size="lg"
                        >
                            New Vault
                        </Controller>
                        <Controller
                            type="button"
                            variant="ghost"
                            icon="settings"
                            size="lg"
                        >
                            Settings
                        </Controller>
                        <Controller
                            type="button"
                            variant="ghost"
                            icon="info"
                            size="lg"
                        >
                            About
                        </Controller>
                    </div>
                </Controller>
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
        gap: '1px',
    },
    sidebar: {
        gridArea: 'sidebar',
        backgroundColor: 'var(--nh-bg-main, #021024)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        gridArea: 'header',
        backgroundColor: 'var(--nh-bg-main, #021024)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
    },
    content: {
        gridArea: 'content',
        backgroundColor: 'var(--nh-bg-main, #021024)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
    },
    cardHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
    },
    cardContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardFooter: {
        marginTop: 'auto',
        paddingTop: '16px',
    },
    brandingWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
    },
    actionsGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        flex: 1,
    },
};

export default WelcomeLayout;
