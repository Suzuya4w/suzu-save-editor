use crate::models::ipc::{EngineType, StandardJson};
use serde_json::Value;
use std::path::Path;

pub struct GodotParser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for GodotParser {
    fn engine_type(&self) -> EngineType {
        EngineType::Godot
    }

    async fn detect(&self, file_path: &Path, _raw_bytes: &[u8]) -> Result<bool, String> {
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        Ok(ext == "tres"
            || ext == "res"
            || ext == "cfg"
            || ext == "json"
            || file_path.to_string_lossy().contains("godot"))
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let content = String::from_utf8(data.to_vec()).map_err(|e| e.to_string())?;

        if let Ok(parsed) = serde_json::from_str::<Value>(&content) {
            return Ok(StandardJson {
                engine_type: EngineType::Godot,
                parsed_variables: parsed,
                raw_payload: Some(serde_json::json!({ "format": "json" })),
            });
        }

        Ok(StandardJson {
            engine_type: EngineType::Godot,
            parsed_variables: serde_json::json!({ "raw_text": content }),
            raw_payload: Some(serde_json::json!({ "format": "text" })),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        let format = standard_json
            .raw_payload
            .as_ref()
            .and_then(|p| p.get("format").cloned())
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "json".to_string());

        if format == "text" {
            if let Some(raw_text) = standard_json
                .parsed_variables
                .get("raw_text")
                .and_then(|v| v.as_str())
            {
                Ok(raw_text.as_bytes().to_vec())
            } else {
                Err("Failed to find raw_text for Godot Text Resource".into())
            }
        } else {
            let content = serde_json::to_string_pretty(&standard_json.parsed_variables)
                .map_err(|e| e.to_string())?;
            Ok(content.into_bytes())
        }
    }
}
