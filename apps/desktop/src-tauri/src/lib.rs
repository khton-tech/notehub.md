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
/// Returns the JSON-serialized FileUri of the selected folder, or null if cancelled
#[cfg(target_os = "android")]
#[tauri::command]
async fn pick_folder_android(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_android_fs::AndroidFsExt;
    
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
            api.file_picker().persist_uri_permission(&uri)
                .await
                .map_err(|e| format!("Failed to take permission: {}", e))?;
            
            // IMPORTANT: Serialize FileUri to JSON to preserve documentTopTreeUri
            // This field is critical for SAF directory operations (create_dir_all, etc.)
            // Previously we converted to FilePath which lost this field, causing "Unsupported operation" errors
            let json_string = uri.to_json_string()
                .map_err(|e| format!("Failed to serialize URI: {}", e))?;
            
            eprintln!("pick_folder_android: returning JSON: {}", json_string);
            Ok(Some(json_string))
        }
        None => Ok(None),
    }
}


fn sanitize_saf_uri(uri: &str) -> String {
    // Android SAF sometimes returns URIs like .../tree/ID/document/ID
    // This redundancy can confuse DocumentFile.fromTreeUri, causing NPEs.
    // If we detect this pattern (and tree ID matches document ID), we strip the document part.
    if let (Some(tree_pos), Some(doc_pos)) = (uri.find("/tree/"), uri.find("/document/")) {
        if doc_pos > tree_pos {
            let tree_id = &uri[tree_pos + 6..doc_pos];
            if uri.len() > doc_pos + 10 {
                let doc_id = &uri[doc_pos + 10..];
                // Check if IDs match (taking into account URL encoding if needed, but usually exact string match)
                if tree_id == doc_id {
                    return uri[..doc_pos].to_string();
                }
            }
        }
    }
    uri.to_string()
}

