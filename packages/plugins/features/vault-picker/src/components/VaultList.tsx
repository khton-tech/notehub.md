import { useState, useEffect, type FC } from 'react';
import { Icon } from '@notehub/icon-manager';
import { Card } from '@notehub/ck-standard';
import { Label } from '@notehub/ck-standard';
import type { VaultService, VaultHistoryEntry } from '../logic/VaultService.js';

/**
 * Props for VaultList component
 */
interface VaultListProps {
    service: VaultService;
}

/**
 * VaultList - Displays list of recently opened vaults
 *
 * Shows vault history with interactive cards.
 * Each card has: Cube icon, Name, Path, and Delete action.
 */
export const VaultList: FC<VaultListProps> = ({ service }) => {
    const [vaults, setVaults] = useState<VaultHistoryEntry[]>([]);

    useEffect(() => {
        service.getRecentVaults().then(setVaults);
    }, [service]);

    const handleVaultClick = async (path: string) => {
        try {
            await service.openVault(path);
        } catch {
            // Error is already logged and displayed by VaultService
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, _path: string) => {
        e.stopPropagation();
        // TODO: Implement vault deletion from history
    };

    if (vaults.length === 0) {
        return (
            <div style={styles.emptyState}>
                <Icon name="folder-open" size={48} className="opacity-30" />
                <Label variant="caption" className="mt-4">No recent vaults</Label>
                <Label variant="muted" className="mt-1">Open or create a vault to get started</Label>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {vaults.map((vault) => (
                <Card
                    key={vault.path}
                    variant="interactive"
                    padding="sm"
                    onClick={() => handleVaultClick(vault.path)}
                    className="flex items-center gap-3"
                >
                    <div style={styles.iconWrapper}>
                        <Icon name="box" size={24} />
                    </div>
                    <div style={styles.vaultInfo}>
                        <Label variant="body" className="font-medium truncate block">
                            {vault.name}
                        </Label>
                        <Label variant="muted" className="truncate block">
                            {vault.path}
                        </Label>
                    </div>
                    <button
                        style={styles.deleteButton}
                        onClick={(e) => handleDeleteClick(e, vault.path)}
                        aria-label="Remove from history"
                    >
                        <Icon name="trash-2" size={16} />
                    </button>
                </Card>
            ))}
        </div>
    );
};

/**
 * Styles for VaultList
 */
const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        color: 'var(--nh-text-muted, #888888)',
        textAlign: 'center',
        padding: '20px',
    },
    iconWrapper: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        backgroundColor: 'var(--nh-bg-main, #1a1a1a)',
        color: 'var(--nh-text-secondary, #a0a0a0)',
        flexShrink: 0,
    },
    vaultInfo: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    deleteButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        border: 'none',
        background: 'transparent',
        color: 'var(--nh-text-muted, #888888)',
        cursor: 'pointer',
        transition: 'color 0.15s ease, opacity 0.15s ease',
        flexShrink: 0,
    },
};

export default VaultList;

