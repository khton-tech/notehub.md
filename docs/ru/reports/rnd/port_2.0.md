RFC-009: Кроссплатформенная архитектура Tauri (Desktop + Android)Статус: DraftДата: 13 января 2026 г.Автор: Principal System ArchitectЦелевая система: Notehub Core (Microkernel Architecture)Версия фреймворка: Tauri v2.0 (Stable)Контекст: Отказ от Capacitor в пользу нативного Tauri Mobile.1. Стратегическое введение и архитектурный поворот1.1. Контекст и обоснование отказа от CapacitorНа основании аудита текущей архитектуры от 13 января 2026 года, было принято стратегическое решение отказаться от гибридного подхода, использующего Capacitor для мобильных платформ. Ранее предполагалось, что Capacitor обеспечит быстрый выход на мобильный рынок за счет переиспользования веб-кода. Однако детальный анализ выявил критические архитектурные разломы, которые этот подход вносит в нашу микроядерную систему:Фрагментация драйверов: Использование Capacitor требует поддержки двух параллельных экосистем плагинов (Capacitor Plugins для Mobile и Tauri Rust Plugins для Desktop). Это нарушает принцип DRY (Don't Repeat Yourself) и увеличивает поверхность атаки и багов вдвое.Узкое место производительности (Bridge Overhead): Архитектура Notehub интенсивно использует I/O операции (чтение/запись заметок, индексация). Мост Capacitor (JS <-> Native) работает через сериализацию JSON, что на больших объемах данных (например, при загрузке плагинов Synapse) приводит к блокировкам UI thread.Потеря мощности Rust: Главное преимущество Tauri — возможность вынести тяжелую логику (поиск, парсинг, криптографию) в Rust. Capacitor изолирует нас в JS-контексте, делая Rust-бэкенд недоступным на мобильных устройствах.Стратегическое решение: Переход на Unified Tauri v2 Architecture. Мы будем использовать единый Rust-бэкенд, который компилируется как для десктопных целей (x86_64/ARM64), так и для мобильных (aarch64-linux-android), используя библиотеку wry для рендеринга WebView на всех платформах. Это позволяет нам реализовать концепцию "Write Once, Run Everywhere" не только для UI (React), но и для системного слоя.1.2. Цели RFC-009Настоящий документ определяет спецификацию Platform Abstraction Layer (PAL) — слоя абстракции, необходимого для адаптации существующего микроядра (@notehub/core) к ограничениям и особенностям Android, сохраняя при этом полную работоспособность на Desktop.Основные задачи исследования:Унификация файловой системы (I/O Strategy): Разработка драйвера, прозрачно работающего с POSIX-путями на десктопе и content:// URI (Scoped Storage) на Android.Модернизация загрузчика Synapse (Loading Strategy): Замена небезопасного механизма Blob URL на высокопроизводительный потоковый протокол plugin://, реализованный на Rust.Адаптация UI (Layout Adaptation): Реализация реактивной смены лейаута (Ribbon -> Drawer) без переписывания компонентной базы, используя React Portals.Безопасность (Security): Настройка ACL (Capabilities) и CSP для соответствия строгим требованиям Android WebView.2. Архитектурный обзор: Единый мост (The Unified Bridge)Ядром новой архитектуры становится Tauri IPC (Inter-Process Communication). В отличие от гибридной схемы, где мобильная часть жила бы своей жизнью, теперь Android-приложение представляет собой полноценный Rust-бинарник, управляющий Android System WebView.2.1. Схема взаимодействия компонентовФрагмент кодаgraph TD
    subgraph "Android Device / Desktop OS"
        subgraph "WebView Layer (UI: React + SystemJS)"
            A[Microkernel Core] -- "Load Plugin" --> B
            A -- "FS I/O" --> C
            C -- "Invoke IPC" --> D
        end

        subgraph "Tauri Rust Backend (lib.rs)"
            D -- "IPC Bridge" --> E
            
            E --> F
            E --> G
            E --> H
            
            subgraph "Platform Specific Implementation"
                F -- "std::fs" --> I
                F -- "Android NDK / JNI" --> J
                H -- "Streaming" --> K[In-Memory / Asset Zip]
            end
        end
    end
2.2. Концепция PAL (Platform Abstraction Layer)PAL в нашей системе — это не монолитная библиотека, а набор контрактов (Interfaces) на стороне TypeScript и соответствующих реализаций на стороне Rust/Tauri.Функциональный блокDesktop (Windows/Linux/macOS)Android (Mobile)Механизм абстракцииФайловая системаПрямой доступ (/home/user/...)Scoped Storage (content://...)fs-driver-tauri (Smart Wrapper)Загрузка плагиновCustom Protocol plugin://Custom Protocol http://plugin.localhostSynapse Protocol Handler (Rust)РазрешенияACL (Capabilities Files)Android Manifest + Runtime PermissionTauri v2 Capabilities SystemВнешние ссылкиshell::openIntents (ACTION_VIEW)@tauri-apps/plugin-openerОпределение средыos.platform()os.platform()@tauri-apps/plugin-os3. Стратегия ввода-вывода (I/O Strategy): Преодоление Android Scoped StorageСамый сложный аспект миграции — фундаментальное различие в работе с файлами. Desktop использует иерархическую файловую систему (POSIX/NTFS). Android, начиная с версии 10, принудительно внедряет Scoped Storage, где пути к файлам виртуализированы, а прямой доступ через std::fs (стандартную библиотеку Rust) к файлам вне приватной директории приложения невозможен без использования дескрипторов файлов.3.1. Проблема content:// URIНа Desktop, когда пользователь выбирает файл через диалог, мы получаем строку вида /Users/name/doc.txt. Rust может открыть этот файл, прочитать или записать в него байты.На Android, использование @tauri-apps/plugin-dialog вернет URI вида:content://com.android.providers.downloads.documents/document/raw%3A%2Fstorage%2Femulated%2F0%2FDownload%2Fnote.nhpКритическое ограничение: Стандартная библиотека Rust (std::fs::File::open) не умеет работать с content:// URI. Попытка передать такую строку в std::fs приведет к ошибке No such file or directory.Однако, Tauri v2 Plugin FS был значительно переработан. Согласно анализу исходного кода и документации 1, JavaScript-биндинги плагина FS на Android автоматически распознают content:// URI и перенаправляют вызовы в нативный Android-код (Kotlin/Java), который использует ContentResolver для открытия потоков ввода-вывода.3.2. Реализация fs-driver-tauriМы должны обновить наш драйвер файловой системы, чтобы он корректно обрабатывал эти нюансы, оставаясь прозрачным для ядра.Файл: packages/drivers/tauri/src/index.tsTypeScriptimport { 
  readTextFile, 
  writeTextFile, 
  readFile, 
  writeFile,
  BaseDirectory,
  exists 
} from '@tauri-apps/plugin-fs';
import { platform } from '@tauri-apps/plugin-os';
import { IFileSystem } from '@notehub/fs-manager';

/**
 * Tauri v2 Unified File System Driver.
 * Handles bridging between POSIX paths (Desktop) and Content URIs (Android).
 */
export class TauriFileSystemDriver implements IFileSystem {
  private _platform: string | null = null;

  async init(): Promise<void> {
    this._platform = await platform();
    console.log(` Initialized on platform: ${this._platform}`);
  }

  private isAndroid(): boolean {
    return this._platform === 'android';
  }

  /**
   * Reads a file. On Android, strictly relies on the plugin's ability 
   * to handle content:// URIs passed from the Dialog plugin.
   */
  async read(path: string, encoding: 'utf8' | 'binary' = 'utf8'): Promise<string | Uint8Array> {
    try {
      // NOTE: BaseDirectory is NOT used when an absolute path or content URI is provided.
      // Tauri v2 heuristic: if path starts with /, drive letter, or scheme, BaseDirectory is ignored.
      if (encoding === 'utf8') {
        return await readTextFile(path);
      } else {
        return await readFile(path);
      }
    } catch (error) {
      console.error(` Read failure for ${path}:`, error);
      // Transform generic Rust errors into Notehub Core errors
      throw new Error(`Unable to read file: ${path}. Reason: ${String(error)}`);
    }
  }

  /**
   * Writes to a file. 
   * Critical: On Android, writing to a content URI usually implies 
   * rewriting an existing file descriptor obtained via 'save' dialog.
   */
  async write(path: string, content: string | Uint8Array): Promise<void> {
    try {
      if (typeof content === 'string') {
        await writeTextFile(path, content);
      } else {
        await writeFile(path, content);
      }
    } catch (error) {
      console.error(` Write failure for ${path}:`, error);
      throw new Error(`Unable to write file: ${path}. Access might be revoked.`);
    }
  }

  /**
   * Checks existence.
   * On Android, this verifies if the ContentResolver can still locate the resource.
   */
  async exists(path: string): Promise<boolean> {
    try {
      return await exists(path);
    } catch (e) {
      return false;
    }
  }
}
3.3. Конфигурация Capabilities (ACL)Безопасность в Tauri v2 построена на Capabilities. Это JSON/TOML файлы, определяющие, к каким API и путям имеет доступ фронтенд. Для Android нам необходимо создать отдельный набор разрешений, учитывающий специфику путей.Файл: src-tauri/capabilities/mobile.jsonJSON{
  "$schema": "../gen/schemas/mobile-schema.json",
  "identifier": "mobile-capability",
  "description": "Capability set for Android and iOS execution",
  "windows": ["main"],
  "platforms": ["android", "ios"],
  "permissions":
    }
  ]
}
Анализ конфигурации:$DOCUMENT: На Android это мапится в приватную директорию документов приложения (Context.getFilesDir()), а не в публичную папку "Документы".2 Это критически важно.Публичное хранилище: Чтобы читать файлы из публичной папки "Documents" или "Downloads", мы не можем просто добавить их в allow scope, так как пути там виртуальные. Мы полагаемся на то, что plugin-dialog возвращает URI, к которому у приложения уже есть временные права доступа (grantUriPermission), выданные системой при выборе файла пользователем.fs:default: Включает базовые команды чтения/записи.Android Manifest (gen/android/app/src/main/AndroidManifest.xml):Для работы plugin-fs и plugin-dialog на старых версиях Android или для специфических кейсов необходимо добавить разрешения:XML<manifest...>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
</manifest>
Примечание: В Android 10+ (targetSdkVersion >= 29) прямой доступ к файловой системе deprecated, и основной механизм взаимодействия — через Picker (Dialog), который не требует READ_EXTERNAL_STORAGE для выбранных файлов.4. Стратегия загрузки Synapse (SystemJS on Mobile)Текущий механизм загрузки плагинов (ZipLoader -> Blob URL) был помечен в аудите как критически уязвимый и производительный риск для мобильных устройств. Распаковка архива в JS-память вызывает Memory Pressure, что на Android часто приводит к принудительному закрытию приложения (OOM Killer). Кроме того, blob: URL часто блокируются строгими CSP (Content Security Policy) в WebView.Решение: Перенос распаковки и отдачи файлов на сторону Rust через Custom Protocol.4.1. Протокол http://plugin.localhostTauri v2 позволяет регистрировать кастомные схемы URI. Однако на Android существуют жесткие ограничения: схема plugin:// не поддерживается нативным WebView должным образом для загрузки скриптов из-за CORS и смешанного контента.Tauri v2 автоматически переписывает кастомные протоколы в http://<scheme>.localhost на Windows и Android.3Новый поток данных:SystemJS запрашивает: http://plugin.localhost/<plugin_id>/main.jsAndroid WebView перехватывает запрос.Rust Backend (Tauri) получает запрос, парсит путь.Rust находит соответствующий .nhp (zip) архив на диске.Rust читает нужный файл из архива (stream) и отдает байты обратно в WebView.Этот подход обеспечивает Zero-Copy (почти) передачу данных и не занимает JS-heap.4.2. Реализация Rust BackendНеобходимо модифицировать src-tauri/src/lib.rs для регистрации протокола.Rustuse tauri::{
    AppHandle, Builder, Manager, Runtime, 
    http::{Response, StatusCode, header::CONTENT_TYPE}
};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use zip::ZipArchive; // crate: zip = "0.6"

