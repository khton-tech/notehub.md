# Plugin Examples

Complete, working plugin examples you can use as templates.

---

## Example 1: Hello World (Minimal)

The simplest possible plugin.

### `manifest.json`

```json
{
    "id": "hello-world",
    "name": "Hello World",
    "version": "1.0.0"
}
```

### `src/index.ts`

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class HelloWorld extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        await ctx.invokeApi('logger:info', 'HelloWorld', '👋 Hello from my first plugin!');
        
        // Register a simple API
        ctx.registerApi('hello:greet', (name: string) => {
            return `Hello, ${name}!`;
        });
    }
    
    async onunload(): Promise<void> {
        console.log('Goodbye!');
    }
}
```

---

## Example 2: Word Counter Widget

A widget that counts words in the current paragraph.

### `manifest.json`

```json
{
    "id": "word-counter",
    "name": "Word Counter Widget",
    "version": "1.0.0"
}
```

### `src/index.ts`

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';
import React from 'react';

// Widget component
const WordCounter: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const text = match[1];
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const chars = text.length;
    
    return (
        <span style={{
            display: 'inline-flex',
            gap: '12px',
            padding: '4px 12px',
            background: 'var(--nh-bg-surface)',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'var(--nh-text-muted)',
            border: '1px solid var(--nh-border-subtle)',
        }}>
            <span>📝 {words} words</span>
            <span>📏 {chars} chars</span>
        </span>
    );
};

export default class WordCounterPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Match: {{count: any text here}}
        await ctx.invokeApi(
            'editor:register-widget',
            'word-counter',
            /\{\{count:\s*(.+?)\}\}/g,
            WordCounter
        );
        
        await ctx.invokeApi('logger:info', 'WordCounter', 'Widget registered');
    }
    
    async onunload(): Promise<void> {}
}
```

**Usage:**
```markdown
{{count: This is a sample text with exactly ten words total}}
```

---

## Example 3: Settings Plugin

A plugin with configurable settings.

### `manifest.json`

```json
{
    "id": "settings-demo",
    "name": "Settings Demo",
    "version": "1.0.0"
}
```

