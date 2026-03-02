# Аудит багов: Модуль файлового менеджера

**Дата**: 2026-03-01
**Статус**: Завершён
**Область**: `fs-manager`, `fs-driver-tauri`, `fs-driver-capacitor`, `explorer`, `backlinks`

---

## Обзор

Проведён детальный анализ кода всей экосистемы файлового менеджера NoteHub. Исследованы:

| Файл | Роль |
|------|------|
| `packages/plugins/system/fs-manager/src/index.ts` | Центральный абстрактный слой ФС |
| `packages/plugins/system/fs-driver-tauri/src/index.ts` | Драйвер для Tauri (desktop + Android) |
| `packages/plugins/system/fs-driver-capacitor/src/index.ts` | Драйвер для Capacitor (iOS/Android web) |
| `packages/plugins/features/explorer/src/logic/ExplorerController.ts` | Контроллер файлового дерева |
| `packages/plugins/features/explorer/src/components/FileTree.tsx` | React-компонент дерева |
| `packages/plugins/features/explorer/src/components/NodeRow.tsx` | Рендер строки дерева |
| `packages/plugins/features/explorer/src/logic/pathUtils.ts` | Утилиты путей |
| `packages/plugins/features/editor/src/logic/EditorController.ts` | Контроллер редактора |
| `packages/plugins/features/backlinks/src/logic/PathResolver.ts` | Резолвер WikiLink путей |

Итого найдено **18 багов**, из них:
- 🔴 **Критических**: 4
- 🟠 **Высоких**: 3
- 🟡 **Средних**: 7
- 🔵 **Низких**: 4

---

## 🔴 Критические баги

---

### BUG-01 · `fs-driver-tauri` · Android: перемещение файлов сломано (DnD)

**Файл**: `fs-driver-tauri/src/index.ts:365–375`
**Платформа**: Android
**Серьёзность**: Критическая

**Описание**:
Метод `rename()` для Android-платформы передаёт Rust-команде только имя файла (`newName`), а не полный путь назначения:

```typescript
async rename(oldPath: string, newPath: string): Promise<void> {
    if (this.isAndroid) {
        const { baseUri, relativePath: oldRelative } = this.resolveSafPath(oldPath);
        // БАГИ: newPath разбирается только для получения имени!
        const newName = newPath.split('/').pop() || newPath;
        await invoke('android_fs_rename', { baseUri, oldPath: oldRelative, newName });
        return;
    }
    await tauriFs.rename(oldPath, newPath);
}
```

**Последствия**:
При перетаскивании (DnD) файла в другую папку на Android Rust-команда получает только имя файла без директории назначения. Rust-сторона интерпретирует это как переименование на месте, а не перемещение. UI оптимистично обновляется (файл «переехал»), но реальная файловая система остаётся без изменений — расхождение состояний.

**Воспроизведение**: Android → DnD файл в другую папку.

---

### BUG-02 · `fs-driver-capacitor` · `readFile` возвращает пустой массив при Blob

**Файл**: `fs-driver-capacitor/src/index.ts:121–131`
**Платформа**: Capacitor (iOS/Android)
**Серьёзность**: Критическая

**Описание**:
Когда `Filesystem.readFile()` возвращает данные в виде `Blob` (Web-платформа или новые версии Capacitor), код молча возвращает пустой `Uint8Array(0)` вместо реальных данных или ошибки:

```typescript
if (typeof result.data === 'string') {
    const binaryString = atob(result.data);
    // ... decode base64
    return bytes;
} else {
    return new Uint8Array(0); // ← ТИХАЯ ПОТЕРЯ ДАННЫХ
}
```

**Последствия**:
Любой двоичный файл (плагин `.nhp`, изображение и т.д.) будет прочитан как пустой массив байт. Если плагин основывается на этих данных для дальнейшей работы — молчаливое повреждение без какого-либо уведомления.

---

### BUG-03 · `fs-driver-capacitor` · `resolvePath` возвращает `directory: undefined`

