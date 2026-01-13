use std::collections::HashMap;
use std::sync::Mutex;
use std::path::PathBuf;
use tauri::{Manager, State};
use tauri::http::{Response, StatusCode, header};
use std::io::Read;

struct PluginRegistry {
    archives: Mutex<HashMap<String, PathBuf>>,
}

#[tauri::command]
fn mount_plugin(state: State<PluginRegistry>, id: String, path: String) {
    let mut archives = state.archives.lock().unwrap();
    eprintln!("Mounting plugin: {} at {}", id, path);
    archives.insert(id, PathBuf::from(path));
}

// =========== Android FS Commands ===========
// These commands use tauri-plugin-android-fs to handle content:// URIs

/// Android-specific folder picker using SAF (Storage Access Framework)
/// Returns the content:// URI of the selected folder, or null if cancelled
#[cfg(target_os = "android")]
#[tauri::command]
async fn pick_folder_android(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_android_fs::AndroidFsExt;
    use tauri_plugin_fs::FilePath;
    
    let api = app.android_fs_async();
    
    // Open folder picker dialog
    let result = api
        .file_picker()
        .pick_dir(None, false)
        .await
        .map_err(|e| format!("Failed to open folder picker: {}", e))?;
    
    match result {
        Some(uri) => {
            // Take persistable permission for this folder (critical for persistence across reboots)
            api.take_persistable_uri_permission(&uri)
                .await
                .map_err(|e| format!("Failed to take permission: {}", e))?;
            
            // Convert FileUri to FilePath to get the URL string
            let file_path: FilePath = uri.into();
            
            // Extract the URI string from FilePath
            let uri_string = match file_path {
                FilePath::Url(url) => url.to_string(),
                FilePath::Path(path) => path.to_string_lossy().to_string(),
            };
            
            Ok(Some(uri_string))
        }
        None => Ok(None),
    }
}

/// Check if a file/directory exists
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_exists(app: tauri::AppHandle, base_uri: String, path: String) -> Result<bool, String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    let api = app.android_fs_async();
    // Wrap plain string in JSON for FileUri parsing
    let json_uri = serde_json::json!({ "uri": base_uri }).to_string();
    let uri = FileUri::from_json_str(&json_uri)
        .map_err(|e| format!("Invalid URI: {}", e))?;
    
    // Use metadata to check existence, as exists() might not be available or requires different args
    // If path is empty, check base_uri itself
    if path.is_empty() {
        match api.get_metadata(&uri).await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    } else {
        // Only create_dir_all supports relative paths directly in some versions.
        // For others, we might need manual resolution? 
        // Let's assume common operations don't support (base, relative) directly based on errors.
        // BUT we need to try. If API doesn't support it, we are stuck.
        // Wait, if create_dir_all supports it, maybe others do?
        // If not, we can use public_storage().resolve?? No this is SAF picker.
        
        // Strategy: 
        // We know create_dir_all(base, relative) works.
        // For read/write/exists, we need the child URI.
        // How to get child URI from (base, relative)?
        // There isn't a "resolve" method exposed in the main API based on docs.
        
        // FALLBACK:
        // Attempt to guess the child URI? No impossible.
        // Try to enumerate? Slow.
        
        // Let's assume they implemented typical fs traits.
        // Actually, looking at the error for create_dir_all: it takes (dir: &FileUri, relative_path).
        // Let's TRY using that pattern for others, maybe the method names are different?
        // read(uri) -> takes URI.
        
        // If I cant resolve, I CANNOT implement this without a Java method or a Rust helper.
        // tauri-plugin-android-fs v24.1.0 seems to expose `Entry` which has `uri`.
        
        // Let's try to find the child manually by walking the path components.
        // This is slow but correct.
        
        // Implementation of lookup:
        let mut current_uri = uri;
        
        // Handle parts
        if !path.is_empty() {
             let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
             for part in parts {
                 let entries = api.read_dir(&current_uri)
                    .await
                    .map_err(|e| format!("Failed to read dir for traversal: {}", e))?;
                 
                 // entries is an Iterator
                 let found = entries
                    .filter(|e| e.name() == part)
                    .next();
                 
                 match found {
                     Some(entry) => {
                         current_uri = entry.uri().clone();
                     },
                     None => return Ok(false) // part not found
                 }
             }
        }
        
        Ok(true)
    }
}

