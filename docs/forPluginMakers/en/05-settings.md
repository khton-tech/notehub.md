# Settings Integration

Add configuration options to your plugin with the Settings API.

## Settings Structure

Settings are organized in a hierarchy:

```
Settings Modal
└── Tab (e.g., "My Plugin")
    └── Group (e.g., "Appearance")
        └── Item (e.g., "Enable dark mode")
```

## Step 1: Register a Tab

```typescript
await ctx.invokeApi('settings:register-tab', {
    id: 'my-plugin',            // Unique identifier
    label: 'My Plugin',         // Display name
    icon: 'puzzle',             // Lucide icon name (kebab-case)
    order: 100                  // Position (lower = first)
});
```

## Step 2: Register a Group

```typescript
await ctx.invokeApi('settings:register-group', {
    id: 'my-plugin-general',    // Unique identifier
    tabId: 'my-plugin',         // Parent tab ID
    label: 'General',           // Display name
    order: 0                    // Position within tab
});
```

## Step 3: Register Items

### Toggle (Boolean)

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

### Text Input

```typescript
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.prefix',
    type: 'text',
    label: 'Custom prefix',
    description: 'Text to prepend to all items',
    placeholder: 'Enter prefix...',
    groupId: 'my-plugin-general',
    order: 1,
    defaultValue: ''
});
```

### Number Input

```typescript
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.max-items',
    type: 'number',
    label: 'Maximum items',
    description: 'Limit the number of items shown',
    groupId: 'my-plugin-general',
    order: 2,
    min: 1,
    max: 100,
    step: 1,
    defaultValue: 10
});
```

### Select (Dropdown)

```typescript
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.theme',
    type: 'select',
    label: 'Widget theme',
    description: 'Choose the visual style',
    groupId: 'my-plugin-general',
    order: 3,
    options: [
        { label: 'Default', value: 'default' },
        { label: 'Compact', value: 'compact' },
        { label: 'Minimal', value: 'minimal' }
    ],
    defaultValue: 'default'
});
```

### Color Picker

```typescript
await ctx.invokeApi('settings:register-item', {
    key: 'my-plugin.accent-color',
    type: 'color',
    label: 'Accent color',
    description: 'Primary color for highlights',
    groupId: 'my-plugin-general',
    order: 4,
    defaultValue: '#3b82f6'
});
```

---

## Reading Settings Values

Use the `config:get` API to read settings:

```typescript
const isEnabled = await ctx.invokeApi<boolean>('config:get', 'my-plugin.enabled', true);
const prefix = await ctx.invokeApi<string>('config:get', 'my-plugin.prefix', '');
const maxItems = await ctx.invokeApi<number>('config:get', 'my-plugin.max-items', 10);
const theme = await ctx.invokeApi<string>('config:get', 'my-plugin.theme', 'default');
const color = await ctx.invokeApi<string>('config:get', 'my-plugin.accent-color', '#3b82f6');
```

---

## Complete Example

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class ConfigurablePlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Register settings tab
        await ctx.invokeApi('settings:register-tab', {
            id: 'my-plugin',
            label: 'My Plugin',
            icon: 'settings-2',
            order: 100
        });
        
        // Register settings group
        await ctx.invokeApi('settings:register-group', {
            id: 'my-plugin-appearance',
            tabId: 'my-plugin',
            label: 'Appearance',
            order: 0
        });
        
        // Register settings items
        await ctx.invokeApi('settings:register-items', [
            {
                key: 'my-plugin.show-icons',
                type: 'toggle',
                label: 'Show icons',
                groupId: 'my-plugin-appearance',
                order: 0,
                defaultValue: true
            },
            {
                key: 'my-plugin.icon-size',
                type: 'select',
                label: 'Icon size',
                groupId: 'my-plugin-appearance',
                order: 1,
                options: [
                    { label: 'Small', value: 16 },
                    { label: 'Medium', value: 24 },
                    { label: 'Large', value: 32 }
                ],
                defaultValue: 24
            }
        ]);
        
        // Use settings values
        const showIcons = await ctx.invokeApi<boolean>('config:get', 'my-plugin.show-icons', true);
        const iconSize = await ctx.invokeApi<number>('config:get', 'my-plugin.icon-size', 24);
        
        await ctx.invokeApi('logger:info', 'MyPlugin', 
            `Settings: showIcons=${showIcons}, iconSize=${iconSize}`);
    }
    
    async onunload(): Promise<void> {
        // Settings items are automatically unregistered!
    }
}
```

---

## Batch Registration

For multiple items, use the batch APIs:

```typescript
// Register multiple tabs
await ctx.invokeApi('settings:register-tabs', [
    { id: 'tab1', label: 'Tab 1', icon: 'star', order: 0 },
    { id: 'tab2', label: 'Tab 2', icon: 'heart', order: 1 }
]);

// Register multiple groups
await ctx.invokeApi('settings:register-groups', [
    { id: 'group1', tabId: 'tab1', label: 'Group 1', order: 0 },
    { id: 'group2', tabId: 'tab1', label: 'Group 2', order: 1 }
]);

// Register multiple items
await ctx.invokeApi('settings:register-items', [/* items array */]);
```

---

## Custom Settings View

For complex settings UI, register a custom React component:

```typescript
const MyCustomSettings: React.FC = () => {
    return (
        <div>
            <h2>Custom Settings UI</h2>
            {/* Your custom settings interface */}
        </div>
    );
};

await ctx.invokeApi('settings:register-custom-view', {
    tabId: 'my-plugin',
    view: MyCustomSettings
});
```

---

## Programmatic Control

```typescript
// Open settings modal
await ctx.invokeApi('settings:open');

// Close settings modal
await ctx.invokeApi('settings:close');

// Toggle settings modal
await ctx.invokeApi('settings:toggle');
```

---

## Type Definitions

```typescript
interface SettingsTabDef {
    id: string;          // Unique identifier
    label: string;       // Display text
    icon: string;        // Lucide icon name
    order: number;       // Sort order
}

interface SettingsGroupDef {
    id: string;          // Unique identifier
    tabId: string;       // Parent tab ID
    label: string;       // Display text
    order: number;       // Sort order
}

interface SettingsItemDef {
    key: string;         // Config key (e.g., 'my-plugin.option')
    type: 'toggle' | 'text' | 'number' | 'select' | 'color';
    label: string;       // Display text
    description?: string;
    groupId: string;     // Parent group ID
    order: number;       // Sort order
    defaultValue?: unknown;
    
    // For 'text'
    placeholder?: string;
    
    // For 'number'
    min?: number;
    max?: number;
    step?: number;
    
    // For 'select'
    options?: Array<{ label: string; value: unknown }>;
}
```

---

## Next Steps

- Learn about **[Context Menu](06-context-menu.md)** integration
- See **[Complete Examples](07-examples.md)**
