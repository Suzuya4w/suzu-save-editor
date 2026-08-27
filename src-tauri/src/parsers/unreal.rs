use crate::models::ipc::{EngineType, StandardJson};

use std::path::Path;

pub struct UnrealParser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for UnrealParser {
    fn engine_type(&self) -> EngineType {
        EngineType::UnrealEngine
    }

    async fn detect(&self, _path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        Ok(raw_bytes.starts_with(b"GVAS"))
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        let base64_encoded = STANDARD.encode(data);

        Ok(StandardJson {
            engine_type: EngineType::UnrealEngine,
            parsed_variables: serde_json::json!({
                "_is_binary_format": true,
                "message": "Unreal Engine GVAS structures are extremely complex and heavily dependent on specific game structs. Please map the memory using the Diff Tool."
            }),
            raw_payload: Some(serde_json::json!(base64_encoded)),
        })
    }

    async fn encode(
        &self,
        _standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        Err("Unreal GVAS encode not structurally implemented. Use offset profiles.".to_string())
    }
}
