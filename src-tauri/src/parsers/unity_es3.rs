use crate::models::ipc::{EngineType, StandardJson};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde_json::json;
use std::path::Path;

pub struct UnityEs3Parser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for UnityEs3Parser {
    fn engine_type(&self) -> EngineType {
        EngineType::UnityEs3
    }

    async fn detect(&self, path: &Path, _raw_bytes: &[u8]) -> Result<bool, String> {
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        Ok(ext == "es3")
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let mut is_base64 = false;

        let parsed_variables: serde_json::Value = match serde_json::from_slice(data) {
            Ok(json) => json,
            Err(_) => {
                let decoded_bytes = STANDARD.decode(data)
                    .map_err(|_| "Failed to decode ES3 base64 content. File might be encrypted or corrupted.")?;

                let json: serde_json::Value =
                    serde_json::from_slice(&decoded_bytes).map_err(|e| {
                        format!("Failed to parse ES3 JSON after base64 decoding: {}", e)
                    })?;

                is_base64 = true;
                json
            }
        };

        let metadata = json!({
            "is_base64": is_base64
        });

        Ok(StandardJson {
            engine_type: EngineType::UnityEs3,
            parsed_variables,
            raw_payload: Some(metadata),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        let json_string = serde_json::to_string(&standard_json.parsed_variables)
            .map_err(|e| format!("Failed to stringify ES3 JSON: {}", e))?;

        let is_base64 = standard_json
            .raw_payload
            .as_ref()
            .and_then(|v| v.get("is_base64"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if is_base64 {
            let encoded = STANDARD.encode(json_string);
            Ok(encoded.into_bytes())
        } else {
            Ok(json_string.into_bytes())
        }
    }
}
