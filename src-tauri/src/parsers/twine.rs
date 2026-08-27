use crate::models::ipc::{EngineType, StandardJson};
use std::path::Path;

pub struct TwineSave;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for TwineSave {
    fn engine_type(&self) -> EngineType {
        EngineType::Twine
    }

    async fn detect(&self, path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        if extension != "save" && extension != "txt" {
            return Ok(false);
        }

        let content = match String::from_utf8(raw_bytes.to_vec()) {
            Ok(c) => c.trim().to_string(),
            Err(_) => return Ok(false),
        };

        // Try to decode to see if it's valid Twine
        if let Ok(decoded) = self.decode_twine_content(&content) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&decoded) {
                if json.get("state").is_some() || json.get("history").is_some() {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        let content = String::from_utf8(raw_data.to_vec())
            .map_err(|e| e.to_string())?
            .trim()
            .to_string();

        let decoded = self.decode_twine_content(&content)?;
        Ok(decoded.into_bytes())
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
            engine_type: EngineType::Twine,
            parsed_variables: parsed_value.clone(),
            raw_payload: Some(parsed_value),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        original_file_path: &Path,
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

        // Need to read original file to determine format
        let raw_bytes = std::fs::read(original_file_path)
            .map_err(|e| format!("Failed to read original file: {}", e))?;
        let content = String::from_utf8(raw_bytes)
            .unwrap_or_default()
            .trim()
            .to_string();

        let encoded = self.encode_twine_content(&json_str, &content)?;
        Ok(encoded.into_bytes())
    }
}

impl TwineSave {
    fn decode_twine_content(&self, content: &str) -> Result<String, String> {
        // Handle wrapper prefixes if any (e.g. some games prefix with a custom header)
        // For Twine, we extract the first '{' if it's plain json, or assume it's base64/lzstring.
        let payload = if let Some(start) = content.find('{') {
            if content[..start].contains("SugarCube") || content.ends_with('}') {
                &content[start..]
            } else {
                content
            }
        } else {
            content
        };

        // Attempt 1: Raw JSON
        if payload.starts_with('{') && payload.ends_with('}') {
            if serde_json::from_str::<serde_json::Value>(payload).is_ok() {
                return Ok(payload.to_string());
            }
        }

        // Attempt 2: LZString Base64
        if let Some(decompressed) = lz_str::decompress_from_base64(payload) {
            if let Ok(bytes) = String::from_utf16(&decompressed) {
                if serde_json::from_str::<serde_json::Value>(&bytes).is_ok() {
                    return Ok(bytes);
                }
            }
        }

        // Attempt 3: Standard Base64
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        if let Ok(decoded_bytes) = STANDARD.decode(payload) {
            if let Ok(bytes_str) = String::from_utf8(decoded_bytes) {
                if serde_json::from_str::<serde_json::Value>(&bytes_str).is_ok() {
                    return Ok(bytes_str);
                }
            }
        }

        Err("Unknown Twine save format or corruption".to_string())
    }

    fn encode_twine_content(&self, json_str: &str, original_content: &str) -> Result<String, String> {
        let original_payload = if let Some(start) = original_content.find('{') {
            if original_content[..start].contains("SugarCube") || original_content.ends_with('}') {
                &original_content[start..]
            } else {
                original_content
            }
        } else {
            original_content
        };

        // Prefix
        let prefix = if original_payload.len() < original_content.len() {
            &original_content[..original_content.len() - original_payload.len()]
        } else {
            ""
        };

        if original_payload.starts_with('{') {
            return Ok(format!("{}{}", prefix, json_str));
        }

        if let Some(decompressed) = lz_str::decompress_from_base64(original_payload) {
            if String::from_utf16(&decompressed).is_ok() {
                let utf16_data: Vec<u16> = json_str.encode_utf16().collect();
                let compressed = lz_str::compress_to_base64(&utf16_data);
                return Ok(format!("{}{}", prefix, compressed));
            }
        }

        use base64::{Engine as _, engine::general_purpose::STANDARD};
        if STANDARD.decode(original_payload).is_ok() {
            let encoded = STANDARD.encode(json_str.as_bytes());
            return Ok(format!("{}{}", prefix, encoded));
        }

        // Fallback to LZString Base64
        let utf16_data: Vec<u16> = json_str.encode_utf16().collect();
        let compressed = lz_str::compress_to_base64(&utf16_data);
        Ok(format!("{}{}", prefix, compressed))
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
