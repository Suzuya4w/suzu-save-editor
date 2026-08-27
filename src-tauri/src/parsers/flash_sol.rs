use crate::models::ipc::{EngineType, StandardJson};

use flash_lso::read::Reader;
use std::path::Path;

pub struct FlashSolParser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for FlashSolParser {
    fn engine_type(&self) -> EngineType {
        EngineType::FlashLegacy
    }

    async fn detect(&self, path: &Path, magic_bytes: &[u8]) -> Result<bool, String> {
        if magic_bytes.len() >= 2 && magic_bytes[0] == 0x00 && magic_bytes[1] == 0xBF {
            return Ok(true);
        }

        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        Ok(ext == "sol")
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let mut reader = Reader::default();
        let lso = reader
            .parse(data)
            .map_err(|e| format!("Failed to parse LSO: {:?}", e))?;

        let parsed_variables = serde_json::to_value(&lso)
            .map_err(|e| format!("Failed to serialize LSO to JSON: {}", e))?;

        Ok(StandardJson {
            engine_type: EngineType::FlashLegacy,
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
        let lso: flash_lso::types::Lso =
            serde_json::from_value(standard_json.parsed_variables.clone())
                .map_err(|e| format!("Failed to deserialize JSON to LSO: {}", e))?;

        let bytes = flash_lso::write::write_to_bytes(&lso);

        Ok(bytes)
    }
}
