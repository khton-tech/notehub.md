# API Reference

Complete reference for all Notehub.md API methods available to plugins.

Use `ctx.invokeApi(methodName, ...args)` to call any of these methods.

---

## Logger API

Structured logging for debugging and monitoring.

### `logger:log`

Log a message with a specified level.

```typescript
await ctx.invokeApi('logger:log', level: string, source: string, message: string): void;
```

| Param | Type | Description |
|-------|------|-------------|
| `level` | `string` | Log level: 'info', 'warn', 'error' |
| `source` | `string` | Source identifier (usually plugin name) |
| `message` | `string` | Message to log |

### `logger:info`

Log an INFO level message.

```typescript
await ctx.invokeApi('logger:info', 'MyPlugin', 'Operation completed');
```

### `logger:warn`

Log a WARN level message.

```typescript
await ctx.invokeApi('logger:warn', 'MyPlugin', 'Config file not found, using defaults');
```

### `logger:error`

Log an ERROR level message.

```typescript
await ctx.invokeApi('logger:error', 'MyPlugin', 'Failed to load data');
```

---

## Config API

Persistent configuration stored on disk.

### `config:get`

Get a configuration value by key.

```typescript
const value = await ctx.invokeApi<T>('config:get', key: string, defaultValue?: T): T | undefined;
```

**Example:**
```typescript
const fontSize = await ctx.invokeApi<number>('config:get', 'editor.font-size', 14);
const theme = await ctx.invokeApi<string>('config:get', 'theme.current', 'dark');
```

### `config:set`

Set a configuration value (automatically persisted to disk).

```typescript
await ctx.invokeApi('config:set', 'my-plugin.option', true);
```

### `config:delete`

Delete a configuration value.

```typescript
await ctx.invokeApi('config:delete', 'my-plugin.option');
```

### `config:reload`

Reload configuration from disk.

```typescript
await ctx.invokeApi('config:reload');
```

---

## State API

Runtime state (not persisted - lost on restart).

### `state:set`

Store a value in runtime state.

```typescript
await ctx.invokeApi('state:set', 'my-plugin.cache', { data: [...] });
```

### `state:get`

Retrieve a value from runtime state.

```typescript
const cache = await ctx.invokeApi<MyData>('state:get', 'my-plugin.cache');
```

### `state:delete`

Delete a value from state.

```typescript
await ctx.invokeApi('state:delete', 'my-plugin.cache');
// Returns: boolean (true if deleted)
```

### `state:has`

Check if a key exists.

```typescript
const exists = await ctx.invokeApi<boolean>('state:has', 'my-plugin.cache');
```

### `state:keys`

Get all keys in state.

```typescript
const keys = await ctx.invokeApi<string[]>('state:keys');
```

### `state:clear`

Clear all state.

```typescript
await ctx.invokeApi('state:clear');
```

### `state:dump`

Export entire state as an object.

```typescript
const snapshot = await ctx.invokeApi<Record<string, unknown>>('state:dump');
```

### `state:restore`

Restore state from a dump object.

```typescript
await ctx.invokeApi('state:restore', snapshot);
```

---

## Filesystem API

Access files in the vault.

### `fs:read-text-file`

Read a file as UTF-8 text.

```typescript
const content = await ctx.invokeApi<string>('fs:read-text-file', '/path/to/file.md');
```

### `fs:read-file`

Read a file as binary data.

```typescript
const data = await ctx.invokeApi<Uint8Array>('fs:read-file', '/path/to/image.png');
```

### `fs:write-text-file`

Write text to a file.

```typescript
await ctx.invokeApi('fs:write-text-file', '/path/to/file.md', '# Hello World');
```

### `fs:write-file`

Write binary data to a file.

```typescript
await ctx.invokeApi('fs:write-file', '/path/to/file.bin', new Uint8Array([...]));
```

### `fs:exists`

Check if a path exists.

```typescript
const exists = await ctx.invokeApi<boolean>('fs:exists', '/path/to/file.md');
```

### `fs:read-dir`

Read directory contents.

```typescript
interface DirEntry {
    name: string;
    isDirectory: boolean;
    isFile: boolean;
}

const entries = await ctx.invokeApi<DirEntry[]>('fs:read-dir', '/path/to/folder');
```

### `fs:create-dir`

Create a directory.

```typescript
await ctx.invokeApi('fs:create-dir', '/path/to/new-folder', { recursive: true });
```

### `fs:remove-file`

Delete a file.

```typescript
await ctx.invokeApi('fs:remove-file', '/path/to/file.md');
```

### `fs:remove-dir`

Delete a directory.

