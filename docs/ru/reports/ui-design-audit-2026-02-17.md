# UI/UX Аудит: Notehub.md 0.1.x

**Дата:** 17 февраля 2026
**Версия:** 0.1.x
**Область:** Полный анализ визуальной части проекта

---

## Оглавление

1. [Резюме](#1-резюме)
2. [Текущая архитектура UI](#2-текущая-архитектура-ui)
3. [Дизайн-система: что есть](#3-дизайн-система-что-есть)
4. [Критические проблемы](#4-критические-проблемы)
5. [Несоответствия стилей (Pixel-level)](#5-несоответствия-стилей-pixel-level)
6. [Кроссплатформенность](#6-кроссплатформенность)
7. [Доступность (Accessibility)](#7-доступность-accessibility)
8. [Производительность рендеринга](#8-производительность-рендеринга)
9. [Рекомендации: Минималистичная расширяемая дизайн-система](#9-рекомендации-минималистичная-расширяемая-дизайн-система)
10. [План действий](#10-план-действий)

---

## 1. Резюме

Проект имеет сильный фундамент: плагинная архитектура, CSS-переменные, компонентная библиотека `ck-standard`. Однако дизайн развивался органически, без единого источника правды. Результат - визуально привлекательный, но непоследовательный интерфейс с проблемами масштабирования.

**Главные выводы:**

- Смешаны 3 подхода к стилизации (Tailwind inline, CSS-файлы, inline styles) без чёткого правила, когда использовать какой
- CSS-переменные определены в theme-manager, но не интегрированы в Tailwind config - половина потенциала пропадает
- Нет единой шкалы spacing/typography/shadows - значения подбираются "на глаз"
- Мобильная адаптация есть, но реализована только для layout, не для компонентов
- Glassmorphism-эффекты красивы, но захардкожены с конкретными rgba-значениями вместо токенов

---

## 2. Текущая архитектура UI

### 2.1 Стек технологий

| Слой | Технология | Роль |
|------|-----------|------|
| Framework | React 18 | Рендеринг компонентов |
| Стилизация | Tailwind CSS 3.4 + CSS Variables | Утилитарные классы + темизация |
| Иконки | Lucide React (~50 иконок) | Единый иконочный набор |
| Дерево файлов | react-arborist | Виртуализированное дерево |
| Цвета | colord | Генерация акцентных оттенков |
| Desktop | Tauri 2.0 | Нативное окно |
| Mobile | Capacitor | Обёртка для iOS/Android |

### 2.2 Компонентная иерархия

```
NotehubApp
├── WelcomeLayout (выбор хранилища)
│   ├── Controller:titlebar
│   ├── Controller:vault-list
│   └── Controller:vault-actions
│
└── EditorLayout (основной рабочий экран)
    ├── Controller:titlebar
    ├── Desktop Grid
    │   ├── Ribbon (3.5rem, вертикальная)
    │   ├── Sidebar (250px, ресайзится 150-600px)
    │   │   └── Explorer:FileTree
    │   ├── Main
    │   │   ├── ZoneRenderer:tabbar → TabBar
    │   │   └── Controller:editor-main
    │   └── StatusBar
    │
    └── Mobile Stack
        ├── Mobile Header (hamburger + vault name)
        ├── Content (tabs + editor)
        ├── StatusBar
        └── Drawer (ribbon + sidebar, slide-in)
```

### 2.3 Библиотека компонентов `ck-standard`

14 компонентов: Button, Input, Select, Toggle, Checkbox, Card, Label, Menu, ListItem, RibbonButton, StatusBar, ColorPicker, EmptySlot, HotkeyRecorder.

---

## 3. Дизайн-система: что есть

### 3.1 Цветовые токены (CSS-переменные)

**Фоны (иерархия глубины):**
```
--nh-bg-main      → #0A0A0A (самый глубокий фон)
--nh-bg-sidebar   → #101010
--nh-bg-surface   → #141414 (панели)
--nh-bg-secondary → #1A1A1A (вложенные элементы)
--nh-bg-hover     → #1E1E1E
```

**Текст:**
```
--nh-text-primary   → #E0E0E0
--nh-text-secondary → #A0A0A0
--nh-text-muted     → rgba(255,255,255,0.4)
--nh-text-error     → #ef4444
```

**Акцент:**
```
--nh-accent-primary   → #7c3aed (Violet-600)
--nh-accent-secondary → генерируется через colord
```

**Glassmorphism:**
```
--nh-glass-bg     → rgba(20, 20, 20, 0.7)
--nh-glass-border → rgba(255, 255, 255, 0.08)
--nh-panel-glow   → inset 0 0 0 1px rgba(255,255,255,0.05)
```

### 3.2 Тени (3 уровня)

```
--nh-shadow-sm → 0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)
--nh-shadow-md → 0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)
--nh-shadow-lg → 0 8px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.3)
```

### 3.3 Что отсутствует

- **Шкала отступов** - нет формализованной spacing scale, используются произвольные Tailwind-значения
- **Типографская шкала** - нет определённых size/weight/line-height ступеней
- **Шкала скруглений** - `rounded-xl` почти везде, но TabBar использует `border-radius: 4px`
- **Шкала анимаций** - длительности от 100ms до 300ms без системы
- **Breakpoints** - только `md:` (768px), без промежуточных
- **Z-index шкала** - произвольные значения (10, 40, 50, 9999)

---

## 4. Критические проблемы

### 4.1 Три конфликтующих подхода к стилизации

**Проблема:** Один и тот же проект использует три разных способа стилизации без единого правила:

| Подход | Где используется | Пример |
|--------|-----------------|--------|
| Tailwind в className | Button, Card, Input, Toggle, EditorLayout | `className="px-3 py-2 rounded-xl"` |
| CSS-файлы с BEM | TabBar | `.nh-tabbar__tab--active` |
| Inline styles | EditorLayout (resize overlay), AlertButton | `style={{ position: 'fixed' }}` |

**Последствие:** Стили невозможно предсказать. Разработчик не знает, где искать стили конкретного элемента.

**Решение:** Определить единое правило:
- **Tailwind** для всех компонентов библиотеки `ck-standard`
- **CSS Modules / CSS-файлы с BEM** только для сложных компонентов со множеством состояний (TabBar, FileTree)
- **Inline styles** только для динамических значений (ширина сайдбара при ресайзе, позиционирование)

### 4.2 Tailwind не знает о дизайн-токенах

**Проблема:** `tailwind.config.js` пуст:

```js
theme: {
    extend: {} // Ничего!
}
```

Все компоненты вынуждены писать `bg-[var(--nh-bg-surface)]` вместо `bg-surface`. Это:
- Увеличивает объём классов в 2-3 раза
- Убивает автодополнение в IDE
- Делает код нечитаемым

**Решение:** Расширить Tailwind config:

```js
theme: {
    extend: {
        colors: {
            nh: {
                main: 'var(--nh-bg-main)',
                sidebar: 'var(--nh-bg-sidebar)',
                surface: 'var(--nh-bg-surface)',
                secondary: 'var(--nh-bg-secondary)',
                hover: 'var(--nh-bg-hover)',
                accent: 'var(--nh-accent-primary)',
                'accent-2': 'var(--nh-accent-secondary)',
                danger: 'var(--nh-danger)',
            },
            'nh-text': {
                DEFAULT: 'var(--nh-text-primary)',
                secondary: 'var(--nh-text-secondary)',
                muted: 'var(--nh-text-muted)',
            },
            'nh-border': {
                DEFAULT: 'var(--nh-border-secondary)',
                subtle: 'var(--nh-border-subtle)',
                accent: 'var(--nh-border-accent)',
            }
        },
        boxShadow: {
            'nh-sm': 'var(--nh-shadow-sm)',
            'nh-md': 'var(--nh-shadow-md)',
            'nh-lg': 'var(--nh-shadow-lg)',
            'nh-glow': 'var(--nh-panel-glow)',
        },
        borderRadius: {
            'nh': '0.75rem', // 12px - единый
        },
        fontFamily: {
            'nh': 'var(--nh-font-family)',
            'nh-mono': 'var(--nh-font-family-mono)',
        }
    }
}
```

### 4.3 Захардкоженные rgba-значения в glow-эффектах

**Проблема:** Glow-эффекты привязаны к фиолетовому цвету `rgba(124,58,237,...)`, но акцентный цвет можно менять динамически через настройки.

Примеры захардкоженных значений:
- Button: `hover:shadow-[0_0_20px_rgba(124,58,237,0.4)]`
- Toggle: `shadow-[0_0_12px_rgba(124,58,237,0.5)]`
- Select: `shadow-[0_0_12px_rgba(124,58,237,0.3)]`

**Последствие:** При смене акцентного цвета glow-эффекты остаются фиолетовыми.

**Решение:** Добавить CSS-переменные для glow:
```css
--nh-glow-accent-sm: 0 0 8px var(--nh-accent-primary-alpha-30);
--nh-glow-accent-md: 0 0 12px var(--nh-accent-primary-alpha-40);
--nh-glow-accent-lg: 0 0 20px var(--nh-accent-primary-alpha-50);
```

Генерировать `--nh-accent-primary-alpha-*` через colord при смене акцента (уже есть инфраструктура в theme-manager).

### 4.4 Z-index хаос

**Текущие значения:**

| Элемент | z-index | Файл |
|---------|---------|------|
| Resize handle | 10 | EditorLayout.tsx:137 |
| Mobile backdrop | 40 | EditorLayout.tsx:199 |
| Mobile drawer | 50 | EditorLayout.tsx:206 |
| Resize overlay | 9999 | EditorLayout.tsx:238 |
| Select dropdown | 50 | Select.tsx:115 |
| Context menu | (не указан) | ContextMenu |

**Решение:** Определить z-index шкалу:
```css
--nh-z-base:     0
--nh-z-dropdown: 100
--nh-z-sticky:   200
--nh-z-overlay:  300
--nh-z-modal:    400
--nh-z-toast:    500
--nh-z-max:      9999
```

---

## 5. Несоответствия стилей (Pixel-level)

### 5.1 Border-radius

| Компонент | Значение | Проблема |
|-----------|----------|----------|
| Button | `rounded-xl` (12px) | - |
| Card | `rounded-xl` (12px) | - |
| Input | `rounded-xl` (12px) | - |
| Select trigger | `rounded-xl` (12px) | - |
| Toggle | `rounded-full` (9999px) | Ожидаемо |
| **TabBar close btn** | **`border-radius: 4px`** | Выбивается |
| **Select dropdown items** | **`rounded-lg` (8px)** | Отличается от триггера |
| **WelcomeLayout sidebar** | **`md:rounded-xl`** (только desktop) | На mobile - квадрат |

**Рекомендация:** Определить шкалу скруглений:
- `--nh-radius-sm`: 6px (мелкие элементы: кнопка закрытия, чипсы)
- `--nh-radius-md`: 10px (элементы управления: кнопки, инпуты)
- `--nh-radius-lg`: 14px (панели, карточки)
- `--nh-radius-full`: 9999px (Toggle, аватары)

### 5.2 Тени и эффекты

| Компонент | Тень | Glow |
|-----------|------|------|
| EditorLayout panels | `var(--nh-shadow-sm), var(--nh-panel-glow)` | Двойная тень |
| StatusBar | `var(--nh-shadow-sm)` + `border accent` | Тень + бордер (перегрузка) |
| WelcomeLayout sidebar | `var(--nh-shadow-sm)` | Без glow |
| Mobile drawer | `var(--nh-shadow-md)` | Без glow |
| Select dropdown | `var(--nh-shadow-lg)` | Без panel-glow |

**Рекомендация:** Все "плавающие" панели одного уровня должны иметь одинаковую комбинацию тень + glow. StatusBar не нужен border - хватит тени.

### 5.3 Padding / Spacing

| Контекст | Значение | Комментарий |
|----------|----------|-------------|
| EditorLayout gap | 16px (hardcoded) | Не из шкалы |
| Mobile layout gap | `gap-2` (8px) | Отличается от desktop |
| Ribbon padding | `py-3 gap-2` | 12px + 8px |
| Sidebar | нет padding | Контент прижат |
| Button sm | `px-3 py-1.5` | 12px / 6px |
| Button md | `px-4 py-2` | 16px / 8px |
| Card sm | `p-3` (12px) | |
| Card md | `p-4` (16px) | |

Desktop gap = 16px, mobile gap = 8px - соотношение 2:1, что нормально, но нигде не формализовано.

### 5.4 Анимации

| Компонент | Duration | Easing | Свойство |
|-----------|----------|--------|----------|
| Button | 200ms | ease-out | transition-all |
| Card | 200ms | ease-out | transition-all |
| Toggle | 300ms | ease-out | transition-all |
| Select trigger | 200ms | (default) | transition-all |
| Select dropdown | 150ms | (default) | animate-in |
| TabBar tab | 150ms | (default) | background, color |
| TabBar close | 100ms | (default) | opacity |
| Resize handle | 200ms | ease | all |
| Mobile drawer | 300ms | (default) | transform |

**Проблема:** 4 разных duration (100, 150, 200, 300ms), разные easing-функции, `transition-all` везде (тяжелее для GPU чем конкретные свойства).

**Рекомендация:**
```css
--nh-duration-fast: 100ms   /* микро-фидбэк: opacity, color */
--nh-duration-base: 200ms   /* стандартные переходы */
--nh-duration-slow: 300ms   /* крупные анимации: drawer, modal */
--nh-ease-out: cubic-bezier(0.16, 1, 0.3, 1)  /* выход элемента */
--nh-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)  /* плавное движение */
```

### 5.5 Focus-кольца

| Компонент | Реализация |
|-----------|-----------|
| Button | `focus-visible:ring-2 ring-offset-2 ring-offset-[var(--nh-bg-main)]` |
| Input (default) | `focus:ring-2 ring-offset-2 ring-offset-[var(--nh-bg-main)]` |
| Input (search) | Только `focus:border-*`, без ring |
| Select | `shadow-[0_0_0_2px_var(--nh-bg-main),0_0_0_4px_var(--nh-accent-primary)]` |
| Toggle | `focus-visible:ring-2 ring-offset-2 ring-offset-[var(--nh-bg-surface)]` |
| Card | `outline-none` (ring отсутствует!) |
| Checkbox | (не проверено) |

**Проблемы:**
1. Input использует `focus:` вместо `focus-visible:` - кольцо появляется при клике мышью
2. Select эмулирует ring через box-shadow - отличается визуально
3. Toggle привязан к `--nh-bg-surface`, остальные к `--nh-bg-main`
4. Card вообще не имеет focus ring, хотя может быть interactive

**Рекомендация:** Единый подход через утилитарный класс:
```css
.nh-focus-ring {
    @apply outline-none focus-visible:ring-2
           focus-visible:ring-[var(--nh-accent-primary)]
           focus-visible:ring-offset-2
           focus-visible:ring-offset-[var(--nh-bg-main)];
}
```

---

## 6. Кроссплатформенность

### 6.1 Desktop (Tauri)

**Что работает:**
- CSS Grid layout с 3 колонками
- Ресайз сайдбара с сохранением ширины
- Titlebar интегрирован

**Что нужно:**
- **Window controls overlay** - если Tauri использует кастомный titlebar, нужно учитывать `titlebar-area-*` для macOS traffic lights
- **Минимальный размер окна** - при `sidebarWidth = 600px` и ribbon `3.5rem` остаётся мало места для editor при узком окне
- **Масштабирование** - нет обработки `window.devicePixelRatio` > 1 для чёткости теней/бордеров на HiDPI

### 6.2 Mobile (Capacitor)

**Что работает:**
- Drawer-навигация с backdrop blur
- Safe area insets для notch
- Единая колонка с tabs + editor

**Что нужно:**
- **Минимальный touch target** - TabBar close button `18x18px` - слишком мал (iOS HIG: 44px, Material: 48px)
- **Swipe-to-close** для drawer - сейчас только tap на backdrop
- **Pull-to-refresh** если нужна синхронизация
- **Виртуальная клавиатура** - при открытии клавиатуры layout ломается? `visualViewport` API нужен
- **Haptic feedback** - нативное тактильное подтверждение для drag-and-drop и toggle
- **Dark/Light status bar** - необходимо синхронизировать цвет статус-бара устройства с темой

### 6.3 Tablet

**Текущее состояние:** Не учтён. Breakpoint `md:` (768px) переключает между "мобильным" и "десктопным" режимом. iPad Mini (768px) попадает на границу.

**Что нужно:**
- Промежуточный layout для планшетов: боковая панель без ribbon, или ribbon + sidebar без ресайза
- `lg:` breakpoint (1024px) для полного desktop layout

### 6.4 Общие проблемы

| Проблема | Desktop | Mobile | Tablet |
|----------|---------|--------|--------|
| Scrollbar стилизация | Кастомная (webkit) | Нативная | Смешанная |
| Context menu | Custom component | Нет long-press | ? |
| Drag-and-drop | Mouse events | Нет touch DnD | ? |
| Text selection | Нативная | `user-select: none` на FileTree | ? |
| Hover states | Работают | Не работают на touch | Стилус работает |

---

## 7. Доступность (Accessibility)

### 7.1 Что сделано хорошо

- Toggle: `role="switch"`, `aria-checked`, `aria-label`, keyboard handler
- Button: `aria-busy` при loading, `disabled` attribute
- Card: `role="button"`, `tabIndex`, `onKeyDown` для interactive variant
- Label: семантические теги `<h1>`, `<h2>`

### 7.2 Критические пропуски

| Проблема | Где | Серьёзность |
|----------|-----|-------------|
| FileTree: `<style>` отключает outline для всех элементов | explorer/FileTree.tsx | Высокая |
| TabBar: нет keyboard navigation между табами | tabbar/TabBar.tsx | Высокая |
| Select: нет `aria-expanded`, `aria-haspopup`, `role="listbox"` | ck-standard/Select.tsx | Высокая |
| Mobile drawer: нет focus trap | EditorLayout.tsx | Средняя |
| Color contrast: `--nh-text-muted` (#666) на `--nh-bg-secondary` (#1A1A1A) = 3.3:1 | theme-manager | Средняя |
| Нет skip-to-content ссылки | EditorLayout.tsx | Низкая |
| Нет prefers-reduced-motion | Все анимации | Средняя |

### 7.3 Контрастность (WCAG AA требует 4.5:1)

| Пара цветов | Ratio | Результат |
|-------------|-------|-----------|
| #E0E0E0 на #0A0A0A | 15.5:1 | PASS |
| #A0A0A0 на #141414 | 8.2:1 | PASS |
| rgba(255,255,255,0.4) на #1A1A1A | ~3.5:1 | FAIL (muted text) |
| #7c3aed на #141414 | 3.8:1 | FAIL (accent как текст) |
| #ffffff на #7c3aed | 6.2:1 | PASS (button text) |

---

## 8. Производительность рендеринга

### 8.1 Что сделано хорошо

- FileTree использует виртуализацию (react-arborist)
- Lazy-компонент загрузка через плагинную систему
- ResizeObserver вместо window resize polling

### 8.2 Проблемы

| Проблема | Влияние | Решение |
|----------|---------|---------|
| `transition-all` на большинстве компонентов | GPU repaint на каждое CSS-свойство | Указывать конкретные свойства: `transition-[background,color,shadow]` |
| `backdrop-blur-xl` на glass-компонентах | Тяжёлая GPU-операция | Использовать только на верхнем уровне (overlay, dropdown), не вкладывать |
| Resize handler через window mousemove | Перерисовка на каждый пиксель | Добавить `requestAnimationFrame` throttle |
| Theme-manager инжектирует стили через DOM | Одноразовая операция | OK, но нужен batch для initial paint |
| `will-change: auto` нигде не используется | Браузер не оптимизирует анимации заранее | Добавить `will-change: transform` на animated elements |

### 8.3 Bundle size

Lucide React импортирует ~50 иконок поштучно через icon-manager registry. Это хорошо для tree-shaking. Но если плагин импортирует Lucide напрямую (как в Select.tsx: `import { ChevronDown, Check } from 'lucide-react'`), это обходит реестр и может дублировать код.

**Рекомендация:** Все иконки должны идти через `@notehub/icon-manager`. Удалить прямые импорты из lucide-react в компонентах.

---

## 9. Рекомендации: Минималистичная расширяемая дизайн-система

### 9.1 Философия

> **Минимум решений, максимум последовательности.**

Каждый визуальный параметр должен иметь ровно одно место определения. Если значение используется больше одного раза - это токен.

### 9.2 Design Tokens (единый источник правды)

Создать файл `packages/plugins/ui/theme-manager/src/tokens.ts`:

```typescript
export const tokens = {
    // Spacing (кратно 4px)
    spacing: {
        0: '0px',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
    },

    // Border Radius
    radius: {
        sm: '6px',    // мелкие элементы
        md: '10px',   // кнопки, инпуты
        lg: '14px',   // панели, карточки
        full: '9999px', // toggle, avatar
    },

    // Typography Scale
    fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],    // 12px - caption, status
        sm: ['0.875rem', { lineHeight: '1.25rem' }], // 14px - body, controls
        base: ['1rem', { lineHeight: '1.5rem' }],    // 16px - primary content
        lg: ['1.125rem', { lineHeight: '1.75rem' }], // 18px - section headers
        xl: ['1.25rem', { lineHeight: '1.75rem' }],  // 20px - page titles
    },

    // Animation
    duration: {
        fast: '100ms',
        base: '200ms',
        slow: '300ms',
    },
    easing: {
        default: 'cubic-bezier(0.4, 0, 0.2, 1)',
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },

    // Z-Index Scale
    zIndex: {
        base: 0,
        dropdown: 100,
        sticky: 200,
        overlay: 300,
        modal: 400,
        toast: 500,
        max: 9999,
    },

    // Breakpoints (mobile-first)
    breakpoints: {
        sm: '640px',   // крупный телефон (landscape)
        md: '768px',   // tablet portrait
        lg: '1024px',  // tablet landscape / small desktop
        xl: '1280px',  // desktop
    },
} as const;
```

### 9.3 Tailwind Config (интеграция с токенами)

```javascript
// tailwind.config.js (shared)
import { tokens } from './tokens';

export default {
    content: [
        "./src/**/*.{ts,tsx}",
        "../../packages/plugins/**/src/**/*.{ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                nh: {
                    main:      'var(--nh-bg-main)',
                    sidebar:   'var(--nh-bg-sidebar)',
                    surface:   'var(--nh-bg-surface)',
                    secondary: 'var(--nh-bg-secondary)',
                    hover:     'var(--nh-bg-hover)',
                    accent:    'var(--nh-accent-primary)',
                    danger:    'var(--nh-danger)',
                },
                'nh-text': {
                    DEFAULT:   'var(--nh-text-primary)',
                    secondary: 'var(--nh-text-secondary)',
                    muted:     'var(--nh-text-muted)',
                },
            },
            boxShadow: {
                'nh-sm':   'var(--nh-shadow-sm)',
                'nh-md':   'var(--nh-shadow-md)',
                'nh-lg':   'var(--nh-shadow-lg)',
                'nh-glow': 'var(--nh-panel-glow)',
                'nh-glow-accent': 'var(--nh-glow-accent-md)',
            },
            borderRadius: tokens.radius,
            zIndex: tokens.zIndex,
            transitionDuration: tokens.duration,
            transitionTimingFunction: tokens.easing,
        },
    },
    plugins: [],
};
```

### 9.4 Компоненты: что рефакторить

**Приоритет 1 (ломает UX):**

| Компонент | Что делать |
|-----------|-----------|
| Select | Добавить ARIA-атрибуты, keyboard navigation, клавиша Escape |
| TabBar | Keyboard navigation (Arrow Left/Right), `role="tablist"` |
| FileTree | Убрать `<style>` что отключает outline, использовать `:focus-visible` |
| Mobile drawer | Focus trap при открытии |

**Приоритет 2 (визуальная целостность):**

| Компонент | Что делать |
|-----------|-----------|
| Button glow | Заменить hardcoded rgba на CSS-переменные |
| Toggle glow | Аналогично |
| Select glow | Аналогично |
| StatusBar | Убрать `border accent` - достаточно тени + glow |
| WelcomeLayout sidebar | Добавить `rounded-xl` на mobile |
| Focus rings | Единый подход через `.nh-focus-ring` |
| `transition-all` | Заменить на конкретные свойства |

**Приоритет 3 (расширяемость):**

| Задача | Описание |
|--------|----------|
| Shared Tailwind config | Один конфиг для desktop и capacitor |
| Иконки через registry | Убрать прямые импорты lucide-react из компонентов |
| Tablet breakpoint | Добавить `lg:` layout вариант |
| prefers-reduced-motion | Глобально отключать анимации |
| Touch targets | Минимум 44px на mobile для всех interactive элементов |

### 9.5 Архитектура стилей: финальная модель

```
theme-manager/tokens.ts        ← Единый источник правды
        │
        ▼
theme-manager/themes.ts         ← Значения CSS-переменных для каждой темы
        │
        ▼
tailwind.config.shared.js       ← Tailwind знает о токенах
        │
        ▼
Компоненты (ck-standard)        ← Используют Tailwind-классы: bg-nh-surface, shadow-nh-sm
        │
        ▼
Сложные компоненты (TabBar)     ← CSS/Module файлы с var(--nh-*), БЕМ нейминг
        │
        ▼
Плагины (explorer, editor)      ← Комбинируют ck-standard + свои стили через className prop
```

---

## 10. План действий

### Фаза 1: Фундамент (без визуальных изменений)

1. Создать `tokens.ts` с полной шкалой
2. Расширить `tailwind.config.js` токенами
3. Добавить `--nh-glow-accent-*` переменные в theme-manager с динамической генерацией
4. Определить z-index шкалу как CSS-переменные
5. Добавить `prefers-reduced-motion` media query в глобальные стили

### Фаза 2: Нормализация компонентов

6. Рефакторинг focus-ring на единый подход (`.nh-focus-ring`)
7. Замена захардкоженных glow-rgba на CSS-переменные
8. Замена `transition-all` на конкретные свойства
9. Нормализация border-radius по шкале
10. Удаление прямых импортов lucide-react

### Фаза 3: Доступность

11. Select: ARIA + keyboard
12. TabBar: `role="tablist"` + Arrow key navigation
13. FileTree: убрать подавление outline
14. Mobile drawer: focus trap
15. Цветовой контраст muted text: поднять до 4.5:1

### Фаза 4: Кроссплатформенные улучшения

16. Tablet layout (lg: breakpoint)
17. Touch targets 44px minimum на mobile
18. Swipe gesture для drawer
19. `visualViewport` API для виртуальной клавиатуры
20. Синхронизация status bar цвета с темой (Capacitor)

### Фаза 5: Polish

21. Документация компонентов (Storybook или аналог)
22. Visual regression тесты
23. Performance audit backdrop-blur usage
24. Dark/Light тема: проверка всех компонентов в обеих темах

---

## Заключение

Проект находится на стадии, где "всё работает, но ничего не формализовано". Это нормально для 0.1.x. Ключевое действие - **создать единый источник правды (tokens)** и **интегрировать его в Tailwind**. Это одноразовое вложение, которое окупится на каждом следующем компоненте и на каждом новом плагине.

Glassmorphism-эстетика - сильная сторона. Но она требует дисциплины: каждый blur, каждый glow, каждая rgba-прозрачность должна быть токеном, иначе при масштабировании визуал "расплывётся" в разнобой.

Минимализм - это не "мало кода", а "мало решений". Одна шкала скруглений. Одна шкала теней. Один подход к focus. Один способ стилизации. Когда это есть - расширять систему тривиально.
