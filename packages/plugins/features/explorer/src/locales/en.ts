export default {
    explorer: {
        settings: {
            tab: 'Files',
            groups: {
                display: 'File Explorer',
                behavior: 'Behavior'
            },
            items: {
                showHidden: {
                    label: 'Show Hidden Files',
                    description: 'Display files and folders starting with a dot'
                },
                foldersFirst: {
                    label: 'Folders First',
                    description: 'Show folders before files in the tree'
                },
                singleClick: {
                    label: 'Single Click to Open',
                    description: 'Open files with a single click instead of double click'
                },
                confirmDelete: {
                    label: 'Confirm File Deletion',
                    description: 'Ask for confirmation before moving files to trash'
                }
            }
        },
        menu: {
            rename: 'Rename',
            delete: 'Delete',
            newNote: 'New Note',
            newFolder: 'New Folder',
        }
    }
};