/// Helper to resolve a relative path from a base URI to a final FileUri
/// Returns error if not found.
#[cfg(target_os = "android")]
async fn resolve_uri(api: &tauri_plugin_android_fs::api::api_async::AndroidFs<tauri::Wry>, base_uri: &tauri_plugin_android_fs::FileUri, path: &str) -> Result<tauri_plugin_android_fs::FileUri, String> {
    use tauri_plugin_android_fs::AndroidFsExt;

    if path.is_empty() {
        return Ok(base_uri.clone());
    }

    let mut current_uri = base_uri.clone();
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    
    for part in parts {
        let entries = api.read_dir(&current_uri)
            .await
            .map_err(|e| format!("Failed to traverse: {}", e))?;
            
        let found = entries
            .filter(|e| e.name() == part)
            .next();
            
        match found {
            Some(entry) => {
                current_uri = entry.uri().clone();
            },
            None => return Err(format!("Path component not found: {}", part))
        }
    }
    
    Ok(current_uri)
}

/// Read a file as binary data
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_read_file(app: tauri::AppHandle, base_uri: String, path: String) -> Result<Vec<u8>, String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    let api = app.android_fs_async();
    let json_uri = serde_json::json!({ "uri": base_uri }).to_string();
    let base = FileUri::from_json_str(&json_uri).map_err(|e| format!("Invalid Base URI: {}", e))?;
    
    let target_uri = resolve_uri(&api, &base, &path).await?;
    
    api.read(&target_uri)
        .await
        .map_err(|e| format!("read_file failed: {}", e))
}

/// Read a file as UTF-8 text
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_read_text_file(app: tauri::AppHandle, base_uri: String, path: String) -> Result<String, String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    let api = app.android_fs_async();
    let json_uri = serde_json::json!({ "uri": base_uri }).to_string();
    let base = FileUri::from_json_str(&json_uri).map_err(|e| format!("Invalid Base URI: {}", e))?;
    
    let target_uri = resolve_uri(&api, &base, &path).await?;
    
    api.read_to_string(&target_uri)
        .await
        .map_err(|e| format!("read_text_file failed: {}", e))
}

/// Write binary data to a file
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_write_file(app: tauri::AppHandle, base_uri: String, path: String, data: Vec<u8>) -> Result<(), String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    let api = app.android_fs_async();
    let json_uri = serde_json::json!({ "uri": base_uri }).to_string();
    let base = FileUri::from_json_str(&json_uri).map_err(|e| format!("Invalid Base URI: {}", e))?;
    
    // For write, the file might not exist.
    // If it exists, resolve it.
    // If not, resolve parent and create child?
    // tauri-plugin-android-fs doesn't seem to expose separate create_file vs write.
    // Usually write() takes a URI.
    // If file doesn't exist, we must Create it first using parent URI.
    
    match resolve_uri(&api, &base, &path).await {
        Ok(uri) => {
             // File exists, write to it
             api.write(&uri, &data).await.map_err(|e| format!("write failed: {}", e))
        },
        Err(_) => {
            // File likely doesn't exist. Try to resolve parent and create.
            // Split path into parent and filename
            let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
            if parts.len() == 0 {
                return Err("Cannot write to empty path".to_string());
            }
            
            let filename = parts.last().unwrap();
            let parent_path = parts[0..parts.len()-1].join("/");
            
            let parent_uri = resolve_uri(&api, &base, &parent_path).await?;
            
            // Create file
            // Note: create_dir_all exists, but create_file?
            // api.create(&parent_uri, filename, mime)?
            // We'll try generic binary mime type
            
            // Check if create method exists. It should.
            // If not, we might be stuck again. But usually create(dir, name, mime) exists.
            let new_uri = api.create_new_file(&parent_uri, filename, Some("application/octet-stream"))
                .await
                .map_err(|e| format!("create_new_file failed: {}", e))?;
                
            api.write(&new_uri, &data).await.map_err(|e| format!("write failed: {}", e))
        }
    }
}

/// Write text to a file
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_write_text_file(app: tauri::AppHandle, base_uri: String, path: String, content: String) -> Result<(), String> {
    // Reuse write_file logic by converting to bytes
    android_fs_write_file(app, base_uri, path, content.into_bytes()).await
}

