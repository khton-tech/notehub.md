RFC-006: Архитектура системы внешних плагинов для Notehub.mdАвтор: Principal System Architect & Head of Developer ExperienceДата: 1 января 2026 г.Статус: Draft / Request for CommentsЦелевая версия: RC31. Исполнительное резюме и архитектурная философия1.1. Стратегический контекстПроект notehub.md достиг критической точки зрелости. Завершение работы над внутренним ядром, построенным на стеке Tauri, React и CodeMirror, обеспечивает нам высокую производительность и надежность редактора. Однако текущая монолитная архитектура становится бутылочным горлышком для развития функциональности. Переход к стадии RC3 (Release Candidate 3) знаменует собой фундаментальный сдвиг парадигмы: от закрытого приложения к открытой расширяемой платформе.Наша цель — демократизация разработки функций. Мы стремимся создать экосистему, в которой сообщество сможет реализовывать пользовательские интерфейсы, логику обработки данных и темы оформления, не затрагивая код ядра. Принципиальное требование к UX (User Experience) системы плагинов формулируется как "Drop-in architecture": пользователь должен иметь возможность просто скопировать папку с JavaScript-файлом в директорию .notehub/plugins/, после чего приложение должно подхватить, загрузить и исполнить расширение без необходимости перезагрузки или сложной конфигурации.1.2. Инженерный вызов: Трилемма расширяемостиПроектирование API плагинов для сложных UI-платформ неизбежно сталкивается с "трилеммой расширяемости", где необходимо найти баланс между тремя конкурирующими силами:Изоляция (Безопасность): Гарантия того, что ошибка в стороннем коде не приведет к падению всего приложения или утечке данных.Возможности (Capability): Предоставление плагинам глубокого доступа к внутреннему состоянию приложения (например, к виртуальному DOM React или модели редактора CodeMirror).Эргономика (DX): Минимизация трения при разработке, сборке и отладке расширений.Максимизация изоляции (например, использование iframe как в Figma или отдельных процессов как в Chrome) часто приводит к деградации возможностей (сложно рендерить React-компоненты в контексте хоста) и усложнению DX (необходимость асинхронного IPC для каждой операции). С другой стороны, максимизация возможностей (общий глобальный скоуп) ставит под угрозу безопасность.В данном RFC предлагается гибридный подход "Managed Shared Scope" (Управляемая общая область видимости). Мы отказываемся от жесткой изоляции процессов в пользу единого потока исполнения (Main Thread), но внедряем строгие "переборки" (bulkheads) на уровне runtime-загрузчика и иерархии компонентов React. Это решение продиктовано требованием "Легковесности": плагины должны переиспользовать зависимости хоста (React, CodeMirror), чтобы избежать раздувания памяти и конфликтов контекста (Context Hell).2. Анализ среды исполнения (Runtime Loader)Центральным элементом архитектуры плагинов является загрузчик (Loader) — механизм, отвечающий за чтение кода с диска, его оценку, разрешение зависимостей и интеграцию в работающее приложение. В контексте Tauri (Chromium WebView) мы проанализировали три основных подхода.2.1. Ландшафт модульных систем2.1.1. Native ES Modules (ESM)Современные браузеры нативно поддерживают <script type="module"> и динамический import(). Это кажется естественным выбором, однако при детальном рассмотрении выявляются критические ограничения для архитектуры плагинов.Главная проблема ESM — жесткость разрешения зависимостей. Браузерные Import Maps (карты импорта), позволяющие перенаправлять "голые" спецификаторы (например, import React from 'react') на конкретные файлы, являются статичными.1 Спецификация не позволяет легко модифицировать карту импорта в runtime после загрузки страницы. Это делает невозможным динамическую загрузку плагина, который требует зависимостей, не объявленных при старте приложения. Кроме того, ESM кэшируется браузером по URL, что усложняет реализацию Hot Module Replacement (HMR) без использования "cache-busting" query-параметров, которые могут приводить к утечкам памяти.12.1.2. CommonJS Shim (Подход Node.js/Obsidian)Этот подход, популяризированный Obsidian и ранними версиями VS Code, заключается в эмуляции функции require в браузере.Хотя это дает полный контроль над скоупом, CommonJS является синхронным форматом, что блокирует основной поток при загрузке. Кроме того, современная экосистема JavaScript (включая библиотеки, которые разработчики захотят использовать) активно мигрирует на ESM. Поддержка устаревшего формата потребует сложных транспиляций на стороне разработчика плагина, ухудшая DX.22.1.3. SystemJS (Выбранное решение)SystemJS представляет собой универсальный динамический загрузчик модулей, реализующий реестровую архитектуру поверх браузерного окружения. Он де-факто является стандартом для микро-фронтенд архитектур (Single-SPA) и сложных плагинных систем.4Почему SystemJS?Управляемый реестр (Registry Control): SystemJS поддерживает внутренний реестр всех загруженных модулей. В отличие от нативных ESM, этот реестр мутабелен. Мы можем программно удалять модули через System.delete(), что является фундаментом для реализации "честного" HMR, когда старая версия кода полностью выгружается из памяти перед загрузкой новой.6Виртуальные модули (Virtual Modules): SystemJS позволяет нам взять уже существующий в памяти инстанс объекта (например, наш React или NotehubAPI) и зарегистрировать его как модуль под определенным именем. Когда плагин запросит import 'react', SystemJS вернет ему ссылку на наш объект, а не будет пытаться загрузить файл по сети. Это решает проблему дублирования зависимостей.8Поддержка формата System.register: Этот формат сохраняет семантику живых привязок (live bindings) ES-модулей, но позволяет линковать зависимости в runtime, что идеально подходит для нашей задачи.2.2. Стратегия внедрения зависимостей (Shared Scope)Одной из самых частых причин сбоев в React-приложениях с плагинами является проблема "Двойного React" (Dual React Warning). Если плагин бандлит свою копию React, а ядро использует свою, хуки вроде useState или useContext перестают работать, так как они полагаются на глобальный синглтон внутри замыкания React.Для решения этой проблемы мы реализуем паттерн Runtime Dependency Injection.На этапе инициализации ядра (bootstrap), до загрузки каких-либо плагинов, мы "прогреваем" реестр SystemJS. В файле main.tsx (точка входа ядра) мы выполняем следующий код (концептуально):TypeScriptimport * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as NotehubAPI from '@notehub/api';
import { System } from 'systemjs';

