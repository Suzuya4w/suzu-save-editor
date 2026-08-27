use crate::models::ipc::{EngineType, StandardJson};

use std::path::Path;

pub struct StandardJsonParser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for StandardJsonParser {
    fn engine_type(&self) -> EngineType {
        EngineType::StandardJson
    }

    async fn detect(&self, path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        if ext == "json" {
            return Ok(true);
        }

        if ext != "sav" && ext != "rpgsave" && ext != "rmmzsave" {
            return Ok(false);
        }

        let mut slice = raw_bytes;
        if slice.starts_with(&[0xEF, 0xBB, 0xBF]) {
            slice = &slice[3..];
        }
        let starts_with_json = slice
            .iter()
            .find(|&&b| !b.is_ascii_whitespace())
            .map_or(false, |&b| b == b'{' || b == b'[');
        Ok(starts_with_json)
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let json_str =
            std::str::from_utf8(data).map_err(|e| format!("Invalid UTF-8 sequence: {}", e))?;

        let clean_str = json_str.trim_start_matches('\u{FEFF}');

        let parsed_variables: serde_json::Value =
            serde_json::from_str(clean_str).map_err(|e| format!("Failed to parse JSON: {}", e))?;

        Ok(StandardJson {
            engine_type: EngineType::StandardJson,
            parsed_variables,
            raw_payload: None,
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        serde_json::to_vec_pretty(&standard_json.parsed_variables)
            .map_err(|e| format!("Failed to encode JSON: {}", e))
    }
}
