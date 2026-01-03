# Ревью Дизайн-Системы Notehub

> **Дата**: 2 января 2026  
> **Аудитор**: Design System Reviewer  
> **Версия**: 1.0

---

## Резюме

Данный отчёт содержит детальный анализ дизайн-системы проекта **notehub.md**. Проведена оценка архитектуры токенов, консистентности стилей, реюзабельности компонентов и общей масштабируемости системы.

> [!CAUTION]
> **Критическая проблема**: Дизайн-система находится в стадии формирования и содержит множество несогласованностей, блокирующих эффективное масштабирование.

---

## 1. Архитектура Токенов

### 1.1 Определённые токены в `ThemePalette`

Текущий интерфейс `ThemePalette` в [index.ts](file:///c:/Users/khton/sources/notehub.md/packages/plugins/ui/theme-manager/src/index.ts#L9-L43) определяет следующие токены:

| Категория       | Токены                                                                                   |
|-----------------|------------------------------------------------------------------------------------------|
| **Backgrounds** | `bg-main`, `bg-sidebar`, `bg-surface`                                                   |
| **Accents**     | `accent-primary`, `accent-secondary`                                                     |
| **Borders**     | `border-accent`, `border-secondary`, `border-subtle`                                     |
| **Text**        | `text-primary`, `text-secondary`, `text-muted`, `text-error`                             |
| **Other**       | `button-text`, `danger`, `font-family`, `font-family-mono`                               |

### 1.2 Проблемы с токенами

> [!WARNING]
> **Критические пробелы в системе токенов**

#### ❌ Недостающие токены

Компоненты активно используют несуществующие CSS-переменные:

```diff
# Используемые в коде, но НЕ определённые в ThemePalette:
- --nh-bg-secondary        # FileTree.tsx, Select.tsx
- --nh-bg-hover            # FileTree.tsx
- --nh-border-color        # FileTree.tsx (дублирует border-subtle)
- --nh-ring-focus          # Генерируется динамически, но не в palette
- --nh-text-secondary      # Помечен как optional (?)
```

#### ❌ Несогласованные fallback-значения

Каждый компонент определяет свои fallback-значения, что приводит к визуальным разрывам:

| Файл | Переменная | Fallback |
|------|------------|----------|
| [Button.tsx](file:///c:/Users/khton/sources/notehub.md/packages/plugins/ui/ck-standard/src/components/Button.tsx#L50) | `--nh-accent-primary` | `#6b5ce7` |
| [Toggle.tsx](file:///c:/Users/khton/sources/notehub.md/packages/plugins/ui/ck-standard/src/components/Toggle.tsx#L85) | `--nh-accent-primary` | *(без fallback)* |
| [Select.tsx](file:///c:/Users/khton/sources/notehub.md/packages/plugins/ui/ck-standard/src/components/Select.tsx#L97) | `--nh-bg-secondary` | *(undefined токен)* |

---

## 2. Типографика

### 2.1 Определение шрифтов

Токены шрифтов определены корректно:

```typescript
'font-family': 'system-ui, -apple-system, BlinkMacSystemFont...'
'font-family-mono': 'ui-monospace, SFMono-Regular...'
```

### 2.2 Проблемы типографики

> [!IMPORTANT]
> **Отсутствует типографическая шкала**

❌ **Нет токенов для размеров шрифтов**:
- `font-size-xs`, `font-size-sm`, `font-size-md`, `font-size-lg` и т.д.

❌ **Нет токенов для межстрочного интервала** (line-height):
- Используются произвольные Tailwind классы: `leading-relaxed`, `text-xs`, `text-sm`

❌ **Нет токенов для толщины шрифта** (font-weight):
- Хардкод в компонентах: `font-medium`, `font-bold`, `font-normal`

---

## 3. Система Отступов (Spacing)

> [!CAUTION]
> **Полностью отсутствует система spacing-токенов**

### 3.1 Текущее состояние

Весь spacing определяется через Tailwind-классы напрямую:

```tsx
// Button.tsx - произвольные значения
'px-2 py-1'   // sm
'px-3 py-1.5' // md
'px-4 py-2'   // lg
'px-8 py-3'   // xl

// FileTree.tsx - несогласованные отступы
'px-3 py-2'   // header
'py-1'        // content
'px-4 py-8'   // empty state
```

### 3.2 Рекомендация

Необходимо внедрить spacing-шкалу:

```typescript
// Пример spacing-токенов
'spacing-1': '0.25rem'  // 4px
'spacing-2': '0.5rem'   // 8px
'spacing-3': '0.75rem'  // 12px
'spacing-4': '1rem'     // 16px
// ...
```

---

## 4. Система Компонентов (CK-Standard)

### 4.1 Доступные компоненты

| Компонент     | Файл                           | Статус         |
|---------------|--------------------------------|----------------|
| Button        | `Button.tsx`                   | ✅ Полный       |
| Toggle        | `Toggle.tsx`                   | ✅ Полный       |
| Select        | `Select.tsx`                   | ⚠️ Частичный    |
| Input         | `Input.tsx`                    | ⚠️ Частичный    |
| ColorPicker   | `ColorPicker.tsx`              | ✅ Полный       |
| Card          | `Card.tsx`                     | ⚠️ Частичный    |
| Label         | `Label.tsx`                    | ✅ Базовый      |
| StatusBar     | `StatusBar.tsx`                | ✅ Базовый      |
| RibbonButton  | `RibbonButton.tsx`             | ⚠️ Минимальный |

### 4.2 Проблемы API компонентов

#### Button

> [!WARNING]
> Дублирование вариантов `primary` и `purple` – идентичные стили

```typescript
// Button.tsx:50-51
primary: 'bg-[var(--nh-accent-primary,#6b5ce7)]...' 
purple:  'bg-[var(--nh-accent-primary,#6b5ce7)]...'  // ← Дубликат!
```

#### Select

> [!WARNING]
> Использует undefined токен `--nh-bg-secondary`

```tsx
// Select.tsx:97
bg-[var(--nh-bg-secondary)]  // ← Не определён в ThemePalette!
```

---

## 5. Интеграция с Tailwind

### 5.1 Смешение подходов

Проект использует **гибридный подход**:

1. CSS-переменные (`--nh-*`) через Tailwind arbitrary values
2. Стандартные Tailwind утилиты (`text-sm`, `px-3`, `rounded-lg`)

**Проблема**: Нет единого источника правды. Часть стилей в CSS-переменных, часть через Tailwind.

### 5.2 Отсутствует кастомизация Tailwind

Файл `tailwind.config.js` **не интегрирован** с CSS-переменными дизайн-системы:

```javascript
// Ожидаемая интеграция (отсутствует):
theme: {
  extend: {
    colors: {
      'nh-bg-main': 'var(--nh-bg-main)',
      'nh-accent-primary': 'var(--nh-accent-primary)',
      // ...
    }
  }
}
```

---

## 6. Тёмная / Светлая Темы

### 6.1 Реализация

Реализованы две темы:
- `deep-space` (тёмная)
- `light` (светлая)
- `system` (автоматическая по OS)

### 6.2 Проблемы

> [!NOTE]
> Светлая тема не полностью проработана

```typescript
// LIGHT_THEME: некоторые токены используют комментарии gray-*
'bg-sidebar': '#f3f4f6', // gray-100
'accent-secondary': '#e2e8f0', // gray-200  ← Это slate-200!
```

Несоответствие комментариев реальным цветам Tailwind palette.

---

## 7. Accessibility (A11y)

### 7.1 Положительные моменты

✅ Компоненты используют ARIA-атрибуты:
- `role="switch"` в Toggle
- `aria-checked`, `aria-label`
- Keyboard navigation (Enter, Space)

### 7.2 Проблемы

❌ **Контрастность не гарантирована**:
- Нет токенов для контрастных пар (text on background)
- `text-muted` (#888888) может не пройти WCAG AA на тёмном фоне

❌ **Focus ring несогласован**:
- Button использует `focus:ring-offset-transparent`
- Toggle использует `focus:ring-offset-[var(--nh-bg-surface)]`

---

## 8. Масштабируемость и Документация

### 8.1 Документация

> [!IMPORTANT]
> Отсутствует документация дизайн-системы

- ❌ Нет Storybook / компонентного каталога
- ❌ Нет описания всех токенов
- ❌ Нет гайдов по использованию

### 8.2 Тестирование

- ❌ Нет visual regression тестов
- ❌ Нет проверки контрастности
- ❌ Нет snapshot тестов компонентов

---

## 9. Рекомендации по Исправлению

### 🔴 Критический Приоритет

1. **Унифицировать токены** – добавить все используемые CSS-переменные в `ThemePalette`:
   - `bg-secondary`, `bg-hover`
   - `border-color`
   
2. **Удалить хардкод fallback** – использовать единый источник defaults

3. **Фиксировать undefined токены** в компонентах (особенно `Select.tsx`, `FileTree.tsx`)

### 🟡 Высокий Приоритет

4. **Добавить spacing-токены** – заменить произвольные px/py на семантические классы

5. **Добавить typography-токены** – font-size scale, line-height, font-weight

6. **Интегрировать Tailwind config** с CSS-переменными

### 🟢 Средний Приоритет

7. **Проверить контрастность** всех color-пар (WCAG AA минимум)

8. **Создать документацию** – Storybook или статичный сайт

9. **Добавить visual tests** – Chromatic или подобное

---

## 10. Заключение

Дизайн-система **notehub.md** находится на ранней стадии развития. Основные компоненты реализованы, но система **не является зрелой production-ready** из-за:

- Неконсистентности токенов
- Отсутствия spacing/typography scale
- Fragmented fallback values
- Отсутствия документации

**Рекомендуемый следующий шаг**: Провести рефакторинг `ThemePalette` и синхронизировать все компоненты с единой системой токенов.

---

*Отчёт сгенерирован в рамках ревью дизайн-системы*
