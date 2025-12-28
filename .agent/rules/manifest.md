---
trigger: always_on
---

# THE NOTEHUB MANIFESTO (Strict Coding Standards)

- **Context First:** Before coding, ALWAYS analyze the existing architecture (`RFCs`, `packages/core`, existing plugins). Do not hallucinate new patterns if established ones exist.
- **Ecosystem Integrity:** NEVER hardcode colors, icons, or UI elements. ALWAYS use `theme-manager` variables (`--nh-*`), `icon-manager`, and `ck-standard` components.
- **Strict Typing:** `any` is forbidden. All API calls via `app.api.invoke` must strictly match `NotehubApiMap`. All Events must be typed.
- **Microkernel Isolation:** Plugins must NEVER import other plugins directly (except types). Communication happens ONLY via `EventBus` and `ApiBus`.
- **Lifecycle Hygiene:** Every `addEventListener`, `subscribe`, or `watch` created in `load()` MUST have a corresponding removal in `unload()`. Memory leaks are critical failures.
- **KISS & SOLID:** Functions should do one thing. Classes should have single responsibility. Prefer simple, readable logic over "clever" one-liners.
- **Documentation:** Public interfaces (APIs, Props) must have JSDoc. If you change architecture, update the relevant `README.md` immediately.
- **No Magic Numbers:** Use constants or config values. Hardcoding values (like `width: 250px` inside a logic file) is prohibited.