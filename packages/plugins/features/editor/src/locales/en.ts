export default {
    editor: {
        settings: {
            tab: 'Editor',
            groups: {
                typography: 'Typography',
                display: 'Display',
                behavior: 'Behavior',
                files: 'Files & Saving'
            },
            items: {
                fontSize: {
                    label: 'Font Size',
                    description: 'Editor font size in pixels'
                },
                fontFamily: {
                    label: 'Font Family',
                    description: 'Choose your preferred programming font',
                    options: {
                        default: 'Default'
                    }
                },
                showLineNumbers: {
                    label: 'Show Line Numbers',
                    description: 'Display line numbers in the gutter'
                },
                wordWrap: {
                    label: 'Word Wrap',
                    description: 'Wrap long lines to fit the editor width'
                },
                tabSize: {
                    label: 'Tab Size',
                    description: 'Number of spaces per indentation level'
                },
                autoCloseBrackets: {
                    label: 'Auto-Close Brackets',
                    description: 'Automatically close brackets and quotes'
                },
                formatOnSave: {
                    label: 'Format on Save',
                    description: 'Automatically format document when saving'
                },
                autosave: {
                    label: 'Auto-Save',
                    description: 'Automatically save files after changes'
                },
                autosaveDelay: {
                    label: 'Auto-Save Delay (ms)',
                    description: 'Delay before auto-saving after a change'
                }
            }
        }
    }
};
