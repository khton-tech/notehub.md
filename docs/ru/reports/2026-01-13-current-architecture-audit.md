# Technical Audit: Current Architecture State (Detailed)
**Date:** 2026-01-13
**Version:** 2.0.0 (Expanded)
**Target:** R&D (Google Deep Research)
**Scope:** `@notehub/core`, `@notehub/plugins`

## 1. Executive Summary

Архитектура системы реализует классический паттерн **Microkernel (Plugin-based Architecture)**. Ядро (`@notehub/core`) является ультра-тонким и агностичным к платформе, предоставляя только механизмы коммуникации (`EventBus`, `ApiBus`) и жизненного цикла.

**Key Architectural Characteristics:**
*   **Coupling:** Extremely Low. Ядро не знает о DOM, React или Electron.
*   **Extensibility:** 100% functionality is implemented as plugins (File System, Layout, Editor, etc.).
*   **Performance:** React-in-CodeMirror rendering uses a decoupled Portal Bridge pattern to avoid overhead.
*   **Portability:** Ready for Web, Desktop (Tauri), and Mobile (Capacitor) deployment via swappable drivers.

Этот документ содержит техническую детализацию вплоть до уровня интерфейсов и алгоритмов.

---

## 2. Core Architecture (`@notehub/core`)

Ядро системы (`NotehubCore`) выполняет роль оркестратора. Оно не содержит бизнес-логики.

### 2.1. Communication Buses
Вся коммуникация между модулями проходит через две строго типизированные шины.

#### EventBus (Pub/Sub)
Асинхронная шина событий. Используется для уведомлений "Fire-and-forget".
*   **Implementation:** `Map<EventName, Set<Callback>>`.
*   **Error Handling:** `Promise.allSettled` гарантирует, что ошибка в одном листенере не прервет выполнение других.
*   **Key Source:** `packages/core/src/buses/EventBus.ts`

#### ApiBus (RPC-like)
Синхронная/Асинхронная шина вызовов методов. Используется для межмодульных запросов с возвращаемым значением.
*   **Implementation:** `Map<ApiName, Handler>`.
*   **Contract:** Строгая типизация через `NotehubApiMap` (в `packages/core/src/api/contract.ts`).
*   **Usage Example:** Файловая система не импортируется явно, а вызывается через `api.invoke('fs:read-file', path)`.

### 2.2. Bootloader Strategy (`nh.system.bootloader`)

Загрузчик реализует алгоритм **Wavefront Parallel Loading** (Волновой параллельной загрузки) на основе топологической сортировки графа зависимостей.

