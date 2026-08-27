use crate::models::ipc::{EngineType, StandardJson};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde_json::Value;
use std::path::Path;

pub struct GameMakerParser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for GameMakerParser {
    fn engine_type(&self) -> EngineType {
        EngineType::GameMaker
    }

    async fn detect(&self, _file_path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        if raw_bytes.len() > 10
            && raw_bytes
                .iter()
                .take(10)
                .all(|b| b.is_ascii_alphanumeric() || *b == b'=' || *b == b'+' || *b == b'/')
        {
            return Ok(true);
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
        let content = String::from_utf8_lossy(data).to_string();
        let content = content.trim();

        if let Ok(decoded) = STANDARD.decode(content) {
            if let Ok(decoded_str) = String::from_utf8(decoded.clone()) {
                if let Ok(parsed) = serde_json::from_str::<Value>(&decoded_str) {
                    return Ok(StandardJson {
                        engine_type: EngineType::GameMaker,
                        parsed_variables: parsed,
                        raw_payload: Some(
                            serde_json::json!({ "is_base64": true, "format": "json" }),
                        ),
                    });
                }

                return Ok(StandardJson {
                    engine_type: EngineType::GameMaker,
                    parsed_variables: serde_json::json!({ "raw_ini": decoded_str }),
                    raw_payload: Some(serde_json::json!({ "is_base64": true, "format": "ini" })),
                });
            }
        }

        if let Ok(parsed) = serde_json::from_str::<Value>(content) {
            return Ok(StandardJson {
                engine_type: EngineType::GameMaker,
                parsed_variables: parsed,
                raw_payload: Some(serde_json::json!({ "is_base64": false, "format": "json" })),
            });
        }

        Ok(StandardJson {
            engine_type: EngineType::GameMaker,
            parsed_variables: serde_json::json!({ "raw_ini": content }),
            raw_payload: Some(serde_json::json!({ "is_base64": false, "format": "ini" })),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        let is_base64 = standard_json
            .raw_payload
            .as_ref()
            .and_then(|p| p.get("is_base64"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let format = standard_json
            .raw_payload
            .as_ref()
            .and_then(|p| p.get("format"))
            .and_then(|v| v.as_str())
            .unwrap_or("json");

        let out_str = if format == "ini" {
            standard_json
                .parsed_variables
                .get("raw_ini")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        } else {
            serde_json::to_string(&standard_json.parsed_variables).map_err(|e| e.to_string())?
        };

        if is_base64 {
            let encoded = STANDARD.encode(out_str);
            Ok(encoded.into_bytes())
        } else {
            Ok(out_str.into_bytes())
        }
    }
}