**Файл**: `fs-driver-capacitor/src/index.ts:83–88`
**Платформа**: Capacitor (Android)
**Серьёзность**: Критическая

**Описание**:
Для `content://` URI, которые не удаётся распарсить, `resolvePath` возвращает объект с `directory: undefined`, подавляя TypeScript-ошибку через `@ts-ignore`:

```typescript
return {
    path: path,
    // @ts-ignore
    directory: undefined // ← НЕОПРЕДЕЛЁННОЕ ПОВЕДЕНИЕ
};
```

Этот объект передаётся напрямую в `Filesystem.readFile({ directory: undefined, ... })`. Поведение Capacitor при `undefined` directory не задокументировано.

**Последствия**:
Произвольные `content://` URI (от сторонних провайдеров — загрузчик, медиа и т.д.) приведут к непредсказуемому поведению: чтение из неожиданной директории или необработанный сбой.

---

### BUG-04 · `NodeRow` · Лавина event listener'ов и config API-вызовов

**Файл**: `explorer/src/components/NodeRow.tsx:46–60`
**Платформа**: Все
**Серьёзность**: Критическая (производительность)

**Описание**:
Каждый экземпляр `NodeRow` при монтировании самостоятельно вызывает `config:get` для настройки `single-click-open` **и** подписывается на событие `config:updated`:

```typescript
useEffect(() => {
    app.api.invoke('config:get', 'explorer.single-click-open', true).then(...);

    const onConfig = (payload: any) => { ... };
    app.events.on('config:updated', onConfig);
    return () => app.events.off('config:updated', onConfig);
}, [app]);
```

**Последствия**:
Для дерева с 200 видимыми файлами — 200 параллельных API-вызовов при каждом монтировании и **200 постоянно активных event listener'ов**. При каждом событии `config:updated` вызывается 200 callback'ов. Настройка уже прочитана в `ExplorerController` и должна передаваться через props.

---

## 🟠 Высокие баги

---

### BUG-05 · `fs-manager` · Race condition: неверный флаг `isNew` в событии `fs:written`

**Файл**: `fs-manager/src/index.ts:85–108, 112–137`
**Платформа**: Все
**Серьёзность**: Высокая

**Описание**:
Проверка `isNew` (существует ли файл до записи) выполняется **до** получения write-lock'а, тогда как сама запись — **внутри** lock'а. В сценарии конкурентных записей к новому файлу:

```
Запись A: isNew = !(await exists(path)) → true  (файл не существует)
Запись B: isNew = !(await exists(path)) → true  (файл ещё не создан)
Lock A:   writeFile() → создаёт файл
Lock B:   writeFile() → перезаписывает файл
emit A:   fs:written { isNew: true }  ← верно
emit B:   fs:written { isNew: true }  ← НЕВЕРНО, файл уже существовал
```

**Последствия**:
`ExplorerController` слушает `fs:written { isNew: true }` для обновления дерева при создании новых файлов. Ложный `isNew: true` вызовет лишнюю перезагрузку директории. Ложный `isNew: false` — пропущенное добавление нового файла в дерево.

**Исправление**: Переместить вызов `exists()` внутрь lock'а, после завершения предыдущей блокировки.

---

### BUG-06 · `ExplorerController` · `folders-first` зарегистрирован в UI, но никогда не применяется

**Файл**: `explorer/src/logic/ExplorerController.ts:834–839`, `ExplorerConfig.ts`
**Платформа**: Все
**Серьёзность**: Высокая

**Описание**:
Настройка `explorer.folders-first` зарегистрирована в settings-UI (через `ExplorerConfig.ts`), есть соответствующие переводы и значения по умолчанию. Однако в `ExplorerController`:
- Не читается в `init()`
- Не обрабатывается в `configHandler`
- Не передаётся в `sortChildren()`

```typescript
private sortChildren(children: FileNode[]) {
    children.sort((a, b) => {
        if (a.isDir === b.isDir) return a.name.localeCompare(b.name, ...);
        return a.isDir ? -1 : 1; // ← ВСЕГДА папки первыми, настройка игнорируется
    });
}
```