**Algorithm (Kahn's Algorithm adaptation):**
1.  **Discovery:** Валидация манифестов (`manifest.json`) всех найденных плагинов.
2.  **Resolution:** Построение ориентированного графа (`DependencyGraph.ts`).
    *   *Hard Dependency:* Ребро добавляется всегда. Отсутствие узла -> Ошибка.
    *   *Optional Dependency:* Ребро добавляется *только если* узел существует.
3.  **Sorting:** Разбиение на "волны" (layers).
    *   Wave 0: Плагины без зависимостей (e.g., `logger`, `fs-manager`).
    *   Wave N: Плагины, зависящие только от Wave < N.
4.  **Execution:**
    *   Волны запускаются последовательно.
    *   Плагины внутри волны запускаются **параллельно** (`Promise.allSettled`).
    *   **Failure Cascading:** Если плагин A падает, все зависящие от него плагины автоматически помечаются `SKIPPED_DEPENDENCY`, не блокируя загрузку независимых веток.

---

## 3. The Editor Engine (`nh.features.editor`)

Самая сложная подсистема. Решает задачу интеграции React-компонентов в текстовый редактор (CodeMirror 6) без потери производительности.

### 3.1. Architecture: React Portal Bridge (RFC-005)

Стандартный подход CodeMirror (`toDOM` возвращает `HTMLElement`) несовместим с React-контекстом. Создание `createRoot` для каждого виджета слишком дорого.
Решение: **Render-as-you-type** с использованием React Portals.

**Data Flow:**
1.  **CodeMirror Parsing:** `ViewPlugin` находит паттерн (e.g., `[[Link]]`).
2.  **Widget Creation:** Создается `ReactBridgeWidget` (extending `WidgetType`).
    *   `toDOM()`: Создает пустой `span` с `dataset.portalId`.
    *   `portalStore.mount(id, container, Component, props)`: Регистрирует намерение рендера.
3.  **Batch Rendering:** Глобальный компонент `<EditorPortalRenderer />` (вне CodeMirror):
    *   Подписан на `portalStore` через `useSyncExternalStore`.
    *   Рендерит массив порталов: `{ portals.map(p => createPortal(<p.Component {...p.props} />, p.container)) }`.

**Performance Optimization:**
*   `eq(other)`: Виджеты сравниваются через Deep Props Comparison. Если пропсы не изменились, React-компонент не перерендеривается.
*   `ignoreEvent(event)`: Виджеты перехватывают события мыши в *Capture Phase*, чтобы CodeMirror не пытался пересчитать позицию курсора внутри React-DOM (что вызывает крэши `Invalid child in posBefore`).

### 3.2. Live Preview (Master Decorator)
Реализован через **один** ViewPlugin (`PortalViewPlugin`), вместо множества мелких плагинов.

**Logic (`view-plugin.ts`):**
*   Слушает `PortalRegistry` (Singleton).
*   В `update(view)` итерирует только `visibleRanges` (viewport).
*   Для каждого матча проверяет пересечение с `state.selection`.
    *   **Intersection = True:** Рендерит декорацию `Decoration.mark` (CSS-класс, показывающий исходник).
    *   **Intersection = False:** Рендерит `Decoration.replace` (PortalWidget).

---

## 4. The Synapse Engine (`nh.system.synapse`)

Система динамической загрузки сторонних расширений.

### 4.1. Security & Isolation
Synapse не использует `eval` напрямую, а полагается на **SystemJS**.

*   **Sandboxing:** Ограничен. Плагины исполняются в том же контексте (Main Thread), но модульная изоляция обеспечивается SystemJS.
*   **Format:**
    *   Dev: Директория с `manifest.json`.
    *   Prod: Артефакт `.nhp` (Zip-архив).
*   **In-Memory Loading (`ZipLoader`):**
    *   Архив `.nhp` читается в `ArrayBuffer`.
    *   `main.js` извлекается в Blob.
    *   Создается `Blob URL` (`blob:notehub/...`).
    *   SystemJS импортирует этот URL. **Файлы не пишутся на диск.**

### 4.2. Shared Scope Injection
Чтобы плагины могли использовать React и API ядра, не бандля их, Synapse инжектит зависимости в SystemJS registry перед загрузкой.

**Injectables (`ScopeInitializer.ts`):**
*   `react`, `react-dom`, `react-dom/client` -> Host React instances.
*   `@notehub/core`, `@notehub/api`, `@notehub/ui` -> Host Core instances.

Это позволяет плагинам писать `import { Button } from '@notehub/ui'`, и этот импорт разрешается в runtime в уже загруженную библиотеку ядра.

---

## 5. Platform Coupling Analysis

### 5.1. File System (I/O)
**Status:** 100% Decoupled.
*   Core использует интерфейс `IFileSystem` (`@notehub/fs-manager`).
*   `fs-driver-tauri` имплементирует его через `@tauri-apps/plugin-fs`.
*   При переезде на Electron потребуется только написать `fs-driver-electron`.

### 5.2. UI Layer
**Status:** Decoupled.
*   Весь UI построен на `@notehub/ui` (ck-standard), который является чистым React + CSS Modules.
*   Нет прямых вызовов нативных API окон в компонентах UI.

### 5.3. Identified Coupling Issues
В ходе аудита выявлены точечные нарушения абстракции:

1.  **Plugin `nh.features.about`:**
    *   *Issue:* Прямой импорт `@tauri-apps/api/app` для получения версии (см. `AboutView.tsx` L:14).
    *   *Risk:* Упадет в Web/Mobile версии.
    *   *Fix:* Вынести получение системной информации в `nh.system.platform-info` плагин.

2.  **Synapse `ZipLoader`:**
    *   *Issue:* Распаковка Zip происходит в Main Thread.
    *   *Risk:* Фризы UI при загрузке больших плагинов (>5MB).
    *   *Recommendation:* Перенос `ZipLoader` в Web Worker + `Comlink`.

---

## 6. Audit Conclusion & Roadmap

Система готова к масштабированию и внедрению новых платформ. Архитектура "Микроядро + Плагины" реализована канонично.

**Critical Path for Refactoring:**
1.  **Abstract Platform Info:** Создать сервис для абстракции `app.getVersion()`, `app.getName()` и т.д.
2.  **Hardening Synapse:** Внедрить Web Worker для распаковки `.nhp`.
3.  **Mobile Support:** Убедиться, что `fs-driver-capacitor` корректно обрабатывает `content://` URI (Android Scoped Storage), так как текущая архитектура полагается на POSIX-пути.

**Ready for R&D Handover.**
