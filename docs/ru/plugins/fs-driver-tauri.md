# FS Driver Tauri

**ID:** `nh.system.fs-driver-tauri`  
**Пакет:** `@notehub/fs-driver-tauri`  
**Путь:** `packages/plugins/system/fs-driver-tauri/`

## Описание

Реализация `IFileSystem` для Tauri v2. Использует `@tauri-apps/plugin-fs` для доступа к файловой системе.

## Зависимости

| Плагин | Версия |
|--------|--------|
| `nh.system.fs-manager` | `^1.0.0` |

## Функционал

- При загрузке автоматически регистрируется в `fs-manager`
- Проверяет наличие Tauri окружения (`__TAURI_INTERNALS__`)
- В консоли выводится: `FS Driver Registered: Tauri`

## Tauri конфигурация

Для работы плагина необходимы права доступа в `capabilities/default.json`:

```json
{
  "permissions": [
    "fs:default",
    "fs:allow-mkdir",
    "fs:allow-exists",
    "fs:allow-read-dir",
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-write-text-file"
  ]
}
```

## Детекция окружения

```typescript
const isTauri = '__TAURI_INTERNALS__' in window;
```

> **Важно:** В Tauri v2 используется `__TAURI_INTERNALS__`, а не `__TAURI__` как в v1.

## Пример загрузки

```typescript
import { NotehubCore } from '@notehub/core';
import { FsManagerPlugin } from '@notehub/fs-manager';
import { FsDriverTauriPlugin } from '@notehub/fs-driver-tauri';

const core = new NotehubCore();
core.registerPlugin(new FsManagerPlugin());
core.registerPlugin(new FsDriverTauriPlugin());  // Загружается после fs-manager
await core.init();
```

## См. также

- [FS Manager](./fs-manager.md) — абстракция FS
- [Отчёт: FS Layer](../reports/2024-12-24-fs-layer.md)
