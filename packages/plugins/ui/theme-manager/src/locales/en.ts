export default {
    theme: {
        settings: {
            tab: 'Appearance',
            groups: {
                general: 'Theme',
                accent: 'Accent Color',
                ui: 'User Interface'
            },
            items: {
                currentTheme: {
                    label: 'Current Theme',
                    description: 'Select the application visual theme',
                    options: {
                        deepSpace: 'Deep Space (Dark)',
                        light: 'Light',
                        system: 'System'
                    }
                },
                presetColors: {
                    label: 'Preset Colors',
                    description: 'Choose a predefined accent color',
                    options: {
                        purple: 'Purple (Default)',
                        blue: 'Blue',
                        green: 'Green',
                        orange: 'Orange',
                        red: 'Red',
                        pink: 'Pink'
                    }
                },
                customColor: {
                    label: 'Custom Color',
                    description: 'Pick a custom accent color'
                },
                animations: {
                    label: 'Enable Animations',
                    description: 'Toggle UI animations and transitions'
                },
                sidebarWidth: {
                    label: 'Default Sidebar Width',
                    description: 'Width of the sidebar in pixels'
                }
            }
        }
    }
};
