use crate::models::ipc::{EngineType, StandardJson};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::io::{Read, Write};
use std::path::Path;

pub struct NbtParser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for NbtParser {
    fn engine_type(&self) -> EngineType {
        EngineType::Nbt
    }

    async fn detect(&self, path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        if ext == "dat" || ext == "mca" {
            return Ok(true);
        }

        if raw_bytes.len() >= 2 {
            if raw_bytes[0] == 0x1F && raw_bytes[1] == 0x8B {
                return Ok(true);
            }
            if raw_bytes[0] == 0x0A {
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
        let mut is_gzip = false;
        let mut actual_data = data;
        let mut decompressed = Vec::new();

        if data.len() >= 2 && data[0] == 0x1F && data[1] == 0x8B {
            is_gzip = true;
            let mut decoder = GzDecoder::new(data);
            decoder
                .read_to_end(&mut decompressed)
                .map_err(|e| format!("Failed to decompress GZIP NBT: {}", e))?;
            actual_data = &decompressed;
        }

        let parsed_variables: serde_json::Value =
            fastnbt::from_bytes(actual_data).map_err(|e| format!("Failed to parse NBT: {}", e))?;

        Ok(StandardJson {
            engine_type: EngineType::Nbt,
            parsed_variables,
            raw_payload: Some(serde_json::json!({ "is_gzip": is_gzip })),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        let nbt_bytes = fastnbt::to_bytes(&standard_json.parsed_variables)
            .map_err(|e| format!("Failed to encode NBT: {}", e))?;

        let mut is_gzip = false;
        if let Some(raw) = &standard_json.raw_payload {
            if let Some(is_gz) = raw.get("is_gzip").and_then(|v| v.as_bool()) {
                is_gzip = is_gz;
            }
        }

        if is_gzip {
            let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
            encoder
                .write_all(&nbt_bytes)
                .map_err(|e| format!("Failed to compress NBT: {}", e))?;
            encoder
                .finish()
                .map_err(|e| format!("Failed to finish compression: {}", e))
        } else {
            Ok(nbt_bytes)
        }
    }
}