// Состояние для хранения путей к зарегистрированным плагинам
struct PluginRegistry {
    // Map<PluginID, PathToNhpFile>
    archives: HashMap<String, std::path::PathBuf>,
}

pub fn run() {
    Builder::default()
       .setup(|app| {
            // Инициализация реестра плагинов
            app.manage(Arc::new(Mutex::new(PluginRegistry { 
                archives: HashMap::new() 
            })));
            Ok(())
        })
        // Регистрация протокола "plugin"
        // На Android это будет доступно как http://plugin.localhost/
       .register_uri_scheme_protocol("plugin", |app, request| {
            let url = request.uri().path(); // например: /my-plugin-id/main.js
            
            // Парсинг URL
            // Ожидаем формат: /<plugin_id>/<path_to_file>
            let components: Vec<&str> = url.trim_start_matches('/').splitn(2, '/').collect();
            
            if components.len()!= 2 {
                return Response::builder()
                   .status(StatusCode::BAD_REQUEST)
                   .body(vec!)
                   .unwrap();
            }

            let plugin_id = components;
            let file_path = components;

            // Доступ к состоянию
            let state = app.state::<Arc<Mutex<PluginRegistry>>>();
            let registry = state.lock().unwrap();

            if let Some(archive_path) = registry.archives.get(plugin_id) {
                // Открытие ZIP архива
                if let Ok(file) = File::open(archive_path) {
                    if let Ok(mut archive) = ZipArchive::new(file) {
                        if let Ok(mut zfile) = archive.by_name(file_path) {
                            let mut buffer = Vec::new();
                            if zfile.read_to_end(&mut buffer).is_ok() {
                                // Определение MIME-типа (упрощенно)
                                let mime = if file_path.ends_with(".js") {
                                    "application/javascript"
                                } else if file_path.ends_with(".json") {
                                    "application/json"
                                } else {
                                    "application/octet-stream"
                                };

                                return Response::builder()
                                   .status(StatusCode::OK)
                                   .header(CONTENT_TYPE, mime)
                                   .header("Access-Control-Allow-Origin", "*") // Важно для CORS!
                                   .body(buffer)
                                   .unwrap();
                            }
                        }
                    }
                }
            }

            // Файл не найден
            Response::builder()
               .status(StatusCode::NOT_FOUND)
               .body("File not found in plugin archive".as_bytes().to_vec())
               .unwrap()
        })
       .plugin(tauri_plugin_fs::init())
       .plugin(tauri_plugin_os::init())
       .plugin(tauri_plugin_dialog::init())
       .plugin(tauri_plugin_opener::init()) // Замена shell::open
       .run(tauri::generate_context!())
       .expect("error while running tauri application");
}
4.3. Настройка CSP (Content Security Policy)Для работы SystemJS и загрузки скриптов с нашего кастомного домена, необходимо ослабить CSP в tauri.conf.json.Файл: src-tauri/tauri.conf.jsonJSON{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self' ipc: http://ipc.localhost",
        "script-src": "'self' 'unsafe-eval' 'unsafe-inline' http://plugin.localhost",
        "connect-src": "'self' http://plugin.localhost",
        "img-src": "'self' blob: data: http://plugin.localhost asset: http://asset.localhost"
      }
    }
  }
}
Важно: unsafe-eval необходим для SystemJS, так как он часто использует eval или new Function для выполнения модулей. Хотя это снижает безопасность, в контексте микроядра, загружающего произвольный код плагинов, это неизбежный компромисс. Мы минимизируем риск, контролируя источник загрузки через Rust-бэкенд.5. Адаптация UI (Layout Adaptation): Responsive TauriПроблема: Десктопный UI использует Ribbon (верхнюю ленту) и плавающие окна. На телефоне это неюзабельно. Необходимо трансформировать UI в Drawer (боковое меню) и Stack-навигацию.5.1. Определение платформыCSS Media Queries (@media (max-width:...) недостаточно, так как они не знают о физических возможностях устройства (наличие кнопки "Назад", Safe Area).Мы будем использовать плагин @tauri-apps/plugin-os для инъекции контекста платформы.Код: packages/core/src/platform/PlatformContext.tsxTypeScriptimport { platform } from '@tauri-apps/plugin-os';
import React, { createContext, useContext, useEffect, useState } from 'react';

type PlatformType = 'linux' | 'windows' | 'macos' | 'android' | 'ios';

const PlatformCtx = createContext<{ os: PlatformType; isMobile: boolean }>({
  os: 'linux',
  isMobile: false,
});

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [os, setOs] = useState<PlatformType>('linux');

  useEffect(() => {
    platform().then((currentOs) => {
      setOs(currentOs as PlatformType);
      // Устанавливаем атрибут на body для глобальных CSS-правил
      document.body.setAttribute('data-platform', currentOs);
      if (currentOs === 'android' |

| currentOs === 'ios') {
        document.body.classList.add('touch-mode');
      }
    });
  },);

  const isMobile = os === 'android' |

| os === 'ios';

  return (
    <PlatformCtx.Provider value={{ os, isMobile }}>
      {children}
    </PlatformCtx.Provider>
  );
};
5.2. Трансформация через React PortalsВместо условного рендеринга (isMobile? <MobileHeader /> : <DesktopHeader />), который размонтирует компоненты и теряет их состояние (ввод текста, скролл), мы используем React Portals.Компоненты (например, "Панель инструментов редактора") рендерятся в портал EditorToolbarPortal.Desktop Layout: Размещает div id="editor-toolbar-portal" в верхней части экрана.Mobile Layout: Размещает этот же div в нижней выдвижной панели (Bottom Sheet).Сам компонент тулбара не знает, где он находится. Он просто "телепортируется" в нужное место DOM-дерева, сохраняя свой инстанс React.6. Информация о платформе и открытие ссылокАудит выявил прямую зависимость от app.getVersion(). В Tauri v2 модули были реорганизованы.6.1. Абстракция версионированияВместо прямого импорта создаем сервис. Нам также понадобится плагин tauri-plugin-package-info (не входит в стандартный набор, но часто необходим) или использование команды Rust.Простейший способ в v2 — использовать getVersion из @tauri-apps/api/app. Этот API работает и на мобильных устройствах, если проброшен через IPC.TypeScriptimport { getVersion } from '@tauri-apps/api/app';

