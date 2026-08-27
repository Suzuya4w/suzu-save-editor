use crate::models::ipc::{EngineType, StandardJson};
use crate::parsers::SaveEngineDecoder;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
pub enum PluginType {
    Lua(PathBuf),
    Wasm(PathBuf),
}

#[derive(Debug, Clone, Serialize)]
pub struct LoadedPlugin {
    pub id: String,
    pub plugin_type: PluginType,
    pub metadata: PluginMetadata,
    pub active: bool,
    pub is_corrupted: bool,
}

pub struct PluginRegistry {
    pub plugins: Vec<LoadedPlugin>,
    pub scripts_dir: PathBuf,
}

impl PluginRegistry {
    pub fn new(scripts_dir: PathBuf) -> Self {
        Self {
            plugins: Vec::new(),
            scripts_dir,
        }
    }
    
    pub async fn reload(&mut self) {
        let config_path = self.scripts_dir.join("disabled_plugins.json");
        let disabled_plugins: std::collections::HashSet<String> = if let Ok(data) = tokio::fs::read_to_string(&config_path).await {
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            std::collections::HashSet::new()
        };

        self.plugins.clear();
        if !self.scripts_dir.exists() {
            let _ = tokio::fs::create_dir_all(&self.scripts_dir).await;
            return;
        }

        let mut entries = match tokio::fs::read_dir(&self.scripts_dir).await {
            Ok(e) => e,
            Err(_) => return,
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if !path.is_file() { continue; }

            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            let id = path.file_name().unwrap_or_default().to_string_lossy().to_string();

            let (plugin_type, meta_res) = if ext == "lua" {
                (PluginType::Lua(path.clone()), crate::parsers::scripting::ScriptParser::metadata(&path).await)
            } else if ext == "wasm" {
                (PluginType::Wasm(path.clone()), crate::parsers::wasm_engine::WasmEngine::metadata(&path).await)
            } else {
                continue;
            };

            let metadata = match meta_res {
                Ok(meta_str) => {
                    serde_json::from_str(&meta_str).unwrap_or_else(|e| PluginMetadata {
                        name: format!("Corrupted Script ({})", id),
                        version: "ERR".to_string(),
                        author: "Unknown".to_string(),
                        description: format!("JSON Metadata failed to parse: {}", e),
                    })
                },
                Err(e) => PluginMetadata {
                    name: format!("Failed Script ({})", id),
                    version: "ERR".to_string(),
                    author: "Unknown".to_string(),
                    description: format!("Execution error: {}", e),
                }
            };

            let is_corrupted = metadata.version == "ERR";

            self.plugins.push(LoadedPlugin {
                id: id.clone(),
                plugin_type,
                metadata,
                active: !is_corrupted && !disabled_plugins.contains(&id),
                is_corrupted,
            });
        }
    }
}

pub struct ExternalPluginOrchestrator {
    pub registry: Arc<RwLock<PluginRegistry>>,
}

#[async_trait::async_trait]
impl SaveEngineDecoder for ExternalPluginOrchestrator {
    fn engine_type(&self) -> EngineType {
        EngineType::LuaParser("ExternalPlugin".to_string())
    }

    async fn detect(&self, _path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        let chunk = if raw_bytes.len() > 4096 { &raw_bytes[0..4096] } else { raw_bytes };
        
        let registry = self.registry.read().await;
        for plugin in &registry.plugins {
            if !plugin.active || plugin.is_corrupted { continue; }
            
            let detect_res = match &plugin.plugin_type {
                PluginType::Lua(p) => crate::parsers::scripting::ScriptParser::detect(p, chunk).await,
                PluginType::Wasm(p) => crate::parsers::wasm_engine::WasmEngine::detect(p, chunk).await,
            };

            if let Ok(true) = detect_res {
                return Ok(true);
            }
        }
        Ok(false)
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let chunk = if data.len() > 4096 { &data[0..4096] } else { data };
        
        let registry = self.registry.read().await;
        for plugin in &registry.plugins {
            if !plugin.active || plugin.is_corrupted { continue; }
            
            let detect_res = match &plugin.plugin_type {
                PluginType::Lua(p) => crate::parsers::scripting::ScriptParser::detect(p, chunk).await,
                PluginType::Wasm(p) => crate::parsers::wasm_engine::WasmEngine::detect(p, chunk).await,
            };

            if let Ok(true) = detect_res {
                let parsed_variables = match &plugin.plugin_type {
                    PluginType::Lua(p) => crate::parsers::scripting::ScriptParser::parse_to_json(p, data).await?,
                    PluginType::Wasm(p) => crate::parsers::wasm_engine::WasmEngine::parse_to_json(p, data).await?,
                };

                return Ok(StandardJson {
                    engine_type: EngineType::LuaParser(plugin.id.clone()),
                    parsed_variables,
                    raw_payload: None,
                });
            }
        }
        
        Err("No external plugin matched this file".to_string())
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        let plugin_id = match &standard_json.engine_type {
            EngineType::LuaParser(id) => id,
            _ => return Err("Not a plugin save file".to_string()),
        };

        let registry = self.registry.read().await;
        let plugin = registry.plugins.iter().find(|p| &p.id == plugin_id)
            .ok_or_else(|| format!("Plugin {} not found or unloaded", plugin_id))?;

        if !plugin.active || plugin.is_corrupted {
            return Err("Plugin is disabled or corrupted".to_string());
        }

        match &plugin.plugin_type {
            PluginType::Lua(p) => crate::parsers::scripting::ScriptParser::json_to_binary(p, &standard_json.parsed_variables).await,
            PluginType::Wasm(p) => crate::parsers::wasm_engine::WasmEngine::json_to_binary(p, &standard_json.parsed_variables).await,
        }
    }
}

#[tauri::command]
pub async fn get_plugins(state: tauri::State<'_, Arc<RwLock<PluginRegistry>>>) -> Result<Vec<LoadedPlugin>, String> {
    let registry = state.read().await;
    Ok(registry.plugins.clone())
}

#[tauri::command]
pub async fn reload_plugins(state: tauri::State<'_, Arc<RwLock<PluginRegistry>>>) -> Result<Vec<LoadedPlugin>, String> {
    let mut registry = state.write().await;
    registry.reload().await;
    Ok(registry.plugins.clone())
}

#[tauri::command]
pub async fn toggle_plugin(id: String, active: bool, state: tauri::State<'_, Arc<RwLock<PluginRegistry>>>) -> Result<(), String> {
    let mut registry = state.write().await;
    if let Some(p) = registry.plugins.iter_mut().find(|p| p.id == id) {
        if !p.is_corrupted {
            p.active = active;
        }
    }
    
    let disabled_plugins: std::collections::HashSet<String> = registry.plugins.iter()
        .filter(|p| !p.active && !p.is_corrupted)
        .map(|p| p.id.clone())
        .collect();
        
    let config_path = registry.scripts_dir.join("disabled_plugins.json");
    if let Ok(data) = serde_json::to_string(&disabled_plugins) {
        let _ = tokio::fs::write(&config_path, data).await;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn open_scripts_folder(state: tauri::State<'_, Arc<RwLock<PluginRegistry>>>) -> Result<(), String> {
    #[allow(unused_variables)]
    let scripts_dir = state.read().await.scripts_dir.clone();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").arg(&scripts_dir).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&scripts_dir).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(&scripts_dir).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}
