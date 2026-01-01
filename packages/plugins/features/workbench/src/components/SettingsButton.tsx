/**
 * @fileoverview SettingsButton Component - Ribbon button to open settings
 * 
 * Displayed in the Ribbon to switch to settings layout.
 * 
 * @module @notehub/workbench/components/SettingsButton
 */

import React from 'react';
import { Settings } from 'lucide-react';
import { RibbonButton } from '@notehub/ck-standard';
import type { NotehubCore } from '@notehub/core';

interface SettingsButtonProps {
    app?: NotehubCore | undefined;
}

/**
 * SettingsButton - Opens the settings layout
 * 
 * Uses RibbonButton from ck-standard with Settings icon from lucide-react.
 * Clicking switches the layout to 'settings'.
 */
export const SettingsButton: React.FC<SettingsButtonProps> = ({ app }) => {
    const handleClick = () => {
        if (!app) return;

        // Switch to settings layout
        app.api.invoke('layout:set', 'settings');
    };

    return (
        <RibbonButton label="Settings" onClick={handleClick}>
            <Settings size={20} />
        </RibbonButton>
    );
};

export default SettingsButton;
