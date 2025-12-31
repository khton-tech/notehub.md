# Аудит настроек плагинов Notehub.md

**Дата:** 31 декабря 2025
**Цель:** Анализ экосистемы плагинов для интеграции с `config-manager`

---

## Обзор

Проведён анализ всех 16 плагинов в экосистеме Notehub.md для выявления:
1. Плагинов, которые уже используют `config-manager`
2. Плагинов, которым необходимо добавить интеграцию
3. Потенциальных настроек для каждого плагина

---

## Категории плагинов

| Категория   | Плагины                                                                 |
|-------------|-------------------------------------------------------------------------|
| **system**  | bootloader, config-manager, fs-driver-tauri, fs-manager, logger, state-manager |
| **features**| editor, explorer, vault-picker, workbench                               |
| **ui**      | ck-standard, controllers-manager, dialog-manager, icon-manager, layout-manager, theme-manager |
| **portals** | button-widget, pp-base                                                  |

---

## Текущее использование config-manager

### ✅ Плагины, уже использующие config-manager

#### 1. `nh.ui.theme-manager`
| Ключ конфига        | Тип      | Описание                        |
|---------------------|----------|---------------------------------|
| `theme.current`     | `string` | Имя текущей активной темы       |

**Зависимость объявлена:** ✅ Да  
**Использование:**  

```typescript
// Сохранение
await this.app.api.invoke('config:set', CONFIG_KEY_CURRENT_THEME, name);

// Чтение
const savedTheme = await app.api.invoke<string | undefined>('config:get', CONFIG_KEY_CURRENT_THEME, 'deep-space');
```

---

#### 2. `nh.features.vault-picker`
| Ключ конфига         | Тип                 | Описание                                |
|----------------------|---------------------|-----------------------------------------|
| `vault.history`      | `VaultHistoryEntry[]` | Массив недавно открытых хранилищ (макс. 10) |
| `vault.last-opened`  | `string`            | Путь к последнему открытому хранилищу   |

**Зависимость объявлена:** ✅ Да  
**Использование:**

```typescript
// Сохранение истории
await this.app.api.invoke('config:set', 'vault.history', newHistory);

// Сохранение последнего хранилища
await this.app.api.invoke('config:set', 'vault.last-opened', fullPath);

// Чтение
const history = await this.app.api.invoke<VaultHistoryEntry[]>('config:get', 'vault.history');
const result = await this.app.api.invoke<string | undefined>('config:get', 'vault.last-opened');

// Удаление при закрытии
await this.app.api.invoke('config:delete', 'vault.last-opened');
```

---

#### 3. `nh.features.workbench`
| Ключ конфига        | Тип      | Описание                        |
|---------------------|----------|---------------------------------|
| `vault.last-opened` | `string` | Чтение для auto-login           |

**Зависимость объявлена:** ❌ Нет (использует опосредованно через vault-picker)  
**Использование:**

```typescript
const lastOpened = await app.api.invoke('config:get', 'vault.last-opened') as string;
```

> [!WARNING]
> Workbench читает `vault.last-opened`, но не объявляет зависимость от `config-manager`.

---

## Плагины, требующие интеграции

### 🔴 Высокий приоритет

#### `nh.features.editor`

**Текущий статус:** ❌ Не использует config-manager  
**Зависимость:** Отсутствует

**Рекомендуемые настройки:**

| Ключ конфига              | Тип       | По умолчанию   | Описание                           |
|---------------------------|-----------|----------------|------------------------------------|
| `editor.font-family`      | `string`  | `monospace`    | Семейство шрифтов редактора       |
| `editor.font-size`        | `number`  | `16`           | Размер шрифта (px)                |
| `editor.line-height`      | `number`  | `1.6`          | Междустрочный интервал            |
| `editor.tab-size`         | `number`  | `4`            | Размер табуляции                  |
| `editor.word-wrap`        | `boolean` | `true`         | Перенос длинных строк             |
| `editor.show-line-numbers`| `boolean` | `false`        | Отображение номеров строк         |
| `editor.auto-save`        | `boolean` | `true`         | Автосохранение                    |
| `editor.auto-save-delay`  | `number`  | `1000`         | Задержка автосохранения (мс)      |
| `editor.spell-check`      | `boolean` | `false`        | Проверка орфографии               |
| `editor.live-preview`     | `boolean` | `true`         | Режим live preview                |

> [!IMPORTANT]
> Редактор — ключевой компонент приложения. Интеграция настроек критически важна для пользовательского опыта.

---

### 🟡 Средний приоритет

#### `nh.features.explorer`

**Текущий статус:** ❌ Не использует config-manager  
**Зависимость:** Отсутствует

**Рекомендуемые настройки:**

