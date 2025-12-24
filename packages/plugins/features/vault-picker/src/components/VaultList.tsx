import { useState, useEffect, type FC } from 'react';
import type { VaultService, VaultHistoryEntry } from '../logic/VaultService.js';

/**
 * Props for VaultList component
 */
interface VaultListProps {
    service: VaultService;
}

/**
 * Styles for the vault list component
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
        color: 'var(--nh-accent-warning, #EAB308)',
    },
    headerTitle: {
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--nh-text-primary, #C1E8FF)',
        margin: 0,
    },
    list: {
        flex: 1,
        overflowY: 'auto' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
    },
    emptyState: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--nh-text-muted, #64748B)',
    },
    vaultItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        backgroundColor: 'var(--nh-bg-tertiary, #0C1929)',
        borderRadius: '8px',
        border: '1px solid var(--nh-border, #1E3A5F)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    vaultIcon: {
        width: '24px',
        height: '24px',
        color: 'var(--nh-accent-primary, #3B82F6)',
    },
    vaultInfo: {
        flex: 1,
        minWidth: 0,
    },
    vaultName: {
        fontSize: '0.95rem',
        fontWeight: 500,
        color: 'var(--nh-text-primary, #C1E8FF)',
        margin: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    },
    vaultPath: {
        fontSize: '0.75rem',
        color: 'var(--nh-text-muted, #64748B)',
        margin: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    },
};

/**
 * VaultList - Displays list of recently opened vaults
 *
 * Shows vault history with names and paths.
 * Clicking a vault item opens it via VaultService.
 */
export const VaultList: FC<VaultListProps> = ({ service }) => {
    const [vaults, setVaults] = useState<VaultHistoryEntry[]>([]);

    useEffect(() => {
        service.getRecentVaults().then(setVaults);
    }, [service]);

    const handleVaultClick = async (path: string) => {
        try {
            await service.openVault(path);
        } catch (error) {
            console.error('Failed to open vault:', error);
        }
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        target.style.backgroundColor = 'var(--nh-bg-hover, #112240)';
        target.style.borderColor = 'var(--nh-accent-primary, #3B82F6)';
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        target.style.backgroundColor = 'var(--nh-bg-tertiary, #0C1929)';
        target.style.borderColor = 'var(--nh-border, #1E3A5F)';
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <svg style={styles.headerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <h2 style={styles.headerTitle}>Recent Vaults</h2>
            </div>

            <div style={styles.list}>
                {vaults.length === 0 ? (
                    <div style={styles.emptyState}>
                        <p>No recent vaults</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                            Open or create a vault to get started
                        </p>
                    </div>
                ) : (
                    vaults.map((vault) => (
                        <div
                            key={vault.path}
                            style={styles.vaultItem}
                            onClick={() => handleVaultClick(vault.path)}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                        >
                            <svg style={styles.vaultIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            <div style={styles.vaultInfo}>
                                <p style={styles.vaultName}>{vault.name}</p>
                                <p style={styles.vaultPath}>{vault.path}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default VaultList;
