use crate::models::ipc::{EngineType, StandardJson};

use std::path::Path;

pub struct RpgMvParser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for RpgMvParser {
    fn engine_type(&self) -> EngineType {
        EngineType::RpgMakerMv
    }

    async fn detect(&self, path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        let _is_json_start = raw_bytes.starts_with(b"{") || raw_bytes.starts_with(b"[");

        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        if extension != "rpgsave" && extension != "rmmzsave" {
            return Ok(false);
        }

        let mut slice = raw_bytes;
        if slice.starts_with(&[0xEF, 0xBB, 0xBF]) {
            slice = &slice[3..];
        }
        let is_plain_json = slice
            .iter()
            .find(|&&b| !b.is_ascii_whitespace())
            .map_or(false, |&b| b == b'{' || b == b'[');
        if is_plain_json {
            return Ok(false);
        }
        Ok(true)
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        let content = String::from_utf8(raw_data.to_vec()).map_err(|e| e.to_string())?;

        let decompressed =
            lz_str::decompress_from_base64(&content).ok_or("Failed to decompress LZString data")?;

        let bytes = String::from_utf16(&decompressed)
            .map_err(|e| format!("Failed to decode UTF-16: {}", e))?
            .into_bytes();

        Ok(bytes)
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let json_str = String::from_utf8(data.to_vec())
            .map_err(|e| format!("Invalid UTF-8 sequence: {}", e))?;

        let parsed_value: serde_json::Value =
            serde_json::from_str(&json_str).map_err(|e| format!("Invalid JSON: {}", e))?;

        Ok(StandardJson {
            engine_type: EngineType::RpgMakerMv,
            parsed_variables: parsed_value.clone(),
            raw_payload: Some(parsed_value),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        let raw_payload = standard_json
            .raw_payload
            .as_ref()
            .ok_or("Missing raw_payload for merging")?;

        let mut merged_json = raw_payload.clone();

        merge_json_values(&mut merged_json, &standard_json.parsed_variables);

        let json_str = serde_json::to_string(&merged_json)
            .map_err(|e| format!("Failed to stringify JSON: {}", e))?;

        let utf16_data: Vec<u16> = json_str.encode_utf16().collect();
        let compressed = lz_str::compress_to_base64(&utf16_data);

        Ok(compressed.into_bytes())
    }
}


fn merge_json_values(target: &mut serde_json::Value, source: &serde_json::Value) {
    if target.is_object() && source.is_object() {
        let target_map = target.as_object_mut().unwrap();
        let source_map = source.as_object().unwrap();

        for (k, v) in source_map {
            if target_map.contains_key(k) {
                if let Some(target_val) = target_map.get_mut(k) {
                    if v.is_object() && target_val.is_object() {
                        merge_json_values(target_val, v);
                    } else {
                        *target_val = v.clone();
                    }
                }
            } else {
                target_map.insert(k.clone(), v.clone());
            }
        }
    } else if target.is_array() && source.is_array() {

        let target_arr = target.as_array_mut().unwrap();
        let source_arr = source.as_array().unwrap();
        *target_arr = source_arr.clone();
    } else {
        *target = source.clone();
    }
}
