# Context Menu Integration

Add custom items to right-click menus throughout Notehub.

## Overview

Context menus are dynamic - providers are called when the menu is triggered and can return different items based on what was clicked.

## Registering a Menu Provider

```typescript
const unsubscribe = await ctx.invokeApi<() => void>(
    'context-menu:register',
    contextId,     // Where the menu appears
    provider       // Function that returns menu items
);
```

## Context IDs

| Context ID | Triggered On | Payload |
|------------|-------------|---------|
| `explorer-item` | File/folder in explorer | `{ path: string, isDirectory: boolean }` |

## Menu Item Types

### Action

A clickable menu item:

```typescript
{
    type: 'action',
    id: 'my-action',           // Unique identifier
    label: 'My Action',        // Display text
    icon: 'star',              // Lucide icon (optional)
    color: 'var(--nh-danger)', // CSS color (optional)
    disabled: false,           // Grey out if true
    onClick: (payload) => {
        // Handle click
    }
}
```

### Separator

A visual divider:

```typescript
{
    type: 'separator'
}
```

### Submenu

Nested menu items:

```typescript
{
    type: 'submenu',
    label: 'More Options',
    icon: 'more-horizontal',
    items: [
        { type: 'action', id: 'sub-1', label: 'Option 1', onClick: () => {} },
        { type: 'action', id: 'sub-2', label: 'Option 2', onClick: () => {} }
    ]
}
```

---

## Complete Example

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

interface ExplorerPayload {
    path: string;
    isDirectory: boolean;
}

export default class ContextMenuPlugin extends NotehubPlugin {
    private unsubscribe?: () => void;
    
    async onload(ctx: PluginContext): Promise<void> {
        // Register menu provider for explorer items
        this.unsubscribe = await ctx.invokeApi(
            'context-menu:register',
            'explorer-item',
            (payload: ExplorerPayload) => this.getMenuItems(payload, ctx)
        );
    }
    
    private getMenuItems(payload: ExplorerPayload, ctx: PluginContext) {
        const items = [];
        
        // Only show for markdown files
        if (payload.path.endsWith('.md')) {
            items.push({
                type: 'action' as const,
                id: 'count-words',
                label: 'Count Words',
                icon: 'hash',
                onClick: async () => {
                    const content = await ctx.invokeApi<string>(
                        'fs:read-text-file', 
                        payload.path
                    );
                    const wordCount = content.split(/\s+/).length;
                    await ctx.invokeApi(
                        'dialog:alert',
                        'Word Count',
                        `${wordCount} words`
                    );
                }
            });
        }
        
        // Separator
        if (items.length > 0) {
            items.push({ type: 'separator' as const });
        }
        
        // Add a submenu with export options
        items.push({
            type: 'submenu' as const,
            label: 'Export As',
            icon: 'file-output',
            items: [
                {
                    type: 'action' as const,
                    id: 'export-txt',
                    label: 'Plain Text',
                    onClick: () => this.exportAs(payload.path, 'txt', ctx)
                },
                {
                    type: 'action' as const,
                    id: 'export-html',
                    label: 'HTML',
                    onClick: () => this.exportAs(payload.path, 'html', ctx)
                }
            ]
        });
        
        // Dangerous action (shows in red)
        items.push({
            type: 'action' as const,
            id: 'archive',
            label: 'Move to Archive',
            icon: 'archive',
            color: 'var(--nh-danger)',
            onClick: () => this.archiveFile(payload.path, ctx)
        });
        
        return items;
    }
    
    private async exportAs(path: string, format: string, ctx: PluginContext) {
        await ctx.invokeApi('logger:info', 'ContextMenu', `Exporting ${path} as ${format}`);
    }
    
    private async archiveFile(path: string, ctx: PluginContext) {
        const confirmed = await ctx.invokeApi<boolean>(
            'dialog:confirm',
            'Archive File',
            `Move ${path} to archive?`
        );
        if (confirmed) {
            // Move file logic
        }
    }
    
    async onunload(): Promise<void> {
        // Manual cleanup (optional - auto-cleaned on unload)
        this.unsubscribe?.();
    }
}
```

---

## Dynamic Menu Items

Menu providers are called every time the menu opens. You can return different items based on:

### File Type

```typescript
(payload: ExplorerPayload) => {
    if (payload.path.endsWith('.md')) {
        return [/* markdown-specific items */];
    } else if (payload.path.endsWith('.png')) {
        return [/* image-specific items */];
    }
    return [/* generic items */];
}
```

### Directory vs File

```typescript
(payload: ExplorerPayload) => {
    if (payload.isDirectory) {
        return [
            { type: 'action', id: 'new-file', label: 'New File Here', ... }
        ];
    }
    return [
        { type: 'action', id: 'duplicate', label: 'Duplicate File', ... }
    ];
}
```

### Async Providers

Providers can be async:

```typescript
async (payload: ExplorerPayload) => {
    const metadata = await loadMetadata(payload.path);
    return [/* items based on metadata */];
}
```

---

## Icon Reference

Icons use [Lucide](https://lucide.dev/icons/) icon names in kebab-case:

| Icon Name | Description |
|-----------|-------------|
| `file` | Generic file |
| `folder` | Folder |
| `star` | Star/favorite |
| `trash-2` | Delete/trash |
| `copy` | Copy |
| `scissors` | Cut |
| `clipboard` | Paste |
| `edit` | Edit |
| `eye` | View |
| `download` | Download |
| `upload` | Upload |
| `archive` | Archive |
| `more-horizontal` | More options |

---

## Type Definitions

```typescript
type MenuItem = MenuAction | MenuSeparator | SubMenu;

interface MenuAction {
    type: 'action';
    id: string;
    label: string;
    icon?: string;
    color?: string;
    disabled?: boolean;
    onClick: (payload: unknown) => void;
}

interface MenuSeparator {
    type: 'separator';
}

interface SubMenu {
    type: 'submenu';
    label: string;
    icon?: string;
    items: MenuItem[];
}

type MenuProvider = (payload: unknown) => MenuItem[] | Promise<MenuItem[]>;
```

---

## Next Steps

- See **[Complete Examples](07-examples.md)** for full plugin code
