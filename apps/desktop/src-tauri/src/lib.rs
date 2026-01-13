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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PluginRegistry {
            archives: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![mount_plugin])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
                    let mut archive = zip::ZipArchive::new(file).map_err(|e| {
                         eprintln!("Failed to read zip: {}", e);
                         e
                    });
                    
                    if let Ok(mut archive) = archive {
                        let mut zip_file = archive.by_name(file_path);
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
