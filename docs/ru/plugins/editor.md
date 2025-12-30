# Редактор Notehub.md — Архитектура и Руководство

> **Плагин:** `@notehub/editor` (`nh.features.editor`)  
> **Версия:** 0.0.1

---

## Обзор

Редактор Notehub.md — это современный WYSIWYG-редактор для Markdown, построенный на [CodeMirror 6](https://codemirror.net/). Он реализует паттерн "Live Preview" — форматирование Markdown отображается визуально, но исходный синтаксис появляется при редактировании соответствующего элемента.

```
┌─────────────────────────────────────────────────────────────────┐
│                        NotehubEditor.tsx                        │
│                    (React-обёртка CM6)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Portal Bridge │  │ Live Preview │  │   Lezer Parsers      │  │
│  │  (React⟷CM)   │  │  ViewPlugin  │  │ (Callouts,Wikilinks) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      CodeMirror 6 Core                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Структура файлов

```
packages/plugins/features/editor/src/
├── index.tsx                 # Точка входа плагина (EditorPlugin)
├── components/
│   └── NotehubEditor.tsx     # React-компонент редактора
├── logic/
│   └── EditorController.ts   # Бизнес-логика (открытие/сохранение файлов)
├── bridge/                   # Portal Bridge (React ⟷ CodeMirror)
│   ├── store.ts              # Micro-state store для порталов
│   ├── renderer.tsx          # React-рендерер порталов
│   ├── widget.ts             # Абстрактный ReactBridgeWidget
│   └── index.ts              # Публичный экспорт
├── lezer/                    # Кастомные парсеры для Markdown
│   ├── callouts.ts           # Парсер Obsidian-style callouts
│   ├── wikilinks.ts          # Парсер [[wikilinks]]
│   └── index.ts              # Сборка notehubMarkdown()
├── cm/                       # CodeMirror расширения
│   ├── live-preview/         # Система Live Preview
│   │   ├── view-plugin.ts    # ViewPlugin для декораций
│   │   └── index.ts          # Экспорт livePreviewExtension
│   └── widgets/              # React-виджеты для CM
│       └── CalloutWidget.ts  # Виджет заголовка callout
└── debug/
    └── tree-visualizer.ts    # Отладка синтаксического дерева
```

---

## 1. Portal Bridge — Мост между React и CodeMirror

### Проблема

CodeMirror 6 использует чистый DOM для виджетов (`WidgetType.toDOM`), но мы хотим использовать React-компоненты для сложных интерактивных элементов (иконки, кнопки, стилизация).

### Решение: Portal Pattern

Вместо `ReactDOM.createRoot` внутри виджета (что создаёт отдельные React-деревья), мы используем **createPortal** — виджет создаёт пустой контейнер, а React рендерит в него из основного дерева.

```
┌─────────────────────────────────────────────────────┐
│                React Root Tree                       │
│  ┌───────────────────────────────────────────────┐  │
│  │           NotehubEditor                        │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │     EditorPortalRenderer                 │  │  │
│  │  │  ┌───────────┐  ┌───────────┐           │  │  │
│  │  │  │ Portal #1 │  │ Portal #2 │  ...      │  │  │
│  │  │  └─────┬─────┘  └─────┬─────┘           │  │  │
│  │  └────────┼──────────────┼─────────────────┘  │  │
│  │           │              │                     │  │
│  │           ▼              ▼                     │  │
│  │  ┌────────────────────────────────────────┐   │  │
│  │  │           CodeMirror DOM                │   │  │
│  │  │  ┌─────────┐    ┌─────────┐            │   │  │
│  │  │  │ Widget  │    │ Widget  │            │   │  │
│  │  │  │Container│    │Container│            │   │  │
│  │  │  └─────────┘    └─────────┘            │   │  │
│  │  └────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Компоненты Portal Bridge

#### 1. `PortalStore` (store.ts)

Micro-state manager с подпиской, совместимый с `useSyncExternalStore`:

```typescript
interface PortalEntry {
    id: string;              // Уникальный ID портала
    container: HTMLElement;  // DOM-контейнер виджета
    component: FC<any>;      // React-компонент
    props: any;              // Props для компонента
}

const portalStore = {
    mount(id, container, component, props): void;  // Виджет создан
    update(id, props): void;                       // Props изменились
    unmount(id): void;                             // Виджет удалён
    subscribe(listener): () => void;               // Подписка
    getSnapshot(): PortalEntry[];                  // Текущее состояние
};
```

> **ВАЖНО:** `getSnapshot()` должен возвращать закэшированную ссылку! Создание нового массива при каждом вызове вызывает бесконечные ре-рендеры.

#### 2. `EditorPortalRenderer` (renderer.tsx)

React-компонент, который рендерит порталы:

```tsx
export const EditorPortalRenderer: React.FC = () => {
    const portals = useSyncExternalStore(
        portalStore.subscribe,
        portalStore.getSnapshot
    );
    
    return (
        <>
            {portals.map(entry => (
                <PortalItem key={entry.id} entry={entry} />
            ))}
        </>
    );
};
```

**Размещение:** Компонент должен быть **внутри** React-дерева рядом с CodeMirror:

```tsx
<div className="editor-wrapper">
    <div ref={cmContainerRef} />
    <EditorPortalRenderer />  {/* ← Здесь */}
</div>
```

#### 3. `ReactBridgeWidget` (widget.ts)

Абстрактный базовый класс для виджетов с React-содержимым:

```typescript
abstract class ReactBridgeWidget extends WidgetType {
    protected readonly id: string;
    protected readonly component: FC<any>;
    protected readonly props: any;

    constructor(component: FC<any>, props: any) {
        this.id = generateId();
        this.component = component;
        this.props = props;
    }

    toDOM(): HTMLElement {
        const container = document.createElement('span');
        portalStore.mount(this.id, container, this.component, this.props);
        return container;
    }

    updateDOM(dom: HTMLElement, view: EditorView): boolean {
        portalStore.update(this.id, this.props);
        return true;  // true = обновить существующий DOM
    }

    destroy(): void {
        portalStore.unmount(this.id);
    }

    abstract eq(other: WidgetType): boolean;  // Обязательно переопределить!
}
```

---

## 2. Lezer Parsers — Расширение синтаксиса Markdown

CodeMirror использует [Lezer](https://lezer.codemirror.net/) для парсинга. Мы расширяем стандартный Markdown-парсер дополнительными синтаксисами.

### Callouts (callouts.ts)

Obsidian-стиль callouts: `> [!TYPE] Title`

```markdown
> [!INFO] Заголовок
> Тело callout
```

**AST-структура:**
```
Blockquote
 ├─ QuoteMark (">")
 ├─ CalloutType ("INFO")    ← наш кастомный node
 ├─ CalloutTitle ("Заголовок")
 └─ ... (остальные строки)
```

> **Особенность:** Lezer не создаёт композитный `Callout` узел. Вместо этого `CalloutType` и `CalloutTitle` размещаются непосредственно внутри `Blockquote`.

### Wikilinks (wikilinks.ts)

Парсер для `[[страница]]` и `[[страница|отображаемый текст]]`:

```markdown
[[Моя заметка]]
[[folder/note|Ссылка на заметку]]
```

**AST-структура:**
```
WikiLink
 ├─ WikiLinkMarker ("[[")
 ├─ WikiLinkTarget ("folder/note")
 ├─ WikiLinkAlias ("Ссылка на заметку")  ← опционально
 └─ WikiLinkMarker ("]]")
```

### Сборка парсера (lezer/index.ts)

```typescript
export const notehubMarkdown = () => markdown({
    extensions: [
        calloutsExtension,  // > [!TYPE] Title
        wikilinksExtension  // [[link]]
    ]
});
```

---

## 3. Live Preview ViewPlugin

Ядро визуального редактирования — `ViewPlugin`, который трансформирует AST в декорации.

### Принцип работы

1. **Итерация дерева:** Ищем `CalloutType` узлы в видимой области
2. **Проверка курсора:** Если курсор *на* строке заголовка → показываем сырой Markdown
3. **Декорация:** Если курсор *снаружи* → заменяем строку на `CalloutHeaderWidget`
4. **Стилизация тела:** Применяем `.cm-callout-body` к последующим строкам

```typescript
export const livePreviewPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        
        constructor(view: EditorView) {
            this.decorations = buildDecorations(view);
        }
        
        update(update: ViewUpdate) {
            // Перестраиваем декорации при любом изменении
            this.decorations = buildDecorations(update.view);
        }
    },
    {
        decorations: v => v.decorations,
        provide: plugin => EditorView.atomicRanges.of(view => {
            return view.plugin(plugin)?.decorations ?? Decoration.none;
        })
    }
);
```

### Проверка курсора

```typescript
function cursorOverlapsRange(view: EditorView, from: number, to: number): boolean {
    // Важно! Если редактор не в фокусе — показываем декорации
    if (!view.hasFocus) {
        return false;
    }
    
    for (const range of view.state.selection.ranges) {
        if (range.from <= to && range.to >= from) {
            return true;
        }
    }
    return false;
}
```

> **Критический момент:** Без проверки `view.hasFocus` курсор на позиции 0 (по умолчанию) считается "внутри" первой строки, и декорации не создаются при загрузке файла.

### Парсинг дерева

```typescript
function buildDecorations(view: EditorView): DecorationSet {
    // Принудительный синхронный парсинг
    for (const { to } of view.visibleRanges) {
        ensureSyntaxTree(view.state, to, 100); // 100ms таймаут
    }
    
    syntaxTree(view.state).iterate({
        enter: (node) => {
            if (node.name === 'CalloutType') {
                // Создаём декорацию...
            }
        }
    });
}
```

---

## 4. CalloutHeaderWidget

React-виджет для визуального заголовка callout.

### CalloutHeader.tsx (React-компонент)

```tsx
interface CalloutHeaderProps {
    type: string;
    title?: string;
}

const TYPE_COLORS = {
    INFO: { bg: '#3b82f6', text: 'white' },
    WARNING: { bg: '#f59e0b', text: 'black' },
    DANGER: { bg: '#ef4444', text: 'white' },
    // ...
};

export const CalloutHeader: FC<CalloutHeaderProps> = ({ type, title }) => {
    const colors = TYPE_COLORS[type.toUpperCase()] ?? DEFAULT_COLORS;
    const Icon = getIconForType(type);
    
    return (
        <div style={{ backgroundColor: colors.bg }}>
            <Icon />
            <span>{title || type}</span>
        </div>
    );
};
```

### CalloutWidget.ts (Bridge Widget)

```typescript
export class CalloutHeaderWidget extends ReactBridgeWidget {
    private type: string;
    private title: string;
    
    constructor(type: string, title: string) {
        super(CalloutHeader, { type, title });
        this.type = type;
        this.title = title;
    }
    
    eq(other: WidgetType): boolean {
        if (!(other instanceof CalloutHeaderWidget)) return false;
        return this.type === other.type && this.title === other.title;
    }
}
```

---

## 5. EditorController — Бизнес-логика

Управляет открытием/сохранением файлов через EventBus.

```typescript
class EditorController {
    async openFile(path: string): Promise<void> {
        const content = await this.app.api.invoke('fs:readFile', path);
        this.currentFilePath = path;
        this.emit('editor:file-opened', { path, content });
    }
    
    async saveFile(content: string): Promise<void> {
        if (!this.currentFilePath) return;
        await this.app.api.invoke('fs:writeFile', this.currentFilePath, content);
        this.emit('editor:file-saved', { path: this.currentFilePath });
    }
}
```

### Интеграция с Explorer

```typescript
// В EditorPlugin.load():
this.app.api.on('explorer:file-selected', (payload) => {
    this.controller.openFile(payload.path);
});
```

---

## 6. Отладка

### Tree Visualizer

Для отладки синтаксического дерева доступны команды в консоли:

```javascript
window.__notehub_debug_tree()   // Вывести структуру дерева
window.__notehub_tree_string()  // Получить дерево как строку
```

### Console Logging

В режиме разработки плагин выводит логи:
- `[LivePreview] Plugin constructor called`
- `[LivePreview] buildDecorations called, doc length: N`
- `[LivePreview] Found node: CalloutType at X - Y`
- `[LivePreview] buildDecorations result: N nodes found, M decorations created`

---

## 7. Типичные ошибки и решения

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `Maximum update depth exceeded` | `getSnapshot()` создаёт новый массив | Кэшировать `cachedSnapshot` |
| `Block decorations may not be specified via plugins` | `block: true` в `Decoration.replace` | Убрать `block: true` |
| Декорации не появляются при загрузке | `cursorOverlapsRange` возвращает `true` для позиции 0 | Проверять `view.hasFocus` |
| `syntaxTree` возвращает пустое дерево | Асинхронный парсинг | `ensureSyntaxTree()` с таймаутом |

---

## 8. Добавление нового типа виджета

### Шаг 1: Создать React-компонент

```tsx
// cm/components/MyWidget.tsx
export const MyWidget: FC<{ value: string }> = ({ value }) => (
    <span className="my-widget">{value}</span>
);
```

### Шаг 2: Создать Bridge Widget

```typescript
// cm/widgets/MyWidget.ts
export class MyWidgetBridge extends ReactBridgeWidget {
    constructor(value: string) {
        super(MyWidget, { value });
    }
    
    eq(other: WidgetType): boolean {
        return other instanceof MyWidgetBridge && 
               this.props.value === other.props.value;
    }
}
```

### Шаг 3: Использовать в ViewPlugin

```typescript
decorations.push(
    Decoration.replace({
        widget: new MyWidgetBridge(value)
    }).range(from, to)
);
```

---

## Заключение

Редактор Notehub.md объединяет:
- **CodeMirror 6** — производительный редактор с инкрементальным парсингом
- **Portal Bridge** — бесшовная интеграция React в CM декорации
- **Lezer расширения** — кастомные синтаксисы (callouts, wikilinks)
- **Live Preview** — WYSIWYG-редактирование с сохранением Markdown

Эта архитектура позволяет создавать сложные интерактивные элементы внутри редактора, сохраняя при этом чистую структуру React-приложения.