// Инициализация реестра
// Мы явно говорим загрузчику: "Если кто-то попросит 'react', дай ему вот этот объект"
System.set('react', System.newModule(React));
System.set('react-dom', System.newModule(ReactDOM));
System.set('@notehub/api', System.newModule(NotehubAPI));

// Блокировка критических зависимостей
// Мы запрещаем плагинам перезаписывать эти ключи в реестре ради безопасности
lockRegistryKeys(['react', 'react-dom', '@notehub/api']);
Когда плагин, скомпилированный в формат System.register, загружается, он объявляет свои зависимости через массив строк ['react', '@notehub/api']. SystemJS перехватывает эти запросы, обращается к своему реестру и передает плагину ссылки на объекты ядра. Это гарантирует, что любой компонент плагина <MyPluginComponent /> будет рендериться в том же контексте React, что и само приложение, имея доступ ко всем провайдерам (ThemeContext, AppContext и т.д.).93. Набор разработчика плагинов (Plugin Development Kit — PDK)Для выполнения требования "Удобство (DX)" мы не можем требовать от сторонних разработчиков самостоятельной настройки сложных сборщиков вроде Webpack или Rollup. Риск ошибки конфигурации слишком велик. Вместо этого мы предоставляем абстракцию — PDK.3.1. Архитектура системы сборкиВ качестве движка сборки выбран Vite. Причины выбора: скорость сборки (на базе esbuild) и мощная экосистема плагинов Rollup для продакшн-бандлинга. PDK будет поставляться в виде CLI-утилиты notehub-cli, которая оборачивает Vite с предустановленным конфигом.3.1.1. Конфигурация экстернализацииКлючевая задача PDK — гарантировать, что плагин не включает в себя react и @notehub/api. Это достигается через настройку rollupOptions.external и output.globals.Внутренний конфиг Vite, скрытый внутри notehub-cli, будет выглядеть следующим образом:TypeScript// notehub-pdk/src/config/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // WebView Tauri поддерживает современный JS
    lib: {
      entry: 'src/main.tsx',
      name: 'plugin', 
      fileName: 'main',
      formats: ['system'] // КРИТИЧЕСКИ ВАЖНО: Вывод в формате System.register
    },
    rollupOptions: {
      // Маркируем библиотеки как внешние.
      // Vite не будет включать их код в итоговый main.js.
      external: [
        'react',
        'react-dom',
        /^@codemirror\/.*/, // Все пакеты CodeMirror
        /^@notehub\/.*/     // Все пакеты Notehub API
      ],
      output: {
        // Указываем SystemJS формат
        format: 'system',
        // Сопоставляем имена импортов с ключами реестра SystemJS в ядре
        globals: {
          react: 'react',
          'react-dom': 'react-dom',
          '@notehub/api': '@notehub/api'
        }
      }
    },
    // Отключаем очистку директории при watch-режиме, чтобы не сбивать Tauri watcher
    emptyOutDir: false,
    minify: 'esbuild'
  }
});
Использование format: 'system' 11 заставляет Rollup оборачивать код в System.register(...), что позволяет нашему загрузчику перехватить зависимости в runtime.3.2. Распространение типов (Typing Strategy)Разработчику необходим IntelliSense (автодополнение) для API ядра. Однако исходный код ядра (@notehub/api) находится в приватном репозитории или просто слишком тяжел.Решение: Пакет только с типами (Declaration-Only Package).Мы создадим отдельный npm-пакет @notehub/types.В CI/CD пайплайне ядра мы запускаем tsc --emitDeclarationOnly или используем vite-plugin-dts 13, чтобы сгенерировать .d.ts файлы из исходников API.Эти файлы публикуются в npm как @notehub/types.При создании плагина через notehub-cli create, в package.json плагина автоматически добавляется зависимость:JSON"devDependencies": {
  "@notehub/types": "^1.0.0",
  "typescript": "^5.0.0"
}
Мы используем поле typesVersions в package.json пакета типов 15, чтобы маппить импорты.Когда разработчик пишет import { Workspace } from '@notehub/api', TypeScript (через paths в tsconfig.json или node resolution) находит определения в @notehub/types. При сборке же этот импорт остается "голым" строковым литералом, который разрешается SystemJS в runtime.4. Стратегия безопасности и изоляцииПоскольку мы запускаем код в одном потоке с UI (Main Thread), мы не можем использовать жесткую изоляцию процессов (как в VS Code для extension host) без потери возможности прямого рендеринга React-компонентов в слоты интерфейса.16 Использование iframe (как в Figma) создает слишком высокий барьер для взаимодействия с DOM.17Мы принимаем риск "Shared Thread", но минимизируем его последствия через паттерн "Soft Sandbox".4.1. Границы ошибок (Error Boundaries)React Error Boundaries — это компоненты, которые перехватывают ошибки JavaScript в своем дочернем дереве компонентов, логируют их и отображают запасной UI вместо рухнувшего дерева компонентов.18Архитектура предполагает иерархическую защиту:Loader Boundary: Оборачивает весь процесс инициализации плагина. Если плагин падает при вызове onload, он не блокирует загрузку приложения.View Boundary: Каждый UI-элемент, который плагин регистрирует (например, новая вкладка в сайдбаре), автоматически оборачивается ядром в отдельный ErrorBoundary.Псевдокод защиты компонента:TypeScript// Core/UI/PluginContainer.tsx
import { ErrorBoundary } from 'react-error-boundary';