### `src/index.ts`

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class SettingsDemo extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Register settings tab
        await ctx.invokeApi('settings:register-tab', {
            id: 'settings-demo',
            label: 'Demo Settings',
            icon: 'sliders',
            order: 100
        });
        
        // Register group
        await ctx.invokeApi('settings:register-group', {
            id: 'demo-general',
            tabId: 'settings-demo',
            label: 'General Options',
            order: 0
        });
        
        // Register items
        await ctx.invokeApi('settings:register-items', [
            {
                key: 'settings-demo.enabled',
                type: 'toggle',
                label: 'Enable feature',
                description: 'Turn the demo feature on or off',
                groupId: 'demo-general',
                order: 0,
                defaultValue: true
            },
            {
                key: 'settings-demo.name',
                type: 'text',
                label: 'Your name',
                placeholder: 'Enter your name...',
                groupId: 'demo-general',
                order: 1,
                defaultValue: ''
            },
            {
                key: 'settings-demo.count',
                type: 'number',
                label: 'Item count',
                min: 1,
                max: 100,
                step: 1,
                groupId: 'demo-general',
                order: 2,
                defaultValue: 10
            },
            {
                key: 'settings-demo.mode',
                type: 'select',
                label: 'Display mode',
                options: [
                    { label: 'Compact', value: 'compact' },
                    { label: 'Normal', value: 'normal' },
                    { label: 'Expanded', value: 'expanded' }
                ],
                groupId: 'demo-general',
                order: 3,
                defaultValue: 'normal'
            },
            {
                key: 'settings-demo.color',
                type: 'color',
                label: 'Highlight color',
                groupId: 'demo-general',
                order: 4,
                defaultValue: '#3b82f6'
            }
        ]);
        
        // Read and use settings
        const enabled = await ctx.invokeApi<boolean>('config:get', 'settings-demo.enabled', true);
        const name = await ctx.invokeApi<string>('config:get', 'settings-demo.name', 'User');
        
        await ctx.invokeApi('logger:info', 'SettingsDemo', 
            `Loaded! enabled=${enabled}, name="${name}"`);
    }
    
    async onunload(): Promise<void> {}
}
```

---

## Example 4: Context Menu Extension

Add custom actions to file explorer context menu.

### `manifest.json`

```json
{
    "id": "quick-actions",
    "name": "Quick Actions",
    "version": "1.0.0"
}
```

### `src/index.ts`

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

interface FilePayload {
    path: string;
    isDirectory: boolean;
}

export default class QuickActionsPlugin extends NotehubPlugin {
    private ctx!: PluginContext;
    
    async onload(ctx: PluginContext): Promise<void> {
        this.ctx = ctx;
        
        await ctx.invokeApi(
            'context-menu:register',
            'explorer-item',
            (payload: FilePayload) => this.buildMenu(payload)
        );
        
        await ctx.invokeApi('logger:info', 'QuickActions', 'Context menu registered');
    }
    
    private buildMenu(payload: FilePayload) {
        const items = [];
        
        // Only for markdown files
        if (payload.path.endsWith('.md')) {
            items.push({
                type: 'action' as const,
                id: 'qa-word-count',
                label: 'Word Count',
                icon: 'hash',
                onClick: () => this.countWords(payload.path)
            });
            
            items.push({
                type: 'action' as const,
                id: 'qa-add-date',
                label: 'Add Today\'s Date',
                icon: 'calendar',
                onClick: () => this.addDate(payload.path)
            });
        }
        
        // For all files
        items.push({ type: 'separator' as const });
        
        items.push({
            type: 'action' as const,
            id: 'qa-copy-path',
            label: 'Copy Path',
            icon: 'copy',
            onClick: () => navigator.clipboard.writeText(payload.path)
        });
        
        // Duplicate action
        if (!payload.isDirectory) {
            items.push({
                type: 'action' as const,
                id: 'qa-duplicate',
                label: 'Duplicate File',
                icon: 'files',
                onClick: () => this.duplicateFile(payload.path)
            });
        }
        
        return items;
    }
    
    private async countWords(path: string) {
        const content = await this.ctx.invokeApi<string>('fs:read-text-file', path);
        const words = content.split(/\s+/).filter(w => w.length > 0).length;
        await this.ctx.invokeApi('dialog:alert', 'Word Count', `${words} words in this file`);
    }
    
    private async addDate(path: string) {
        const content = await this.ctx.invokeApi<string>('fs:read-text-file', path);
        const date = new Date().toISOString().split('T')[0];
        const newContent = `---\ndate: ${date}\n---\n\n${content}`;
        await this.ctx.invokeApi('fs:write-text-file', path, newContent);
        await this.ctx.invokeApi('dialog:alert', 'Success', 'Date added to file');
    }
    
    private async duplicateFile(path: string) {
        const content = await this.ctx.invokeApi<string>('fs:read-text-file', path);
        const newPath = path.replace(/\.md$/, ' (copy).md');
        await this.ctx.invokeApi('fs:write-text-file', newPath, content);
        await this.ctx.invokeApi('dialog:alert', 'Success', `Created: ${newPath}`);
    }
    
    async onunload(): Promise<void> {}
}
```

---

## Example 5: Full-Featured Plugin

A complete plugin combining widgets, settings, and context menus.

### `manifest.json`

```json
{
    "id": "task-tracker",
    "name": "Task Tracker",
    "version": "1.0.0"
}
```

### `src/index.ts`

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';
import React, { useState } from 'react';

// === Widget: Interactive Task Checkbox ===
const TaskWidget: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const status = match[1]; // 'x' or ' '
    const text = match[2];
    const [checked, setChecked] = useState(status === 'x');
    
    return (
        <span
            onClick={() => setChecked(!checked)}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 8px',
                background: checked ? 'var(--nh-accent-primary)20' : 'var(--nh-bg-surface)',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
            }}
        >
            <span style={{
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                border: `2px solid ${checked ? 'var(--nh-accent-primary)' : 'var(--nh-border-subtle)'}`,
                background: checked ? 'var(--nh-accent-primary)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '12px',
            }}>
                {checked && '✓'}
            </span>
            <span style={{
                textDecoration: checked ? 'line-through' : 'none',
                color: checked ? 'var(--nh-text-muted)' : 'var(--nh-text-primary)',
            }}>
                {text}
            </span>
        </span>
    );
};