/// Create a directory
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_create_dir(app: tauri::AppHandle, base_uri: String, path: String, recursive: bool) -> Result<String, String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    let api = app.android_fs_async();
    let json_uri = serde_json::json!({ "uri": base_uri }).to_string();
    let base = FileUri::from_json_str(&json_uri).map_err(|e| format!("Invalid Base URI: {}", e))?;
    
    if recursive {
        // create_dir_all takes (dir, relative_path)
        let new_uri = api.create_dir_all(&base, &path)
            .await
            .map_err(|e| format!("create_dir_all failed: {}", e))?;
        new_uri.to_json_string().map_err(|e| format!("Serialize error: {}", e))
    } else {
        // create_dir might interpret arg as URI (like read) or (base, name)
        // If we assume it behaves like other ops, we should resolve parent and create child.
        let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        if parts.is_empty() { return Ok(base_uri); } // root already exists
        
        let new_dir_name = parts.last().unwrap();
        let parent_path = parts[0..parts.len()-1].join("/");
        let parent_uri = resolve_uri(&api, &base, &parent_path).await?;
        
        let new_uri = api.create_dir_all(&parent_uri, new_dir_name)
             .await
             .map_err(|e| format!("create_dir failed: {}", e))?;
             
        new_uri.to_json_string().map_err(|e| format!("Serialize error: {}", e))
    }
}

/// Read directory contents
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_read_dir(app: tauri::AppHandle, base_uri: String, path: String) -> Result<Vec<serde_json::Value>, String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    let api = app.android_fs_async();
    let json_uri = serde_json::json!({ "uri": base_uri }).to_string();
    let base = FileUri::from_json_str(&json_uri).map_err(|e| format!("Invalid Base URI: {}", e))?;
    
    let target_uri = resolve_uri(&api, &base, &path).await?;
    
    let entries = api.read_dir(&target_uri)
        .await
        .map_err(|e| format!("read_dir failed: {}", e))?;
    
    let result: Vec<serde_json::Value> = entries.map(|entry| {
        serde_json::json!({
            "name": entry.name(),
            "isDirectory": entry.is_dir(),
            "isFile": !entry.is_dir(),
            "uri": entry.uri().to_json_string().unwrap_or_default()
        })
    }).collect();
    
    Ok(result)
}

/// Remove a file
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_remove_file(app: tauri::AppHandle, base_uri: String, path: String) -> Result<(), String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    let api = app.android_fs_async();
    let json_uri = serde_json::json!({ "uri": base_uri }).to_string();
    let base = FileUri::from_json_str(&json_uri).map_err(|e| format!("Invalid Base URI: {}", e))?;
    
    let target_uri = resolve_uri(&api, &base, &path).await?;
    
    api.remove_file(&target_uri)
        .await
        .map_err(|e| format!("remove_file failed: {}", e))
}

/// Remove a directory
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_remove_dir(app: tauri::AppHandle, base_uri: String, path: String, recursive: bool) -> Result<(), String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    let api = app.android_fs_async();
    let json_uri = serde_json::json!({ "uri": base_uri }).to_string();
    let base = FileUri::from_json_str(&json_uri).map_err(|e| format!("Invalid Base URI: {}", e))?;
    
    let target_uri = resolve_uri(&api, &base, &path).await?;
    
    if recursive {
        api.remove_dir_all(&target_uri)
            .await
            .map_err(|e| format!("remove_dir_all failed: {}", e))
    } else {
         // remove_dir usually requires empty dir
        api.remove_dir(&target_uri)
            .await
            .map_err(|e| format!("remove_dir failed: {}", e))
    }
}

/// Rename/move a file or directory
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_rename(app: tauri::AppHandle, base_uri: String, old_path: String, new_name: String) -> Result<String, String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    let api = app.android_fs_async();
    let json_uri = serde_json::json!({ "uri": base_uri }).to_string();
    let base = FileUri::from_json_str(&json_uri).map_err(|e| format!("Invalid Base URI: {}", e))?;
    
    let target_uri = resolve_uri(&api, &base, &old_path).await?;
    
    let new_uri = api.rename(&target_uri, &new_name)
        .await
        .map_err(|e| format!("rename failed: {}", e))?;
    
    new_uri.to_json_string()
        .map_err(|e| format!("Failed to serialize URI: {}", e))
}

