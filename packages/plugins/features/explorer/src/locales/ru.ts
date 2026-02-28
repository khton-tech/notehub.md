export default {
    explorer: {
        settings: {
            tab: 'Файлы',
            groups: {
                display: 'Файловый менеджер',
                behavior: 'Поведение'
            },
            items: {
                showHidden: {
                    label: 'Показывать скрытые файлы',
                    description: 'Отображать файлы и папки, начинающиеся с точки'
                },
                foldersFirst: {
                    label: 'Сначала папки',
                    description: 'Показывать папки перед файлами в дереве'
                },
                singleClick: {
                    label: 'Одинарный клик для открытия',
                    description: 'Открывать файлы одиночным щелчком вместо двойного'
                },
                confirmDelete: {
                    label: 'Подтверждение удаления',
                    description: 'Спрашивать подтверждение перед перемещением файлов в корзину'
                }
            }
        },
        menu: {
            rename: 'Переименовать',
            delete: 'Удалить',
            newNote: 'Новая заметка',
            newFolder: 'Новая папка',
        }
    }
};
