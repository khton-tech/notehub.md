import type { FC } from 'react';
import type { NotehubCore } from '@notehub/core';
import type { VaultService } from '../logic/VaultService.js';

/**
 * Props for VaultActions component
 */
interface VaultActionsProps {
    app: NotehubCore;
    service: VaultService;
}

/**
 * Styles for the vault actions component
 */
const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column' as const,
        height: '100%',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
    },
    headerIcon: {
        width: '32px',
        height: '32px',
        color: 'var(--nh-accent-warning, #F97316)',
    },
    headerTitle: {
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--nh-text-primary, #C1E8FF)',
        margin: 0,
    },
    actionsGrid: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
        flex: 1,
    },
    button: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        borderRadius: '10px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 500,
        transition: 'all 0.2s ease',
    },
    primaryButton: {
        backgroundColor: 'var(--nh-accent-primary, #3B82F6)',
        color: '#FFFFFF',
    },
    secondaryButton: {
        backgroundColor: 'var(--nh-bg-tertiary, #0C1929)',
        color: 'var(--nh-text-primary, #C1E8FF)',
        border: '1px solid var(--nh-border, #1E3A5F)',
    },
    buttonIcon: {
        width: '20px',
        height: '20px',
    },
};

/**
 * VaultActions - Action buttons for vault management
 *
 * Provides "Open Vault" and "Create Vault" functionality.
 * Uses native directory picker via fs-manager.
 */
export const VaultActions: FC<VaultActionsProps> = ({ app, service }) => {
    /**
     * Handle opening an existing vault
     */
    const handleOpenVault = async () => {
        try {
            const path = await app.api.invoke('fs:pick-directory') as string | null;
            if (path) {
                await service.openVault(path);
            }
        } catch (error) {
            console.error('Failed to open vault:', error);
        }
    };

    /**
     * Handle creating a new vault
     */
    const handleCreateVault = async () => {
        try {
            const basePath = await app.api.invoke('fs:pick-directory') as string | null;
            if (!basePath) return;

            // Prompt for vault name (using browser prompt for now)
            const name = window.prompt('Enter vault name:', 'My Notes');
            if (!name || name.trim() === '') return;

            await service.createVault(basePath, name.trim());
        } catch (error) {
            console.error('Failed to create vault:', error);
        }
    };

    const handlePrimaryMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.backgroundColor = 'var(--nh-accent-primary-hover, #2563EB)';
        e.currentTarget.style.transform = 'translateY(-1px)';
    };

    const handlePrimaryMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.backgroundColor = 'var(--nh-accent-primary, #3B82F6)';
        e.currentTarget.style.transform = 'none';
    };

    const handleSecondaryMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.backgroundColor = 'var(--nh-bg-hover, #112240)';
        e.currentTarget.style.borderColor = 'var(--nh-accent-primary, #3B82F6)';
    };

    const handleSecondaryMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.backgroundColor = 'var(--nh-bg-tertiary, #0C1929)';
        e.currentTarget.style.borderColor = 'var(--nh-border, #1E3A5F)';
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <svg style={styles.headerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <h2 style={styles.headerTitle}>Quick Actions</h2>
            </div>

            <div style={styles.actionsGrid}>
                <button
                    style={{ ...styles.button, ...styles.primaryButton }}
                    onClick={handleCreateVault}
                    onMouseEnter={handlePrimaryMouseEnter}
                    onMouseLeave={handlePrimaryMouseLeave}
                >
                    <svg style={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New Vault
                </button>

                <button
                    style={{ ...styles.button, ...styles.secondaryButton }}
                    onClick={handleOpenVault}
                    onMouseEnter={handleSecondaryMouseEnter}
                    onMouseLeave={handleSecondaryMouseLeave}
                >
                    <svg style={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    Open Vault
                </button>
            </div>
        </div>
    );
};

export default VaultActions;