```typescript
await ctx.invokeApi('fs:remove-dir', '/path/to/folder', { recursive: true });
```

### `fs:rename`

Rename or move a file/directory.

```typescript
await ctx.invokeApi('fs:rename', '/old/path.md', '/new/path.md');
```

### `fs:watch`

Watch a path for changes.

```typescript
interface FsEvent {
    path: string;
    type: 'create' | 'modify' | 'remove' | 'any';
}

const unwatch = await ctx.invokeApi<() => void>(
    'fs:watch', 
    '/path/to/folder', 
    (event: FsEvent) => {
        console.log('Change detected:', event);
    }
);

// Later: stop watching
unwatch();
```

### `fs:pick-directory`

Open native directory picker dialog.

```typescript
const path = await ctx.invokeApi<string | null>('fs:pick-directory');
if (path) {
    console.log('User selected:', path);
}
```

---

## Dialog API

Show modal dialogs to the user.

### `dialog:alert`

Show an alert message.

```typescript
await ctx.invokeApi('dialog:alert', 'Warning', 'File has been deleted');
```

### `dialog:confirm`

Show a confirmation dialog.

```typescript
const confirmed = await ctx.invokeApi<boolean>(
    'dialog:confirm', 
    'Delete File', 
    'Are you sure you want to delete this file?'
);

if (confirmed) {
    // User clicked OK
}
```

### `dialog:prompt`

Show a prompt for user input.

```typescript
const name = await ctx.invokeApi<string | null>(
    'dialog:prompt',
    'Rename File',
    'Enter new filename:',
    'untitled.md'  // default value
);

if (name !== null) {
    // User entered a value
}
```

---

## Theme API

Manage themes and colors.

### `theme:register`

Register a custom theme.

```typescript
const myPalette = {
    'bg-main': '#1a1a2e',
    'bg-sidebar': '#16213e',
    'bg-surface': '#0f3460',
    'text-primary': '#e6e6e6',
    'accent-primary': '#e94560',
    // ... more colors
    'font-family': 'Inter, sans-serif'
};

await ctx.invokeApi('theme:register', 'my-dark-theme', myPalette);
```

### `theme:set`

Apply a theme.

```typescript
const success = await ctx.invokeApi<boolean>('theme:set', 'my-dark-theme');
```

### `theme:get-current`

Get current theme name.

```typescript
const themeName = await ctx.invokeApi<string>('theme:get-current');
```

### `theme:list`

List all registered themes.

```typescript
const themes = await ctx.invokeApi<string[]>('theme:list');
// ['deep-space', 'light', 'my-dark-theme']
```

### `theme:get`

Get a theme palette by name.

```typescript
const palette = await ctx.invokeApi<ThemePalette | undefined>('theme:get', 'deep-space');
```

---

## Layout API

Manage application layouts and zones.

### `layout:register-component`

Register a layout component.

```typescript
const MyLayout: React.FC = () => <div>My Custom Layout</div>;
await ctx.invokeApi('layout:register-component', 'my-layout', MyLayout);
```

### `layout:set`

Set the active layout.

```typescript
await ctx.invokeApi('layout:set', 'editor-layout', { showSidebar: true });
```

### `layout:get-active`

Get current layout info.

```typescript
interface ActiveLayout {
    name: string;
    props: Record<string, unknown>;
}

const layout = await ctx.invokeApi<ActiveLayout | null>('layout:get-active');
```

### `layout:list`

List registered layouts.

```typescript
const layouts = await ctx.invokeApi<string[]>('layout:list');
```

### `zone:register`

Register a component in a layout zone.

```typescript
await ctx.invokeApi('zone:register', 'sidebar-top', {
    component: 'my-sidebar-widget',
    priority: 100  // Higher = rendered first
});
```

### `zone:get`

Get all items in a zone.

```typescript
const items = await ctx.invokeApi<ZoneItem[]>('zone:get', 'sidebar-top');
```

### `zone:clear`

Clear all items in a zone.

```typescript
await ctx.invokeApi('zone:clear', 'sidebar-top');
```

---

## Controller API

Register React components as named controllers.

### `controller:register`

Register a controller component.

```typescript
const MyComponent: React.FC = () => <div>Hello!</div>;
await ctx.invokeApi('controller:register', 'my-component', MyComponent);
```

### `controller:unregister`

Unregister a controller.

```typescript
await ctx.invokeApi('controller:unregister', 'my-component');
```

### `controller:get`

Get a controller by name.

```typescript
const Component = await ctx.invokeApi<React.FC>('controller:get', 'my-component');
```

---

## Icon API

Register and retrieve icons.

