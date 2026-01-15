# Widgets (Portals)

Portals are custom React components that render inline within the editor, replacing matched text patterns.

## How Portals Work

1. You define a **regex pattern** that matches text in the document
2. You provide a **React component** to render for each match
3. Notehub replaces matched text with your component in **view mode**
4. When the cursor enters the match, it switches to **edit mode** (shows source)

```
View Mode:     [████████░░] 80%     ← Your rendered component
Edit Mode:     [progress:80]        ← Source text visible when cursor inside
```

## Registering a Widget

Use the `editor:register-widget` API:

```typescript
await ctx.invokeApi(
    'editor:register-widget',
    'unique-id',           // Unique identifier
    /regex-pattern/g,      // Pattern to match (MUST have global flag 'g')
    ReactComponent         // Component to render
);
```

## Component Props

Your component receives the regex match array:

```typescript
interface WidgetProps {
    match: RegExpExecArray;
}
```

The `match` array contains:
- `match[0]` - Full matched string
- `match[1]`, `match[2]`, ... - Capture groups

## Complete Example: Progress Bar

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';
import React from 'react';

// Widget component
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

// Plugin
export default class ProgressBarPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Match: [progress:XX] where XX is a number
        await ctx.invokeApi(
            'editor:register-widget',
            'progress-bar',
            /\[progress:(\d+)\]/g,
            ProgressBar
        );
        
        await ctx.invokeApi('logger:info', 'ProgressBar', 'Widget registered');
    }
    
    async onunload(): Promise<void> {
        // Widget is automatically unregistered!
    }
}
```

**Usage in documents:**
```markdown
Project completion: [progress:75]
```

---

## Example: Clickable Button

```typescript
const ButtonWidget: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const label = match[1];
    const action = match[2];
    
    const handleClick = async () => {
        // You can't access ctx here directly, but you can use events
        // or call a registered API
        console.log(`Button clicked: ${action}`);
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

// Register
await ctx.invokeApi(
    'editor:register-widget',
    'btn-widget',
    /\[btn:([^\]:]+):([^\]]+)\]/g,
    ButtonWidget
);
```

**Usage:**
```markdown
Click here: [btn:Submit:action-submit]
```

---

## Example: Status Badge

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

await ctx.invokeApi(
    'editor:register-widget',
    'status-badge',
    /\[status:([^\]]+)\]/g,
    StatusBadge
);
```

**Usage:**
```markdown
Task 1 [status:Done]
Task 2 [status:In-Progress]
Task 3 [status:TODO]
```

---

## Regex Best Practices

### 1. Always use global flag (`g`)

```typescript
// ✅ Good
/\[progress:(\d+)\]/g

// ❌ Bad - won't match multiple occurrences
/\[progress:(\d+)\]/
```

### 2. Use capture groups for dynamic content

```typescript
// Captures two groups: label and value
/\[meter:([^:]+):(\d+)\]/g
// match[1] = label
// match[2] = value
```

### 3. Escape special characters

```typescript
// Match [!note] - brackets need escape
/\[!note\]/g
```

### 4. Be specific to avoid false matches

```typescript
// ✅ Good - specific pattern
/\[progress:(\d{1,3})\]/g

// ❌ Bad - too greedy
/\[.*\]/g  // Matches ALL bracketed content!
```

---

## Styling Tips

### Use CSS Variables

Access theme colors for consistent styling:

```typescript
style={{
    background: 'var(--nh-bg-surface)',
    color: 'var(--nh-text-primary)',
    border: '1px solid var(--nh-border-subtle)',
}}
```

Available CSS variables:
- `--nh-bg-main`, `--nh-bg-sidebar`, `--nh-bg-surface`
- `--nh-text-primary`, `--nh-text-secondary`, `--nh-text-muted`
- `--nh-accent-primary`, `--nh-accent-secondary`
- `--nh-border-accent`, `--nh-border-subtle`

### Keep it inline

Widgets render inline with text. Use `display: inline-flex` or `inline-block`:

```typescript
style={{
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
}}
```

---

## Interaction Handling

### Don't prevent default click behavior

Widgets exist inside CodeMirror. Avoid stopping event propagation:

```typescript
// ✅ Good - simple click handler
onClick={() => doSomething()}

// ⚠️ Caution with event manipulation
onClick={(e) => {
    e.stopPropagation(); // May cause issues!
    doSomething();
}}
```

### Use data attributes for identification

```typescript
<span data-widget-id="my-widget" data-value={match[1]}>
    ...
</span>
```

---

## Unregistering Widgets

Widgets are **automatically unregistered** when your plugin unloads.

For manual unregistration:

```typescript
await ctx.invokeApi('editor:unregister-widget', 'my-widget-id');
```

---

## Next Steps

- Add **[Settings](05-settings.md)** to configure your widgets
- Learn about **[Context Menus](06-context-menu.md)**
- See **[Complete Examples](07-examples.md)**
