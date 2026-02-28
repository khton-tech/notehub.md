export default {
    editor: {
        settings: {
            tab: 'Редактор',
            groups: {
                typography: 'Типографика',
                display: 'Отображение',
                behavior: 'Поведение',
                files: 'Файлы и Сохранение'
            },
            items: {
                fontSize: {
                    label: 'Размер шрифта',
                    description: 'Размер шрифта редактора в пикселях'
                },
                fontFamily: {
                    label: 'Семейство шрифтов',
                    description: 'Выберите предпочитаемый шрифт для программирования',
                    options: {
                        default: 'По умолчанию'
                    }
                },
                showLineNumbers: {
                    label: 'Показывать номера строк',
                    description: 'Отображать номера строк на полях'
                },
                wordWrap: {
                    label: 'Перенос строк',
                    description: 'Переносить длинные строки по ширине редактора'
                },
                tabSize: {
                    label: 'Размер табуляции',
                    description: 'Количество пробелов на один уровень отступа'
                },
                autoCloseBrackets: {
                    label: 'Автозакрытие скобок',
                    description: 'Автоматически закрывать скобки и кавычки'
                },
                formatOnSave: {
                    label: 'Форматировать при сохранении',
                    description: 'Автоматически форматировать документ перед сохранением'
                },
                autosave: {
                    label: 'Автосохранение',
                    description: 'Автоматически сохранять файлы после изменений'
                },
                autosaveDelay: {
                    label: 'Задержка автосохранения (мс)',
                    description: 'Задержка перед автосохранением после изменения'
                }
            }
        }
    }
};
