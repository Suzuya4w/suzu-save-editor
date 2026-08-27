use crate::models::ipc::{EngineType, StandardJson};
use serde_json::Value;
use std::path::Path;

pub struct TyranoParser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for TyranoParser {
    fn engine_type(&self) -> EngineType {
        EngineType::TyranoBuilder
    }

    async fn detect(&self, file_path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if ext == "sav" || ext == "json" {
            if raw_bytes.starts_with(b"[")
                || raw_bytes.starts_with(b"{")
                || raw_bytes.starts_with(b"%")
            {
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
        let content = String::from_utf8_lossy(data).to_string();
        let content = content.trim();

        let is_uri = content.starts_with('%');
        let decoded_content = if is_uri {
            urlencoding::decode(content)
                .map(|c| c.into_owned())
                .unwrap_or_else(|_| content.to_string())
        } else {
            content.to_string()
        };

        let parsed: Value = serde_json::from_str(&decoded_content).map_err(|e| e.to_string())?;

        Ok(StandardJson {
            engine_type: EngineType::TyranoBuilder,
            parsed_variables: parsed,
            raw_payload: Some(serde_json::json!({ "was_uri_encoded": is_uri })),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        let was_uri_encoded = standard_json
            .raw_payload
            .as_ref()
            .and_then(|p| p.get("was_uri_encoded").cloned())
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let json_str =
            serde_json::to_string(&standard_json.parsed_variables).map_err(|e| e.to_string())?;

        if was_uri_encoded {
            let encoded = urlencoding::encode(&json_str);
            Ok(encoded.into_owned().into_bytes())
        } else {
            Ok(json_str.into_bytes())
        }
    }
}