**Последствия**:
Пользователь видит переключатель в настройках, изменяет его — дерево не реагирует. «Сломанная» фича.

---

### BUG-07 · `ExplorerController` · `createItem` создаёт файл в корне вместо контекстной папки

**Файл**: `explorer/src/logic/ExplorerController.ts:958–984`
**Платформа**: Все
**Серьёзность**: Высокая

**Описание**:
Когда контекстная папка существует на диске, но **не загружена в кэш** (`this.nodes`), `createItem` вместо загрузки этой папки откатывается к корневой директории vault'а:

```typescript
} else {
    // Path exists on disk but not in cache - use root instead
    // (the path might be outside our current vault or in an unloaded area)
    this.log('info', `Parent path exists but not loaded, falling back to root`);
    parentPath = this.rootPath; // ← ФАЙЛ СОЗДАЁТСЯ В КОРНЕ ВМЕСТО ВЫБРАННОЙ ПАПКИ
    parentNode = parentPath ? this.nodes.get(parentPath) : undefined;
}
```

**Последствие**:
ПКМ на папку (которая не раскрыта в дереве) → «New Note» → файл создаётся в корне vault'а. Особенно раздражает при глубокой структуре директорий.

---

## 🟡 Средние баги

---

### BUG-08 · `ExplorerController` · `setRoot` не позволяет повторную попытку после ошибки

**Файл**: `explorer/src/logic/ExplorerController.ts:703–708`
**Платформа**: Все

**Описание**:
Guard `if (this.rootPath === path) return` запускается при повторном вызове `setRoot()` с тем же путём. Если первый `setRoot()` завершился ошибкой на полпути (например, `loadDir` выбросил), дерево остаётся в неполном состоянии. Повторный вызов `setRoot(samePath)` не инициализирует его заново.

---

### BUG-09 · `ExplorerController` · `reloadAll` — последовательная перезагрузка при toggle show-hidden

**Файл**: `explorer/src/logic/ExplorerController.ts:78–90`
**Платформа**: Все

**Описание**:
При изменении настройки «Show Hidden Files» вызывается `reloadAll()`, которая перезагружает root и все раскрытые директории **последовательно** через `await` в цикле:

```typescript
for (const path of paths) {
    if (path !== this.rootPath) {
        await this.loadDir(path); // Водопад: N последовательных FS-чтений
    }
}
```

В большом vault с 20+ открытыми папками — заметный UI-лаг. Параллельная загрузка через `Promise.all` была бы значительно быстрее.

---

### BUG-10 · `EditorController` · Смешанные разделители путей при переименовании папки на Windows

**Файл**: `editor/src/logic/EditorController.ts:180–184`
**Платформа**: Windows (desktop)

**Описание**:
При переименовании родительской папки новый путь к открытому файлу конструируется через конкатенацию:

```typescript
const relativePart = this.currentPath.slice(oldPath.length);
// relativePart начинается с '\' на Windows
this.currentPath = newPath + relativePart;
// newPath = 'C:/vault/NewName', relativePart = '\file.md'
// Результат: 'C:/vault/NewName\file.md' ← смешанные разделители
```

Путь с разными разделителями может приводить к сбоям сравнения строк в последующих операциях.

---

### BUG-11 · `fs-driver-capacitor` · Polling watcher не рекурсивен

**Файл**: `fs-driver-capacitor/src/index.ts:260–313`
**Платформа**: Capacitor (iOS/Android)

**Описание**:
Реализация `watch()` на основе polling опрашивает только непосредственных потомков директории — без рекурсии в поддиректории. Изменения в подпапках (внешним приложением или ОС) не будут обнаружены.

```typescript
const entries = await this.readDir(path); // только прямые потомки
```

**Примечание**: Для операций через приложение (write, delete, rename) события `fs:*` всё равно дойдут через `FsManagerPlugin`. Баг актуален только для внешних изменений.

