# Аудит Explorer Plugin (`nh.features.explorer`)

> **Дата:** 2026-01-01  
> **Автор:** Principal Product Designer & Senior Frontend Architect  
> **Цель:** Глубокий анализ текущей реализации и план рефакторинга  

---

## 1. Executive Summary

| Критерий | Оценка |
|----------|--------|
| **Общая оценка** | **D+** |
| UI/UX | D |
| Функциональность | D |
| Архитектура | C |
| Производительность | C+ |

### Вердикт

Текущая реализация Explorer — это **функциональный MVP**, который выполняет базовую задачу: отображение дерева файлов и навигация. Однако он находится на уровне **"студенческого проекта"** по сравнению с профессиональными инструментами (VS Code, Obsidian, Sublime Text).

**Критические пробелы:**
- ❌ **Нет Context Menu** — основная операция (ПКМ) отсутствует
- ❌ **Нет полноценного CRUD** — только создание через тулбар, нет rename/delete
- ❌ **Нет Drag & Drop** — перемещение файлов невозможно
- ❌ **Нет персистентности состояния** — раскрытые папки сбрасываются при перезагрузке
- ❌ **Нет Guide Lines** — визуальная иерархия теряется на глубине > 2

**Позитивные моменты:**
- ✅ Базовая клавиатурная навигация реализована
- ✅ Интеграция с `config-manager` работает (show-hidden)
- ✅ File watching через `fs-manager` присутствует
- ✅ Архитектура Controller/View разделена корректно

---

## 2. Visual & UX Analysis

### 2.1 Иерархия и Indentation

| Проблема | Серьёзность | Детали |
|----------|-------------|--------|
| Нет Guide Lines | 🔴 High | На глубине 3+ уровней невозможно визуально отследить вложенность. VS Code и Obsidian используют тонкие вертикальные линии для каждого уровня. |
| Слишком маленький indent | 🟡 Medium | `depth * 12px` — слишком плотно. Рекомендуется 16-20px для комфортного восприятия. |
| Нет Collapse All / Expand All | 🟡 Medium | Отсутствует возможность быстро свернуть всё дерево |

**Код проблемы:**
```tsx
// FileTreeItem.tsx:27-29
const style = {
    paddingLeft: `${depth * 12 + 4}px`, // Нет guide lines, только padding
};
```

### 2.2 Иконки

| Проблема | Серьёзность | Детали |
|----------|-------------|--------|
| Нет file type icons | 🔴 High | Все файлы используют одну иконку `file`. Нет различия между `.md`, `.json`, `.png` и т.д. |
| Folder icon не меняется | 🟡 Medium | Используется только `chevron-*` для индикации состояния. Рекомендуется также менять иконку папки (`folder` → `folder-open`). |
| Иконки слишком мелкие | 🟢 Low | `size={14}` — можно увеличить до 16 для лучшей видимости |

**Текущая реализация:**
```tsx
// FileTreeItem.tsx:61-65
<Icon
    name="file"  // ← Всегда одна иконка
    size={14}
    className={...}
/>
```

### 2.3 States (Визуальные состояния)

| Состояние | Статус | Проблема |
|-----------|--------|----------|
| **Selected** | ⚠️ Partial | Работает, но стиль `bg-[var(--nh-accent-secondary)] text-white` слишком агрессивный. Нет синхронизации с открытым файлом в редакторе. |
| **Hover** | ✅ Works | `hover:bg-[var(--nh-bg-secondary)]` — корректно |
| **Focused** | ⚠️ Partial | `ring-1 ring-inset` — работает для keyboard focus, но визуально слабо заметен |
| **Active (Sync with Editor)** | ❌ Missing | Explorer не знает, какой файл сейчас открыт в редакторе. Нет подсветки "активного" файла. |
| **Loading** | ❌ Missing | Нет skeleton/spinner при загрузке директории |
| **Error** | ❌ Missing | Ошибки FS только логируются в консоль, пользователь не видит |

### 2.4 Typography

| Аспект | Статус | Детали |
|--------|--------|--------|
| Font size | ✅ OK | `text-[13px]` — стандартно для tree views |
| Line height | 🟡 Tight | `h-[22px]` — можно увеличить до 24-26px |

---

## 2.5 Focus Tracking (Критическая секция)

### Что такое Focus Tracking?

Focus Tracking — это система, которая понимает **контекст пользователя** и визуально отражает его в UI. Включает:

1. **Keyboard Focus** — какой элемент активен для клавиатурной навигации
2. **Selection** — какой элемент выбран пользователем (клик)
3. **Active File** — какой файл сейчас открыт в редакторе (Sync with Editor)
4. **Focus Ring** — визуальный индикатор для accessibility

### Текущая реализация