| Ключ конфига                 | Тип       | По умолчанию | Описание                          |
|------------------------------|-----------|--------------|-----------------------------------|
| `explorer.show-hidden`       | `boolean` | `false`      | Показывать скрытые файлы          |
| `explorer.sort-by`           | `string`  | `name`       | Сортировка: name, date, size      |
| `explorer.sort-order`        | `string`  | `asc`        | Порядок: asc, desc                |
| `explorer.folders-first`     | `boolean` | `true`       | Папки отображаются первыми        |
| `explorer.collapse-state`    | `object`  | `{}`         | Состояние свёрнутых папок         |

---

#### `nh.system.logger`

**Текущий статус:** ❌ Не использует config-manager  
**Зависимость:** Отсутствует

**Рекомендуемые настройки:**

| Ключ конфига          | Тип      | По умолчанию | Описание                       |
|-----------------------|----------|--------------|--------------------------------|
| `logger.level`        | `string` | `INFO`       | Минимальный уровень: LOG, INFO, WARN, ERROR |
| `logger.persist-to-file` | `boolean` | `false` | Запись логов в файл            |

---

### 🟢 Низкий приоритет

#### `nh.ui.layout-manager`

**Потенциальные настройки:**

| Ключ конфига              | Тип      | Описание                        |
|---------------------------|----------|---------------------------------|
| `layout.sidebar-width`    | `number` | Ширина боковой панели (px)      |
| `layout.sidebar-collapsed`| `boolean`| Состояние свёрнутости           |

---

#### `nh.portals.pp-base`

**Потенциальные настройки:**

| Ключ конфига                   | Тип       | Описание                       |
|--------------------------------|-----------|--------------------------------|
| `preview.enable-checkboxes`    | `boolean` | Интерактивные чекбоксы         |
| `preview.enable-callouts`      | `boolean` | Рендеринг callout-блоков       |
| `preview.enable-headings`      | `boolean` | Визуальное форматирование заголовков |

---

## Плагины, НЕ требующие настроек

| Плагин                     | Причина                                              |
|----------------------------|------------------------------------------------------|
| `nh.system.bootloader`     | Системный загрузчик, нет пользовательских настроек |
| `nh.system.config-manager` | Сам является провайдером настроек                    |
| `nh.system.fs-driver-tauri`| Драйвер файловой системы, детерминированный         |
| `nh.system.fs-manager`     | Абстракция FS, нет настроек                         |
| `nh.system.state-manager`  | Хранит runtime-состояние, не конфиг                 |
| `nh.ui.ck-standard`        | UI-компоненты, стилизация через тему                |
| `nh.ui.controllers-manager`| Реестр контроллеров, нет настроек                   |
| `nh.ui.dialog-manager`     | Менеджер диалогов, нет настроек                     |
| `nh.ui.icon-manager`       | Реестр иконок, нет настроек                         |
| `nh.portals.button-widget` | Виджет кнопки, стилизация через тему                |

---

## Рекомендации по реализации

### 1. Добавить зависимость в `manifest.json`

```json
{
    "dependencies": [
        "nh.system.config-manager"
    ]
}
```

### 2. Паттерн инициализации настроек

```typescript
async load(app: NotehubCore): Promise<void> {
    // Загрузить настройки с дефолтами
    const fontSize = await app.api.invoke<number>('config:get', 'editor.font-size', 16);
    const wordWrap = await app.api.invoke<boolean>('config:get', 'editor.word-wrap', true);
    
    // Применить настройки
    this.applySettings({ fontSize, wordWrap });
    
    // Подписаться на изменения
    app.events.on('config:updated', (payload) => {
        if (payload.key.startsWith('editor.')) {
            this.handleSettingChange(payload.key, payload.value);
        }
    });
}
```

### 3. Конвенция именования ключей

```
{plugin-category}.{short-name}
```

Примеры:
- `editor.font-size`
- `explorer.show-hidden`
- `theme.current`
- `vault.history`

---

## Сводная таблица

| Плагин              | Статус       | Приоритет | Кол-во настроек |
|---------------------|--------------|-----------|-----------------|
| theme-manager       | ✅ Интегрирован | —         | 1               |
| vault-picker        | ✅ Интегрирован | —         | 2               |
| workbench           | ⚠️ Частично   | Средний   | 0 (чтение)      |
| **editor**          | ❌ Требуется  | **Высокий** | **10**          |
| explorer            | ❌ Требуется  | Средний   | 5               |
| logger              | ❌ Требуется  | Низкий    | 2               |
| layout-manager      | ❌ Опционально | Низкий    | 2               |
| pp-base             | ❌ Опционально | Низкий    | 3               |

---

## Следующие шаги

1. **Исправить workbench** — добавить зависимость от `config-manager` в manifest.json
2. **Интегрировать editor** — высший приоритет, много пользовательских настроек
3. **Интегрировать explorer** — улучшит UX файлового навигатора
4. **Создать UI для настроек** — страница Settings в приложении
