# Виджеты (Порталы)

Порталы — это кастомные React-компоненты, которые рендерятся инлайн в редакторе, заменяя совпадающие текстовые паттерны.

## Как работают порталы

1. Вы определяете **regex-паттерн**, который ищет текст в документе
2. Вы предоставляете **React-компонент** для рендеринга каждого совпадения
3. Notehub заменяет совпадающий текст вашим компонентом в **режиме просмотра**
4. Когда курсор входит в совпадение, переключается в **режим редактирования** (показывает исходный текст)

```
Режим просмотра:  [████████░░] 80%     ← Ваш отрендеренный компонент
Режим редактирования: [progress:80]   ← Исходный текст виден когда курсор внутри
```

## Регистрация портала

Используйте API `editor:register-portal`:

```typescript
await ctx.invokeApi('editor:register-portal', {
    id: 'unique-id',           // Уникальный идентификатор
    regex: /regex-pattern/g,   // Паттерн для поиска (ДОЛЖЕН иметь флаг 'g')
    component: ReactComponent  // Компонент для рендеринга
});
```

## Пропсы компонента

Ваш компонент получает массив результатов regex:

```typescript
interface WidgetProps {
    match: RegExpExecArray;
}
```

Массив `match` содержит:
- `match[0]` — Полная совпавшая строка
- `match[1]`, `match[2]`, ... — Захваченные группы

## Полный пример: Прогресс-бар

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';
import React from 'react';

// Компонент виджета
const ProgressBar: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const percentage = parseInt(match[1], 10);
    
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '2px 8px',
            background: 'var(--nh-bg-surface)',
            borderRadius: '4px',
        }}>
            <span style={{
                width: '100px',
                height: '8px',
                background: 'var(--nh-bg-secondary)',
                borderRadius: '4px',
                overflow: 'hidden',
            }}>
                <span style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: 'var(--nh-accent-primary)',
                    display: 'block',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                }} />
            </span>
            <span style={{ fontSize: '12px', color: 'var(--nh-text-muted)' }}>
                {percentage}%
            </span>
        </span>
    );
};

// Плагин
export default class ProgressBarPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Совпадение: [progress:XX] где XX — число
        await ctx.invokeApi('editor:register-portal', {
            id: 'progress-bar',
            regex: /\[progress:(\d+)\]/g,
            component: ProgressBar
        });
        
        await ctx.invokeApi('logger:info', 'ProgressBar', 'Портал зарегистрирован');
    }
    
    async onunload(): Promise<void> {
        // Портал автоматически отменяет регистрацию!
    }
}
```

**Использование в документах:**
```markdown
Завершенность проекта: [progress:75]
```

---

## Пример: Кликабельная кнопка

```typescript
const ButtonWidget: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const label = match[1];
    const action = match[2];
    
    const handleClick = async () => {
        console.log(`Кнопка нажата: ${action}`);
    };
    
    return (
        <button
            onClick={handleClick}
            style={{
                background: 'var(--nh-accent-primary)',
                color: 'var(--nh-button-text, #fff)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 12px',
                cursor: 'pointer',
                fontSize: 'inherit',
            }}
        >
            {label}
        </button>
    );
};

// Регистрация
await ctx.invokeApi('editor:register-portal', {
    id: 'btn-widget',
    regex: /\[btn:([^\]:]+):([^\]]+)\]/g,
    component: ButtonWidget
});
```

**Использование:**
```markdown
Нажмите сюда: [btn:Отправить:action-submit]
```

---

## Пример: Статус-бейдж

```typescript
const StatusBadge: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const status = match[1].toLowerCase();
    
    const colors: Record<string, { bg: string; text: string }> = {
        done: { bg: '#22c55e20', text: '#22c55e' },
        'in-progress': { bg: '#f59e0b20', text: '#f59e0b' },
        todo: { bg: '#6b728020', text: '#6b7280' },
    };
    
    const style = colors[status] || colors.todo;
    
    return (
        <span style={{
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 500,
            background: style.bg,
            color: style.text,
        }}>
            {match[1]}
        </span>
    );
};

await ctx.invokeApi('editor:register-portal', {
    id: 'status-badge',
    regex: /\[status:([^\]]+)\]/g,
    component: StatusBadge
});
```

**Использование:**
```markdown
Задача 1 [status:Done]
Задача 2 [status:In-Progress]
Задача 3 [status:TODO]
```

---

## Лучшие практики Regex

### 1. Всегда используйте глобальный флаг (`g`)

```typescript
// ✅ Хорошо
/\[progress:(\d+)\]/g

// ❌ Плохо — не найдет множественные вхождения
/\[progress:(\d+)\]/
```

### 2. Используйте группы захвата для динамического контента

```typescript
// Захватывает две группы: label и value
/\[meter:([^:]+):(\d+)\]/g
// match[1] = label
// match[2] = value
```

### 3. Экранируйте специальные символы

```typescript
// Совпадение [!note] — скобки нужно экранировать
/\[!note\]/g
```

### 4. Будьте конкретны, чтобы избежать ложных совпадений

```typescript
// ✅ Хорошо — конкретный паттерн
/\[progress:(\d{1,3})\]/g

// ❌ Плохо — слишком жадный
/\[.*\]/g  // Совпадает со ВСЕМ контентом в скобках!
```

---

## Советы по стилизации

### Используйте CSS-переменные

Используйте цвета темы для согласованной стилизации:

```typescript
style={{
    background: 'var(--nh-bg-surface)',
    color: 'var(--nh-text-primary)',
    border: '1px solid var(--nh-border-subtle)',
}}
```

Доступные CSS-переменные:
- `--nh-bg-main`, `--nh-bg-sidebar`, `--nh-bg-surface`
- `--nh-text-primary`, `--nh-text-secondary`, `--nh-text-muted`
- `--nh-accent-primary`, `--nh-accent-secondary`
- `--nh-border-accent`, `--nh-border-subtle`

### Держите это инлайн

Виджеты рендерятся встроенными в текст. Используйте `display: inline-flex` или `inline-block`:

```typescript
style={{
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
}}
```

---

## Отмена регистрации виджетов

Порталы **автоматически отменяют регистрацию** при выгрузке вашего плагина.

Для ручной отмены:

```typescript
await ctx.invokeApi('editor:unregister-portal', 'my-portal-id');
```

---

## Следующие шаги

- Добавьте **[Настройки](05-settings.md)** для конфигурации ваших виджетов
- Изучите **[Контекстные меню](06-context-menu.md)**
- Смотрите **[Полные примеры](07-examples.md)**
