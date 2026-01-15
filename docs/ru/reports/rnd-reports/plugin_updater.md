RFC-010: Архитектура Unlimited Power — Смена Парадигмы Расширяемости Платформы Notehub.md1. Введение и Архитектурный КонтекстНастоящий документ представляет собой детальную техническую спецификацию (Request for Comments) для инициативы "Unlimited Power", направленной на фундаментальную трансформацию архитектуры плагинов платформы Notehub.md. Текущий анализ экосистемы разработки 1 и стратегий расширяемости 1 выявил, что существующая модель "защищенной песочницы" (sandbox) достигла предела своей эффективности, создавая искусственные барьеры для разработчиков и блокируя реализацию сложного функционала.Цель данной спецификации — переход к модели "Open Core with Trust" (Открытое ядро с доверием). Мы постулируем, что попытка предвосхитить все возможные сценарии использования через строго типизированный API обречена на провал в долгосрочной перспективе. Вместо этого архитектура должна предоставлять надежные примитивы для стандартных задач и легитимизированные "аварийные люки" (escape hatches) для задач, выходящих за рамки стандартного контракта.В данном документе детально рассматриваются четыре критических компонента реформы: унификация среды выполнения JavaScript (решение проблемы JSX Runtime), внедрение паттерна перехвата вызовов (Interceptor Pattern), предоставление доступа к внутренним структурам через Unsafe Context и создание инструментов визуальной инспекции UI (Zone Inspector). Реализация этих компонентов позволит устранить текущий разрыв в Developer Experience (DX) и обеспечит паритет возможностей с такими платформами, как Obsidian и VS Code.22. Унификация Среды Выполнения: SystemJS и JSX RuntimeОдной из наиболее острых проблем, блокирующих вход новых разработчиков в экосистему Notehub.md, является несовместимость текущей конфигурации загрузчика SystemJS с современным стандартом трансформации JSX, внедренным в React 17+.12.1. Проблема Разрешения Модулей JSXСовременные сборщики (Vite, Webpack 5+, Rollup), используемые при создании плагинов, по умолчанию применяют режим jsx: "automatic". Этот режим заменяет вызовы React.createElement на импорты функций из специальной точки входа: react/jsx-runtime (или react/jsx-dev-runtime в режиме разработки).4В отличие от стандартных ESM-импортов, где разрешение путей регулируется спецификацией Node.js, в браузере под управлением SystemJS отсутствует автоматическое разрешение суффиксов путей внутри пакетов.5 Текущая карта импортов (import map) платформы предоставляет доступ к модулю react, но не к его подмодулям. Это приводит к фатальной ошибке выполнения при попытке загрузить любой современный плагин: Unable to resolve bare specifier 'react/jsx-runtime'.6Анализ показывает, что проблема усугубляется тем, что многие библиотеки компонентов, которые разработчики могут захотеть использовать (например, @mui/material или antd), также скомпилированы с использованием нового JSX transform и ожидают наличия react/jsx-runtime в среде выполнения.62.2. Стратегия Гибридной Карты ИмпортовДля решения этой проблемы необходимо внедрить гибридную стратегию разрешения модулей, которая сочетает в себе явную регистрацию синтетических модулей в SystemJS и обновление конфигурации сборки на стороне плагинов.2.2.1. Обновление SystemJS Import Map (Core)В index.html основного приложения необходимо расширить карту импортов. Мы должны явно указать, что запрос модуля react/jsx-runtime должен разрешаться в тот же бандл (или специфический чанк), который содержит логику React, либо перенаправляться на именованный модуль, зарегистрированный вручную.SpecifierTarget StrategyDescriptionreactapp:reactОсновной entry point библиотеки React.react-domapp:react-domБиблиотека рендеринга для браузера.react/jsx-runtimeapp:react/jsx-runtimeНовое: Точка входа для автоматического JSX.@notehub/apiapp:notehub-apiПубличный API ядра.Данная конфигурация требует, чтобы в процессе инициализации приложения (bootstrap) происходила регистрация соответствующих модулей в реестре SystemJS.72.2.2. Синтетическая Регистрация МодулейПоскольку React распространяется в формате UMD или CJS, а SystemJS оперирует форматом System.register, нам необходимо создать "мост". В файле инициализации ядра (src/system/bootstrap.ts) следует реализовать следующую логику:TypeScriptimport * as React from 'react';
import * as ReactDOM from 'react-dom';
// ВАЖНО: Импорт рантайма может требовать специфической настройки
// сборщика самого Core (например, resolve.alias в Webpack/Vite)
import * as JsxRuntime from 'react/jsx-runtime'; 
import { System } from 'systemjs';

