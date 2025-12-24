# Сессия 2024-12-24: Config Manager

## Цель

Реализация плагина `config-manager` для централизованного управления настройками с сохранением в JSON-файл.

## Реализовано

### Плагин @notehub/config-manager

**Путь:** `packages/plugins/system/config-manager/`

**API методы:**

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `config:get` | `(key: string, defaultValue?: any) => any` | Чтение значения |
| `config:set` | `(key: string, value: any) => Promise<void>` | Запись с сохранением |
| `config:reload` | `() => Promise<void>` | Перезагрузка с диска |

**События:**

| Событие | Payload |
|---------|---------|
| `config:updated` | `{ key: string, value: any }` |

---

### Интеграция с FS

- Использует `fs:read-text-file` / `fs:write-text-file`
- Путь хранения: `.notehub/configs/settings.json`
- Graceful fallback при отсутствии файла

---

### Зависимости

```json
{
  "dependencies": {
    "nh.system.fs-manager": "^1.0.0"
  }
}
```

---

## Файлы

```
packages/plugins/system/config-manager/
├── package.json
├── tsconfig.json
├── manifest.json
└── src/
    └── index.ts
```

---

## Результат

```
✨ Found 4 plugins. Registry generated. Graph updated.

   • nh.system.bootloader (system)
   • nh.system.config-manager (system)
   • nh.system.fs-driver-tauri (system)
   • nh.system.fs-manager (system)
```

Build успешен: `pnpm --filter @notehub/config-manager build`