---

### BUG-12 · `fs-driver-capacitor` · `pickedFileCache` — утечка памяти

**Файл**: `fs-driver-capacitor/src/index.ts:376–379`
**Платформа**: Capacitor (iOS/Android)

**Описание**:
`pickFile()` сохраняет байты выбранного файла в `pickedFileCache` под синтетическим путём. Cache очищается только когда `readFile()` вызывается с этим путём. Если вызывающий код по какой-либо причине не вызвал `readFile()` (ошибка, отмена операции), запись остаётся в кэше навсегда.

На мобильных устройствах с ограниченной памятью повторный выбор файлов постепенно заполняет кэш.

---

### BUG-13 · `PathResolver` · Ложное совпадение при suffix-поиске WikiLink

**Файл**: `backlinks/src/logic/PathResolver.ts:125`
**Платформа**: Все

**Описание**:
В методе `findFile()` проверка `fullPath.endsWith(normalizedSuffix)` без учёта разделителя может дать ложноположительный результат:

```typescript
if (fullPath.endsWith('/' + normalizedSuffix) ||
    fullPath === normalizedSuffix ||
    fullPath.endsWith(normalizedSuffix)) { // ← опасно!
```

Пример: в vault есть `note.md` и `subnote.md`. WikiLink `[[note.md]]`:
- `searchSuffix = "note.md"`
- `"/vault/subnote.md".endsWith("note.md")` → **true** (ложное совпадение!)

WikiLink `[[note.md]]` может открыть `subnote.md`, если тот найден раньше в обходе директорий.

---

### BUG-14 · `PathResolver` · Дорогостоящий полный обход vault без кэширования

**Файл**: `backlinks/src/logic/PathResolver.ts:86–89`
**Платформа**: Все

**Описание**:
`resolveLink()` вызывается при рендере каждого WikiLink компонента (в `useEffect`). Каждый вызов инициирует полный рекурсивный обход vault через `fs:read-dir`. При vault со 100+ файлами и 20+ WikiLink'ами на странице — это сотни `fs:read-dir` вызовов при каждом открытии файла.

Кэширование результатов резолвинга или предварительный индекс файлов vault'а полностью устранят проблему.

---

## 🔵 Низкие баги

---

### BUG-15 · `fs-driver-tauri` · Повторное определение платформы в `pickDirectory`

**Файл**: `fs-driver-tauri/src/index.ts:200–215`
**Серьёзность**: Низкая

`pickDirectory()` вызывает `platform()` заново вместо использования уже кэшированного `this.isAndroid`. Создаёт локальную теневую переменную `isAndroid`, потенциально несогласованную с полем класса.

---

### BUG-16 · `fs-driver-tauri` · Ненадёжное определение типа события watcher

**Файл**: `fs-driver-tauri/src/index.ts:308–318`
**Серьёзность**: Низкая

Определение типа события watcher через `typeStr.includes('create')` и т.д. не охватывает тип `'rename'` из crate `notify` на Windows. Событие переименования маппится как `'any'`. Потребители downstream не пострадают (ExplorerController не различает типы), но это хрупкое решение.

---

### BUG-17 · `ExplorerController` · `findUniqueName` — молчаливое поглощение ошибок FS

**Файл**: `explorer/src/logic/ExplorerController.ts:921`
**Серьёзность**: Низкая

```typescript
try {
    const exists = await this.app.api.invoke<boolean>('fs:exists', fullPath);
    if (!exists) return name;
} catch {
    // ignore check errors ← ПОГЛОЩАЕТ ошибки FS
}
counter++;
```

Если `fs:exists` недоступен или выбрасывает постоянную ошибку, цикл пройдёт все 1000 итераций, выполнив 1000 последовательных неудачных API-вызовов перед тем как вернуть имя с timestamp-суффиксом.

---

### BUG-18 · `fs-driver-capacitor` · Polling watcher не останавливается при удалении директории