// Регистрация основных библиотек как модулей SystemJS
// Это позволяет плагинам делать `import React from 'react'`
System.set('app:react', System.newModule({
 ...React,
  default: React,
  __useDefault: true
}));

System.set('app:react-dom', System.newModule({
 ...ReactDOM,
  default: ReactDOM,
  __useDefault: true
}));

// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Регистрация JSX Runtime
// Мы создаем синтетический модуль, который экспортирует jsx, jsxs и Fragment
// из импортированного пространства имен.
System.set('app:react/jsx-runtime', System.newModule({
 ...JsxRuntime,
  default: JsxRuntime, 
  __useDefault: true
}));
Использование System.set с System.newModule гарантирует, что модуль будет доступен для всех плагинов, загружаемых позже, и предотвращает дублирование кода React в памяти.7 Если react/jsx-runtime физически отсутствует в бандле ядра (например, из-за использования старой версии React), необходимо реализовать полифилл, который маппит вызовы jsx() обратно на React.createElement() 4, однако предпочтительным является обновление ядра до React 17+.2.3. Стандартизация Конфигурации Сборки (Vite)На стороне разработчика плагина (CLI) необходимо обеспечить, чтобы react/jsx-runtime не включался в выходной бандл. Это достигается через настройку rollupOptions.external. Если этого не сделать, плагин попытается загрузить свою копию React, что приведет к конфликту версий и ошибкам хуков (Invalid Hook Call Warning).10Спецификация шаблона vite.config.ts для nhp:TypeScriptimport { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins:,
  build: {
    target: 'es2020', // SystemJS поддерживает современные стандарты
    lib: {
      entry: resolve(__dirname, 'src/main.tsx'),
      name: 'MyPlugin',
      fileName: 'main',
      formats: ['system'] // Обязательный формат для платформы
    },
    rollupOptions: {
      // Список внешних зависимостей, предоставляемых ядром (Peer Dependencies)
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime', // Блокируем бандлинг рантайма
        '@notehub/api',
        '@notehub/ui'
      ],
      output: {
        // Глобальные переменные не требуются для формата 'system',
        // но полезны для документации зависимостей.
        // SystemJS разрешает их через import map.
        globals: {
          'react': 'react',
          'react/jsx-runtime': 'react/jsx-runtime'
        }
      }
    }
  }
});
Это решение устраняет корневую причину "критической ошибки сборки" 1, обеспечивая бесшовный Developer Experience для новых проектов.3. Interceptor Pattern: Архитектура Middleware для ApiBusТекущая архитектура команд в Notehub.md представляет собой прямую связь "вызов -> исполнение". Это ограничивает возможности плагинов по модификации поведения системы. Для реализации стратегии "Monkey Patching" безопасным способом 1 мы внедряем паттерн "Цепочка ответственности" (Chain of Responsibility) в ядро системы команд ApiBus.3.1. Концептуальная МодельПаттерн Middleware позволяет выстроить конвейер обработки для любой команды. Каждый элемент цепочки (Interceptor) получает контроль над выполнением, может модифицировать аргументы, блокировать выполнение (не вызывая next), подменять результат или выполнять побочные эффекты (логирование).13Это аналогично работе middleware в Express.js/Koa или Interceptors в NestJS 15, но адаптировано для асинхронной шины команд внутри браузерного приложения.3.2. Интерфейс ApiMiddleware и CallContextОсновой реализации является контекст вызова, который передается сквозь всю цепочку. Он должен быть мутабельным, чтобы позволять плагинам влиять на данные.TypeScript/**
 * Контекст перехвата вызова API.
 */