const SafePluginView = ({ pluginId, component: Component, props }) => (
  <ErrorBoundary
    FallbackComponent={({ error, resetErrorBoundary }) => (
      <div className="plugin-crash-overlay">
        <h3>Plugin "{pluginId}" crashed</h3>
        <pre>{error.message}</pre>
        <button onClick={resetErrorBoundary}>Reload View</button>
      </div>
    )}
    onError={(error) => {
      console.error(` Plugin ${pluginId} caused a UI crash:`, error);
      Telemetry.reportCrash(pluginId, error);
    }}
  >
    <Component {...props} />
  </ErrorBoundary>
);
Таким образом, если плагин содержит баг в методе render(), пользователь увидит сообщение об ошибке только в области этого плагина, а остальной редактор (CodeMirror, меню файлов) продолжит работать штатно.4.2. API Фасады (Facades & Proxies)Мы не должны передавать плагинам "сырые" внутренние объекты. Например, прямой доступ к инстансу CodeMirror может позволить плагину сломать внутреннюю модель документа.Вместо этого мы экспортируем Фасады — обертки, которые валидируют входные данные перед передачей их во внутренние системы.TypeScript// Internal
class EditorImpl {
  public rawCM: CodeMirror.Editor;
  //... dangerous methods
}

// Exposed to Plugin
export class EditorProxy {
  private impl: EditorImpl;
  
  constructor(impl: EditorImpl) { this.impl = impl; }

