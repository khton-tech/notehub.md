# FS Manager

**ID:** `nh.system.fs-manager`  
**Пакет:** `@notehub/fs-manager`  
**Путь:** `packages/plugins/system/fs-manager/`

## Описание

Абстракция файловой системы. Предоставляет единый API для работы с файлами, проксируя вызовы к зарегистрированному драйверу.

## Зависимости

Нет зависимостей.

## API методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `fs:register-driver` | `(driver: IFileSystem, name: string)` | Регистрация драйвера FS |
| `fs:read-file` | `(path: string) => Uint8Array` | Чтение бинарного файла |
| `fs:read-text-file` | `(path: string) => string` | Чтение текстового файла |
| `fs:write-file` | `(path: string, data: Uint8Array)` | Запись бинарных данных |
| `fs:write-text-file` | `(path: string, content: string)` | Запись текста |
| `fs:create-dir` | `(path: string, options?)` | Создание директории |
| `fs:read-dir` | `(path: string) => DirEntry[]` | Чтение директории |
| `fs:exists` | `(path: string) => boolean` | Проверка существования |

## Интерфейс IFileSystem

```typescript
interface IFileSystem {
  readFile(path: string): Promise<Uint8Array>;
  readTextFile(path: string): Promise<string>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  writeTextFile(path: string, content: string): Promise<void>;
  createDir(path: string, options?: CreateDirOptions): Promise<void>;
  readDir(path: string): Promise<DirEntry[]>;
  exists(path: string): Promise<boolean>;
}
```

## Пример использования

```typescript
// Чтение файла
const content = await app.api.invoke<string>('fs:read-text-file', '/path/to/file.txt');

// Запись файла
await app.api.invoke('fs:write-text-file', '/path/to/file.txt', 'Hello, World!');

// Проверка существования
const exists = await app.api.invoke<boolean>('fs:exists', '/path/to/file.txt');
```

## См. также

- [FS Driver Tauri](./fs-driver-tauri.md) — реализация для Tauri
- [Отчёт: FS Layer](../reports/2024-12-24-fs-layer.md)
