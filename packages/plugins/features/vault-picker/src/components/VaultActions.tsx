import type { FC } from 'react';
import type { NotehubCore } from '@notehub/core';
import { Icon } from '@notehub/icon-manager';
import { Button, Label } from '@notehub/ck-standard';
import type { VaultService } from '../logic/VaultService.js';

/**
 * Props for VaultActions component
 */
interface VaultActionsProps {
    app: NotehubCore;
    service: VaultService;
}

/**
 * VaultActions - Main action panel for vault management
 *
 * Centered layout with:
 * - Logo and app name
 * - Subtitle
 * - Add Vault button (purple)
 * - Open Vault button (secondary)
 */
export const VaultActions: FC<VaultActionsProps> = ({ app, service }) => {
    /**
     * Handle adding a new vault (select folder to use as vault)
     */
    const handleAddVault = async () => {
        try {
            const path = await app.api.invoke('fs:pick-directory') as string | null;
            if (path) {
                await service.openVault(path);
            }
        } catch (error) {
            console.error('Failed to add vault:', error);
        }
    };

    /**
     * Handle creating a new vault
     */
    const handleOpenVault = async () => {
        try {
            const basePath = await app.api.invoke('fs:pick-directory') as string | null;
            if (!basePath) return;

            // Prompt for vault name
            const name = await app.api.invoke('dialog:prompt', 'Create Vault', 'Enter vault name:', 'My Notes') as string | null;
            if (!name || name.trim() === '') return;

            await service.createVault(basePath, name.trim());
        } catch (error) {
            console.error('Failed to create vault:', error);
        }
    };

    return (
        <div style={styles.container}>
            {/* Logo Section */}
            <div style={styles.logoSection}>
                <Icon name="disc" size={80} className="opacity-90" />
                <Label variant="logo" className="mt-4">notehub.md</Label>
                <Label variant="caption" className="mt-2">Gather your data together</Label>
            </div>

            {/* Spacer */}
            <div style={styles.spacer} />

            {/* Actions Section */}
            <div style={styles.actionsSection}>
                {/* Open Vault Button (primary action - open existing folder) */}
                <div style={styles.actionGroup}>
                    <Button
                        variant="purple"
                        size="xl"
                        icon="folder-open"
                        onClick={handleAddVault}
                    >
                        Open Vault
                    </Button>
                    <Label variant="muted" className="mt-2 text-center">
                        Select an existing folder
                    </Label>
                </div>

                {/* Create Vault Button (secondary action - create new) */}
                <div style={styles.actionGroup}>
                    <Button
                        variant="secondary"
                        size="xl"
                        icon="plus-circle"
                        onClick={handleOpenVault}
                    >
                        Create Vault
                    </Button>
                    <Label variant="muted" className="mt-2 text-center">
                        Create a new storage location
                    </Label>
                </div>
            </div>
        </div>
    );
};

/**
 * Styles for VaultActions
 */
const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '16px',
    },
    logoSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: 'var(--nh-text-primary, #e0e0e0)',
    },
    spacer: {
        height: '40px',
    },
    actionsSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        width: '100%',
        maxWidth: '300px',
    },
    actionGroup: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
    },
};

export default VaultActions;

