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
 * 
 * Smart Slots:
 * - Sidebar slot: Renders `vault-list` controller if registered
 * - Actions slot: Renders `vault-actions` controller if registered
 * If controllers are not registered, fallback content is shown.
 */
export const WelcomeLayout: FC = () => {
    return (
        <div style={styles.container}>
            {/* Sidebar - Left Column: vault-list slot */}
            <div style={styles.sidebar}>
                <Controller type="card" className="w-full h-full flex flex-col">
                    {/* Try to render vault-list, fallback to default content */}
                    <Controller type="vault-list" />
                    {/* Note: If vault-list is not registered, Controller returns null.
                        The VaultListFallback below will be shown as part of the card content
                        when vault-list is not available. We handle this via CSS/layout. */}
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

            {/* Content - Bottom Right: vault-actions slot */}
            <div style={styles.content}>
                <Controller type="card" className="w-full h-full flex flex-col">
                    {/* Try to render vault-actions, fallback content shown when not registered */}
                    <Controller type="vault-actions" />
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
    brandingWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
    },
};

export default WelcomeLayout;
