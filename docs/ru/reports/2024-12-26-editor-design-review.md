# Дизайн-Ревью Редактора: Анализ и План Исправлений
**Дата:** 2024-12-26  
**Автор:** AI Design Review  
**Версия:** 1.0

## Оглавление
1. [Введение](#введение)
2. [Методология](#методология)
3. [Текущее Состояние](#текущее-состояние)
4. [Проблемы и Рекомендации](#проблемы-и-рекомендации)
5. [План Исправлений](#план-исправлений)
6. [Приоритизация](#приоритизация)

---

## Введение

Данный документ представляет собой комплексное дизайн-ревью редактора Notehub.md с фокусом на режим Live Preview. Основные референсы для сравнения: **Obsidian** и **VSCode** — признанные лидеры в области markdown-редакторов.

### Цели Ревью
- Выявить визуальные и UX-проблемы в текущей реализации
- Сравнить с best practices Obsidian и VSCode
- Предложить конкретные исправления с приоритизацией
- Создать actionable план для улучшения дизайна

---

## Методология

### Референсные Источники
1. **Obsidian Live Preview** — индустриальный стандарт для inline markdown editing
   - Плавное скрытие/показ синтаксиса при фокусе
   - Четкая визуальная иерархия блочных элементов
   - Профессиональная типографика

2. **VSCode Markdown Preview** — золотой стандарт читабельности
   - GitHub Flavored Markdown styling
   - Сбалансированные отступы и margins
   - Чистый, минималистичный дизайн

### Анализируемые Компоненты
- Блоки кода (fenced code blocks)
- Цитаты (blockquotes)
- Каллауты/адмонишн (callouts/admonitions)
- Списки (ordered, unordered, task lists)
- Инлайн элементы (bold, italic, inline code, links)
- Заголовки (headings H1-H6)

---

## Текущее Состояние

### Скриншот Проблем

![Текущее состояние редактора](C:/Users/khton/.gemini/antigravity/brain/e05f3a96-3a02-4101-a016-aeca1488566c/uploaded_image_1766736738373.png)

### Архитектурный Обзор

**Текущая Реализация:**
- **Live Preview Plugin** (`view-plugin.ts`) — ViewPlugin на базе CodeMirror 6
- **Decorations** (`decorations.ts`) — статические декорации для визуализации
- **React Widgets** (`CheckboxWidget.ts`, `CalloutHeaderWidget.ts`) — интерактивные компоненты
- **CSS Injection** (`NotehubEditor.tsx`) — глобальные стили через `<style>` тег

**Основной Подход:**
- Line decorations для блочных элементов (`.cm-callout-body`, `.cm-code-block-bg`)
- Mark decorations для инлайн-элементов (`.cm-nh-bold`, `.cm-nh-italic`)
- Replace decorations для скрытия синтаксиса (`hiddenSyntax`)

---

## Проблемы и Рекомендации

### 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

#### 1. Цитаты (Blockquotes)

**Текущее Состояние:**
```typescript
.cm-blockquote {
    border-left: 3px solid var(--nh-accent-secondary) !important;
    padding-left: 12px !important;
    margin-left: 4px;
    color: var(--nh-text-muted);
    font-style: italic;
}
```

**Проблемы:**
- ❌ Символ `>` не скрывается — виден на скриншоте
- ❌ Слишком тонкая левая граница (3px)
- ❌ Отсутствует вертикальный padding (`padding-top`, `padding-bottom`)
- ❌ Курсив для всего текста — плохо для читабельности больших цитат
- ❌ Нет фонового цвета — блоки не выделяются визуально

**Референс Obsidian:**
- Используется `border-left: 4px solid`
- Цвет границы более контрастный (использует accent color)
- Вертикальные отступы: `padding: 8px 0 8px 12px`
- Курсив только для коротких цитат (опционально)
- Легкий фоновый оттенок для выделения блока

**Референс VSCode:**
- `border-left: 4px solid #007acc` (blue accent)
- `padding: 0 0 0 20px`
- `margin: 8px 0`
- Четкое визуальное отделение от остального текста

**Рекомендации:**
```css
.cm-blockquote {
    border-left: 4px solid var(--nh-accent-secondary);
    padding: 4px 0 4px 16px;
    margin: 8px 0;
    background-color: rgba(var(--nh-accent-secondary-rgb), 0.05); /* Subtle tint */
    color: var(--nh-text-primary); /* Remove forced muted color */
    font-style: normal; /* Remove forced italic */
    display: block;
}
```

**Логика Скрытия `>`:**
Текущая реализация в `view-plugin.ts` (строки 527-598) обрабатывает только каллауты, но НЕ стандартные blockquotes! 

```typescript
// ПРОБЛЕМА: QuoteMark НЕ скрывается для standard blockquotes
if (!match) {
    // Standard Blockquote (Card Style)
    for (let i = startLine.number; i <= endLine.number; i++) {
        const line = state.doc.line(i);
        addDecoration(Decoration.line({ class: 'cm-blockquote' }).range(line.from), false);
    }
    return; // ❌ Просто применяется класс, но '>' остается видимым!
}
```

**Нужно добавить:**
```typescript
if (!match) {
    // Standard Blockquote
    for (let i = startLine.number; i <= endLine.number; i++) {
        const line = state.doc.line(i);
        const lineText = line.text;
        
        addDecoration(Decoration.line({ class: 'cm-blockquote' }).range(line.from), false);
        
        // Hide the '>' marker if NOT in editing mode
        if (!isSelectionOverlapping(selection, line.from, line.to)) {
            const markerMatch = lineText.match(/^[ \t]*>( ?)/);
            if (markerMatch) {
                const matchLen = markerMatch[0].length;
                const markerStart = line.from + markerMatch.index!;
                const markerEnd = markerStart + matchLen;
                
                addDecoration(hiddenSyntax.range(markerStart, markerEnd), true);
            }
        }
    }
    return;
}
```

---

#### 2. Каллауты (Callouts)

**Текущее Состояние:**
```css
.cm-callout-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--nh-bg-secondary);
    border: 1px solid var(--nh-border-subtle);
    border-bottom: none;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
}

.cm-callout-body {
    background-color: var(--nh-bg-surface);
    border-left: 1px solid var(--nh-border-subtle);
    border-right: 1px solid var(--nh-border-subtle);
    padding: 0 12px;
}
```

**Проблемы:**
- ✅ Header widget работает корректно
- ⚠️ Цветовая схема слишком блеклая — не видно типа (note, warning, error)
- ❌ Отсутствует иконка слева (Obsidian использует lucide-react иконки)
- ⚠️ Padding тела каллаута слишком мал вертикально
- ⚠️ Нет визуального разделения между header и body

**Референс Obsidian:**
- **Иконки:** Каждый тип каллаута имеет уникальную иконку (`info`, `warning`, `danger`, `check`, etc.)
- **Цветовой акцент:** Border-left header'а использует яркий цвет типа (синий для info, красный для danger)
- **Вертикальный padding body:** `padding: 12px 16px`
- **Разделитель:** Тонкая линия между header и body (`border-bottom: 1px solid rgba(...)`)

**Рекомендации:**

```css
/* Добавить border-left accent к header */
.cm-callout-header {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    background-color: var(--nh-bg-secondary);
    border: 1px solid var(--nh-border-subtle);
    border-left: 4px solid; /* Цвет зависит от типа, см. ниже */
    border-bottom: 1px solid rgba(255, 255, 255, 0.1); /* Subtle separator */
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    font-weight: 600; /* Чуть жирнее для header */
    gap: 10px;
}

/* Улучшить body padding */
.cm-callout-body {
    background-color: var(--nh-bg-surface);
    border-left: 1px solid var(--nh-border-subtle);
    border-right: 1px solid var(--nh-border-subtle);
    padding: 8px 16px; /* Увеличен вертикальный padding */
}

/* Цветовая схема для border-left header */
.cm-callout-note .cm-callout-header,
.cm-callout-info .cm-callout-header {
    border-left-color: #60a5fa; /* Blue */
}

.cm-callout-success .cm-callout-header,
.cm-callout-check .cm-callout-header {
    border-left-color: #4ade80; /* Green */
}

.cm-callout-warning .cm-callout-header,
.cm-callout-caution .cm-callout-header {
    border-left-color: #fb923c; /* Orange */
}

.cm-callout-danger .cm-callout-header,
.cm-callout-error .cm-callout-header {
    border-left-color: #f87171; /* Red */
}

.cm-callout-tip .cm-callout-header,
.cm-callout-important .cm-callout-header {
    border-left-color: #c084fc; /* Purple */
}
```

**Добавить Иконки:**
Обновить `CalloutHeaderWidget.tsx` для использования lucide-react иконок:

```typescript
import { Info, AlertTriangle, AlertCircle, CheckCircle, Lightbulb, Quote } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<any>> = {
    'note': Info,
    'info': Info,
    'warning': AlertTriangle,
    'caution': AlertTriangle,
    'danger': AlertCircle,
    'error': AlertCircle,
    'success': CheckCircle,
    'check': CheckCircle,
    'tip': Lightbulb,
    'important': Lightbulb,
    'quote': Quote,
    'abstract': Quote
};

// В рендере:
const IconComponent = iconMap[type.toLowerCase()] || Info;
<IconComponent size={18} className="cm-callout-icon" />
```

---

#### 3. Блоки Кода (Code Blocks)

**Текущее Состояние:**
```css
.cm-code-block-bg {
    font-family: 'JetBrains Mono', 'Consolas', monospace !important;
    background-color: var(--nh-bg-secondary) !important;
}

.cm-code-block-badge {
    position: absolute;
    top: -1.2em;
    right: 8px;
    background-color: var(--nh-bg-surface);
    border: 1px solid var(--nh-border-subtle);
    color: var(--nh-text-muted);
    padding: 2px 6px;
    font-size: 0.7em;
    border-radius: 4px;
}
```

**Проблемы:**
- ❌ Нет border вокруг блока кода — VSCode и Obsidian используют `border: 1px solid`
- ❌ Badge с `position: absolute; top: -1.2em` — выглядит оторванным от блока
- ⚠️ Отсутствует rounded corner для первой/последней строки блока
- ❌ Line-height слишком компактный (не указан явно, наследуется 1.6)
- ⚠️ Нет внутреннего padding — текст прилипает к краям

**Референс VSCode:**
```css
pre > code {
    display: block;
    padding: 16px;
    background-color: #1e1e1e;
    border: 1px solid #3c3c3c;
    border-radius: 6px;
    overflow-x: auto;
    line-height: 1.45;
}
```

**Референс Obsidian:**
```css
.cm-line.HyperMD-codeblock {
    background-color: var(--code-background);
    padding: 0 16px;
    line-height: 1.5;
}

.cm-line.HyperMD-codeblock-begin {
    border-top: 1px solid var(--code-border);
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    padding-top: 12px;
}

.cm-line.HyperMD-codeblock-end {
    border-bottom: 1px solid var(--code-border);
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    padding-bottom: 12px;
}
```

**Рекомендации:**

```css
/* Базовые стили для всех строк блока кода */
.cm-code-block-bg {
    font-family: 'JetBrains Mono', 'Consolas', monospace !important;
    background-color: var(--nh-bg-secondary) !important;
    border-left: 1px solid var(--nh-border-subtle);
    border-right: 1px solid var(--nh-border-subtle);
    padding: 0 16px !important; /* Horizontal padding для кода */
    line-height: 1.5 !important;
}

/* Первая строка блока */
.cm-code-block-first {
    border-top: 1px solid var(--nh-border-subtle);
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    padding-top: 12px !important;
    margin-top: 8px;
}

/* Последняя строка блока */
.cm-code-block-last {
    border-bottom: 1px solid var(--nh-border-subtle);
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    padding-bottom: 12px !important;
    margin-bottom: 8px;
}

/* Badge внутри блока */
.cm-code-block-badge {
    position: absolute;
    top: 4px; /* ❗ Изменено с -1.2em на 4px — теперь внутри блока */
    right: 12px;
    background-color: rgba(0, 0, 0, 0.4); /* Полупрозрачный фон */
    color: var(--nh-text-muted);
    padding: 3px 8px;
    font-size: 0.75em;
    border-radius: 4px;
    pointer-events: none;
    user-select: none;
    z-index: 10;
    font-family: var(--nh-font-family-sans); /* НЕ моноширинный для badge */
    font-weight: 500;
}
```

**Обновить view-plugin.ts для применения классов:**
```typescript
// В buildFencedCodeDecorations (строки 478-525)
for (let i = startLine.number; i <= endLine.number; i++) {
    const linePos = state.doc.line(i).from;
    let className = 'cm-code-block-bg';
    if (i === startLine.number) className += ' cm-code-block-first';
    if (i === endLine.number) className += ' cm-code-block-last';
    
    addDecoration(Decoration.line({ class: className }).range(linePos), false);
}
```

---

### 🟡 СРЕДНИЕ ПРОБЛЕМЫ

#### 4. Списки (Lists)

**Текущее Состояние:**
- ✅ Bullet points заменяются на `•` (работает)
- ✅ Task checkboxes интерактивные (работает)
- ⚠️ Нет визуального отступа для вложенных списков

**Проблемы:**
- ❌ Отсутствует индентация для вложенных уровней (Obsidian/VSCode используют `padding-left: 2em` для каждого уровня)
- ⚠️ Bullet `•` слишком жирный (`font-weight: bold`)

**Рекомендации:**
```css
/* Убрать font-weight: bold для bullet */
.cm-nh-bullet {
    color: var(--nh-text-muted);
    display: inline-block;
    width: 1em;
    text-align: center;
    /* ❗ УБРАТЬ: font-weight: bold; */
}

/* Добавить вложенность (потребует изменений в view-plugin) */
.cm-list-indent-1 { padding-left: 2em; }
.cm-list-indent-2 { padding-left: 4em; }
.cm-list-indent-3 { padding-left: 6em; }
```

---

#### 5. Заголовки (Headings)

**Текущее Состояние:**
```css
.cm-nh-h1 { fontSize: '1.75em', fontWeight: 'bold' }
.cm-nh-h2 { fontSize: '1.5em', fontWeight: 'bold' }
.cm-nh-h3 { fontSize: '1.25em', fontWeight: 'bold' }
...
```

**Проблемы:**
- ⚠️ Нет нижней границы для H1/H2 (Obsidian использует `border-bottom` для H1/H2)
- ⚠️ Padding слишком мал для больших заголовков

**Референс Obsidian/VSCode:**
```css
h1 {
    font-size: 2em;
    font-weight: 600;
    padding: 0.5em 0 0.25em 0;
    border-bottom: 2px solid var(--divider-color);
}

h2 {
    font-size: 1.5em;
    font-weight: 600;
    padding: 0.4em 0 0.2em 0;
    border-bottom: 1px solid var(--divider-color);
}
```

**Рекомендации:**
```css
/* Добавить border-bottom для H1/H2 */
.cm-nh-h1-line {
    padding-top: 0.5em;
    padding-bottom: 0.25em;
    border-bottom: 2px solid var(--nh-border-subtle);
}

.cm-nh-h2-line {
    padding-top: 0.4em;
    padding-bottom: 0.2em;
    border-bottom: 1px solid var(--nh-border-subtle);
}

/* Увеличить размеры шрифтов для лучшей иерархии */
.cm-nh-h1 { font-size: 2em; font-weight: 600; }
.cm-nh-h2 { font-size: 1.6em; font-weight: 600; }
.cm-nh-h3 { font-size: 1.3em; font-weight: 600; }
```

---

### 🟢 НИЗКИЕ ПРОБЛЕМЫ

#### 6. Инлайн Код

**Текущее Состояние:**
```css
.cm-nh-inline-code {
    fontFamily: 'var(--nh-font-family-mono)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: '0.1em 0.3em',
    borderRadius: '3px'
}
```

**Проблемы:**
- ⚠️ Border radius слишком мал (3px vs 4px в Obsidian)
- ⚠️ Padding слишком мал для комфортной читабельности

**Рекомендации:**
```css
.cm-nh-inline-code {
    font-family: var(--nh-font-family-mono);
    background-color: rgba(255, 255, 255, 0.12); /* Чуть ярче */
    padding: 0.15em 0.4em; /* Увеличено */
    border-radius: 4px; /* Увеличено с 3px */
    color: var(--nh-accent-primary); /* Акцентный цвет для выделения */
}
```

---

#### 7. Ссылки (Links)

**Текущее Состояние:**
```css
.cm-nh-link {
    color: 'var(--nh-accent-primary)',
    textDecoration: 'underline',
    cursor: 'pointer'
}
```

**Проблемы:**
- ⚠️ Подчеркивание всегда видно (Obsidian показывает только при hover)
- ❌ Нет hover-эффекта

**Рекомендации:**
```css
.cm-nh-link {
    color: var(--nh-accent-primary);
    text-decoration: none; /* ❗ Убрать постоянное подчеркивание */
    cursor: pointer;
    transition: all 0.2s ease;
}

.cm-nh-link:hover {
    text-decoration: underline;
    opacity: 0.8;
}
```

---

## План Исправлений

### Фаза 1: Критические Визуальные Проблемы (Приоритет: HIGH)

#### 1.1. Скрытие Символов Цитат
**Файл:** `packages/plugins/features/editor/src/cm/live-preview/view-plugin.ts`  
**Строки:** 546-552

**Изменения:**
```typescript
// В buildBlockquoteDecorations, секция Standard Blockquote
if (!match) {
    // Standard Blockquote (Card Style)
    for (let i = startLine.number; i <= endLine.number; i++) {
        const line = state.doc.line(i);
        const lineText = line.text;
        
        addDecoration(Decoration.line({ class: 'cm-blockquote' }).range(line.from), false);
        
        // ❗ ДОБАВИТЬ: Hide the '>' marker if NOT in editing mode
        if (!isSelectionOverlapping(selection, line.from, line.to)) {
            const markerMatch = lineText.match(/^[ \t]*>( ?)/);
            if (markerMatch) {
                const matchLen = markerMatch[0].length;
                const markerStart = line.from + markerMatch.index!;
                const markerEnd = markerStart + matchLen;
                
                addDecoration(hiddenSyntax.range(markerStart, markerEnd), true);
            }
        }
    }
    return;
}
```

**Тестирование:**
1. Создать файл с обычной цитатой:
```markdown
> This is a quote
> Another line
```
2. Убедиться что символы `>` скрыты когда курсор НЕ на строке
3. Убедиться что `>` появляются при фокусе

---

#### 1.2. Улучшение Стилей Blockquote
**Файл:** `packages/plugins/features/editor/src/components/NotehubEditor.tsx`  
**Строки:** 263-271

**Изменения:**
```css
/* == Standard Quotes == */
.cm-blockquote {
    border-left: 4px solid var(--nh-accent-secondary) !important;
    padding: 4px 0 4px 16px !important;
    margin: 8px 0;
    background-color: rgba(96, 165, 250, 0.05); /* Subtle blue tint */
    color: var(--nh-text-primary);
    font-style: normal;
    display: block;
}
```

---

#### 1.3. Улучшение Блоков Кода
**Файл:** `packages/plugins/features/editor/src/components/NotehubEditor.tsx`  
**Строки:** 232-246

**Изменения:**
```css
/* == Code Blocks == */
.cm-code-block-bg {
    font-family: 'JetBrains Mono', 'Consolas', monospace !important;
    background-color: var(--nh-bg-secondary) !important;
    border-left: 1px solid var(--nh-border-subtle);
    border-right: 1px solid var(--nh-border-subtle);
    padding: 0 16px !important;
    line-height: 1.5 !important;
}

.cm-code-block-first {
    border-top: 1px solid var(--nh-border-subtle);
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    padding-top: 12px !important;
    margin-top: 8px;
}

.cm-code-block-last {
    border-bottom: 1px solid var(--nh-border-subtle);
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    padding-bottom: 12px !important;
    margin-bottom: 8px;
}

.cm-code-block-badge {
    position: absolute;
    top: 4px; /* ❗ Changed from -1.2em */
    right: 12px;
    background-color: rgba(0, 0, 0, 0.4);
    color: var(--nh-text-muted);
    padding: 3px 8px;
    font-size: 0.75em;
    border-radius: 4px;
    font-family: var(--nh-font-family-sans);
    font-weight: 500;
    pointer-events: none;
    user-select: none;
    z-index: 10;
}
```

**ВАЖНО:** Классы `.cm-code-block-first` и `.cm-code-block-last` уже применяются в `view-plugin.ts:492-493`, никаких изменений в логике не требуется.

---

#### 1.4. Улучшение Каллаутов
**Файл:** `packages/plugins/features/editor/src/components/NotehubEditor.tsx`  
**Строки:** 273-331

**Изменения:**
```css
/* == Callouts == */

/* HEADER WIDGET */
.cm-callout-header {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    background-color: var(--nh-bg-secondary);
    border: 1px solid var(--nh-border-subtle);
    border-left: 4px solid; /* Color set by type below */
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    font-weight: 600;
    user-select: none;
    gap: 10px;
}

.cm-callout-icon {
    display: flex;
    align-items: center;
    justify-content: center;
}

/* HEADER LINE CONTAINER */
.cm-callout-header-line {
    padding-left: 0 !important;
}

/* BODY LINE CONTAINER */
.cm-callout-body {
    background-color: var(--nh-bg-surface);
    border-left: 1px solid var(--nh-border-subtle);
    border-right: 1px solid var(--nh-border-subtle);
    padding: 8px 16px; /* ❗ Increased from '0 12px' */
}

/* FIRST/LAST */
.cm-callout-first.cm-callout-header-line {
    margin-top: 0.5em;
}

.cm-callout-last.cm-callout-body {
    border-bottom: 1px solid var(--nh-border-subtle);
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;
    padding-bottom: 8px;
    margin-bottom: 0.5em;
}

/* Callout Types - Border Left Color */
.cm-callout-note .cm-callout-header, 
.cm-callout-info .cm-callout-header { 
    border-left-color: #60a5fa; 
}

.cm-callout-success .cm-callout-header, 
.cm-callout-check .cm-callout-header { 
    border-left-color: #4ade80; 
}

.cm-callout-warning .cm-callout-header, 
.cm-callout-caution .cm-callout-header { 
    border-left-color: #fb923c; 
}

.cm-callout-danger .cm-callout-header, 
.cm-callout-error .cm-callout-header { 
    border-left-color: #f87171; 
}

.cm-callout-tip .cm-callout-header, 
.cm-callout-important .cm-callout-header { 
    border-left-color: #c084fc; 
}

.cm-callout-quote .cm-callout-header, 
.cm-callout-abstract .cm-callout-header { 
    border-left-color: #cbd5e1; 
}

/* Callout Types - Header Text Color (existing styles, no change) */
.cm-callout-info .cm-callout-header, 
.cm-callout-note .cm-callout-header { 
    color: #60a5fa; 
}
/* ... rest of existing color styles ... */
```

---

#### 1.5. Добавить Иконки в Каллауты
**Файл:** `packages/plugins/features/editor/src/cm/widgets/CalloutHeaderWidget.ts`

**СОЗДАТЬ НОВЫЙ ФАЙЛ:** (если не существует)
```typescript
import { WidgetType, EditorView } from '@codemirror/view';
import { bridgeService, generateWidgetId } from '../react-bridge';
import React from 'react';
import { Info, AlertTriangle, AlertCircle, CheckCircle, Lightbulb, Quote } from 'lucide-react';

interface CalloutHeaderProps {
    type: string;
    title: string;
}

const CalloutHeaderComponent: React.FC<CalloutHeaderProps> = ({ type, title }) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
        'note': Info,
        'info': Info,
        'warning': AlertTriangle,
        'caution': AlertTriangle,
        'danger': AlertCircle,
        'error': AlertCircle,
        'success': CheckCircle,
        'check': CheckCircle,
        'tip': Lightbulb,
        'important': Lightbulb,
        'quote': Quote,
        'abstract': Quote
    };
    
    const IconComponent = iconMap[type.toLowerCase()] || Info;
    
    return (
        <div className="cm-callout-header">
            <div className="cm-callout-icon">
                <IconComponent size={18} />
            </div>
            <span>{title}</span>
        </div>
    );
};

export class CalloutHeaderWidget extends WidgetType {
    private widgetId: string;
    
    constructor(
        private readonly type: string,
        private readonly title: string
    ) {
        super();
        this.widgetId = generateWidgetId();
    }
    
    eq(other: CalloutHeaderWidget): boolean {
        return this.type === other.type && this.title === other.title;
    }
    
    toDOM(_view: EditorView): HTMLElement {
        const container = document.createElement('div');
        container.style.display = 'block';
        
        bridgeService.mount(
            this.widgetId, 
            container, 
            CalloutHeaderComponent, 
            { type: this.type, title: this.title }
        );
        
        return container;
    }
    
    destroy(_dom: HTMLElement): void {
        bridgeService.unmount(this.widgetId);
    }
    
    ignoreEvent(_event: Event): boolean {
        return true;
    }
}
```

---

### Фаза 2: Средние Улучшения (Приоритет: MEDIUM)

#### 2.1. Улучшение Заголовков
**Файл:** `packages/plugins/features/editor/src/components/NotehubEditor.tsx`  
**Строки:** 106-119

**Изменения:**
```typescript
// Heading text marks (inline styling)
'.cm-nh-h1': { fontSize: '2em', fontWeight: '600' }, // ❗ Changed from 1.75em, 'bold'
'.cm-nh-h2': { fontSize: '1.6em', fontWeight: '600' }, // ❗ Changed from 1.5em
'.cm-nh-h3': { fontSize: '1.3em', fontWeight: '600' }, // ❗ Changed from 1.25em
'.cm-nh-h4': { fontSize: '1.1em', fontWeight: '600' },
'.cm-nh-h5': { fontSize: '1.05em', fontWeight: '600' },
'.cm-nh-h6': { fontSize: '1em', fontWeight: '600' },

// Heading line decorations (line container styling)
'.cm-nh-h1-line': { 
    paddingTop: '0.5em', 
    paddingBottom: '0.25em',
    borderBottom: '2px solid var(--nh-border-subtle)' // ❗ ADDED
},
'.cm-nh-h2-line': { 
    paddingTop: '0.4em', 
    paddingBottom: '0.2em',
    borderBottom: '1px solid var(--nh-border-subtle)' // ❗ ADDED
},
// ... rest unchanged
```

---

#### 2.2. Улучшение Bullet Points
**Файл:** `packages/plugins/features/editor/src/components/NotehubEditor.tsx`  
**Строки:** 121-127

**Изменения:**
```typescript
// Bullet points
'.cm-nh-bullet': {
    color: 'var(--nh-text-muted)',
    // ❗ REMOVE: fontWeight: 'bold',
    display: 'inline-block',
    width: '1em',
    textAlign: 'center'
}
```

---

### Фаза 3: Полировка (Приоритет: LOW)

#### 3.1. Улучшение Инлайн Кода
**Файл:** `packages/plugins/features/editor/src/components/NotehubEditor.tsx`  
**Строки:** 99-105

**Изменения:**
```typescript
// Inline code
'.cm-nh-inline-code': {
    fontFamily: 'var(--nh-font-family-mono)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)', // ❗ Changed from 0.1
    padding: '0.15em 0.4em', // ❗ Changed from 0.1em 0.3em
    borderRadius: '4px', // ❗ Changed from 3px
    color: 'var(--nh-accent-primary)' // ❗ ADDED for accent
}
```

---

#### 3.2. Улучшение Ссылок
**Файл:** `packages/plugins/features/editor/src/components/NotehubEditor.tsx`  
**Строки:** 88-93

**Изменения:**
```typescript
// Links
'.cm-nh-link': {
    color: 'var(--nh-accent-primary)',
    textDecoration: 'none', // ❗ Changed from 'underline'
    cursor: 'pointer',
    transition: 'all 0.2s ease' // ❗ ADDED
}

// ❗ ДОБАВИТЬ в <style> тег (строка 230):
'.cm-nh-link:hover': {
    textDecoration: 'underline',
    opacity: '0.8'
}
```

**ВАЖНО:** Hover-стили в EditorView.theme НЕ работают, нужно добавить в `<style dangerouslySetInnerHTML>`:

```typescript
// В NotehubEditor.tsx, внутри <style> тега (после строки 333)
<style dangerouslySetInnerHTML={{
    __html: `
    /* ... existing styles ... */
    
    /* Link Hover Effect */
    .cm-nh-link:hover {
        text-decoration: underline;
        opacity: 0.8;
    }
    ` }} />
```

---

## Приоритизация

### 🔴 Критические (Делать ПЕРВЫМ)
1. **Скрытие `>` в blockquotes** — нарушает базовую UX концепцию Live Preview
2. **Улучшение стилей blockquote** — текущий дизайн не читаемый
3. **Borders и padding для code blocks** — блоки кода без границ выглядят незаконченными
4. **Border-left accent для callout headers** — без этого невозможно различить типы

### 🟡 Средние (Делать ВТОРЫМ)
5. **Иконки в каллаутах** — визуальная идентификация типов
6. **Улучшение заголовков** — размеры и underlines для H1/H2
7. **Bullet weight** — слишком жирные буллеты отвлекают

### 🟢 Низкие (Делать ТРЕТЬИМ)
8. **Инлайн код padding/radius** — мелкие визуальные улучшения
9. **Link hover effects** — полировка интерактивности

---

## Итоговая Метрика Качества

### До Исправлений (Текущее Состояние)
- **Blockquotes:** 3/10 (символы видны, нет фона, курсив форсированный)
- **Callouts:** 6/10 (функционально работают, но нет акцентов и иконок)
- **Code Blocks:** 5/10 (работают, но нет boundaries и badge отрывается)
- **Lists:** 7/10 (работают, но буллеты слишком жирные)
- **Headings:** 6/10 (размеры ок, но нет underlines для H1/H2)
- **Inline Elements:** 7/10 (работают, но нужна полировка)

### После Исправлений (Ожидаемое)
- **Blockquotes:** 9/10 (соответствуют Obsidian/VSCode стандартам)
- **Callouts:** 9/10 (полностью functional с иконками и акцентами)
- **Code Blocks:** 9/10 (профессиональные границы и badge placement)
- **Lists:** 8/10 (буллеты нормальные)
- **Headings:** 9/10 (иерархия четкая с underlines)
- **Inline Elements:** 9/10 (полированные hover-эффекты)

---

## Заключение

Данный план исправлений приводит редактор Notehub.md к индустриальным стандартам Obsidian и VSCode. Основные проблемы связаны с:
1. Недостаточным скрытием Markdown-синтаксиса
2. Отсутствием визуальных границ для блоков
3. Слабой цветовой дифференциацией элементов

Все исправления имеют четкие приоритеты и могут быть реализованы поэтапно без breaking changes для существующей функциональности.

**CRITICAL PATH:**
Фаза 1 → Фаза 2 → Фаза 3

**Оценка трудозатрат:**
- Фаза 1 (Критические): 2-3 часа
- Фаза 2 (Средние): 1-2 часа
- Фаза 3 (Низкие): 0.5-1 час

**Общее время:** 3.5-6 часов чистой разработки.
