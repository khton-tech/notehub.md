# Icon Manager Plugin

> `@notehub/icon-manager` - Centralized icon registry for Notehub.md

## Overview

The Icon Manager provides a centralized registry for icons, using [Lucide React](https://lucide.dev/) as the default icon set. Other plugins can register custom icons via the API.

## Available Icons (Core Set)

| Name          | Description               | Component     |
|---------------|---------------------------|---------------|
| `folder-open` | Open folder icon          | `FolderOpen`  |
| `info`        | Information circle        | `Info`        |
| `zap`         | Lightning bolt (actions)  | `Zap`         |
| `plus`        | Plus sign (add/create)    | `Plus`        |
| `settings`    | Gear icon                 | `Settings`    |
| `x`           | Close/cancel              | `X`           |
| `file-text`   | Document with text        | `FileText`    |
| `help-circle` | Help/unknown (fallback)   | `HelpCircle`  |

## Usage

### Using the Icon Component

```tsx
import { Icon } from '@notehub/icon-manager';

// Basic usage
<Icon name="folder-open" />

// With size and className
<Icon name="info" size={48} className="text-blue-400 mb-4" />

// Unknown icon falls back to HelpCircle
<Icon name="unknown-icon" size={24} />
```

### Registering Custom Icons

```ts
import type { LucideIcon } from 'lucide-react';
import { Star } from 'lucide-react';

// Register via API
app.api.invoke('icon:register', 'star', Star);
```

### Getting an Icon Component

```ts
const IconComponent = app.api.invoke('icon:get', 'folder-open');
// Use IconComponent in your JSX
```

## API

| Method          | Arguments                                  | Returns              | Description                     |
|-----------------|--------------------------------------------|----------------------|---------------------------------|
| `icon:register` | `name: string, component: React.ElementType` | `void`               | Register a custom icon          |
| `icon:get`      | `name: string`                             | `React.ElementType`  | Get icon component (or fallback)|

## Dependencies

- `lucide-react` - Icon library
- `nh.system.logger` - Logging

## License

MIT