| Аспект | Статус | Файл/Строка |
|--------|--------|-------------|
| **Keyboard Focus Index** | ⚠️ Partial | `FileTree.tsx:44` — `focusedIndex` в state |
| **Focused Path** | ⚠️ Partial | `FileTree.tsx:149-151` — вычисляется из flatNodes |
| **Focus Ring Visual** | 🔴 Weak | `FileTreeItem.tsx:47` — `ring-1 ring-inset` еле заметен |
| **Active File Sync** | ❌ Missing | Нет подписки на `editor:file-opened` |
| **Scroll into View** | ❌ Missing | При keyboard nav элемент не скроллится в viewport |

### Анализ кода

**Keyboard Navigation (частично работает):**
```tsx
// FileTree.tsx:96-146
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
        case 'ArrowDown':
            setFocusedIndex(prev => Math.min(prev + 1, flatNodes.length - 1));
            break;
        // ... ArrowUp, Enter, Home, End
    }
}, [...]);
```

Проблемы:
- ✅ Стрелки работают
- ❌ Нет `scrollIntoView()` — при длинном списке фокус уходит за viewport
- ❌ Нет `Tab` navigation между explorer и editor
- ❌ Нет `Escape` для сброса фокуса

**Focus Ring (слабо визуализирован):**
```tsx
// FileTreeItem.tsx:47
${isFocused && !isSelected ? 'ring-1 ring-inset ring-[var(--nh-accent-primary)]' : ''}
```

Проблема: `ring-1` (1px) с `ring-inset` практически не виден на тёмном фоне. VS Code использует **outline с offset** или **фоновую подсветку**.

**Active File Sync (полностью отсутствует):**
```typescript
// ExplorerController.ts — НЕТ такого кода:
// this.app.events.on('editor:file-opened', (payload) => {
//     this.activeFilePath = payload.path;
//     this.notify();
// });
```

Explorer не знает, какой файл открыт. Это **критический UX gap**.

### Рекомендации по исправлению

1. **Add Active File State:**
```typescript
// ExplorerController.ts
private activeFilePath: string | null = null;

async init() {
    this.app.events.on('editor:file-opened', ({ path }) => {
        this.activeFilePath = path;
        this.notify();
    });
}
```

2. **Add Scroll Into View:**
```tsx
// FileTreeItem.tsx
const itemRef = useRef<HTMLDivElement>(null);

useEffect(() => {
    if (isFocused && itemRef.current) {
        itemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}, [isFocused]);
```

3. **Improve Focus Ring:**
```tsx
// Вместо ring-1:
${isFocused && !isSelected ? 'bg-[var(--nh-bg-hover)] outline outline-2 outline-[var(--nh-accent-primary)]' : ''}
```

---

## 2.6 Deep UI Critique (Глубокий анализ визуальных проблем)

### Проблема 1: Hardcoded Colors

**Файл:** `EditorLayout.tsx:75, 85`
```tsx
className="border-r border-[#444] bg-[var(--nh-bg-sidebar)]"
```

`#444` — это **хардкод**, который ломает светлые темы. На светлом фоне этот цвет будет выглядеть грязно.

**Решение:** Использовать `border-[var(--nh-border-color)]`.

### Проблема 2: Агрессивный Selection Color

**Файл:** `FileTreeItem.tsx:46`
```tsx
${isSelected ? 'bg-[var(--nh-accent-secondary)] text-white' : 'text-[var(--nh-text-muted)]'}
```

Проблемы:
- `text-white` конфликтует с темами, где accent светлый
- Selection слишком "кричащий", отвлекает от контента
- Нет отличия между Selected и Active (в VS Code это разные состояния)

**Рекомендация (VS Code pattern):**
```css
.selected { background: rgba(accent, 0.2); } /* Лёгкая подсветка */
.active   { background: rgba(accent, 0.4); border-left: 2px solid accent; } /* Активный файл */
```

### Проблема 3: Отсутствие визуальной иерархии

Все элементы дерева выглядят одинаково:
- Файлы и папки имеют одинаковый визуальный вес
- Нет visual grouping между уровнями
- Нет subtle background alternation

**VS Code / Obsidian подход:**
- Папки: **bold weight** или **чуть крупнее**
- Файлы: regular weight, muted color
- Уровни: subtle opacity gradient или guide lines

### Проблема 4: Иконка Chevron вместо Folder

**Файл:** `FileTreeItem.tsx:54-59`
```tsx
{isDirectory ? (
    <Icon name={node.isExpanded ? 'chevron-down' : 'chevron-right'} ... />
) : (
    <Icon name="file" ... />
)}
```

Текущий паттерн показывает только chevron для папок. Правильный подход:

```
📁 ▶ folder-name      // closed: folder icon + chevron
📂 ▼ folder-name      // open: folder-open icon + chevron (or just open folder)
📄   file.md          // file: no chevron, just icon
```

### Проблема 5: Toolbar выглядит отдельно