  // Безопасный метод
  public insertText(text: string) {
    if (typeof text!== 'string') throw new Error("Text must be a string");
    this.impl.rawCM.dispatch(...)
  }
}
Все методы API оборачиваются в try-catch блоки на уровне фасада, чтобы перехватывать исключения, выброшенные внутри ядра по вине некорректных аргументов плагина.5. Стратегия Hot Module Replacement (HMR)Реализация HMR для внешних файлов в Tauri-приложении нетривиальна, так как стандартные HMR-решения (Webpack Dev Server) полагаются на WebSocket-соединение, которое сложно прокинуть внутрь WebView к динамически загруженному файлу.Мы реализуем File-System Driven HMR.5.1. Workflow (Рабочий процесс)Наблюдение (Rust/Tauri): Процесс Tauri запускает файловый вотчер (через крейт notify) на папку .notehub/plugins.Сборка (CLI): Разработчик запускает notehub-cli watch. Vite пересобирает main.js при изменении исходников и пишет его на диск.Сигнал (IPC): Tauri обнаруживает изменение файла main.js. Он посылает событие plugin:reload в WebView с payload { pluginId: 'my-plugin' }.Перезагрузка (Frontend): Сервис PluginManager в ядре получает событие и запускает процедуру ротации модуля.5.2. Алгоритм ротации модуля (SystemJS Registry Manipulation)Чтобы браузер увидел новый код, нам нужно обмануть кэш и очистить реестр SystemJS.Unload (Выгрузка): Ядро вызывает метод plugin.onunload(). Плагин обязан отписаться от событий DOM, остановить таймеры и вернуть объект состояния (State Memento).Delete (Очистка реестра): Ядро вызывает System.delete(moduleUrl). Это критический шаг: SystemJS удаляет запись о модуле из своей памяти.6 Без этого шага повторный импорт вернет старый объект.Cache Busting (Обход кэша): Ядро формирует новый URL с timestamp: const newUrl = originalUrl + '?t=' + Date.now().Import (Загрузка): Вызов System.import(newUrl).Restore (Восстановление): Создается новый инстанс плагина. Вызывается onload(context), куда передается сохраненный стейт.5.3. Сохранение состояния (State Preservation)В отличие от React Fast Refresh, который пытается сохранить состояние компонентов магически, мы используем явный паттерн Memento.TypeScript// Plugin Code
let internalState = { counter: 0 };

export function onload(ctx) {
  if (ctx.previousState) {
    internalState = ctx.previousState; // Восстанавливаем счетчик
  }
}

export function onunload() {
  return internalState; // Сохраняем счетчик перед смертью
}
Это позволяет разработчику сохранять положение скролла, введенный текст или активную вкладку между перезагрузками кода.6. Спецификация поставки (Deliverable)6.1. Спецификация Loader (Псевдокод реализации)Ниже представлен алгоритм класса PluginManager, который управляет жизненным циклом.TypeScript// services/PluginManager.ts

interface PluginRecord {
  id: string;
  instance: PluginInstance;
  url: string;
  manifest: PluginManifest;
}

class PluginManager {
  private registry = new Map<string, PluginRecord>();
  private system = (window as any).System;

  constructor() {
    this.initializeSharedScope();
  }

  // 1. Dependency Injection Setup
  private initializeSharedScope() {
    // Инъекция зависимостей хоста в SystemJS
    this.system.set('react', this.system.newModule(React));
    this.system.set('react-dom', this.system.newModule(ReactDOM));
    this.system.set('@notehub/api', this.system.newModule(NotehubAPI));
  }

  // 2. Loading Logic
  public async loadPlugin(manifest: PluginManifest) {
    const entryUrl = convertPathToAssetUrl(manifest.entryPoint); // e.g., https://asset.localhost/...
    
    try {
      // Динамический импорт через SystemJS
      const module = await this.system.import(entryUrl);
      
      // Предполагаем, что default export - это класс плагина
      const PluginClass = module.default;
      const pluginInstance = new PluginClass(this.app);

      // Lifecycle: Load
      await pluginInstance.onload({ isReload: false });

      this.registry.set(manifest.id, {
        id: manifest.id,
        instance: pluginInstance,
        url: entryUrl,
        manifest
      });
      
    } catch (err) {
      console.error(`Failed to load plugin ${manifest.id}`, err);
      // Показать уведомление пользователю
    }
  }

