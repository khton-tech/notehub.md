import React from 'react';
import { LogOut } from 'lucide-react';
import { RibbonButton } from '@notehub/ck-standard';
import type { NotehubCore } from '@notehub/core';

interface VaultSwitchButtonProps {
    app?: NotehubCore;
}

/**
 * VaultSwitchButton - Close Vault / Switch Vault button
 *
 * Displayed at the bottom of the Ribbon in the editor layout.
 * Clicking this clears the last-opened vault and returns to welcome screen.
 */
export const VaultSwitchButton: React.FC<VaultSwitchButtonProps> = ({ app }) => {
    const handleClick = async () => {
        if (!app) return;

        try {
            // Close the current vault (clears last-opened state)
            await app.api.invoke('vault:close');

            // Navigate to welcome screen
            app.api.invoke('layout:set', 'welcome');
        } catch (error) {
            console.error('Failed to close vault:', error);
        }
    };

    return (
        <RibbonButton label="Close Vault" onClick={handleClick}>
            <LogOut size={20} />
        </RibbonButton>
    );
};
