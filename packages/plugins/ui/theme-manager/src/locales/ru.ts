export default {
    theme: {
        settings: {
            tab: 'Внешний вид',
            groups: {
                general: 'Тема',
                accent: 'Цвет акцента',
                ui: 'Интерфейс'
            },
            items: {
                currentTheme: {
                    label: 'Текущая тема',
                    description: 'Выберите визуальную тему приложения',
                    options: {
                        deepSpace: 'Глубокий космос (Темная)',
                        light: 'Светлая',
                        system: 'Системная'
                    }
                },
                presetColors: {
                    label: 'Готовые цвета',
                    description: 'Выберите предустановленный цвет акцента',
                    options: {
                        purple: 'Фиолетовый (По умолчанию)',
                        blue: 'Синий',
                        green: 'Зеленый',
                        orange: 'Оранжевый',
                        red: 'Красный',
                        pink: 'Розовый'
                    }
                },
                customColor: {
                    label: 'Пользовательский цвет',
                    description: 'Выберите свой цвет акцента'
                },
                animations: {
                    label: 'Включить анимации',
                    description: 'Переключение UI-анимаций и переходов'
                },
                sidebarWidth: {
                    label: 'Ширина боковой панели',
                    description: 'Ширина боковой панели в пикселях'
                }
            }
        }
    }
};