// === Plugin Class ===
export default class TaskTracker extends NotehubPlugin {
    private ctx!: PluginContext;
    
    async onload(ctx: PluginContext): Promise<void> {
        this.ctx = ctx;
        
        // 1. Register widget
        await ctx.invokeApi(
            'editor:register-widget',
            'task-tracker:checkbox',
            /\[([x ])\]\s+(.+?)(?=\n|$)/g,
            TaskWidget
        );
        
        // 2. Register settings
        await ctx.invokeApi('settings:register-tab', {
            id: 'task-tracker',
            label: 'Task Tracker',
            icon: 'check-square',
            order: 50
        });
        
        await ctx.invokeApi('settings:register-group', {
            id: 'task-tracker-options',
            tabId: 'task-tracker',
            label: 'Options',
            order: 0
        });
        
        await ctx.invokeApi('settings:register-items', [
            {
                key: 'task-tracker.style',
                type: 'select',
                label: 'Checkbox style',
                options: [
                    { label: 'Round', value: 'round' },
                    { label: 'Square', value: 'square' }
                ],
                groupId: 'task-tracker-options',
                order: 0,
                defaultValue: 'square'
            },
            {
                key: 'task-tracker.strikethrough',
                type: 'toggle',
                label: 'Strikethrough completed',
                groupId: 'task-tracker-options',
                order: 1,
                defaultValue: true
            }
        ]);
        
        // 3. Register context menu
        await ctx.invokeApi(
            'context-menu:register',
            'explorer-item',
            (payload: { path: string }) => {
                if (!payload.path.endsWith('.md')) return [];
                
                return [
                    {
                        type: 'action' as const,
                        id: 'tt-count-tasks',
                        label: 'Count Tasks',
                        icon: 'list-checks',
                        onClick: () => this.countTasks(payload.path)
                    }
                ];
            }
        );
        
        await ctx.invokeApi('logger:info', 'TaskTracker', 'Plugin loaded successfully!');
    }
    
    private async countTasks(path: string) {
        const content = await this.ctx.invokeApi<string>('fs:read-text-file', path);
        const total = (content.match(/\[[x ]\]/g) || []).length;
        const done = (content.match(/\[x\]/g) || []).length;
        
        await this.ctx.invokeApi(
            'dialog:alert',
            'Task Summary',
            `${done}/${total} tasks completed (${Math.round(done/total*100)}%)`
        );
    }
    
    async onunload(): Promise<void> {
        await this.ctx.invokeApi('logger:info', 'TaskTracker', 'Plugin unloaded');
    }
}
```

**Usage in documents:**
```markdown
## Today's Tasks

[x] Review pull request
[ ] Write documentation
[ ] Deploy to production
```

---

## Build Configuration

### `package.json`

```json
{
    "name": "my-plugin",
    "version": "1.0.0",
    "type": "module",
    "scripts": {
        "build": "esbuild src/index.ts --bundle --format=esm --outfile=main.js --external:@notehub/api --external:react --external:react-dom",
        "watch": "npm run build -- --watch"
    },
    "devDependencies": {
        "@notehub/api": "file:../path/to/notehub/packages/api",
        "@types/react": "^18.2.0",
        "esbuild": "^0.20.0",
        "typescript": "^5.3.0"
    }
}
```

### `tsconfig.json`

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "lib": ["ES2020", "DOM"],
        "jsx": "react-jsx",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "declaration": false,
        "outDir": "./dist"
    },
    "include": ["src/**/*"]
}
```

---

## Tips for Development

1. **Use `npm run watch`** for automatic rebuilding
2. **Notehub auto-reloads** plugins when files change
3. **Open DevTools** (Ctrl+Shift+I) for console output
4. **Use `logger:info`** for structured logging
5. **Test incrementally** - add features one at a time
