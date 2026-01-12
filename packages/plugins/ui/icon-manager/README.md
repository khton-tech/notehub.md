<h1 align="center">🎨 Icon Manager Plugin</h1>

<p align="center">
  <code>nh.ui.icon-manager</code> • UI • Centralized icon registry
</p>

---

## Overview

Централизованный реестр иконок на базе [Lucide React](https://lucide.dev/). Плагины могут регистрировать свои иконки через API.

---

## 📦 Core Icons

| Name | Component | Usage |
|------|-----------|-------|
| `folder-open` | FolderOpen | Explorer |
| `file-text` | FileText | Files |
| `settings` | Settings | Settings |
| `plus` | Plus | Create actions |
| `x` | X | Close/cancel |
| `info` | Info | Information |
| `zap` | Zap | Actions |
| `help-circle` | HelpCircle | Fallback |

---

## 🔌 API Methods

### `icon:register(name, component)`

```typescript
import { Star } from 'lucide-react';
await app.api.invoke('icon:register', 'star', Star);
```

### `icon:get(name)`

```typescript
const IconComponent = await app.api.invoke('icon:get', 'folder-open');
```

---

## 💻 Usage

### React Component

```tsx
import { Icon } from '@notehub/icon-manager';

// Basic
<Icon name="folder-open" />

// With size and styling
<Icon name="info" size={48} className="text-blue-400" />

// Unknown icons fallback to HelpCircle
<Icon name="unknown" />
```

---

## 📦 Dependencies

- `lucide-react` — Icon library
- `nh.system.logger` — Logging
