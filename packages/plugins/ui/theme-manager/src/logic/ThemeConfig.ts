import type { NotehubCore } from '@notehub/core';

/**
 * Theme configuration settings
 * Registers the Theme settings tab and associated groups/items
 */
export const registerThemeSettings = (app: NotehubCore): void => {
    // Register Tab
    app.api.invoke('settings:register-tab', {
        id: 'theme',
        label: 'Appearance',
        icon: 'palette',
        order: 2,
        category: 'core',
    });

    // Register Groups
    app.api.invoke('settings:register-group', {
        id: 'theme-general',
        tabId: 'theme',
        label: 'Theme',
        order: 1,
    });

    app.api.invoke('settings:register-group', {
        id: 'theme-accent',
        tabId: 'theme',
        label: 'Accent Color',
        order: 2,
    });

    // Register Items

    // Current Theme Selection (Preset)
    app.api.invoke('settings:register-item', {
        key: 'theme.current',
        groupId: 'theme-general',
        label: 'Current Theme',
        description: 'Select the application visual theme',
        type: 'select',
        defaultValue: 'deep-space',
        options: [
            { label: 'Deep Space (Dark)', value: 'deep-space' },
            { label: 'Light', value: 'light' },
            { label: 'System', value: 'system' },
        ],
        order: 1,
    });

    // Accent Color Preset
    app.api.invoke('settings:register-item', {
        key: 'theme.accent-preset', // Virtual setting for presets to set the actual color
        groupId: 'theme-accent',
        label: 'Preset Colors',
        description: 'Choose a predefined accent color',
        type: 'select',
        defaultValue: '#6b5ce7',
        options: [
            { label: 'Purple (Default)', value: '#6b5ce7' },
            { label: 'Blue', value: '#3b82f6' },
            { label: 'Green', value: '#10b981' },
            { label: 'Orange', value: '#f97316' },
            { label: 'Red', value: '#ef4444' },
            { label: 'Pink', value: '#ec4899' },
        ],
        order: 1,
    });

    // Custom Accent Color
    app.api.invoke('settings:register-item', {
        key: 'theme.accent-primary',
        groupId: 'theme-accent',
        label: 'Custom Color',
        description: 'Pick a custom accent color',
        type: 'color',
        defaultValue: '#6b5ce7',
        order: 2,
    });

    // Register User Interface Group
    app.api.invoke('settings:register-group', {
        id: 'theme-ui',
        tabId: 'theme',
        label: 'User Interface',
        order: 3,
    });

    app.api.invoke('settings:register-item', {
        key: 'ui.animations',
        groupId: 'theme-ui',
        label: 'Enable Animations',
        description: 'Toggle UI animations and transitions',
        type: 'toggle',
        defaultValue: true,
        order: 1,
    });

    app.api.invoke('settings:register-item', {
        key: 'ui.sidebar-width',
        groupId: 'theme-ui',
        label: 'Default Sidebar Width',
        description: 'Width of the sidebar in pixels',
        type: 'number',
        defaultValue: 250,
        order: 2,
    });
};
