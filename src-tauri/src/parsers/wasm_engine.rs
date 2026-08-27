use std::path::Path;
use serde_json::Value;
use extism::{Plugin, Manifest, Wasm};

pub struct WasmEngine;

impl WasmEngine {
    fn create_plugin(script_path: &Path) -> Result<Plugin, String> {
        let wasm = Wasm::file(script_path);
        // We set NO WASI capabilities (pure compute only)
        let manifest = Manifest::new([wasm]);
        Plugin::new(&manifest, [], true)
            .map_err(|e| format!("Failed to initialize Wasm plugin: {}", e))
    }

    pub async fn metadata(script_path: &Path) -> Result<String, String> {
        let path = script_path.to_path_buf();
        tokio::task::spawn_blocking(move || {
            let mut plugin = Self::create_plugin(&path)?;
            let res = plugin.call::<(), String>("metadata", ())
                .map_err(|e| format!("Wasm metadata call failed: {}", e))?;
            Ok(res)
        }).await.map_err(|e| e.to_string())?
    }

    pub async fn detect(script_path: &Path, chunk: &[u8]) -> Result<bool, String> {
        let path = script_path.to_path_buf();
        let data = chunk.to_vec();
        tokio::task::spawn_blocking(move || {
            let mut plugin = Self::create_plugin(&path)?;
            let res = plugin.call::<&[u8], String>("detect", &data)
                .map_err(|e| format!("Wasm detect call failed: {}", e))?;
            Ok(res.trim() == "true" || res.trim() == "1")
        }).await.map_err(|e| e.to_string())?
    }

    pub async fn parse_to_json(script_path: &Path, data: &[u8]) -> Result<Value, String> {
        let path = script_path.to_path_buf();
        let data = data.to_vec();
        tokio::task::spawn_blocking(move || {
            let mut plugin = Self::create_plugin(&path)?;
            let res = plugin.call::<&[u8], String>("parse_to_json", &data)
                .map_err(|e| format!("Wasm parse_to_json call failed: {}", e))?;
            serde_json::from_str(&res)
                .map_err(|e| format!("Invalid JSON from Wasm: {}", e))
        }).await.map_err(|e| e.to_string())?
    }

    pub async fn json_to_binary(script_path: &Path, json: &Value) -> Result<Vec<u8>, String> {
        let path = script_path.to_path_buf();
        let json_str = serde_json::to_string(json).map_err(|e| e.to_string())?;
        tokio::task::spawn_blocking(move || {
            let mut plugin = Self::create_plugin(&path)?;
            let res = plugin.call::<&str, Vec<u8>>("json_to_binary", &json_str)
                .map_err(|e| format!("Wasm json_to_binary call failed: {}", e))?;
            Ok(res)
        }).await.map_err(|e| e.to_string())?
    }
}
