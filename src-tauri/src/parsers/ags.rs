use crate::models::ipc::{EngineType, StandardJson};
use std::path::Path;

pub struct AgsSave;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for AgsSave {
    fn engine_type(&self) -> EngineType {
        EngineType::Ags
    }

    async fn detect(&self, path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        if extension != "agssave" {
            return Ok(false);
        }

        // Optional: Check for AGS signature in the first few bytes.
        // Usually, AGS save files have something like "Adventure Game Studio" or similar.
        // We'll just rely on the extension since it's highly specific, but we can also
        // do a quick string scan.
        let header_len = std::cmp::min(256, raw_bytes.len());
        let header = String::from_utf8_lossy(&raw_bytes[..header_len]);
        if header.contains("Adventure Game Studio") || header.contains("AdventureGameStudio") {
            return Ok(true);
        }
        
        // If extension matches but no strict signature, still return true as AGS 
        // older formats might lack the strict signature at offset 0.
        Ok(true)
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        // Return raw binary data since AGS is a memory dump
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        // Extract Null-Terminated Strings (Length >= 4) from the binary blob
        let mut extracted_strings = Vec::new();
        let mut current_string = Vec::new();
        let mut string_start_offset = 0;

        for (i, &byte) in data.iter().enumerate() {
            if byte.is_ascii_graphic() || byte == b' ' {
                if current_string.is_empty() {
                    string_start_offset = i;
                }
                current_string.push(byte);
            } else if byte == 0x00 {
                // Null terminator hit
                if current_string.len() >= 4 {
                    // Try parsing as UTF-8 lossy to handle ANSI gracefully
                    let valid_str = String::from_utf8_lossy(&current_string).into_owned();
                    extracted_strings.push(serde_json::json!({
                        "offset": format!("0x{:08X}", string_start_offset),
                        "text": valid_str
                    }));
                }
                current_string.clear();
            } else {
                // Garbage byte (not ASCII, not null)
                current_string.clear();
            }
        }

        use base64::{Engine as _, engine::general_purpose::STANDARD};
        let base64_payload = STANDARD.encode(data);

        Ok(StandardJson {
            engine_type: EngineType::Ags,
            parsed_variables: serde_json::json!({
                "is_encrypted_binary": true,
                "note": "AGS save files are memory dumps. Modifying the file length will corrupt the save.",
                "extracted_metadata_strings": extracted_strings,
            }),
            raw_payload: Some(serde_json::json!(base64_payload)),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        let raw_payload_b64 = standard_json
            .raw_payload
            .as_ref()
            .and_then(|v| v.as_str())
            .ok_or("Missing raw_payload (Base64) for AGS encode")?;

        use base64::{Engine as _, engine::general_purpose::STANDARD};
        let new_data = STANDARD.decode(raw_payload_b64)
            .map_err(|e| format!("Invalid Base64 payload: {}", e))?;

        // Critical safety check: Ensure the modified file size is EXACTLY the same
        let original_data = std::fs::read(original_file_path)
            .map_err(|e| format!("Failed to read original file for size verification: {}", e))?;

        if new_data.len() != original_data.len() {
            return Err(format!(
                "CRITICAL: Modified AGS save file size ({}) does not match original size ({}). \
                AGS memory dumps cannot be shifted. Please use Overwrite mode only.",
                new_data.len(),
                original_data.len()
            ));
        }

        Ok(new_data)
    }
}