export const getAppVersion = async (): Promise<string> => {
  try {
    return await getVersion();
  } catch (e) {
    return '0.0.0-dev';
  }
};
6.2. Открытие ссылок (plugin-opener)Ранее использовался shell.open. В Tauri v2 появился специальный плагин Opener, который унифицирует открытие внешних ссылок и файлов. На Android он использует Intent с ACTION_VIEW.Миграция:Удалить зависимость от shell для открытия ссылок.Использовать openUrl из plugin-opener.TypeScriptimport { openUrl } from '@tauri-apps/plugin-opener';

// Работает и на Desktop, и на Android
await openUrl('https://notehub.app');
7. План миграции (Migration Steps)Для реализации RFC-009 необходимо выполнить следующие шаги в репозитории.Шаг 1: Подготовка среды и зависимостейОчистка: Удалить папку src-capacitor и зависимости @capacitor/* из package.json.Инициализация Android:Bash# Установка таргетов Rust
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
# Инициализация проекта
npm run tauri android init
Установка плагинов v2:Bashnpm install @tauri-apps/plugin-fs @tauri-apps/plugin-os @tauri-apps/plugin-dialog @tauri-apps/plugin-opener @tauri-apps/api
Cargo.toml (src-tauri/Cargo.toml):Ini, TOML[dependencies]
tauri = { version = "2.0.0", features = ["protocol-asset"] }
tauri-plugin-fs = "2.0.0"
tauri-plugin-os = "2.0.0"
tauri-plugin-dialog = "2.0.0"
tauri-plugin-opener = "2.0.0"
zip = "0.6" # Для распаковки плагинов
Шаг 2: Модификация Rust-бэкендаОбновить src-tauri/src/lib.rs кодом из раздела 4.2 (регистрация протокола plugin).Убедиться, что tauri-plugin-fs инициализирован.Шаг 3: Настройка разрешений (Permissions)Создать src-tauri/capabilities/mobile.json (см. раздел 3.3).Добавить в src-tauri/tauri.conf.json ссылку на новую capability в секции app.security.capabilities.Шаг 4: Рефакторинг TypeScriptОбновить fs-driver-tauri (код из раздела 3.2).Обновить Synapse ZipLoader для использования http://plugin.localhost/... вместо распаковки в Blob.Заменить вызовы shell.open на opener.openUrl.Шаг 5: Сборка и тестированиеЗапуск эмулятора: npm run tauri android dev.Проверка логов в Logcat на предмет ошибок CSP.Тест загрузки тестового плагина .nhp.8. ЗаключениеПредложенная архитектура решает ключевые проблемы адаптации Notehub под мобильные устройства без компромиссов гибридных решений вроде Capacitor.Использование Tauri v2 Unified Architecture позволяет:Сохранить единую кодовую базу Rust для системной логики.Обеспечить высокую производительность загрузки плагинов через потоковую передачу данных из Rust в WebView (минуя JS Heap).Корректно работать с файловой системой Android, соблюдая требования Google Play по Scoped Storage.Данный RFC рекомендуется к немедленной реализации.