/// Check if a file/directory exists
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_exists(app: tauri::AppHandle, base_uri: String, path: String) -> Result<bool, String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    let api = app.android_fs_async();
    // base_uri is now a JSON string from pick_folder_android
    let uri = FileUri::from_json_str(&base_uri)
        .map_err(|e| format!("Invalid URI JSON: {}", e))?;
    
    // Use metadata to check existence, as exists() might not be available or requires different args
    // If path is empty, check base_uri itself
    // Use metadata to check existence
    // If path is empty, check base_uri itself
    if path.is_empty() {
        match api.get_metadata(&uri).await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    } else {
        // Use shared resolve_uri which now has fallback logic
        match resolve_uri(&api, &uri, &path).await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
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
        let current_uri_str = {
             let file_path: tauri_plugin_fs::FilePath = current_uri.clone().into();
             match file_path {
                 tauri_plugin_fs::FilePath::Url(url) => url.to_string(),
                 tauri_plugin_fs::FilePath::Path(path) => path.to_string_lossy().to_string(),
             }
        };
        
        // Try to read directory
        let entries_result = api.read_dir(&current_uri).await;
        
        match entries_result {
            Ok(entries) => {
                let found = entries
                    .filter(|e| e.name() == part)
                    .next();
                
                match found {
                    Some(entry) => {
                        current_uri = entry.uri().clone();
                    },
                    None => return Err(format!("Path component not found: {}", part))
                }
            },
            Err(e) => {
                 // Fallback: read_dir failed (likely NPE or permission issue on some Android versions)
                 // Try to construct the URI manually using standard Android conventions
                 // Standard format: parent_uri + "%2F" + encoded_child_name
                 eprintln!("read_dir failed for {}, attempting fallback for child {}. Error: {}", current_uri_str, part, e);
                 
                 // Simple URL encoding for the part
                 // We need to encode the part name to be appended to the URI path
                 // Since we don't have a full URL library active here, we'll do basic replacement
                 // or hopefully assume the part doesn't contain crazy characters for now.
                 // Better strategy: Use a safe character set.
                 
                 // Note: Android URIs for documents are usually: .../document/ID
                 // Child: .../document/ID%2Fchild
                 
                 // effective_uri = current_uri + "%2F" + part (encoded)
                 // BUT, current_uri comes from FileUri.
                 // We need to verify if this predicted URI actually exists.
                 
                 // Manual encoding of special chars for URI component
                 let encoded_part = part.replace(" ", "%20")
                                      .replace("/", "%2F")
                                      .replace(":", "%3A");
                 
                 let new_uri_string = format!("{}%2F{}", current_uri_str, encoded_part);
                 let json_uri = serde_json::json!({ "uri": new_uri_string }).to_string();
                 
                 match tauri_plugin_android_fs::FileUri::from_json_str(&json_uri) {
                     Ok(candidate_uri) => {
                         // Check if this candidate exists using metadata
                         match api.get_metadata(&candidate_uri).await {
                             Ok(_) => {
                                 // It exists! Use it.
                                 current_uri = candidate_uri;
                             },
                             Err(_) => {
                                 // Metadata check failed, so it probably doesn't exist
                                 return Err(format!("Path component not found (fallback failed): {}", part));
                             }
                         }
                     },
                     Err(parse_err) => {
                         return Err(format!("Failed to parse constructed URI: {}", parse_err));
                     }
                 }
            }
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
    // base_uri is now a JSON string from pick_folder_android
    let base = FileUri::from_json_str(&base_uri).map_err(|e| format!("Invalid Base URI JSON: {}", e))?;
    
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
    // base_uri is now a JSON string from pick_folder_android
    let base = FileUri::from_json_str(&base_uri).map_err(|e| format!("Invalid Base URI JSON: {}", e))?;
    
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
    // base_uri is now a JSON string from pick_folder_android
    let base = FileUri::from_json_str(&base_uri).map_err(|e| format!("Invalid Base URI JSON: {}", e))?;
    
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
async fn android_fs_create_dir(app: tauri::AppHandle, base_uri: String, path: String, _recursive: bool) -> Result<String, String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    eprintln!("android_fs_create_dir: base_uri={} path={}", base_uri, path);
    
    // base_uri is now a JSON string from pick_folder_android (e.g., {"uri": "...", "documentTopTreeUri": "..."})
    // We pass it directly to from_json_str which will properly parse both fields
    let api = app.android_fs_async();
    let base = FileUri::from_json_str(&base_uri).map_err(|e| format!("Invalid Base URI JSON: {}", e))?;
    
    // If path is empty, the directory already exists (it's the base)
    if path.is_empty() {
        eprintln!("Path is empty, returning base URI");
        return base.to_json_string().map_err(|e| format!("Serialize error: {}", e));
    }
    
    // Use create_dir_all which is the correct API for directory creation
    // This method properly handles SAF directory creation on all Android versions
    let new_dir_uri = api.create_dir_all(&base, &path)
        .await
        .map_err(|e| format!("Failed to create directory '{}': {}", path, e))?;
    
    eprintln!("Directory '{}' created successfully", path);
    new_dir_uri.to_json_string().map_err(|e| format!("Serialize error: {}", e))
}


/// Convert a tree URI to a document URI for write operations
/// Tree URI: content://com.android.externalstorage.documents/tree/primary%3Afolder
/// Document URI: content://com.android.externalstorage.documents/tree/primary%3Afolder/document/primary%3Afolder
#[cfg(target_os = "android")]
fn convert_tree_to_document_uri(uri: &str) -> String {
    // If already has /document/, return as-is
    if uri.contains("/document/") {
        return uri.to_string();
    }
    
    // Check if it's a tree URI
    if let Some(tree_pos) = uri.find("/tree/") {
        // Extract the tree ID (everything after /tree/)
        let tree_id = &uri[tree_pos + 6..];
        // Build document URI: original + /document/ + tree_id
        return format!("{}/document/{}", uri, tree_id);
    }
    
    // Not a tree URI, return as-is
    uri.to_string()
}

/// Read directory contents
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_fs_read_dir(app: tauri::AppHandle, base_uri: String, path: String) -> Result<Vec<serde_json::Value>, String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileUri};
    
    let api = app.android_fs_async();
    // base_uri is now a JSON string from pick_folder_android
    let base = FileUri::from_json_str(&base_uri).map_err(|e| format!("Invalid Base URI JSON: {}", e))?;
    
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
    // base_uri is now a JSON string from pick_folder_android
    let base = FileUri::from_json_str(&base_uri).map_err(|e| format!("Invalid Base URI JSON: {}", e))?;
    
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
    // base_uri is now a JSON string from pick_folder_android
    let base = FileUri::from_json_str(&base_uri).map_err(|e| format!("Invalid Base URI JSON: {}", e))?;
    
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
    // base_uri is now a JSON string from pick_folder_android
    let base = FileUri::from_json_str(&base_uri).map_err(|e| format!("Invalid Base URI JSON: {}", e))?;
    
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
        .setup(|app| {
            #[cfg(any(target_os = "linux", target_os = "macos", target_os = "windows"))]
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }
            Ok(())
        })
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