**Файл**: `fs-driver-capacitor/src/index.ts:298–305`
**Серьёзность**: Низкая

Если наблюдаемая директория удаляется, поллер продолжает работать и пытаться прочитать её каждые 2 секунды. Ошибки поглощаются (`catch (e) { log.warn }`), и `setTimeout` регистрируется снова. Остановить поллер можно только через возвращённую функцию `() => { stopped = true }`. На мобильных устройствах расход батареи.

---

## Итоговая таблица

| ID | Серьёзность | Модуль | Краткое описание |
|----|-------------|--------|-----------------|
| BUG-01 | 🔴 Критическая | fs-driver-tauri | Android: file move через rename сломан (только имя, не путь) |
| BUG-02 | 🔴 Критическая | fs-driver-capacitor | readFile возвращает пустой Uint8Array при Blob-ответе |
| BUG-03 | 🔴 Критическая | fs-driver-capacitor | resolvePath возвращает `directory: undefined` (@ts-ignore) |
| BUG-04 | 🔴 Критическая | NodeRow | N×200 listeners и API-вызовов при 200 видимых файлах |
| BUG-05 | 🟠 Высокая | fs-manager | Race condition: isNew вычисляется вне write lock |
| BUG-06 | 🟠 Высокая | ExplorerController | `folders-first` настройка никогда не применяется |
| BUG-07 | 🟠 Высокая | ExplorerController | createItem откатывается в корень вместо контекстной папки |
| BUG-08 | 🟡 Средняя | ExplorerController | setRoot guard блокирует повтор после ошибки |
| BUG-09 | 🟡 Средняя | ExplorerController | reloadAll — последовательная загрузка (должна быть параллельной) |
| BUG-10 | 🟡 Средняя | EditorController | Смешанные разделители путей на Windows после переименования папки |
| BUG-11 | 🟡 Средняя | fs-driver-capacitor | Polling watcher не рекурсивен |
| BUG-12 | 🟡 Средняя | fs-driver-capacitor | pickedFileCache не очищается при неиспользовании |
| BUG-13 | 🟡 Средняя | PathResolver | WikiLink suffix match: false positive для подстрок имени файла |
| BUG-14 | 🟡 Средняя | PathResolver | Полный обход vault при каждом рендере WikiLink без кэша |
| BUG-15 | 🔵 Низкая | fs-driver-tauri | Повторное определение платформы в pickDirectory |
| BUG-16 | 🔵 Низкая | fs-driver-tauri | Ненадёжный маппинг типов событий watcher |
| BUG-17 | 🔵 Низкая | ExplorerController | findUniqueName — 1000 итераций при постоянной ошибке FS |
| BUG-18 | 🔵 Низкая | fs-driver-capacitor | Polling watcher не останавливается при удалении директории |

---

## Приоритеты исправления

**Sprint 1 (немедленно)**:
1. BUG-04 — вынести `singleClickOpen` в ExplorerController, передавать через props
2. BUG-06 — реализовать `foldersFirst` в `sortChildren()` и загрузить в `init()`
3. BUG-07 — при ненайденном parentNode в кэше загрузить директорию, а не откатываться в корень
4. BUG-01 — исправить Android rename: передавать `{ baseUri, oldPath, newBasePath, newName }` в Rust

**Sprint 2 (следующий цикл)**:
5. BUG-05 — перенести `exists()` внутрь write lock
6. BUG-02 — добавить обработку Blob в `readFile` Capacitor
7. BUG-03 — убрать `@ts-ignore`, выбрасывать ошибку вместо `undefined`
8. BUG-13 — исправить suffix match: использовать только `endsWith('/' + suffix)`

**Sprint 3 (рефакторинг)**:
9. BUG-09 — `reloadAll`: `Promise.all` вместо последовательного `await`
10. BUG-14 — добавить кэш индекса файлов vault в PathResolver
11. BUG-10 — нормализовать пути через `normalizePath` при конкатенации в EditorController
12. BUG-12 — добавить TTL или weak reference для `pickedFileCache`
