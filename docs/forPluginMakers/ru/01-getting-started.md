# Начало работы

Это руководство проведет вас через создание вашего первого плагина Notehub.md.

## Предварительные требования

- **Node.js** v18+ с npm/pnpm
- **TypeScript** (рекомендуется, но JavaScript тоже работает)
- **Сборщик**: esbuild, Vite или Rollup
- Хранилище Notehub.md для тестирования

## Структура плагина

Каждый плагин требует как минимум:

```
my-plugin/
├── manifest.json    # Метаданные плагина (обязательно)
├── main.js          # Точка входа (скомпилированная)
└── src/             # Исходные файлы (опционально)
    └── index.ts
```

## manifest.json

Манифест описывает ваш плагин для Notehub:

```json
{
    "id": "my-awesome-plugin",
    "name": "Мой Крутой Плагин",
    "version": "1.0.0",
    "main": "main.js",
    "dependencies": []
}
```

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `id` | ✅ | Уникальный идентификатор (строчные буквы, дефисы разрешены) |
| `name` | ✅ | Человекочитаемое имя |
| `version` | ✅ | Семантическая версия (например, `1.0.0`) |
| `main` | ❌ | Файл точки входа, по умолчанию `main.js` |
| `dependencies` | ❌ | Массив ID внутренних плагинов, от которых зависит этот плагин |

---

## Вариант 1: Генератор плагинов (Внутренние плагины)

Если вы разрабатываете плагин **внутри монорепо Notehub**, используйте генератор:

```bash
pnpm gen:plugin
```

Интерактивный CLI:
1. ✔ Запросит имя плагина (kebab-case)
2. ✔ Предложит выбрать категорию (`system`, `ui`, `features`)
3. ✔ Сгенерирует полную структуру со всем boilerplate

**Генерируемые файлы:**
- `package.json` — Конфиг пакета с зависимостью `@notehub/core`
- `tsconfig.json` — TypeScript конфиг, расширяющий базовый
- `manifest.json` — Метаданные плагина
- `src/index.ts` — Класс плагина, реализующий `IPlugin`

---

## Вариант 2: Ручная настройка (Внешние плагины)

Для плагинов, которые живут **вне монорепо** и загружаются в runtime из хранилища:

### Шаг 1: Создайте структуру папок

```bash
mkdir my-plugin
cd my-plugin
npm init -y
npm install @notehub/api typescript esbuild --save-dev
```

### Шаг 2: Создайте manifest.json

```json
{
    "id": "hello-world",
    "name": "Hello World",
    "version": "1.0.0"
}
```

### Шаг 3: Создайте src/index.ts

```typescript
import { NotehubPlugin, PluginContext } from '@notehub/api';

export default class HelloWorldPlugin extends NotehubPlugin {
    async onload(ctx: PluginContext): Promise<void> {
        // Логируем сообщение при загрузке плагина
        await ctx.invokeApi('logger:info', 'HelloWorld', 'Привет из моего плагина!');
        
        // Регистрируем кастомный API
        ctx.registerApi('hello:say', (message: string) => {
            console.log(`[HelloWorld] ${message}`);
        });
        
        // Подписываемся на события выбора файла
        ctx.subscribe<{ path: string }>('explorer:file-selected', (payload) => {
            console.log('Выбран файл:', payload.path);
        });
    }
    
    async onunload(): Promise<void> {
        // Ничего делать не нужно - очистка автоматическая!
        console.log('Плагин HelloWorld выгружен');
    }
}
```

### Шаг 4: Создайте tsconfig.json

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "lib": ["ES2020", "DOM"],
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "declaration": false,
        "outDir": "./dist"
    },
    "include": ["src/**/*"]
}
```

### Шаг 5: Создайте скрипт сборки

Добавьте в `package.json`:

```json
{
    "scripts": {
        "build": "esbuild src/index.ts --bundle --format=esm --outfile=main.js --external:@notehub/api --external:react"
    }
}
```

### Шаг 6: Соберите и установите

```bash
npm run build
```

Скопируйте папку в ваше хранилище:
```
MyVault/.notehub/plugins/hello-world/
├── manifest.json
└── main.js
```

### Шаг 7: Тестирование

1. Откройте Notehub.md с вашим хранилищем
2. Ваш плагин загрузится автоматически!
3. Проверьте консоль на сообщение "Привет из моего плагина!"

---

## Важно: Внешние зависимости

Ваш плагин работает в **общей области видимости** с Notehub. Эти пакеты предоставляются хостом:

| Пакет | Описание |
|-------|----------|
| `@notehub/api` | API плагинов (`NotehubPlugin`, `PluginContext`) |
| `react` | Библиотека React |
| `react-dom` | React DOM рендерер |

**Отметьте их как external** в конфигурации сборщика, чтобы избежать дублирования!

---

## Горячая перезагрузка

Notehub следит за директорией `.notehub/plugins/`. Когда вы обновляете плагин:

1. Старая версия автоматически выгружается
2. Новая версия загружается
3. Все ваши регистрации API очищаются автоматически!

---

## Советы по отладке

1. **Откройте DevTools** (Ctrl+Shift+I) чтобы видеть логи консоли
2. **Используйте `logger:info`** API для структурированного логирования
3. **Проверьте логи плагина Synapse** для событий загрузки/выгрузки

---

## Следующие шаги

- Прочитайте **[Архитектура](02-architecture.md)** чтобы понять жизненный цикл плагина
- Изучите **[Справочник API](03-api-reference.md)** для всех доступных методов
