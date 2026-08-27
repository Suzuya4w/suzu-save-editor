use crate::models::ipc::{EngineType, StandardJson};

use marshal_rs::{Value, dump, load};
use std::path::Path;

pub struct RubyMarshalParser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for RubyMarshalParser {
    fn engine_type(&self) -> EngineType {
        EngineType::RubyMarshal
    }

    async fn detect(&self, path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        if ext != "rxdata" && ext != "rvdata" && ext != "rvdata2" {
            return Ok(false);
        }

        if raw_bytes.len() >= 2 && raw_bytes[0] == 0x04 && raw_bytes[1] == 0x08 {
            Ok(true)
        } else {
            Ok(false)
        }
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let marshal_value: Value =
            load(data, None).map_err(|e| format!("Failed to parse Ruby Marshal binary: {}", e))?;

        let json_string = marshal_value.to_string();

        let parsed_variables: serde_json::Value = serde_json::from_str(&json_string)
            .map_err(|e| format!("Failed to convert Ruby Marshal data to JSON: {}", e))?;

        Ok(StandardJson {
            engine_type: EngineType::RubyMarshal,
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
        let json_string = serde_json::to_string(&standard_json.parsed_variables)
            .map_err(|e| format!("Failed to stringify StandardJson variables: {}", e))?;

        let marshal_value: Value = serde_json::from_str(&json_string)
            .map_err(|e| format!("Failed to parse JSON back to Ruby Marshal structure. Ensure you didn't break the type fidelity: {}", e))?;

        let encoded = dump(marshal_value, None);

        Ok(encoded)
    }
}