export interface CallContext<TArgs extends any = any, TResult = any> {
  /** Идентификатор команды, например 'editor:insert-text' */
  readonly commandId: string;
  
  /** Аргументы вызова. Middleware может модифицировать массив. */
  args: TArgs;
  
  /** 
   * Результат выполнения. Устанавливается последним обработчиком 
   * или любым middleware, прерывающим цепочку.
   */
  result?: TResult;
  
  /** Метаданные вызова (инициатор, timestamp, флаги отмены) */
  readonly meta: {
    readonly timestamp: number;
    readonly sourcePluginId?: string;
    [key: string]: any;
  };
}

/**
 * Функция передачи управления следующему обработчику.
 */
export type NextFn = () => Promise<void>;

/**
 * Сигнатура функции-перехватчика.
 */
export type MiddlewareFn = (ctx: CallContext, next: NextFn) => Promise<void>;
3.3. Реализация Middleware Runner (Onion Model)Для обеспечения корректной асинхронности (возможности выполнить код после завершения оригинальной команды, например, для логирования результата) необходимо использовать модель "Луковицы" (Onion Architecture), где await next() погружает исполнение вглубь цепочки, а возврат из next() поднимает его обратно.17TypeScriptexport class MiddlewareRunner {
  // Храним перехватчики с поддержкой wildcard-паттернов (напр. 'editor:*')
  private middlewares: Array<{ pattern: RegExp, fn: MiddlewareFn, priority: number }> =;

  /**
   * Регистрация нового перехватчика.
   */
  register(pattern: string, fn: MiddlewareFn, priority: number = 0) {
    // Преобразование glob-паттерна в RegExp для быстрого матчинга
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    this.middlewares.push({ pattern: regex, fn, priority });
    // Сортировка для детерминированного порядка выполнения
    this.middlewares.sort((a, b) => b.priority - a.priority);
    
    return { dispose: () => this.remove(fn) };
  }

  /**
   * Исполнение пайплайна.
   */
  async run(commandId: string, args: any, finalHandler: (...args: any) => Promise<any>): Promise<any> {
    // 1. Фильтрация middleware, применимых к текущей команде
    const chain = this.middlewares
     .filter(m => m.pattern.test(commandId))
     .map(m => m.fn);

    const context: CallContext = {
      commandId,
      args,
      meta: { timestamp: Date.now() }
    };

    // 2. Рекурсивный диспетчер
    const dispatch = async (index: number): Promise<void> => {
      if (index === chain.length) {
        // Достигли конца цепочки middleware -> вызываем оригинальный handler
        context.result = await finalHandler(...context.args);
        return;
      }

      const middleware = chain[index];
      // Передаем функцию next, которая замыкает инкрементированный индекс
      await middleware(context, async () => {
        await dispatch(index + 1);
      });
    };

    // 3. Запуск цепочки
    await dispatch(0);
    
    return context.result;
  }
  
  private remove(fn: MiddlewareFn) { /*... */ }
}
3.4. Сценарии Использования и ИмпликацииВнедрение этого паттерна открывает возможности, ранее недоступные без хаков:Прозрачная валидация и коррекция: Плагин автозамены может перехватывать editor:insert-text, заменять кавычки в ctx.args на типографские («...») и вызывать await next(). Ядро даже не узнает о подмене.Условная блокировка: Плагин "Режим чтения" может перехватывать все команды, изменяющие контент (editor:delete, editor:type), и выбрасывать исключение или просто не вызывать next(), эффективно блокируя операцию.Аудит и Аналитика: Перехват * позволяет логировать все действия пользователя для отладки или аналитики продуктивности.Риски: Бесконечные циклы и замедление работы при большом количестве тяжелых middleware. Необходим механизм тайм-аута для next() и защита от рекурсивных вызовов внутри middleware.4. Unsafe Context: Стратегия Контролируемого ДоступаСтремление к абсолютной безопасности API привело к изоляции разработчиков от мощных инструментов, на которых построен сам Notehub.md. Документ 1 справедливо указывает, что доступ к инстансу CodeMirror (EditorView) решает 90% проблем с отсутствующим API редактора.4.1. Концепция "Unsafe"Мы вводим явное разделение API на safe (стабильный контракт) и unsafe (прямой доступ к внутренностям). Это соответствует подходу Obsidian (app.internalPlugins) и VS Code, где использование недокументированных возможностей возможно, но помечено как рискованное.1Интерфейс PluginContext:TypeScriptimport type { EditorView } from '@codemirror/view'; // Только type import!
import type { App } from './core/App';

