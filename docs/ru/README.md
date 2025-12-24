# Документация Notehub.md

## 📚 Содержание

### Архитектура и разработка

- [**Архитектура ядра**](./core-architecture.md) — Компоненты ядра: NotehubCore, EventBus, ApiBus
- [**Разработка плагинов**](./plugin-development.md) — Руководство по созданию плагинов
- [**CLI инструменты**](./cli-tools.md) — Описание команд и скриптов

### Плагины

- [**Bootloader**](./plugins/bootloader.md) — Оркестратор загрузки с разрешением зависимостей
- [**FS Manager**](./plugins/fs-manager.md) — Абстракция файловой системы
- [**FS Driver Tauri**](./plugins/fs-driver-tauri.md) — Реализация FS для Tauri v2
- [**Config Manager**](./plugins/config-manager.md) — Централизованное управление настройками

### Отчёты

- [2024-12-24: Инициализация проекта](./reports/2024-12-24-project-init.md)
- [2024-12-24: FS Layer](./reports/2024-12-24-fs-layer.md)
- [2024-12-24: Config Manager](./reports/2024-12-24-config-manager.md)

---

## 🚀 Быстрый старт

```bash
# Установка
pnpm install

# Сборка всех пакетов
pnpm build

# Запуск Desktop приложения (Tauri)
pnpm dev:desktop

# Создание нового плагина
pnpm gen:plugin
```

## 📦 Структура проекта

```
notehub.md/
├── packages/
│   ├── core/                 # @notehub/core — ядро приложения
│   └── plugins/
│       ├── system/           # Системные плагины
│       │   ├── bootloader/   # Оркестратор загрузки
│       │   ├── fs-manager/   # Абстракция файловой системы
│       │   ├── fs-driver-tauri/ # Tauri драйвер FS
│       │   └── config-manager/  # Менеджер конфигурации
│       ├── ui/               # UI плагины
│       └── features/         # Фича-плагины
├── apps/
│   └── desktop/              # Tauri Desktop приложение
├── scripts/                  # CLI-скрипты
└── docs/                     # Документация
    └── ru/                   # Русская документация
```

## 🔌 Системные плагины

| Плагин | Описание |
|--------|----------|
| `@notehub/bootloader` | Оркестратор загрузки плагинов с разрешением зависимостей |
| `@notehub/fs-manager` | Абстракция файловой системы (интерфейс `IFileSystem`) |
| `@notehub/fs-driver-tauri` | Реализация FS для Tauri v2 |
| `@notehub/config-manager` | Централизованное управление настройками |
