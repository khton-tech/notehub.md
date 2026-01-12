# Plugin Architecture

This document explains how Notehub.md plugins work under the hood.

## Microkernel Architecture

Notehub.md follows a **microkernel** design where the core is minimal and all functionality comes from plugins:

```
┌─────────────────────────────────────────────────────────────┐
│                    NotehubCore                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  EventBus   │  │   ApiBus    │  │  Plugin Registry    │ │
│  │  (pub/sub)  │  │ (RPC calls) │  │  (lifecycle mgmt)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        ▲                 ▲                    ▲
        │                 │                    │
   ┌────┴───┐       ┌─────┴────┐        ┌─────┴────┐
   │ Logger │       │  Editor  │        │ Explorer │
   │ Plugin │       │  Plugin  │        │  Plugin  │
   └────────┘       └──────────┘        └──────────┘
```

## Plugin Types

### Internal Plugins (IPlugin)

Core features implement the `IPlugin` interface directly:

```typescript
interface IPlugin {
    readonly manifest: PluginManifest;
    load(app: NotehubCore): Promise<void> | void;
    onReady?(app: NotehubCore): Promise<void> | void;
    unload(app: NotehubCore): Promise<void> | void;
}
```

### External Plugins (NotehubPlugin)

Your plugins extend `NotehubPlugin` and use `PluginContext`:

```typescript
abstract class NotehubPlugin {
    abstract onload(ctx: PluginContext): Promise<void> | void;
    abstract onunload(): Promise<void> | void;
}
```

The key difference: **external plugins get automatic cleanup** via `PluginContext`!

---

## Plugin Lifecycle

```
┌──────────────────────────────────────────────────────────┐
│                  Plugin Lifecycle                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. DISCOVERY                                            │
│     └─ Synapse scans .notehub/plugins/ folder            │
│     └─ Reads manifest.json for each plugin               │
│                                                          │
│  2. LOADING                                              │
│     └─ SystemJS imports the main.js module               │
│     └─ Plugin class is instantiated                      │
│     └─ PluginContext is created (for external plugins)   │
│                                                          │
│  3. INITIALIZATION (onload)                              │
│     └─ Plugin registers APIs                             │
│     └─ Plugin subscribes to events                       │
│     └─ Plugin sets up UI components                      │
│                                                          │
│  4. RUNNING                                              │
│     └─ Plugin responds to events                         │
│     └─ Plugin handles API calls                          │
│                                                          │
│  5. UNLOADING (onunload)                                 │
│     └─ Plugin performs manual cleanup (optional)         │
│     └─ PluginContext auto-cleans registrations           │
│     └─ SystemJS module is unregistered                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## PluginContext

The `PluginContext` is your gateway to the Notehub ecosystem:

```typescript
interface PluginContext {
    // Register an API that other plugins can call
    registerApi(name: string, handler: (...args: unknown[]) => unknown): void;
    
    // Call an API registered by any plugin
    invokeApi<T>(name: string, ...args: unknown[]): Promise<T>;
    
    // Subscribe to application events
    subscribe<T>(event: string, handler: (payload: T) => void): void;
}
```

### Auto-Cleanup Magic

When your plugin is unloaded, `PluginContext` automatically:

- ✅ Unregisters all APIs you registered
- ✅ Unsubscribes from all events
- ✅ Removes editor widgets you registered
- ✅ Removes settings tabs/groups/items you added

**You don't need to manually clean these up!**

---

## Communication Patterns

### 1. EventBus (Pub/Sub)

For **broadcasting** information to multiple listeners:

```typescript
// Subscribe to an event
ctx.subscribe<{ path: string }>('explorer:file-selected', (payload) => {
    console.log('File selected:', payload.path);
});

// Events are emitted by plugins internally
// External plugins can only subscribe, not emit
```

Common events:
- `explorer:file-selected` - User clicked a file
- `editor:file-opened` - File content loaded
- `editor:file-closed` - Editor cleared
- `vault:opened` - Vault was opened
- `vault:closed` - Vault was closed

### 2. ApiBus (RPC)

For **direct method calls** between plugins:

```typescript
// Register an API
ctx.registerApi('my-plugin:calculate', (a: number, b: number) => a + b);

// Invoke someone else's API
const result = await ctx.invokeApi<number>('my-plugin:calculate', 5, 3);
// result = 8

// All core APIs are available via invokeApi
const content = await ctx.invokeApi<string>('fs:read-text-file', '/path/to/file.md');
```

---

## Dependency Resolution

Plugins can declare dependencies in `manifest.json`:

```json
{
    "id": "my-plugin",
    "dependencies": ["nh.features.editor"]
}
```

The bootloader ensures dependencies load before your plugin.

**Note:** For external plugins, core plugins are always available. You typically don't need to declare dependencies unless you depend on another external plugin.

---

## Hot Reload

Notehub watches the plugins folder. When a file changes:

1. **Detect** - File watcher triggers on `.js` or `manifest.json` change
2. **Unload** - Old plugin version is unloaded (calls `onunload()`)
3. **Cleanup** - PluginContext removes all registrations
4. **Reload** - New version is loaded (calls `onload()`)

This enables **rapid development** without restarting Notehub!

---

## Best Practices

### 1. Namespace your APIs

```typescript
// ✅ Good - namespaced
ctx.registerApi('my-plugin:do-something', handler);

// ❌ Bad - may conflict
ctx.registerApi('do-something', handler);
```

### 2. Handle errors gracefully

```typescript
async onload(ctx: PluginContext): Promise<void> {
    try {
        const data = await ctx.invokeApi('fs:read-text-file', '/config.json');
        // ...
    } catch (error) {
        await ctx.invokeApi('logger:error', 'MyPlugin', `Failed to load: ${error}`);
    }
}
```

### 3. Use TypeScript for better IntelliSense

The `@notehub/api` package includes full type definitions for all APIs.

### 4. Keep onload() fast

Don't block initialization with heavy work. Use async patterns or defer work.

---

## Next Steps

See the complete **[API Reference](03-api-reference.md)** for all available methods.
