# Отчет о Дизайн-Ревью: Project "Deep Space"
**Дата:** 12 Января 2026
**Статус:** Draft
**Автор:** Antigravity (Design Lead)

## 1. Диагноз: "Инженерный Космос"

Текущее состояние UI я бы описал как **"Стерильный Прототип"**.
Функционально всё на месте, но визуально — это набор дефолтных компонентов, которые пытаются казаться "современными" разбрасыванием теней и прозрачностью.

**Главные проблемы:**
1.  **Хардкод в JavaScript:** Цвета в `CalloutHeader.tsx` и `NodeRow.tsx` зашиты прямо в код. Это убивает темизацию и делает поддержку адом.
2.  **"Desaturation":** Интерфейс слишком плоский. "Deep Space" — это не просто `#0A0A0A`. Это глубина, слои, шум (noise textures), градиенты на границах (border-gradients) и свечение. Сейчас это просто серые плашки.
3.  **Отсутствие "Тактильности":** Кнопки и инпуты не реагируют "сочно". Нет микро-скейлов (`scale-95` on click), нет `ring-offset`, фокусы выглядят стандартно.
4.  **Странные отступы:** `gap=8px` в главном лейауте для десктопа — это слишком тесно. Панели "слипаются".

---

## 2. Аудит Атомов (CK-Standard)

Наши строительные блоки требуют шлифовки. Мы должны уйти от `style={{...}}` к классам Tailwind и CSS Variables.

### Button (`Button.tsx`)
*   **Сейчас:** Хардкодные тени (`shadow-[0_0_20px_rgba(...)]`). Скучный Hover (`brightness-110`).
*   **Как надо:**
    *   **Glow Effect:** Использовать внутреннее свечение через `inset-shadow` или градиентный бордер.
    *   **Click:** Добавить `active:scale-95` для тактильного отклика.
    *   **Glass:** Вместо простого `bg-opacity`, нужен `backdrop-blur-md` + `border-white/10` + `bg-gradient-to-b from-white/5 to-transparent`.

```tsx
// Предложение по стилю (Tailwind)
const glassButton = "backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all duration-200 shadow-lg shadow-black/20";
```

### Input (`Input.tsx`)
*   **Сейчас:** "Floating aesthetic" с `shadow-[inset_0_1px_2px...]`.
*   **Критика:** Выглядит "грязно" на темном фоне. Inset shadows на черном часто выглядят как вдавленные дыры.
*   **Решение:**
    *   Убрать `inset-shadow`.
    *   Сделать плоский фон `bg-secondary` с `border-b` (только нижняя граница) для минимализма, ЛИБО полный `ring-1 ring-white/10`.
    *   **Focus:** Glowing ring. `focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-bg-main`.

### Toggle (`Toggle.tsx`)
*   **Сейчас:** iOS-стайл, фиксированные размеры.
*   **Решение:** Сделать трек более темным (`bg-black/50` inset), а ручку (knob) — светящейся.

---

## 3. Аудит Редактора (The Core)

Это сердце приложения. Здесь пользователь проводит 90% времени.

### Callout Widgets (Критика уровня "Critical")
В `CalloutHeader.tsx` обнаружен **преступный хардкод**:
```javascript
INFO: { bg: 'rgba(74, 144, 226, 0.15)', text: '#4a90e2', border: '#4a90e2' }
```
Это недопустимо. Если мы захотим поменять оттенок синего в теме, нам придется лезть в React-компонент.

**Предложение:**
1.  Перенести цвета в CSS переменные: `--nh-callout-info-bg`, `--nh-callout-info-text`.
2.  Визуал:
    *   **Left Border:** Жирная полоса слева (4px) цвета типа.
    *   **Background:** Градиент `linear-gradient(90deg, var(--color-type)/10%, transparent)`.
    *   **Icon:** Должна "парить" (drop-shadow).

### Checkboxes
Текущие чекбоксы (нативные или простые кастомные) слишком мелкие.
**Нужно:**
*   Размер `w-5 h-5`.
*   При чеке — анимация (галочка "рисуется").
*   Зачеркивание текста должно быть плавным (`nav-link` transition).

---

## 4. Аудит Лейаута (Layout Manager)

### Grid & Spacing (`EditorLayout.tsx`)
*   **Grid Gap:** `gap: 8px` — это мобильный стандарт. Для десктопного "космопита" нужно больше воздуха.
    *   Предлагаю: `gap-4` (16px) или даже `gap-6` (24px) между сайдбаром и редактором.
*   **Panels:** Панели (Ribbon, Sidebar, Main) сейчас просто плашки.
    *   Добавить: **Inner Glow**. `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05)`. Это создаст эффект премиального стекла.

### Explorer (`NodeRow.tsx`)
*   **Selection:** Сейчас это просто `bg-accent`. Слишком грубо.
*   **Предложение:**
    *   Убрать фон на всю ширину.
    *   Оставить только свечение текста и маркера.
    *   Или использовать стиль "Rounded Selection": скругленный прямоугольник, который не касается краев сайдбара (`mx-2 rounded-lg`).
*   **Icons:** Хардкод `text-yellow-500` для папок убивает монохромную эстетику. Заменить на `text-[var(--nh-accent-secondary)]` или вообще убрать цвет, оставив форму.

---

## 5. Motion Design (The "Juice")

У нас нет никакой динамики.
**Чек-лист анимаций:**
1.  **Sidebar Toggle:** Сайдбар должен выезжать плавно (`ease-out-expo`), а не просто появляться.
2.  **Widgets:** При загрузке заметок виджеты (Callouts) должны иметь легкий `fade-in-up` (появление с небольшим смещением вверх).
3.  **Active File:** При смене файла в дереве, индикатор (полоска слева) должен *плавно переезжать* (LayoutId in Framer Motion), а не прыгать.

## Action Plan (Next Steps)

1.  **Refactor Themes:** Вычистить `theme-manager`, добавить переменные для Callouts и семантических статусов.
2.  **Atomic Design:** Переписать `Button`, `Input` используя новые токены и `backdrop-blur`.
3.  **Widget Cleanup:** Переписать `CalloutHeader` на CSS-классы.
4.  **Layout Polish:** Увеличить отступы, добавить "шумные" текстуры на фон (опционально).

*Let's make it shine.*