**Файл:** `FileTree.tsx:160-163`
```tsx
<div className="flex items-center justify-between px-3 py-2 border-b border-[var(--nh-border-color)] bg-[var(--nh-bg-secondary)]">
    <span className="text-xs font-bold uppercase tracking-wider text-[var(--nh-text-muted)]">
        {rootNode.name}
    </span>
```

Проблемы:
- `UPPERCASE` + `letter-spacing` = слишком "крикливо"
- Toolbar занимает много вертикального пространства
- Нет визуальной связи с контентом ниже

**VS Code approach:** Vault name в обычном case, меньше padding, иконка vault'а.

### Проблема 6: Empty State слишком "бедный"

**Файл:** `FileTree.tsx:227-230`
```tsx
<div className="px-4 py-8 text-center text-xs text-[var(--nh-text-muted)] italic">
    Empty vault
</div>
```

Решение: Добавить иллюстрацию или CTA ("Create your first note").

### Summary визуальных проблем

| Проблема | Severity | Effort |
|----------|----------|--------|
| Hardcoded `#444` | 🔴 High | Easy |
| No Active File indicator | 🔴 High | Medium |
| Weak Focus Ring | 🟡 Medium | Easy |
| No Scroll Into View | 🟡 Medium | Easy |
| No File Type Icons | 🟡 Medium | Medium |
| Aggressive Selection | 🟢 Low | Easy |
| No Guide Lines | 🟡 Medium | Medium |
| Poor Empty State | 🟢 Low | Easy |
| Truncation | ✅ Works | `truncate` класс используется |
| File extension | 🟡 Missing | Рекомендуется приглушать расширение (`.md` в muted color) |

---

## 3. Technical Debt

### 3.1 Отсутствующий функционал

#### A. Context Menu (Critical)
```
Статус: ❌ Полностью отсутствует
```

Ни один компонент не обрабатывает `onContextMenu`. Это **главный UX-барьер**.

**Ожидаемые операции в Context Menu:**
- New Note
- New Folder
- Rename (`F2`)
- Delete (`Delete`)
- Duplicate
- Copy Path
- Reveal in System Explorer
- Set as Root (для folder)

#### B. CRUD Operations

| Операция | Статус | Где реализовано |
|----------|--------|-----------------|
| **Create Note** | ✅ | `ExplorerController.createNote()` — через `dialog:prompt` |
| **Create Folder** | ✅ | `ExplorerController.createFolder()` — через `dialog:prompt` |
| **Rename** | ❌ | Отсутствует |
| **Delete** | ❌ | Отсутствует |
| **Move** | ❌ | Отсутствует |
| **Duplicate** | ❌ | Отсутствует |

#### C. Drag & Drop
```
Статус: ❌ Полностью отсутствует
```

Нет `draggable`, `onDragStart`, `onDrop` ни на одном элементе.

### 3.2 State Management

#### Проблема: Expanded Paths не сохраняются

```typescript
// ExplorerController.ts:13
private expandedPaths: Set<string> = new Set();
```

Состояние хранится **только в памяти**. При перезагрузке приложения:
- Все папки сворачиваются
- Пользователь теряет контекст навигации

**Решение:** Использовать `state-manager` для персистентности:
```typescript
// Должно быть:
await this.app.api.invoke('state:set', 'explorer.expanded-paths', [...expandedPaths]);
```

#### Проблема: Нет синхронизации с Editor

Explorer не слушает события `editor:file-opened`. Открытый файл не подсвечивается в дереве.

### 3.3 Reactivity

#### Текущий подход (частично корректный):

```typescript
// ExplorerController.ts:53-58
const unsubscribe = controller.subscribe(() => {
    setRootNode(prev => {
        const newVal = controller.getTree();
        return newVal ? { ...newVal } : null;
    });
});
```

**Проблема:** При любом изменении пересоздаётся весь объект `rootNode`. Это вызывает:
- Перерендер всего дерева
- Потерю scroll position
- Мерцание UI

**Решение:** Использовать immutable updates только для изменённых узлов + `React.memo`.

### 3.4 Performance

#### Рекурсивный рендеринг

```tsx
// FileTreeItem.tsx:74-86
{isDirectory && node.isExpanded && node.children && (
    <div role="group">
        {node.children.map(child => (
            <FileTreeItem ... />  // ← Рекурсия
        ))}
    </div>
)}
```

**Статус:** Для < 1000 файлов это приемлемо. Для больших vault'ов (10k+ файлов) потребуется виртуализация.

#### Отсутствие мемоизации

`FileTreeItem` не обёрнут в `React.memo()`. Каждое изменение в родителе вызывает ререндер всех детей.

```tsx
// Должно быть:
export const FileTreeItem = React.memo<FileTreeItemProps>(({ ... }) => {
    ...
});
```

---

## 4. Refactoring Roadmap (RC2)

