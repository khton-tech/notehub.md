import type { NotehubCore } from '@notehub/core';

/**
 * Theme configuration settings
 * Registers the Theme settings tab and associated groups/items
 */
export const registerThemeSettings = async (app: NotehubCore): Promise<void> => {
    const t = (key: string) => app.api.invoke<string>('i18n:t', key);

    const tabLabel = await t('theme.settings.tab') || 'Appearance';
    const groupGeneral = await t('theme.settings.groups.general') || 'Theme';
    const groupAccent = await t('theme.settings.groups.accent') || 'Accent Color';
    const groupUi = await t('theme.settings.groups.ui') || 'User Interface';

    // Register Tab
    app.api.invoke('settings:register-tab', {
        id: 'theme',
        label: tabLabel,
        icon: 'palette',
        order: 2,
        category: 'core',
    });

    // Register Groups
    app.api.invoke('settings:register-group', {
        id: 'theme-general',
        tabId: 'theme',
        label: groupGeneral,
        order: 1,
    });

    app.api.invoke('settings:register-group', {
        id: 'theme-accent',
        tabId: 'theme',
        label: groupAccent,
        order: 2,
    });

    app.api.invoke('settings:register-group', {
        id: 'theme-ui',
        tabId: 'theme',
        label: groupUi,
        order: 3,
    });

    // Register Items

    // Current Theme Selection (Preset)
    app.api.invoke('settings:register-item', {
        key: 'theme.current',
        groupId: 'theme-general',
        label: await t('theme.settings.items.currentTheme.label') || 'Current Theme',
        description: await t('theme.settings.items.currentTheme.description') || 'Select the application visual theme',
        type: 'select',
        defaultValue: 'deep-space',
        options: [
            { label: await t('theme.settings.items.currentTheme.options.deepSpace') || 'Deep Space (Dark)', value: 'deep-space' },
            { label: await t('theme.settings.items.currentTheme.options.light') || 'Light', value: 'light' },
            { label: await t('theme.settings.items.currentTheme.options.system') || 'System', value: 'system' },
        ],
        order: 1,
    });

    // Accent Color Preset
    app.api.invoke('settings:register-item', {
        key: 'theme.accent-preset',
        groupId: 'theme-accent',
        label: await t('theme.settings.items.presetColors.label') || 'Preset Colors',
        description: await t('theme.settings.items.presetColors.description') || 'Choose a predefined accent color',
        type: 'select',
        defaultValue: '#6b5ce7',
        options: [
            { label: await t('theme.settings.items.presetColors.options.purple') || 'Purple (Default)', value: '#6b5ce7' },
            { label: await t('theme.settings.items.presetColors.options.blue') || 'Blue', value: '#3b82f6' },
            { label: await t('theme.settings.items.presetColors.options.green') || 'Green', value: '#10b981' },
            { label: await t('theme.settings.items.presetColors.options.orange') || 'Orange', value: '#f97316' },
            { label: await t('theme.settings.items.presetColors.options.red') || 'Red', value: '#ef4444' },
            { label: await t('theme.settings.items.presetColors.options.pink') || 'Pink', value: '#ec4899' },
        ],
        order: 1,
    });

    // Custom Accent Color
    app.api.invoke('settings:register-item', {
        key: 'theme.accent-primary',
        groupId: 'theme-accent',
        label: await t('theme.settings.items.customColor.label') || 'Custom Color',
        description: await t('theme.settings.items.customColor.description') || 'Pick a custom accent color',
        type: 'color',
        defaultValue: '#6b5ce7',
        order: 2,
    });

    // UI Animations
    app.api.invoke('settings:register-item', {
        key: 'ui.animations',
        groupId: 'theme-ui',
        label: await t('theme.settings.items.animations.label') || 'Enable Animations',
        description: await t('theme.settings.items.animations.description') || 'Toggle UI animations and transitions',
        type: 'toggle',
        defaultValue: true,
        order: 1,
    });

    // Sidebar Width
    app.api.invoke('settings:register-item', {
        key: 'ui.sidebar-width',
        groupId: 'theme-ui',
        label: await t('theme.settings.items.sidebarWidth.label') || 'Default Sidebar Width',
        description: await t('theme.settings.items.sidebarWidth.description') || 'Width of the sidebar in pixels',
        type: 'number',
        defaultValue: 250,
        order: 2,
    });
};