  // 3. HMR Logic
  public async reloadPlugin(pluginId: string) {
    const record = this.registry.get(pluginId);
    if (!record) return;

    console.log(` Reloading plugin: ${pluginId}`);

    // A. Graceful Shutdown & State Capture
    let persistedState = {};
    try {
      if (record.instance.onunload) {
        persistedState = await record.instance.onunload() |

| {};
      }
    } catch (e) {
      console.warn('Error during unload, state might be lost', e);
    }

    // B. Registry Cleanup
    this.system.delete(record.url);

    // C. Cache Busting Re-import
    const newUrl = `${record.url}?bust=${Date.now()}`;
    
    try {
      const newModule = await this.system.import(newUrl);
      const NewPluginClass = newModule.default;
      const newInstance = new NewPluginClass(this.app);

      // D. Re-initialization with State
      await newInstance.onload({ 
        isReload: true, 
        previousState: persistedState 
      });

      // Update registry
      this.registry.set(pluginId, {
       ...record,
        instance: newInstance,
        url: record.url // Keep original URL base, ignoring query param
      });

    } catch (err) {
      console.error(` Failed to reload plugin ${pluginId}`, err);
    }
  }
}
6.2. Поверхность API Плагина (index.ts)Пример того, как выглядит код простейшего плагина для разработчика.TypeScriptimport { Plugin, PluginContext } from '@notehub/api';
// Мы импортируем React, но в бандл он не попадет (External)
import React from 'react'; 

interface MyState {
  clickCount: number;
}

export default class HelloWorldPlugin extends Plugin {
  state: MyState = { clickCount: 0 };

  async onload(ctx: PluginContext) {
    console.log('Hello World Plugin Loaded');

    // Восстановление состояния при HMR
    if (ctx.previousState) {
      this.state = ctx.previousState;
    }

    // Регистрация команды в палитре (Ctrl+P)
    this.registerCommand({
      id: 'show-alert',
      name: 'Show Hello Alert',
      callback: () => {
        alert(`Button clicked ${this.state.clickCount} times`);
      }
    });

    // Регистрация компонента в статус-баре
    this.registerStatusBarItem('my-status', (props) => (
      <div 
        onClick={() => this.state.clickCount++} 
        className="cursor-pointer hover:text-blue-500"
      >
        Clicks: {this.state.clickCount}
      </div>
    ));
  }

  async onunload() {
    console.log('Unloading plugin...');
    // Возвращаем стейт для сохранения
    return this.state;
  }
}
6.3. Спецификация CLI (notehub-cli)Инструментарий командной строки для управления жизненным циклом разработки.КомандаОписаниеТехническая реализацияnotehub-cli create <name>Создает новый проект плагина из шаблона.Клонирует github-template, настраивает package.json, устанавливает @notehub/types.notehub-cli buildСобирает плагин для релиза.Запускает vite build. Выполняет валидацию: проверяет, что react не попал в бандл, и формат вывода — system. Генерирует manifest.json.notehub-cli watchРежим разработки с HMR.Запускает vite build --watch. При каждом сохранении файла пересобирает dist/main.js. Не запускает dev-server, а пишет файлы прямо в файловую систему, чтобы Tauri watcher их подхватил.notehub-cli validateСтатический анализ плагина.Проверяет манифест, зависимости и соответствие API guideline (через ESLint правила).6.4. Интеграция с Developer ToolsДля обеспечения качественного опыта отладки:Source Maps:Конфиг Vite в PDK по умолчанию включает build.sourcemap: 'inline'. Это критически важно. Когда SystemJS загружает код через eval или script tag, inline source maps позволяют браузеру восстановить исходные файлы .ts и показать их в панели "Sources" Chrome DevTools. Разработчик может ставить брейкпоинты прямо в своем TypeScript коде.React DevTools:Поскольку плагины используют тот же инстанс React, что и ядро, компоненты плагинов (например, <SafePluginView>) автоматически появляются в дереве компонентов React DevTools. Они будут видны как дочерние элементы PluginContainer. Никакой дополнительной настройки со стороны разработчика плагина не требуется.Внутренняя консоль:Для удобства (особенно если DevTools закрыты) мы реализуем в приложении панель "Developer Logs". Мы перехватываем console.log внутри контекста плагина (через обертку или Proxy глобального объекта, если возможно, или просто фильтруя логи по префиксу плагина) и дублируем их в UI-панель внутри Notehub.7. ЗаключениеПредложенная архитектура решает поставленные задачи следующим образом:Безопасность: Обеспечивается через ErrorBoundary (защита UI) и API Facades (защита логики).Легковесность: Достигается через SystemJS и Runtime Dependency Injection, исключая дублирование React.DX: Vite и CLI скрывают сложность конфигурации; пакет @notehub/types дает типизацию.HMR: Реализован через манипуляцию реестром SystemJS и файловый вотчер Tauri.Данная спецификация готова к прототипированию. Следующим шагом является создание репозитория notehub-pdk и реализация класса PluginManager в ядре.