pub mod backup;
pub mod models;
pub mod parsers;
pub mod adb;
pub mod utils;
pub mod converter;
pub mod shizuku;
pub mod saf;

use crate::backup::manager::create_backup;
use crate::models::ipc::{EngineType, StandardJson};

use crate::parsers::renpy::RenPyParser;
use crate::parsers::rpgmv::RpgMvParser;
use std::path::Path;
use tauri::{Emitter, Manager, State};
use std::sync::Arc;
use tokio::sync::{RwLock, oneshot, broadcast};
use serde::{Deserialize, Serialize};
use axum::{
    routing::{post, get},
    Json, Router, response::{IntoResponse, sse::{Event, Sse}},
};
use tower_http::cors::{Any, CorsLayer};
use dashmap::DashMap;
use uuid::Uuid;
use futures_util::stream::Stream;
use std::convert::Infallible;

#[derive(Default, Clone, Serialize, Deserialize)]
pub struct SaveState {
    pub parsed_variables: serde_json::Value,
    pub is_mcp_enabled: bool,
}

pub type SharedSaveState = Arc<RwLock<SaveState>>;

#[derive(Clone)]
pub struct AxumState {
    pub app_handle: tauri::AppHandle,
    pub mcp_channels: Arc<DashMap<String, oneshot::Sender<serde_json::Value>>>,
    pub mcp_broadcaster: broadcast::Sender<String>,
    pub save_state: SharedSaveState,
}

fn deep_merge(target: &mut serde_json::Value, source: &serde_json::Value) {
    if let (Some(target_obj), Some(source_obj)) = (target.as_object_mut(), source.as_object()) {
        for (key, val) in source_obj {
            if let Some(target_val) = target_obj.get_mut(key) {
                if target_val.is_object() && val.is_object() {
                    deep_merge(target_val, val);
                } else {
                    *target_val = val.clone();
                }
            } else {
                target_obj.insert(key.clone(), val.clone());
            }
        }
    } else {
        *target = source.clone();
    }
}

#[derive(Deserialize)]
pub struct McpRequestPayload {
    pub action: String,
    pub args: Option<serde_json::Value>,
}

async fn handle_mcp_call(
    axum::extract::State(state): axum::extract::State<AxumState>,
    Json(payload): Json<McpRequestPayload>,
) -> axum::response::Response {
    let is_enabled = state.save_state.read().await.is_mcp_enabled;
    if !is_enabled {
        return (
            axum::http::StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "MCP Bridge is currently disabled by the user." }))
        ).into_response();
    }

    let request_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();
    state.mcp_channels.insert(request_id.clone(), tx);

    let event_payload = serde_json::json!({
        "uuid": request_id,
        "action": payload.action,
        "args": payload.args.unwrap_or(serde_json::Value::Null)
    });

    if let Err(e) = state.app_handle.emit("mcp_request", event_payload) {
        state.mcp_channels.remove(&request_id);
        return (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to emit event: {}", e) }))
        ).into_response();
    }

    // Wait for the frontend to respond via the oneshot channel
    match rx.await {
        Ok(response) => Json(response).into_response(),
        Err(_) => {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Frontend failed to respond or timeout." }))
            ).into_response()
        }
    }
}

async fn sse_handler(
    axum::extract::State(state): axum::extract::State<AxumState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut rx = state.mcp_broadcaster.subscribe();
    
    let stream = async_stream::stream! {
        // Send an initial ping
        yield Ok(Event::default().data("connected"));
        
        while let Ok(msg) = rx.recv().await {
            yield Ok(Event::default().data(msg));
        }
    };

    Sse::new(stream)
}

#[tauri::command]
async fn toggle_mcp(enabled: bool, state: State<'_, SharedSaveState>) -> Result<(), String> {
    let mut save_state = state.write().await;
    save_state.is_mcp_enabled = enabled;
    Ok(())
}

#[tauri::command]
async fn close_save_file(state: State<'_, SharedSaveState>) -> Result<(), String> {
    let mut save_data = state.write().await;
    save_data.parsed_variables = serde_json::json!({}); 
    Ok(())
}

