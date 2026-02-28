import { useState, useEffect, useCallback, type FC } from 'react';
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
const VA_DEFAULTS = {
    tagline: 'Gather your data together',
    openVault: 'Open Vault', opening: 'Opening...', openVaultDesc: 'Select an existing folder',
    createVault: 'Create Vault', creating: 'Creating...', createVaultDesc: 'Create a new storage location',
};

export const VaultActions: FC<VaultActionsProps> = ({ app, service }) => {
    const [isOpening, setIsOpening] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [strings, setStrings] = useState(VA_DEFAULTS);

    const loadStrings = useCallback(async () => {
        try {
            const t = (key: string) => app.api.invoke<string>('i18n:t', key);
            const results = await Promise.all([
                t('vault-picker.tagline'), t('vault-picker.openVault'), t('vault-picker.opening'),
                t('vault-picker.openVaultDesc'), t('vault-picker.createVault'),
                t('vault-picker.creating'), t('vault-picker.createVaultDesc'),
            ]);
            setStrings({
                tagline: results[0] ?? VA_DEFAULTS.tagline,
                openVault: results[1] ?? VA_DEFAULTS.openVault, opening: results[2] ?? VA_DEFAULTS.opening,
                openVaultDesc: results[3] ?? VA_DEFAULTS.openVaultDesc,
                createVault: results[4] ?? VA_DEFAULTS.createVault, creating: results[5] ?? VA_DEFAULTS.creating,
                createVaultDesc: results[6] ?? VA_DEFAULTS.createVaultDesc,
            });
        } catch { /* use defaults */ }
    }, [app]);

    useEffect(() => {
        loadStrings();
        app.events.on('i18n:language-changed', loadStrings);
        return () => app.events.off('i18n:language-changed', loadStrings);
    }, [app, loadStrings]);

    /**
     * Handle adding a new vault (select folder to use as vault)
     */
    const handleAddVault = async () => {
        try {
            setIsOpening(true);
            const path = await app.api.invoke('fs:pick-directory') as string | null;
            if (path) {
                await service.openVault(path);
            }
        } catch (error) {
            console.error('Failed to add vault:', error);
        } finally {
            setIsOpening(false);
        }
    };

    /**
     * Handle creating a new vault
     */
    const handleOpenVault = async () => {
        try {
            const basePath = await app.api.invoke('fs:pick-directory') as string | null;
            if (!basePath) return;

            setIsCreating(true);
            // Prompt for vault name
            const name = await app.api.invoke('dialog:prompt', 'Create Vault', 'Enter vault name:', 'My Notes') as string | null;
            if (!name || name.trim() === '') {
                setIsCreating(false);
                return;
            }

            await service.createVault(basePath, name.trim());
        } catch (error) {
            console.error('Failed to create vault:', error);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full gap-4 w-full">
            {/* Logo Section */}
            <div className="flex flex-col items-center text-[var(--nh-text-primary)]">
                <Icon name="app-logo" size={64} className="text-[var(--nh-accent-primary)] mb-4" />
                <Label variant="logo">notehub.md</Label>
                <Label variant="caption" className="mt-2 text-center px-4">{strings.tagline}</Label>
            </div>

            {/* Spacer */}
            <div className="h-10" />

            {/* Actions Section */}
            <div className="flex flex-col items-center gap-5 w-full max-w-[300px]">
                {/* Open Vault Button (primary action - open existing folder) */}
                <div className="flex flex-col items-center w-full">
                    <Button
                        variant="primary"
                        size="xl"
                        icon="folder-open"
                        onClick={handleAddVault}
                        isLoading={isOpening}
                        className="w-full"
                    >
                        {isOpening ? strings.opening : strings.openVault}
                    </Button>
                    <Label variant="muted" className="mt-2 text-center">
                        {strings.openVaultDesc}
                    </Label>
                </div>

                {/* Create Vault Button (secondary action - create new) */}
                <div className="flex flex-col items-center w-full">
                    <Button
                        variant="secondary"
                        size="xl"
                        icon="plus-circle"
                        onClick={handleOpenVault}
                        isLoading={isCreating}
                        className="w-full"
                    >
                        {isCreating ? strings.creating : strings.createVault}
                    </Button>
                    <Label variant="muted" className="mt-2 text-center">
                        {strings.createVaultDesc}
                    </Label>
                </div>
            </div>
        </div>
    );
};

export default VaultActions;