// =========== Non-Android Stubs ===========
// Return errors on non-Android platforms

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn pick_folder_android() -> Result<Option<String>, String> {
    Err("pick_folder_android is only available on Android".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn android_fs_exists(_base_uri: String, _path: String) -> Result<bool, String> {
    Err("android_fs_exists is only available on Android".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn android_fs_read_file(_base_uri: String, _path: String) -> Result<Vec<u8>, String> {
    Err("android_fs_read_file is only available on Android".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn android_fs_read_text_file(_base_uri: String, _path: String) -> Result<String, String> {
    Err("android_fs_read_text_file is only available on Android".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn android_fs_write_file(_base_uri: String, _path: String, _data: Vec<u8>) -> Result<(), String> {
    Err("android_fs_write_file is only available on Android".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn android_fs_write_text_file(_base_uri: String, _path: String, _content: String) -> Result<(), String> {
    Err("android_fs_write_text_file is only available on Android".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn android_fs_create_dir(_base_uri: String, _path: String, _recursive: bool) -> Result<String, String> {
    Err("android_fs_create_dir is only available on Android".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn android_fs_read_dir(_base_uri: String, _path: String) -> Result<Vec<serde_json::Value>, String> {
    Err("android_fs_read_dir is only available on Android".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn android_fs_remove_file(_base_uri: String, _path: String) -> Result<(), String> {
    Err("android_fs_remove_file is only available on Android".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn android_fs_remove_dir(_base_uri: String, _path: String, _recursive: bool) -> Result<(), String> {
    Err("android_fs_remove_dir is only available on Android".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn android_fs_rename(_base_uri: String, _old_path: String, _new_name: String) -> Result<String, String> {
    Err("android_fs_rename is only available on Android".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .manage(PluginRegistry {
            archives: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            mount_plugin,
            pick_folder_android,
            android_fs_exists,
            android_fs_read_file,
            android_fs_read_text_file,
            android_fs_write_file,
            android_fs_write_text_file,
            android_fs_create_dir,
            android_fs_read_dir,
            android_fs_remove_file,
            android_fs_remove_dir,
            android_fs_rename
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init());
    
    // Android-specific: SAF folder picker support
    #[cfg(target_os = "android")]
    {
        builder = builder.plugin(tauri_plugin_android_fs::init());
    }
    
    builder
        .register_uri_scheme_protocol("plugin", move |app, request| {
            // let url = request.uri().to_string();
            // Expected format: http://plugin.localhost/<id>/<path> or plugin://<id>/<path>
            // We need to parse <id> and <path>
            
            // Basic parsing strategy: 
            // 1. Remove scheme and host
            // 2. Split first component as ID, rest as path
            
            let path_and_query = request.uri().path();
            // path starts with /, so e.g. /plugin-id/assets/file.js
            
            // Remove leading slash
            let trim_path = path_and_query.trim_start_matches('/');
            let parts: Vec<&str> = trim_path.splitn(2, '/').collect();
            
            if parts.len() < 2 {
                 return Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Vec::new())
                    .unwrap();
            }
            
            let plugin_id = parts[0];
            let file_path = parts[1];
            
            let state = app.app_handle().state::<PluginRegistry>();
            let archives = state.archives.lock().unwrap();
            
            if let Some(archive_path) = archives.get(plugin_id) {
                let file = std::fs::File::open(archive_path).map_err(|e| {
                     eprintln!("Failed to open archive: {}", e);
                     e
                });
                
                if let Ok(file) = file {
                    let archive = zip::ZipArchive::new(file).map_err(|e| {
                         eprintln!("Failed to read zip: {}", e);
                         e
                    });
                    
                    if let Ok(mut archive) = archive {
                        let zip_file = archive.by_name(file_path);
                         // Handle nested paths or different separators if needed, but usually zip uses /
                        
                        if let Ok(mut zip_file) = zip_file {
                            let mut buffer = Vec::new();
                            if zip_file.read_to_end(&mut buffer).is_ok() {
                                let mime_type = mime_guess::from_path(file_path).first_or_octet_stream();
                                
                                return Response::builder()
                                    .status(StatusCode::OK)
                                    .header("Access-Control-Allow-Origin", "*")
                                    .header(header::CONTENT_TYPE, mime_type.as_ref())
                                    .body(buffer)
                                    .unwrap();
                            }
                        }
                    }
                }
            }
            
            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header("Access-Control-Allow-Origin", "*")
                .body("Not Found".as_bytes().to_vec())
                .unwrap()
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