export interface UnsafeContext {
  /**
   * Прямой доступ к инстансу приложения.
   * Предоставляет доступ к Router, Store, ServiceContainer.
   * @warning API может быть изменено без мажорного обновления версии.
   */
  readonly app: App;

  /**
   * Получение активного экземпляра CodeMirror 6 EditorView.
   * Позволяет использовать транзакции, декорации и расширения CM6.
   */
  getActiveEditorView(): EditorView | null;
  
  /**
   * Выполнение произвольного кода в контексте главного окна (Window).
   * Критично для плагинов, требующих доступ к DOM или Electron IPC.
   */
  readonly window: Window;
}

export interface PluginContext {
  readonly id: string;
  readonly api: NotehubApi; // Стабильный фасад
  readonly unsafe: UnsafeContext; // Escape hatch
}
4.2. Техническая Реализация Доступа к CodeMirror 6В отличие от CodeMirror 5, который часто вешал инстанс на глобальный объект или DOM-элемент через .CodeMirror, версия 6 инкапсулирует состояние.20 Экземпляр EditorView не является синглтоном.Для реализации getActiveEditorView() мы используем особенность архитектуры CM6: экземпляр EditorView привязывается к DOM-элементу редактора через свойство cmView (или может быть найден через статический метод EditorView.findFromDOM, если он экспортирован).21Алгоритм получения EditorView:Найти в DOM активный контейнер редактора, используя стабильный селектор (гарантируемый слоем Layout, см. раздел 5). Например, .nh-editor-active.cm-content.Извлечь свойство cmView.view из DOM-элемента. Это требует приведения типов, так как свойство добавляется динамически.TypeScript// packages/core/src/api/UnsafeContextImpl.ts

getActiveEditorView(): EditorView | null {
  // Ищем DOM элемент контента редактора
  const domContent = document.querySelector('.nh-layout-active-pane.cm-content');
  
  if (domContent && (domContent as any).cmView) {
    // В CM6 DOM-элемент имеет ссылку на View класс, который имеет ссылку на EditorView
    return (domContent as any).cmView.view as EditorView;
  }
  return null;
}
4.3. Проблема "Dual Package Hazard" (Сдвоенные пакеты)При использовании Unsafe API возникает риск, описанный в 23: если плагин импортирует @codemirror/view из своего node_modules, а ядро использует свою версию, проверка instanceof EditorView вернет false, и многие функции (например, StateEffect) не сработают.Решение:Плагины обязаны декларировать библиотеки CodeMirror как peerDependencies и исключать их из бандла (через rollupOptions.external, как описано в разделе 2.3). SystemJS должен мапить запросы @codemirror/* на экземпляры, загруженные ядром. Это критическое требование для работы Unsafe Context.5. DevTools Spec: Zone Inspector и Инъекции UIАнализ 1 показал, что разработчики не понимают структуру макета (Layout) приложения. Метод "черного ящика" при разработке UI недопустим.5.1. Архитектура Зон (Layout Zones)Каждый контейнер в приложении, предназначенный для расширения, должен быть размечен специальным атрибутом data-nh-zone. Это создает контракт между DOM и системой плагинов.Спецификация компонента Zone:TypeScript// packages/ui/src/Zone.tsx
export const Zone: React.FC<{ id: string; className?: string }> = ({ id, children, className }) => {
  return (
    <div 
      data-nh-zone={id} // Якорный атрибут для инспектора
      className={`nh-zone nh-zone-${id} ${className |

| ''}`}
      style={{ position: 'relative' }} // Контекст позиционирования для оверлеев
    >
      {children}
      {/* Скрытый контейнер для монтирования порталов */}
      <div id={`nh-zone-portal-${id}`} style={{ display: 'none' }} />
    </div>
  );
};
5.2. Zone Inspector: Визуальная ОтладкаДля DX необходимо внедрить инструмент, аналогичный инспектору Google Maps OverlayView 24 или веб-инспектору браузера.25Техническое задание на Zone Inspector:Активация: Через команду devtools:toggle-zones или горячую клавишу.Обнаружение: Скрипт сканирует DOM на наличие [data-nh-zone].Отрисовка Оверлея: Для каждой зоны создается полупрозрачный div (Overlay), позиционируемый абсолютно поверх зоны. Используется getBoundingClientRect() для точного совпадения размеров.Информация: По центру оверлея выводится Zone ID крупным шрифтом.Интерактивность: Оверлей должен пропускать события мыши (pointer-events: none), чтобы не блокировать интерфейс, либо, наоборот, перехватывать клик для копирования ID в буфер обмена (в режиме "Picker").5.3. Механизм Инъекции UI (React Portals & MutationObserver)Плагины должны иметь возможность рендерить свои React-компоненты в любую зону, даже если она еще не существует в DOM (например, лениво загружаемая боковая панель). Для этого используется паттерн MutationObserver.1Реализация PluginPortal:TypeScriptimport React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