### `icon:register`

Register a custom icon.

```typescript
import { MyCustomIcon } from './icons';
await ctx.invokeApi('icon:register', 'my-icon', MyCustomIcon);
```

### `icon:get`

Get an icon component.

```typescript
const IconComponent = await ctx.invokeApi<React.ElementType>('icon:get', 'my-icon');
```

---

## Editor API

Register custom editor widgets (Portals).

### `editor:register-widget`

Register an inline widget that renders for regex matches.

```typescript
const ProgressBar: React.FC<{ match: RegExpExecArray }> = ({ match }) => {
    const progress = parseInt(match[1], 10);
    return <div style={{ width: `${progress}%` }} />;
};

await ctx.invokeApi(
    'editor:register-widget',
    'my-plugin:progress-bar',
    /\[progress:(\d+)\]/g,
    ProgressBar
);
```

### `editor:unregister-widget`

Unregister a widget (auto-cleaned on unload).

```typescript
await ctx.invokeApi('editor:unregister-widget', 'my-plugin:progress-bar');
```

See **[Widgets (Portals)](04-widgets.md)** for detailed widget documentation.

---

## Settings API

Add configuration UI to the Settings modal.

### `settings:register-tab`

Register a settings tab.

```typescript
await ctx.invokeApi('settings:register-tab', {
    id: 'my-plugin-settings',
    label: 'My Plugin',
    icon: 'puzzle',
    order: 100
});
```

### `settings:register-group`

Register a settings group within a tab.

```typescript
await ctx.invokeApi('settings:register-group', {
    id: 'my-plugin-general',
    tabId: 'my-plugin-settings',
    label: 'General Settings',
    order: 0
});
```

### `settings:register-item`

Register a settings item within a group.

```typescript
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.enabled',
    type: 'toggle',
    label: 'Enable plugin',
    description: 'Turn the plugin on or off',
    groupId: 'my-plugin-general',
    order: 0,
    defaultValue: true
});
```

See **[Settings Integration](05-settings.md)** for detailed settings documentation.

### `settings:open` / `settings:close` / `settings:toggle`

Control the settings modal.

```typescript
await ctx.invokeApi('settings:open');
await ctx.invokeApi('settings:close');
await ctx.invokeApi('settings:toggle');
```

---

## Context Menu API

Add items to right-click menus.

### `context-menu:register`

Register a menu provider for a context.

```typescript
const unsubscribe = await ctx.invokeApi<() => void>(
    'context-menu:register',
    'explorer-item',  // Context ID
    (payload: { path: string }) => [
        {
            type: 'action',
            id: 'my-action',
            label: 'My Custom Action',
            icon: 'star',
            onClick: () => {
                console.log('Clicked on:', payload.path);
            }
        }
    ]
);
```

See **[Context Menu](06-context-menu.md)** for detailed documentation.

---

## Explorer API

Control the file explorer.

### `explorer:open`

Open a folder in the explorer.

```typescript
await ctx.invokeApi('explorer:open', '/path/to/folder');
```

### `explorer:set-root`

Set the root path for the explorer.

```typescript
await ctx.invokeApi('explorer:set-root', '/new/vault/path');
```

---

## Synapse API

Manage external plugins programmatically.

### `synapse:load-plugin`

Load an external plugin from a path.

```typescript
interface SynapseLoadResult {
    success: boolean;
    pluginId?: string;
    error?: string;
}

const result = await ctx.invokeApi<SynapseLoadResult>(
    'synapse:load-plugin',
    '/path/to/plugin-folder'
);
```

### `synapse:unload-plugin`

Unload an external plugin.

```typescript
const success = await ctx.invokeApi<boolean>('synapse:unload-plugin', 'plugin-id');
```

### `synapse:list-plugins`

List loaded plugin IDs.

```typescript
const pluginIds = await ctx.invokeApi<string[]>('synapse:list-plugins');
```

### `synapse:get-details`

Get detailed metadata for all plugins.

```typescript
const details = await ctx.invokeApi<unknown[]>('synapse:get-details');
```

---

## Shell API

Open external resources.

### `shell:open`

Open a URL in the default browser.

```typescript
await ctx.invokeApi('shell:open', 'https://notehub.md');
```

---

## Vault API

Vault-level operations.

### `vault:close`

Close the current vault and return to welcome screen.

```typescript
await ctx.invokeApi('vault:close');
```

---

## Next Steps

- Learn to create **[Widgets (Portals)](04-widgets.md)**
- Add **[Settings](05-settings.md)** to your plugin
- Integrate with **[Context Menus](06-context-menu.md)**