#[tauri::command]
fn get_mcp_script_path(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path().app_config_dir()
        .map_err(|_| "Failed to get config dir".to_string())?
        .join("mcp-server.js");
    // Replace backslashes with forward slashes for valid JSON string representation on Windows
    Ok(path.to_string_lossy().to_string().replace("\\", "/"))
}

#[tauri::command]
async fn mcp_respond(
    uuid: String,
    payload: serde_json::Value,
    state: State<'_, AxumState>,
) -> Result<(), String> {
    if let Some((_, tx)) = state.mcp_channels.remove(&uuid) {
        let _ = tx.send(payload);
    }
    Ok(())
}

#[tauri::command]
fn mcp_notify_event(event_name: String, state: State<'_, AxumState>) -> Result<(), String> {
    let _ = state.mcp_broadcaster.send(event_name);
    Ok(())
}

#[tauri::command]
async fn apply_ai_mutation(payload: serde_json::Value, state: State<'_, SharedSaveState>) -> Result<serde_json::Value, String> {
    let mut save_data = state.write().await;
    deep_merge(&mut save_data.parsed_variables, &payload);
    Ok(save_data.parsed_variables.clone())
}

#[tauri::command]
async fn load_save_file(path: String, state: State<'_, SharedSaveState>) -> Result<serde_json::Value, String> {
    let content = tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
    let parsed: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    
    let mut save_state = state.write().await;
    save_state.parsed_variables = parsed.clone();
    
    Ok(parsed)
}