export const PluginPortal: React.FC<{ zoneId: string; children: React.ReactNode }> = ({ zoneId, children }) => {
  const = useState<Element | null>(null);

  useEffect(() => {
    // Функция поиска целевого элемента
    const findTarget = () => document.querySelector(`[data-nh-zone="${zoneId}"]`);
    
    // 1. Быстрая проверка
    const existing = findTarget();
    if (existing) {
      setTarget(existing);
      return;
    }

    // 2. Наблюдение за изменениями DOM (если зона появится позже)
    const observer = new MutationObserver((mutations) => {
      const el = findTarget();
      if (el) {
        setTarget(el);
        observer.disconnect(); // Элемент найден, наблюдение снимаем
      }
    });

    // Наблюдаем за body или корневым элементом приложения
    // subtree: true критично для обнаружения глубокой вложенности
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [zoneId]);

  if (!target) return null;

  return ReactDOM.createPortal(children, target);
};
Оптимизация: Наблюдение за всем document.body может быть ресурсоемким.29 Рекомендуется ограничить scope наблюдения корневым элементом приложения (#app-root) и использовать debounce для коллбека наблюдателя, если обновлений много.6. Сводная Таблица Компонентов и План ВнедренияНиже представлена сводка изменений и их влияние на систему.КомпонентТекущее состояниеЦелевое состояние (RFC-010)Влияние на DXJS RuntimeОшибка react/jsx-runtime.Поддержка React 17+ JSX Transform через SystemJS map.✅ Работают современные шаблоны Vite/React.APIЖесткий, ограниченный контракт.Перехватчики (intercept) для любой команды.✅ Возможность глубокой модификации поведения.Editor AccessНет доступа.ctx.unsafe.getActiveEditorView().✅ Полный доступ к API CodeMirror 6.UI Layout"Черный ящик", угадывание ID.Zone Inspector, визуальная карта.✅ Прозрачность, быстрое прототипирование UI.План Внедрения (Implementation Roadmap)Phase 1: Runtime Fix (Hotfix). Приоритет критический. Обновление index.html и выпуск патча для nhp CLI с обновленным шаблоном Vite. Это разблокирует создание новых плагинов.Phase 2: Core Architecture. Реализация MiddlewareRunner в ApiBus. Рефакторинг регистрации обработчиков.Phase 3: Unsafe Context. Создание прокси-объекта UnsafeContext и проброс его в загрузчик плагинов. Важно сопроводить это документацией с предупреждениями (Disclaimers).Phase 4: DevTools. Разметка зон в UI (добавление атрибутов) и реализация инспектора.7. ЗаключениеРеализация архитектуры "Unlimited Power" трансформирует Notehub.md из закрытого редактора в расширяемую платформу. Мы переходим от защиты разработчиков от ошибок к предоставлению им инструментов для создания мощных решений. Риски стабильности, связанные с UnsafeContext и Interceptors, митигируются через строгую типизацию, изоляцию в отдельный namespace и инструменты визуальной отладки. Это необходимый шаг для создания процветающей экосистемы плагинов.