# Ревью кода Explorer Plugin

> **Дата:** 2026-01-03  
> **Версия плагина:** 0.0.2  
> **Область анализа:** Архитектура, баги, UX  

---

## Executive Summary

| Аспект | Оценка | Тренд vs предыдущий аудит |
|--------|--------|---------------------------|
| **Архитектура** | **C+** | ↑ (было C) |
| **Качество кода** | **C** | — |
| **UX/Юзабилити** | **D+** | → (было D) |
| **Производительность** | **C** | — |
| **Общая оценка** | **C-** | ↑ (было D+) |

### Ключевые улучшения с прошлого аудита
- ✅ Реализован Context Menu через `menus.ts`
- ✅ Добавлен inline rename (F2 + инпут)
- ✅ Реализовано удаление с диалогом подтверждения
- ✅ Синхронизация с редактором (`editor:file-opened`)
- ✅ Optimistic UI updates при rename/delete

### Оставшиеся критические проблемы
- ❌ Нет Drag & Drop
- ❌ Нет персистентности развёрнутых папок
- ❌ Нет Guide Lines для визуальной иерархии
- ❌ Нет иконок по типу файлов
- ❌ Отсутствует React.memo — ререндер всего дерева

---

## 1. Архитектурный анализ

### 1.1 Общая структура

```
packages/plugins/features/explorer/src/
├── index.tsx              # Plugin entry point (136 loc)
├── types.ts               # FileNode interface (9 loc)  
├── menus.ts               # Context menu providers (173 loc)
├── components/
│   ├── FileTree.tsx       # Tree container (278 loc)
│   └── FileTreeItem.tsx   # Tree item (274 loc)
└── logic/
    ├── ExplorerController.ts  # Business logic (570 loc)
    └── ExplorerConfig.ts      # Settings definition
```

**Общий объём:** ~1440 строк кода

### 1.2 Положительные аспекты архитектуры

| Паттерн | Реализация | Комментарий |
|---------|------------|-------------|
| **Controller / View разделение** | ✅ Хорошо | `ExplorerController` управляет состоянием, компоненты только рендерят |
| **Pub/Sub для обновлений** | ✅ Хорошо | `subscribe()` / `notify()` паттерн |
| **Lifecycle cleanup** | ✅ Хорошо | `eventCleanups[]` в plugin и controller |
| **Context Menu модульность** | ✅ Хорошо | Отдельный `menus.ts` с чистыми провайдерами |
| **Интеграция с config-manager** | ✅ Хорошо | Подписка на `config:updated` |

### 1.3 Архитектурные проблемы

#### 🔴 Проблема 1: Двойная ответственность FileNode

**Файл:** [types.ts](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/types.ts)

```typescript
export interface FileNode {
    path: string;
    name: string;
    kind: 'file' | 'directory';
    children?: FileNode[];     // Domain data
    isLoaded?: boolean;        // UI state ← СМЕШЕНИЕ
    isExpanded?: boolean;      // UI state ← СМЕШЕНИЕ
}
```

**Проблема:** `FileNode` смешивает доменную модель (path, name, kind) с UI-состоянием (isLoaded, isExpanded). Это нарушает принцип Single Responsibility.

**Рекомендация:**
```typescript
// Domain model
interface FileEntry {
    path: string;
    name: string;
    kind: 'file' | 'directory';
}

// UI state (хранится отдельно в Map)
interface TreeNodeState {
    isExpanded: boolean;
    isLoaded: boolean;
}
```

---

#### 🔴 Проблема 2: Map + Tree дублирование

