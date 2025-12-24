# Документация Notehub.md

## 📚 Содержание

### Архитектура и разработка

- [**Архитектура ядра**](./core-architecture.md) — Компоненты ядра: NotehubCore, EventBus, ApiBus
- [**Разработка плагинов**](./plugin-development.md) — Руководство по созданию плагинов
- [**CLI инструменты**](./cli-tools.md) — Описание команд и скриптов

### Отчёты

- [2024-12-24: Инициализация проекта](./reports/2024-12-24-project-init.md)
- [2024-12-24: FS Layer](./reports/2024-12-24-fs-layer.md)

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
│       │   └── fs-driver-tauri/ # Tauri драйвер FS
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