### Wave 1: Critical UX (Estimated: 3-4 days)

| Задача | Приоритет | Описание |
|--------|-----------|----------|
| **Context Menu** | 🔴 P0 | Создать `<ContextMenu>` компонент и интегрировать с деревом. Использовать Radix/Headless UI для accessibility. |
| **Rename inline** | 🔴 P0 | При `F2` или через context menu — inline editing с `<input>`. |
| **Delete** | 🔴 P0 | Confirmation dialog + вызов `fs:delete`. |
| **Sync with Editor** | 🔴 P0 | Подписка на `editor:file-opened`, подсветка активного файла. |

**Архитектурные изменения Wave 1:**

```
packages/plugins/features/explorer/
├── src/
│   ├── components/
│   │   ├── FileTree.tsx
│   │   ├── FileTreeItem.tsx
│   │   ├── ContextMenu.tsx          ← NEW
│   │   └── InlineRename.tsx         ← NEW
│   ├── logic/
│   │   ├── ExplorerController.ts    ← MODIFY (add rename, delete)
│   │   └── useContextMenu.ts        ← NEW (hook for positioning)
```

---

### Wave 2: Visual Polish (Estimated: 2-3 days)

| Задача | Приоритет | Описание |
|--------|-----------|----------|
| **Guide Lines** | 🟡 P1 | CSS pseudo-elements для вертикальных линий на каждом уровне вложенности. |
| **File Type Icons** | 🟡 P1 | Mapping расширений → иконок. Использовать `icon-manager` расширенный набор. |
| **Loading State** | 🟡 P1 | Skeleton или spinner при загрузке директории. |
| **Increase Indent** | 🟢 P2 | `depth * 20px` вместо `12px`. |
| **Muted Extensions** | 🟢 P2 | `.md` отображать в `--nh-text-muted`. |

**CSS для Guide Lines (пример):**
```css
.file-tree-item {
    position: relative;
}

.file-tree-item::before {
    content: '';
    position: absolute;
    left: calc(var(--depth) * 20px + 8px);
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--nh-border-color);
    opacity: 0.5;
}
```

---

### Wave 3: Persistence & Reactivity (Estimated: 2 days)

| Задача | Приоритет | Описание |
|--------|-----------|----------|
| **Persist Expanded Paths** | 🟡 P1 | Сохранение в `state-manager` при каждом toggle. Восстановление при init. |
| **Memo FileTreeItem** | 🟡 P1 | Обернуть в `React.memo` с сравнением пропсов. |
| **Granular Updates** | 🟢 P2 | Вместо перерендера всего дерева — обновление только изменённых узлов. |

---

### Wave 4: Drag & Drop (Estimated: 2-3 days)

| Задача | Приоритет | Описание |
|--------|-----------|----------|
| **DnD Implementation** | 🟢 P2 | `react-dnd` или native HTML5 DnD. |
| **Drop Zones** | 🟢 P2 | Индикация допустимых зон при перетаскивании. |
| **Move Files** | 🟢 P2 | `fs:move` API для перемещения. |

---

### Wave 5: Advanced (Future - RC3)

| Задача | Описание |
|--------|----------|
| **Search/Filter** | Поиск по имени файла в дереве |
| **Favorites/Bookmarks** | Закреплённые файлы сверху |
| **Recent Files** | Быстрый доступ к последним |
| **Virtualized Tree** | `react-window` для 10k+ файлов |
| **Multi-select** | `Ctrl+Click`, `Shift+Click` для массовых операций |

---

## 5. Summary Table

| Категория | Текущий статус | После RC2 Wave 1-4 |
|-----------|----------------|---------------------|
| Context Menu | ❌ | ✅ |
| Rename | ❌ | ✅ |
| Delete | ❌ | ✅ |
| Drag & Drop | ❌ | ✅ |
| Guide Lines | ❌ | ✅ |
| File Type Icons | ❌ | ✅ |
| State Persistence | ❌ | ✅ |
| Sync with Editor | ❌ | ✅ |
| Memoization | ❌ | ✅ |
| Virtualization | ❌ | ⏳ (RC3) |

---

## 6. Recommended Priority Order

```
1. Context Menu + Delete + Rename  ← Разблокирует основной workflow
2. Sync with Editor               ← Критично для UX
3. Persist Expanded Paths         ← Устраняет раздражающий сброс
4. Guide Lines + Icons            ← Visual polish
5. Memoization                    ← Performance baseline
6. Drag & Drop                    ← Nice to have
```

---

> **Заключение:** Текущий Explorer — это прототип, который требует серьёзной доработки для соответствия планке качества Obsidian/VS Code. Приоритет №1 — **Context Menu**, так как без него невозможны базовые операции управления файлами. Рекомендуется выделить на рефакторинг **10-14 рабочих дней** для Wave 1-4.