**Файл:** [ExplorerController.ts:12-13](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/logic/ExplorerController.ts#L12-L13)

```typescript
private nodes: Map<string, FileNode> = new Map();
private expandedPaths: Set<string> = new Set();
```

При этом `FileNode.children` тоже хранит ссылки на те же объекты. Это создаёт:
- **Дублирование источников правды** — `isExpanded` в `FileNode` и `expandedPaths` Set
- **Риск рассинхронизации** при неатомарных обновлениях

**Улучшение:** Использовать только `nodes: Map` как source of truth, вычислять `isExpanded` на лету:
```typescript
getNode(path: string): FileNodeView {
    const node = this.nodes.get(path);
    return {
        ...node,
        isExpanded: this.expandedPaths.has(path)
    };
}
```

---

#### 🟡 Проблема 3: Синхронный invoke для context-menu

**Файл:** [menus.ts:116-125](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/menus.ts#L116-L125)

```typescript
const unsubItem = app.api.invoke<() => void>(
    'context-menu:register' as any,  // ← as any подавляет типизацию
    'explorer-item',
    itemProvider
);

if (typeof unsubItem === 'function') {  // ← Ручная проверка типа
    cleanups.push(unsubItem);
}
```

**Проблемы:**
1. `as any` подавляет TypeScript проверки — нет гарантии что API существует
2. Явная проверка `typeof === 'function'` — признак неуверенности в контракте

**Рекомендация:** Добавить `context-menu:register` в `NotehubApiMap` для строгой типизации.

---

#### 🟡 Проблема 4: Нет виртуализации дерева

При большом количестве файлов (10k+) React будет рендерить все элементы в DOM. Это приведёт к:
- Высокому потреблению памяти
- Медленному скроллу
- Долгому первоначальному рендеру

**Рекомендация на будущее:** Использовать `react-window` или `@tanstack/react-virtual` для виртуализации.

---

## 2. Обнаруженные баги

### 🐛 Баг 1: Path separator inconsistency

**Файл:** [ExplorerController.ts:165-169](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/logic/ExplorerController.ts#L165-L169)

```typescript
const separator = oldPath.includes('\\') ? '\\' : '/';
const lastIndex = oldPath.lastIndexOf(separator);
const parentPath = lastIndex !== -1 ? oldPath.substring(0, lastIndex) : '';
const newPath = parentPath ? `${parentPath}/${newName}` : newName;  // ← Всегда '/'
const normalizedNewPath = newPath.replace(/\\/g, '/').replace(/\/\//g, '/');
```

**Проблема:** Определяется separator (может быть `\\`), но при построении `newPath` всегда используется `/`. Затем происходит нормализация. Это избыточно и может вызвать edge cases.

**Дублирование:** Этот же паттерн повторяется в:
- `deleteItem()` (строка 290)
- `createNote()` (строка 489-493)
- `createFolder()` (строка 521-525)
- `handleFsEvent()` (строка 435-449)

**Рекомендация:** Создать утилиту:
```typescript
function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function getParentPath(path: string): string {
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash > 0 ? normalized.substring(0, lastSlash) : '';
}
```

---

### 🐛 Баг 2: Race condition при быстром rename

**Файл:** [ExplorerController.ts:157-217](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/logic/ExplorerController.ts#L157-L217)

```typescript
async submitRename(oldPath: string, newName: string): Promise<boolean> {
    // ... 
    try {
        await this.app.api.invoke('fs:rename', oldPath, normalizedNewPath);
        // Optimistic update happens AFTER fs:rename
    }
}
```

**Сценарий:**
1. Пользователь переименовывает файл A → B
2. Не дожидаясь завершения, переименовывает B → C
3. Первый `fs:rename` ещё не завершился
4. Второй `fs:rename` работает с устаревшим `oldPath`

**Рекомендация:** Добавить debounce или очередь операций:
```typescript
private renameQueue: Map<string, Promise<boolean>> = new Map();
```

---

### 🐛 Баг 3: Потеря фокуса при создании файла

**Файл:** [ExplorerController.ts:502-507](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/logic/ExplorerController.ts#L502-L507)

```typescript
await this.loadDir(parentPath);  // ← Перезагрузка директории
this._selectedPath = fullPath;
this.setRenaming(fullPath);      // ← Начинаем rename
```

**Проблема:** `loadDir()` пересоздаёт children массив, что вызывает полный ререндер `FileTree`. При этом `flatNodes` в `FileTree.tsx` пересчитывается, и `focusedIndex` может указывать на неправильный элемент.

**Симптом:** После создания файла клавиатурная навигация может "прыгать" на неожиданные элементы.

---

### 🐛 Баг 4: Memory leak в FileTree

**Файл:** [FileTree.tsx:73](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/components/FileTree.tsx#L73)

```typescript
const flatNodes = flattenTree(rootNode);
```

**Проблема:** `flattenTree()` вызывается на каждый рендер без мемоизации. Для большого дерева это:
- Лишние аллокации массивов
- Лишние обходы дерева

**Исправление:**
```typescript
const flatNodes = useMemo(() => flattenTree(rootNode), [rootNode]);
```

---

### 🐛 Баг 5: Popup меню не закрывается при клике вне

**Файл:** [FileTree.tsx:224-238](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/components/FileTree.tsx#L224-L238)

```typescript
{showNewMenu && (
    <div className="absolute right-0 top-full mt-1 z-50">
        <Menu ...>
```

**Проблема:** Нет обработчика для закрытия меню при клике вне компонента. `onClick={() => setShowNewMenu(false)}` на контейнере работает только при клике на tree content, не на сайдбар или другие области.

**Рекомендация:** Использовать `useClickAway` hook или `Popover` компонент с proper dismiss handling.

---

### 🐛 Баг 6: XSS потенциал в имени файла

**Файл:** [FileTreeItem.tsx:235-237](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/components/FileTreeItem.tsx#L235-L237)

```tsx
<span className="truncate leading-none block">
    {node.name}  {/* ← Напрямую из файловой системы */}
</span>
```

**Риск:** Если пользователь создаст файл с именем `<script>alert(1)</script>.md`, React по умолчанию экранирует HTML, но это не защищает от всех XSS векторов в контексте атрибутов.

**Статус:** Низкий риск благодаря React auto-escaping, но рекомендуется санитизация на уровне Controller.

---

## 3. UX Анализ (vs Obsidian / VSCode)

### 3.1 Сравнительная таблица функционала

| Функция | Notehub | Obsidian | VS Code |
|---------|---------|----------|---------|
| Создание файла/папки | ✅ Toolbar + Context | ✅ | ✅ |
| Inline rename | ✅ F2 | ✅ F2 | ✅ F2 |
| Delete | ✅ Confirm dialog | ✅ Trash | ✅ Trash |
| Drag & Drop | ❌ | ✅ | ✅ |
| Multi-select | ❌ | ✅ | ✅ |
| Copy/Paste | ❌ | ✅ | ✅ |
| Duplicate | ❌ | ✅ | ✅ |
| Reveal in System | ❌ | ✅ | ✅ |
| Search/Filter | ❌ | ✅ | ✅ |
| Favorites/Bookmarks | ❌ | ✅ | — |
| File Type Icons | ❌ | ✅ | ✅ |
| Guide Lines | ❌ | Subtle | ✅ |
| Keyboard navigation | ⚠️ Partial | ✅ Full | ✅ Full |
| Scroll into view | ❌ | ✅ | ✅ |
| State persistence | ❌ | ✅ | ✅ |
| Loading indicators | ❌ | ✅ | ✅ |

### 3.2 Критические UX проблемы

#### 🔴 UX-1: Отсутствие Guide Lines

**Текущее состояние:** Только padding для индентации.

**Obsidian/VSCode:** Тонкие вертикальные линии на каждом уровне вложенности помогают визуально отслеживать иерархию на глубине 3+ уровней.

**Визуальный эффект:** На глубине 4-5 уровней пользователь теряет понимание, к какой папке относится файл.

---

#### 🔴 UX-2: Все файлы выглядят одинаково

**Файл:** [FileTreeItem.tsx:140-144](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/components/FileTreeItem.tsx#L140-L144)

```typescript
return {
    name: 'file',  // ← Всегда одна иконка
    className: baseClass,
};
```

**Проблема:** Нет различия между `.md`, `.json`, `.png`, `.pdf` и т.д.

**Obsidian:** Разные иконки для Markdown, изображений, PDF, канвасов.
**VSCode:** Полная поддержка file type icons через icon themes.

---

#### 🔴 UX-3: Нет Scroll Into View при навигации

**Файл:** [FileTree.tsx:126-132](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/components/FileTree.tsx#L126-L132)

```typescript
case 'ArrowDown':
    e.preventDefault();
    setFocusedIndex(prev => Math.min(prev + 1, flatNodes.length - 1));
    break;
// ← Нет scrollIntoView()
```

**Симптом:** При навигации стрелками по длинному списку элемент может уйти за пределы viewport, и пользователь теряет визуальный контакт с фокусом.

---

#### 🟡 UX-4: Агрессивный Selection Color

**Файл:** [FileTreeItem.tsx:157-162](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/components/FileTreeItem.tsx#L157-L162)

```typescript
if (isSelected) {
    baseItemClasses.push(
        'text-white',
        'bg-[var(--nh-accent-primary,#6b5ce7)]/10'
    );
}
```

**Анализ:** Текущий selection использует accent color с 10% opacity — это лучше, чем в предыдущем аудите. Однако:
- `text-white` может конфликтовать со светлыми темами
- Нет различия между Selected и Active (открытый файл)

**Obsidian подход:**
```css
.selected { background: rgba(accent, 0.15); }
.active { border-left: 2px solid accent; color: accent; }
```

---

#### 🟡 UX-5: Empty State не информативен

**Файл:** [FileTree.tsx:269-273](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/components/FileTree.tsx#L269-L273)

```tsx
<div className="px-4 py-8 text-center text-xs text-[var(--nh-text-muted)] italic">
    Empty vault
</div>
```

**Obsidian:** "Create your first note" с CTA кнопкой.
**Рекомендация:** Добавить иконку и интерактивный элемент для создания первой заметки.

---

#### 🟡 UX-6: Header занимает много места

**Файл:** [FileTree.tsx:206-212](file:///c:/Users/khton/sources/notehub.md/packages/plugins/features/explorer/src/components/FileTree.tsx#L206-L212)

```tsx
<span className="text-xs font-bold uppercase tracking-wider ...">
    {rootNode.name}
</span>
```

`UPPERCASE` + `tracking-wider` + `py-2` = визуально "крикливый" header, который отвлекает от контента.

**VSCode:** Vault name в sentence case, компактный padding, dropdown для переключения.

---

### 3.3 Позитивные UX моменты

| Аспект | Оценка |
|--------|--------|
| Inline rename | ✅ Хорошо реализован, выделяет имя без расширения |
| Active file indicator | ✅ Left border 4px + accent color |
| Chevron toggle | ✅ Работает интуитивно |
| Keyboard basics | ⚠️ Arrow keys работают |
| Context menu | ✅ Появляется на правый клик |

---

## 4. Рекомендации по улучшению

### Приоритет P0 (Критично)

| # | Задача | Effort | Impact |
|---|--------|--------|--------|
| 1 | Мемоизация `flatNodes` через `useMemo` | S | High |
| 2 | `React.memo()` для `FileTreeItem` | S | High |
| 3 | `scrollIntoView()` при keyboard nav | S | High |
| 4 | Утилита для нормализации путей | M | Medium |

### Приоритет P1 (Важно)

| # | Задача | Effort | Impact |
|---|--------|--------|--------|
| 5 | Guide Lines через CSS pseudo-elements | M | High |
| 6 | File type icons (по расширению) | M | Medium |
| 7 | Persist expanded paths в state-manager | M | High |
| 8 | Click-away для popup menu | S | Medium |

### Приоритет P2 (Желательно)

| # | Задача | Effort | Impact |
|---|--------|--------|--------|
| 9 | Drag & Drop | L | High |
| 10 | Multi-select (Ctrl/Shift+Click) | L | Medium |
| 11 | Search/Filter в дереве | M | Medium |
| 12 | Reveal in System Explorer | S | Low |

---

## 5. Заключение

Explorer прошёл путь от "D+" до "C-" — это заметный прогресс. Основной CRUD функционал (Create, Rename, Delete) теперь работает. Однако для ощущения "бета-версии" уровня Obsidian требуется:

1. **Визуальная polish** — Guide Lines, file type icons, improved empty states
2. **Performance baseline** — мемоизация, React.memo
3. **Persistence** — сохранение развёрнутых папок
4. **Keyboard polish** — scrollIntoView, Tab navigation

Рекомендуемый бюджет на доработку: **5-7 рабочих дней** для P0 + P1.

---

> **Сравнение с предыдущим аудитом (2026-01-01):**
> - Context Menu: ❌ → ✅
> - Rename: ❌ → ✅
> - Delete: ❌ → ✅
> - Sync with Editor: ❌ → ✅
> - Guide Lines: ❌ → ❌ (не реализовано)
> - File Type Icons: ❌ → ❌ (не реализовано)
> - Persistence: ❌ → ❌ (не реализовано)
> - Memoization: ❌ → ❌ (не реализовано)