#[tauri::command]
async fn mcp_create_backup(path: String, app: tauri::AppHandle) -> Result<String, String> {
    let backup_path = crate::backup::manager::create_backup(std::path::Path::new(&path), None, &app).await?;
    Ok(backup_path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn mcp_restore_backup(target_path: String, backup_path: String) -> Result<(), String> {
    tokio::fs::copy(&backup_path, &target_path)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_backups(app: tauri::AppHandle) -> Result<Vec<crate::backup::manager::BackupMetadata>, String> {
    crate::backup::manager::read_metadata_db(&app).await
}

#[tauri::command]
async fn delete_backup(id: String, app: tauri::AppHandle) -> Result<(), String> {
    crate::backup::manager::delete_backup_by_id(&id, &app).await
}

#[tauri::command]
async fn create_named_backup(path: String, notes: String, app: tauri::AppHandle) -> Result<String, String> {
    let backup_path = crate::backup::manager::create_backup(std::path::Path::new(&path), Some(notes), &app).await?;
    Ok(backup_path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn create_named_backup_from_bytes(path: String, bytes: Vec<u8>, notes: String, app: tauri::AppHandle) -> Result<String, String> {
    let backup_path = crate::backup::manager::create_backup_from_bytes(std::path::Path::new(&path), &bytes, Some(notes), &app).await?;
    Ok(backup_path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn restore_backup_by_id(id: String, app: tauri::AppHandle) -> Result<(), String> {
    crate::backup::manager::restore_backup_by_id(&id, &app).await
}

#[tauri::command]
async fn export_backup_by_id(id: String, export_path: String, app: tauri::AppHandle) -> Result<(), String> {
    crate::backup::manager::export_backup_by_id(&id, &export_path, &app).await
}

#[tauri::command]
async fn mcp_scan_pattern(base64_data: String, pattern: String) -> Result<Vec<usize>, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let decoded = STANDARD.decode(&base64_data).map_err(|e| e.to_string())?;
    
    let mut parsed_pattern: Vec<Option<u8>> = Vec::new();
    for token in pattern.split_whitespace() {
        if token == "??" || token == "?" {
            parsed_pattern.push(None);
        } else if let Ok(byte) = u8::from_str_radix(token, 16) {
            parsed_pattern.push(Some(byte));
        } else {
            return Err(format!("Invalid pattern token: {}", token));
        }
    }

    if parsed_pattern.is_empty() || parsed_pattern.len() > decoded.len() {
        return Ok(vec![]);
    }

    let mut results = Vec::new();
    let pat_len = parsed_pattern.len();
    
    for i in 0..=(decoded.len() - pat_len) {
        let mut match_found = true;
        for j in 0..pat_len {
            if let Some(expected) = parsed_pattern[j] {
                if decoded[i + j] != expected {
                    match_found = false;
                    break;
                }
            }
        }
        if match_found {
            results.push(i);
            if results.len() >= 250 {
                break;
            }
        }
    }
    
    Ok(results)
}

#[tauri::command]
async fn calculate_entropy(base64_data: String) -> Result<f64, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let decoded = STANDARD.decode(&base64_data).map_err(|e| e.to_string())?;
    Ok(crate::parsers::reverse_engineering::RevEngUtils::calculate_entropy(&decoded))
}

#[tauri::command]
async fn extract_strings(base64_data: String, min_len: usize, show_letters: bool, show_digits: bool, show_symbols: bool) -> Result<Vec<String>, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let decoded = STANDARD.decode(&base64_data).map_err(|e| e.to_string())?;
    Ok(crate::parsers::reverse_engineering::RevEngUtils::extract_strings(&decoded, min_len, show_letters, show_digits, show_symbols))
}

#[tauri::command]
async fn xor_decrypt(base64_data: String, hex_key: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let decoded = STANDARD.decode(&base64_data).map_err(|e| e.to_string())?;
    let key = hex::decode(&hex_key).map_err(|e| e.to_string())?;
    let result = crate::parsers::reverse_engineering::RevEngUtils::xor_decrypt(&decoded, &key);
    Ok(STANDARD.encode(&result))
}

#[tauri::command]
async fn decompress_payload(base64_data: String, method: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let decoded = STANDARD.decode(&base64_data).map_err(|e| e.to_string())?;
    let result =
        crate::parsers::reverse_engineering::RevEngUtils::decompress_payload(&decoded, &method)?;
    Ok(STANDARD.encode(&result))
}

#[tauri::command]
async fn extract_save_zip(zip_path: String, dest_dir: String) -> Result<(), String> {
    let zip_p = std::path::Path::new(&zip_path);
    let dest_p = std::path::Path::new(&dest_dir);
    crate::utils::secure_extract_zip(zip_p, dest_p)
}

#[tauri::command]
fn check_device_rooted() -> Result<bool, String> {
    // Check Shizuku first
    if crate::shizuku::check_permission().unwrap_or(false) {
        return Ok(true);
    }

    let output = std::process::Command::new("su")
        .arg("-c")
        .arg("id")
        .output();

    match output {
        Ok(result) => Ok(result.status.success()),
        Err(_) => Ok(false),
    }
}

// =====================================================================
// 1. FUNGSI PULL: Membaca file game tertutup ke dalam memori
// =====================================================================
#[tauri::command]
fn root_read_file(app: tauri::AppHandle, target_path: &str) -> Result<String, String> {
    let has_shizuku = crate::shizuku::check_permission().unwrap_or(false);
    
    if has_shizuku {
        // Copy-Edit-Replace Architecture via Shizuku
        let cache_dir = app.path().app_cache_dir().map_err(|_| "Failed to get cache dir".to_string())?;
        let _ = std::fs::create_dir_all(&cache_dir);
        let staging_file = cache_dir.join("payload_read_staging.tmp");
        let staging_str = staging_file.to_str().ok_or("Invalid path")?;
        
        let cmd = format!("cp \"{}\" \"{}\" && chmod 666 \"{}\"", target_path, staging_str, staging_str);
        crate::shizuku::execute_command(&cmd)?;
        
        let content = std::fs::read_to_string(&staging_file)
            .map_err(|_| "Save file contains non-UTF8 characters or failed to read cached copy!".to_string());
        
        let _ = std::fs::remove_file(staging_file);
        return content;
    }

    // Fallback to SU
    let output = std::process::Command::new("su")
        .arg("-c")
        .arg(format!("cat \"{}\"", target_path))
        .output()
        .map_err(|e| format!("Gagal memanggil eksekutor: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout).map_err(|_| "File save mengandung karakter non-UTF8!".to_string())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        Err(format!("Root ditolak saat membaca: {}", err_msg))
    }
}

// =====================================================================
// 2. FUNGSI PUSH: Menyuntikkan teks baru ke dalam file game
// =====================================================================
#[tauri::command]
fn root_write_file(app: tauri::AppHandle, target_path: &str, new_content: &str) -> Result<(), String> {
    let cache_dir = app.path().app_cache_dir().map_err(|_| "Gagal melacak direktori cache aplikasi".to_string())?;
    let _ = std::fs::create_dir_all(&cache_dir);
    let staging_file = cache_dir.join("payload_staging.tmp");

    std::fs::write(&staging_file, new_content).map_err(|e| format!("Gagal menulis payload lokal: {}", e))?;
    let staging_str = staging_file.to_str().ok_or("Path memuat karakter aneh")?;

    let has_shizuku = crate::shizuku::check_permission().unwrap_or(false);
    
    if has_shizuku {
        // Copy-Edit-Replace via Shizuku
        let cmd = format!("cp \"{}\" \"{}\"", staging_str, target_path);
        let result = crate::shizuku::execute_command(&cmd);
        let _ = std::fs::remove_file(staging_file);
        return result.map(|_| ());
    }

    let cmd = format!("cat \"{}\" > \"{}\"", staging_str, target_path);
    let output = std::process::Command::new("su")
        .arg("-c")
        .arg(&cmd)
        .output()
        .map_err(|e| e.to_string())?;

    let _ = std::fs::remove_file(staging_file);

    if output.status.success() {
        Ok(())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        Err(format!("Gagal menyuntikkan save: {}", err_msg))
    }
}

// =====================================================================
// 3. FUNGSI SHIZUKU API KHUSUS
// =====================================================================
#[tauri::command]
fn shizuku_is_available() -> Result<bool, String> {
    crate::shizuku::is_available()
}

#[tauri::command]
fn shizuku_check_permission() -> Result<bool, String> {
    crate::shizuku::check_permission()
}

#[tauri::command]
fn shizuku_request_permission() -> Result<(), String> {
    crate::shizuku::request_permission()
}

#[tauri::command]
fn shizuku_open_manager() -> Result<(), String> {
    crate::shizuku::open_manager()
}

#[tauri::command]
fn shizuku_get_status() -> Result<String, String> {
    crate::shizuku::get_status()
}

#[tauri::command]
fn shizuku_execute_command(command: String) -> Result<String, String> {
    crate::shizuku::execute_command(&command)
}

pub async fn detect_engine_type(file_path: &Path, raw_bytes: &[u8], plugin_state: Option<Arc<RwLock<crate::parsers::plugin_manager::PluginRegistry>>>) -> EngineType {
    let mut registry: Vec<Box<dyn crate::parsers::SaveEngineDecoder>> = vec![
        Box::new(RpgMvParser),
        Box::new(RenPyParser),
        Box::new(crate::parsers::unreal::UnrealParser),
        Box::new(crate::parsers::godot::GodotParser),
        Box::new(crate::parsers::gamemaker::GameMakerParser),
        Box::new(crate::parsers::tyrano::TyranoParser),
        Box::new(crate::parsers::ruby_marshal::RubyMarshalParser),
        Box::new(crate::parsers::standard_json::StandardJsonParser),
        Box::new(crate::parsers::unity_es3::UnityEs3Parser),
        Box::new(crate::parsers::wolf_rpg::WolfRpgParser),
        Box::new(crate::parsers::kirikiri::KirikiriParser),
        Box::new(crate::parsers::naninovel::NaninovelParser),
        Box::new(crate::parsers::flash_sol::FlashSolParser),
        Box::new(crate::parsers::csharp_xml::CSharpXmlParser),
        Box::new(crate::parsers::twine::TwineSave),
        Box::new(crate::parsers::ags::AgsSave),
        Box::new(crate::parsers::nbt::NbtParser),
        Box::new(crate::parsers::construct::ConstructParser),
        Box::new(crate::parsers::terraria::TerrariaParser),
    ];

    if let Some(state) = plugin_state {
        registry.push(Box::new(crate::parsers::plugin_manager::ExternalPluginOrchestrator { registry: state }));
    }

    for parser in registry {
        if parser.detect(file_path, raw_bytes).await.unwrap_or(false) {
            return parser.engine_type();
        }
    }

    EngineType::Unknown
}

async fn process_save_data(
    file_path: &Path,
    raw_data: &[u8],
    active_profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    state: &State<'_, SharedSaveState>,
    app: &tauri::AppHandle,
) -> Result<StandardJson, String> {
    use tauri::Manager;
    let plugin_state = app.state::<Arc<RwLock<crate::parsers::plugin_manager::PluginRegistry>>>().inner().clone();
    let engine_type = detect_engine_type(file_path, raw_data, Some(plugin_state.clone())).await;

    let mut registry: Vec<Box<dyn crate::parsers::SaveEngineDecoder>> = vec![
        Box::new(RpgMvParser),
        Box::new(RenPyParser),
        Box::new(crate::parsers::unreal::UnrealParser),
        Box::new(crate::parsers::godot::GodotParser),
        Box::new(crate::parsers::gamemaker::GameMakerParser),
        Box::new(crate::parsers::tyrano::TyranoParser),
        Box::new(crate::parsers::ruby_marshal::RubyMarshalParser),
        Box::new(crate::parsers::standard_json::StandardJsonParser),
        Box::new(crate::parsers::unity_es3::UnityEs3Parser),
        Box::new(crate::parsers::wolf_rpg::WolfRpgParser),
        Box::new(crate::parsers::kirikiri::KirikiriParser),
        Box::new(crate::parsers::naninovel::NaninovelParser),
        Box::new(crate::parsers::flash_sol::FlashSolParser),
        Box::new(crate::parsers::csharp_xml::CSharpXmlParser),
        Box::new(crate::parsers::twine::TwineSave),
        Box::new(crate::parsers::ags::AgsSave),
        Box::new(crate::parsers::nbt::NbtParser),
        Box::new(crate::parsers::construct::ConstructParser),
        Box::new(crate::parsers::terraria::TerrariaParser),
    ];
    registry.push(Box::new(crate::parsers::plugin_manager::ExternalPluginOrchestrator { registry: plugin_state }));

    for parser in registry {
        let is_plugin_match = matches!((parser.engine_type(), &engine_type), (EngineType::LuaParser(_), EngineType::LuaParser(_)));
        
        if parser.engine_type() == engine_type || is_plugin_match {
            if let Ok(decoded) = parser.decode(file_path, raw_data).await {
                match parser.parse_to_standard_json(&decoded, active_profile_rules.clone()).await {
                    Ok(res) => {
                        let mut save_data = state.write().await;
                        save_data.parsed_variables = res.parsed_variables.clone();
                        return Ok(res);
                    }
                    Err(e) => {
                        eprintln!("[DEBUG] Parser {:?} failed at parse_to_standard_json: {}", parser.engine_type(), e);
                    }
                }
            } else {
                eprintln!("[DEBUG] Parser {:?} failed at decode phase.", parser.engine_type());
            }
        }
    }

    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let base64_encoded = STANDARD.encode(raw_data);

    Ok(StandardJson {
        engine_type: EngineType::Unknown,
        parsed_variables: serde_json::json!({
            "is_encrypted_binary": true
        }),
        raw_payload: Some(serde_json::json!(base64_encoded)),
    })
}

#[tauri::command]
async fn open_save_file(
    path: String,
    active_profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    state: State<'_, SharedSaveState>,
    app: tauri::AppHandle,
) -> Result<StandardJson, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    let raw_data = tokio::fs::read(file_path).await.map_err(|e| format!("Failed to read file: {}", e))?;
    process_save_data(file_path, &raw_data, active_profile_rules, &state, &app).await
}

#[tauri::command]
async fn open_save_file_bytes(
    path: String,
    bytes: Vec<u8>,
    active_profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    state: State<'_, SharedSaveState>,
    app: tauri::AppHandle,
) -> Result<StandardJson, String> {
    let file_path = Path::new(&path);
    process_save_data(file_path, &bytes, active_profile_rules, &state, &app).await
}


async fn encode_save_data(
    modified_data: &StandardJson,
    file_path: &Path,
    active_profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    app: &tauri::AppHandle,
) -> Result<Vec<u8>, String> {
    use tauri::Manager;
    let plugin_state = app.state::<Arc<RwLock<crate::parsers::plugin_manager::PluginRegistry>>>().inner().clone();
    
    let mut registry: Vec<Box<dyn crate::parsers::SaveEngineDecoder>> = vec![
        Box::new(RpgMvParser),
        Box::new(RenPyParser),
        Box::new(crate::parsers::unreal::UnrealParser),
        Box::new(crate::parsers::godot::GodotParser),
        Box::new(crate::parsers::gamemaker::GameMakerParser),
        Box::new(crate::parsers::tyrano::TyranoParser),
        Box::new(crate::parsers::ruby_marshal::RubyMarshalParser),
        Box::new(crate::parsers::standard_json::StandardJsonParser),
        Box::new(crate::parsers::unity_es3::UnityEs3Parser),
        Box::new(crate::parsers::wolf_rpg::WolfRpgParser),
        Box::new(crate::parsers::kirikiri::KirikiriParser),
        Box::new(crate::parsers::naninovel::NaninovelParser),
        Box::new(crate::parsers::flash_sol::FlashSolParser),
        Box::new(crate::parsers::csharp_xml::CSharpXmlParser),
        Box::new(crate::parsers::twine::TwineSave),
        Box::new(crate::parsers::ags::AgsSave),
        Box::new(crate::parsers::nbt::NbtParser),
        Box::new(crate::parsers::construct::ConstructParser),
        Box::new(crate::parsers::terraria::TerrariaParser),
    ];
    registry.push(Box::new(crate::parsers::plugin_manager::ExternalPluginOrchestrator { registry: plugin_state }));

    let mut encoded_bytes_opt = None;
    for parser in registry {
        let is_plugin_match = matches!((parser.engine_type(), &modified_data.engine_type), (EngineType::LuaParser(_), EngineType::LuaParser(_)));
        
        if parser.engine_type() == modified_data.engine_type || 
           (modified_data.engine_type == EngineType::RpgMakerMz && parser.engine_type() == EngineType::RpgMakerMv) || is_plugin_match {
            encoded_bytes_opt = Some(parser.encode(modified_data, file_path, active_profile_rules.clone()).await?);
            break;
        }
    }

    if let Some(bytes) = encoded_bytes_opt {
        Ok(bytes)
    } else {
        match modified_data.engine_type {
            EngineType::Unknown => {
                if let Some(payload_value) = &modified_data.raw_payload {
                    if let Some(base64_str) = payload_value.as_str() {
                        use base64::{Engine as _, engine::general_purpose::STANDARD};
                        STANDARD.decode(base64_str).map_err(|e| format!("Failed to decode base64 back to binary: {}", e))
                    } else {
                        Err("No raw payload provided for Unknown binary file.".to_string())
                    }
                } else {
                    Err("No raw payload provided for Unknown binary file.".to_string())
                }
            }
            _ => Err("Should have been handled by registry".into()),
        }
    }
}

#[tauri::command]
async fn write_save_file(
    modified_data: StandardJson,
    path: String,
    active_profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    active_profile_checksums: Option<Vec<crate::parsers::profiles::ChecksumRule>>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let file_path = Path::new(&path);

    if file_path.exists() {
        if let Err(e) = create_backup(file_path, None, &app).await {
            return Err(e);
        }
    }

    let mut encoded_bytes = encode_save_data(&modified_data, file_path, active_profile_rules, &app).await?;
    
    if let Some(checksums) = active_profile_checksums {
        if let Err(e) = crate::utils::apply_checksums(&mut encoded_bytes, &checksums) {
            return Err(format!("Checksum engine error: {}", e));
        }
    }
    
    tokio::fs::write(file_path, encoded_bytes)
        .await
        .map_err(|e| format!("Failed to write save file to disk: {}", e))?;

    Ok(format!("Successfully saved {}", path))
}

#[tauri::command]
async fn save_file_bytes(
    json: StandardJson,
    path: String,
    active_profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    active_profile_checksums: Option<Vec<crate::parsers::profiles::ChecksumRule>>,
    app: tauri::AppHandle,
) -> Result<Vec<u8>, String> {
    let file_path = Path::new(&path);
    let mut encoded_bytes = encode_save_data(&json, file_path, active_profile_rules, &app).await?;
    
    if let Some(checksums) = active_profile_checksums {
        if let Err(e) = crate::utils::apply_checksums(&mut encoded_bytes, &checksums) {
            return Err(format!("Checksum engine error: {}", e));
        }
    }
    
    // Attempt internal backup for content:// URIs
    if let Err(e) = crate::backup::manager::create_backup_from_bytes(file_path, &encoded_bytes, None, &app).await {
        eprintln!("[DEBUG] Failed to create internal backup: {}", e);
    }

    Ok(encoded_bytes)
}

pub struct AdbState(pub std::sync::Mutex<Option<String>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = rustls::crypto::CryptoProvider::install_default(rustls::crypto::ring::default_provider());
    let shared_state = SharedSaveState::default();
    
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .manage(shared_state.clone())
        .manage(AdbState(std::sync::Mutex::new(None)))
        .setup(move |app| {
            let app_handle = app.handle().clone();
            
            // Safe initialization for app_config_dir
            if let Ok(app_config_dir) = app.path().app_config_dir() {
                let _ = std::fs::create_dir_all(&app_config_dir);
                let status_file_path = app_config_dir.join("mcp_status.json");
                
                let mcp_script_content = include_str!("../../mcp-server.js");
                let script_file_path = app_config_dir.join("mcp-server.js");
                let _ = std::fs::write(&script_file_path, mcp_script_content);
                
                let (mcp_broadcaster, _) = broadcast::channel(16);
                let mcp_channels = Arc::new(DashMap::new());

                let axum_state = AxumState {
                    save_state: shared_state.clone(),
                    app_handle: app_handle.clone(),
                    mcp_channels: mcp_channels.clone(),
                    mcp_broadcaster: mcp_broadcaster.clone(),
                };
                
                app.manage(axum_state.clone());

                tauri::async_runtime::spawn(async move {
                    let cors = CorsLayer::new()
                        .allow_origin(Any)
                        .allow_methods(Any)
                        .allow_headers(Any);

                    let router = Router::new()
                        .route("/api/mcp/call", post(handle_mcp_call))
                        .route("/api/mcp/events", get(sse_handler))
                        .layer(cors)
                        .with_state(axum_state);

                    if let Ok(listener) = tokio::net::TcpListener::bind("127.0.0.1:0").await {
                        if let Ok(addr) = listener.local_addr() {
                            let allocated_port = addr.port();
                            
                            let status_json = serde_json::json!({
                                "port": allocated_port,
                                "status": "running"
                            });
                            
                            let _ = tokio::fs::write(&status_file_path, status_json.to_string()).await;
                            println!("MCP Bridge Server running on dynamic port: {}", allocated_port);

                            let _ = axum::serve(listener, router).await;
                        }
                    }
                });

                // --- OAUTH LOCAL SERVER (Port 14225) ---
                let oauth_app = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    let cors = tower_http::cors::CorsLayer::new()
                        .allow_origin(tower_http::cors::Any)
                        .allow_methods(tower_http::cors::Any)
                        .allow_headers(tower_http::cors::Any);
                        
                    let router = axum::Router::new()
                        .route("/callback", axum::routing::get(|| async {
                            axum::response::Html(r#"<!DOCTYPE html><html><head><title>Authentication</title></head><body style="background: black; color: white; font-family: monospace; text-align: center; padding-top: 50px;"><h2>Processing authentication...</h2><script>if (window.location.hash) { fetch('http://127.0.0.1:14225/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: window.location.hash }) }).then(() => { document.body.innerHTML = '<h2 style="color: #FF7A00;">Login successful, you can close this tab.</h2>'; window.close(); }).catch(e => { document.body.innerHTML = '<h2 style="color: red;">Error processing authentication.</h2>'; }); } else { document.body.innerHTML = '<h2 style="color: red;">No token found in URL.</h2>'; }</script></body></html>"#)
                        }))
                        .route("/token", axum::routing::post({
                            let app = oauth_app.clone();
                            |axum::Json(payload): axum::Json<serde_json::Value>| async move {
                                if let Some(hash) = payload.get("hash").and_then(|v| v.as_str()) {
                                    let _ = app.emit("auth-success", hash);
                                }
                                "OK"
                            }
                        }))
                        .layer(cors);
                        
                    if let Ok(listener) = tokio::net::TcpListener::bind("127.0.0.1:14225").await {
                        println!("OAuth Server running on port: 14225");
                        let _ = axum::serve(listener, router).await;
                    }
                });
            }

            // Plugin Manager Setup
            if let Ok(app_data_dir) = app.path().app_data_dir() {
                let scripts_dir = app_data_dir.join("scripts");
                let mut plugin_registry = crate::parsers::plugin_manager::PluginRegistry::new(scripts_dir);
                tauri::async_runtime::block_on(plugin_registry.reload());
                let plugin_state = Arc::new(RwLock::new(plugin_registry));
                app.manage(plugin_state);
            } else {
                let plugin_registry = crate::parsers::plugin_manager::PluginRegistry::new(std::path::PathBuf::from(""));
                let plugin_state = Arc::new(RwLock::new(plugin_registry));
                app.manage(plugin_state);
            }

            Ok(())
        })
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(
                tauri_plugin_window_state::Builder::default()
                    .with_state_flags(
                        tauri_plugin_window_state::StateFlags::SIZE
                            | tauri_plugin_window_state::StateFlags::POSITION
                            | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                    )
                    .build(),
            )
            .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
                let _ = app.get_webview_window("main").map(|w| {
                    for arg in args {
                        if arg.starts_with("suzu://") {
                            let _ = w.emit("deep-link-received", arg);
                        }
                    }
                    let _ = w.show();
                    w.set_focus()
                });
            }));
    }

    builder
        .invoke_handler(tauri::generate_handler![
            calculate_entropy,
            extract_strings,
            xor_decrypt,
            decompress_payload,
            open_save_file,
            open_save_file_bytes,
            write_save_file,
            save_file_bytes,
            crate::parsers::database::load_game_database,
            crate::parsers::profiles::sync_profiles_from_github,
            crate::parsers::profiles::load_local_profiles,
            crate::parsers::profiles::save_local_profile,
            crate::parsers::profiles::delete_local_profile,
            crate::parsers::diff::compare_files,
            crate::parsers::plugin_manager::get_plugins,
            crate::parsers::plugin_manager::reload_plugins,
            crate::parsers::plugin_manager::toggle_plugin,
            crate::parsers::plugin_manager::open_scripts_folder,
            crate::parsers::auto_detect::detect_installed_games,
            crate::parsers::unity_prefs::load_unity_registry_prefs,
            crate::parsers::unity_prefs::save_unity_registry_prefs,
            crate::parsers::metadata::fetch_game_metadata,
            crate::parsers::tmx_parser::get_farm_collision_grid,
            crate::adb::adb_list_devices,
            crate::adb::adb_list_files,
            crate::adb::adb_pull_file,
            crate::adb::adb_push_file,
            crate::adb::adb_backup_file,
            extract_save_zip,
            check_device_rooted,
            root_read_file,
            root_write_file,
            shizuku_is_available,
            shizuku_check_permission,
            shizuku_request_permission,
            shizuku_open_manager,
            shizuku_get_status,
            shizuku_execute_command,
            crate::saf::write_content_uri_bytes,
            crate::saf::pick_file_for_write,
            load_save_file,
            toggle_mcp,
            close_save_file,
            get_mcp_script_path,
            apply_ai_mutation,
            mcp_respond,
            mcp_notify_event,
            mcp_create_backup,
            mcp_restore_backup,
            list_backups,
            delete_backup,
            restore_backup_by_id,
            export_backup_by_id,
            create_named_backup,
            create_named_backup_from_bytes,
            mcp_scan_pattern,
            crate::converter::strip_save_header,
            crate::converter::inject_save_header,
            crate::converter::swap_endianness
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. } => {
                if let Some(adb_state) = app_handle.try_state::<AdbState>() {
                    if let Ok(guard) = adb_state.0.lock() {
                        if let Some(path) = &*guard {
                            let _ = crate::adb::create_command(path).arg("kill-server").output();
                        }
                    }
                }
            }
            _ => {}
        });
}
