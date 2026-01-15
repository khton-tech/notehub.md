# 🔍 Аудит плагин-системы Synapse

> Дата: 15 января 2026  
> Версия: 1.0

---

## Резюме

Проведён полный аудит системы загрузки плагинов Synapse, CLI инструментов и документации. Обнаружены критические рассинхронизации между документацией, API контрактом и реализацией.

---

## 🔴 Критические проблемы

### 1. Рассинхронизация API контракта

**Расположение проблемы:**
- Контракт: `packages/api/src/contract.ts` (строка 618)
- Реализация: `packages/plugins/features/editor/src/index.tsx` (строка 317)

**Суть проблемы:**

| Место | API | Сигнатура |
|-------|-----|-----------|
| `contract.ts` | `editor:register-widget` | `(id, regex, component)` — 3 аргумента |
| Реализация | `editor:register-portal` | `(spec: PortalSpec)` — 1 объект |

**Влияние:** 
- AI-агенты используют документацию → генерируют код с неверным API
- Плагины падают с ошибкой `Handler "editor:register-widget" is not registered`

---

### 2. Некорректный auto-cleanup виджетов

**Файл:** `packages/plugins/system/synapse/src/logic/PluginContextImpl.ts`

```typescript
// Строка 94-98: Перехватывает несуществующий API!
if (name === 'editor:register-widget' && typeof args[0] === 'string') {
    const widgetId = args[0];
    this.registeredWidgets.push(widgetId);
}
```

**Проблема:**
- `PluginContextImpl` отслеживает `editor:register-widget` для автоочистки
- Но этот API не существует в реальной системе
- Используется `editor:register-portal` с объектной сигнатурой

**Влияние:**
- При выгрузке плагина виджеты НЕ удаляются автоматически
- Потенциальные memory leaks и "зомби-виджеты"

---

### 3. Устаревшая документация

**Затронутые файлы:**

| Файл | Проблема |
|------|----------|
| `packages/cli/templates/PLUGIN_GUIDE.md` | Устаревший API с 3 аргументами |
| `packages/cli/templates/PLUGIN_GUIDE_RU.md` | То же самое на русском |
| `docs/forPluginMakers/en/*.md` | Потенциально устаревшие примеры |
| `docs/forPluginMakers/ru/*.md` | Потенциально устаревшие примеры |

---

## ✅ Рекомендуемые исправления

### Шаг 1: Исправить API контракт

**Файл:** `packages/api/src/contract.ts`

```diff
+ // Добавить тип
+ export interface PortalSpec {
+     id: string;
+     regex: RegExp;
+     component: FC<{ match: RegExpExecArray }>;
+     name?: string;
+ }

  // Заменить устаревший API
- 'editor:register-widget': (id: string, regex: RegExp | string, component: FC<...>) => void;
- 'editor:unregister-widget': (id: string) => void;
+ 'editor:register-portal': (spec: PortalSpec) => void;
+ 'editor:unregister-portal': (id: string) => void;
```

---

### Шаг 2: Исправить PluginContextImpl

**Файл:** `packages/plugins/system/synapse/src/logic/PluginContextImpl.ts`

```diff
  // Исправить перехват (строка 94)
- if (name === 'editor:register-widget' && typeof args[0] === 'string') {
-     const widgetId = args[0];
+ if (name === 'editor:register-portal' && args[0] && typeof (args[0] as any).id === 'string') {
+     const widgetId = (args[0] as any).id;

  // Исправить cleanup (строка 196)
- this.app.api.invoke('editor:unregister-widget', widgetId)
+ this.app.api.invoke('editor:unregister-portal', widgetId)
```

---

### Шаг 3: Добавить unregister API в редактор

**Файл:** `packages/plugins/features/editor/src/index.tsx`

```typescript
// После регистрации register-portal добавить:
app.api.register('editor:unregister-portal', (id: string) => {
    PortalRegistry.getInstance().unregister(id);
    this.log('info', `Unregistered portal: ${id}`);
});

// Исправить unload (строка 414-415):
app.api.unregister('editor:register-portal');
app.api.unregister('editor:unregister-portal');
```

---

### Шаг 4: Обновить документацию

**Правильный пример использования:**

```typescript
import { NotehubPlugin, PluginContext } from '@notehub.md/api';
import React from 'react';

const MyCatIcon: React.FC<{ match: RegExpExecArray }> = () => {
    return React.createElement('span', {
        style: { color: 'var(--nh-accent-primary)' }
    }, '🐱');
};

class MyPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // ✅ ПРАВИЛЬНО: Передаём объект PortalSpec
        await ctx.invokeApi('editor:register-portal', {
            id: 'my-plugin:cat',
            regex: /:cat:/g,
            component: MyCatIcon
        });
    }

    async onunload(): Promise<void> {}
}

export default new MyPlugin();
```

---

## 📋 Дополнительные рекомендации

### Для стабильности Synapse

1. **Валидация манифеста** — добавить JSON Schema для `manifest.json`
2. **Проверка зависимостей** — валидировать что все `dependencies` существуют до загрузки
3. **Graceful degradation** — показывать понятные ошибки при неверной сигнатуре API

### Для документации

1. **Минимальный рабочий пример** в начале каждого гайда
2. **Таблица актуальных API** с правильными сигнатурами
3. **Changelog** при изменении API

---

## 📊 Затронутые файлы (сводка)

```
packages/api/src/contract.ts                                    [ИЗМЕНИТЬ]
packages/plugins/system/synapse/src/logic/PluginContextImpl.ts  [ИЗМЕНИТЬ]
packages/plugins/features/editor/src/index.tsx                  [ИЗМЕНИТЬ]
packages/cli/templates/PLUGIN_GUIDE.md                          [ИЗМЕНИТЬ]
packages/cli/templates/PLUGIN_GUIDE_RU.md                       [ИЗМЕНИТЬ]
docs/forPluginMakers/en/04-widgets.md                           [ИЗМЕНИТЬ]
docs/forPluginMakers/ru/04-widgets.md                           [ИЗМЕНИТЬ]
```

---

## ❓ Открытые вопросы

1. Нужна ли обратная совместимость со старым API `editor:register-widget`?
2. Есть ли unit-тесты для Synapse/PluginLoader?
3. Какие ещё плагины используют widget API (нужен ли массовый рефакторинг)?
