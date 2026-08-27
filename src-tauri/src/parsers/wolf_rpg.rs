use crate::models::ipc::{EngineType, StandardJson};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use encoding_rs::SHIFT_JIS;
use nom::{
    IResult,
    bytes::complete::take,
    number::complete::{le_u8, le_u32},
};
use serde_json::json;
use std::path::Path;

pub struct WolfRpgParser;

#[allow(dead_code)]
fn parse_shift_jis_string(input: &[u8]) -> IResult<&[u8], String> {
    let (input, length) = le_u32(input)?;
    let (input, string_bytes) = take(length)(input)?;
    let (decoded, _, _) = SHIFT_JIS.decode(string_bytes);
    Ok((input, decoded.into_owned()))
}

fn parse_wolf_header(input: &[u8]) -> IResult<&[u8], u32> {

    let (input, _magic) = le_u8(input)?;
    let (input, version) = le_u32(input)?;
    Ok((input, version))
}

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for WolfRpgParser {
    fn engine_type(&self) -> EngineType {
        EngineType::WolfRpg
    }

    async fn detect(&self, path: &Path, _raw_bytes: &[u8]) -> Result<bool, String> {
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        Ok(ext == "sav")
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let mut parsed_data = json!({
             "_is_binary_format": true
        });

        if let Ok((_remaining, version)) = parse_wolf_header(data) {
            parsed_data["header_version"] = json!(version);
        }

        if let Some(rules) = &profile_rules {
            parsed_data["message"] = json!("Wolf RPG Data mapped via Profile Rules.");
            for rule in rules {
                if rule.r#type == "binary_offset" {
                    if let (Some(offset), Some(size), Some(val_type), Some(key)) = (
                        rule.offset,
                        rule.size,
                        rule.value_type.as_ref(),
                        rule.keys.as_ref().and_then(|k| k.get(0)),
                    ) {
                        if offset + size <= data.len() {
                            let slice = &data[offset..offset + size];
                            match val_type.as_str() {
                                "u8" => {
                                    if slice.len() == 1 {
                                        parsed_data[key] = json!(slice[0]);
                                    }
                                }
                                "u16" => {
                                    if slice.len() == 2 {
                                        let val = u16::from_le_bytes([slice[0], slice[1]]);
                                        parsed_data[key] = json!(val);
                                    }
                                }
                                "u32" => {
                                    if slice.len() == 4 {
                                        let val = u32::from_le_bytes([
                                            slice[0], slice[1], slice[2], slice[3],
                                        ]);
                                        parsed_data[key] = json!(val);
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        } else {
            parsed_data["message"] =
                json!("Wolf RPG Data is highly structural. Create a profile via Diff Tool first.");
        }

        let base64_encoded = STANDARD.encode(data);

        Ok(StandardJson {
            engine_type: EngineType::WolfRpg,
            parsed_variables: parsed_data,
            raw_payload: Some(json!(base64_encoded)),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        if let Some(payload_value) = &standard_json.raw_payload {
            if let Some(base64_str) = payload_value.as_str() {
                let mut decoded = STANDARD
                    .decode(base64_str)
                    .map_err(|e| format!("Failed to decode base64 back to binary: {}", e))?;

                if let Some(rules) = profile_rules {
                    for rule in rules {
                        if rule.r#type == "binary_offset" {
                            if let (Some(offset), Some(size), Some(val_type), Some(key)) = (
                                rule.offset,
                                rule.size,
                                rule.value_type.as_ref(),
                                rule.keys.as_ref().and_then(|k| k.get(0)),
                            ) {
                                if let Some(new_val) = standard_json.parsed_variables.get(key) {
                                    if offset + size <= decoded.len() {
                                        match val_type.as_str() {
                                            "u8" => {
                                                if let Some(n) = new_val.as_u64() {
                                                    decoded[offset] = n as u8;
                                                }
                                            }
                                            "u16" => {
                                                if let Some(n) = new_val.as_u64() {
                                                    let bytes = (n as u16).to_le_bytes();
                                                    decoded[offset] = bytes[0];
                                                    decoded[offset + 1] = bytes[1];
                                                }
                                            }
                                            "u32" => {
                                                if let Some(n) = new_val.as_u64() {
                                                    let bytes = (n as u32).to_le_bytes();
                                                    decoded[offset] = bytes[0];
                                                    decoded[offset + 1] = bytes[1];
                                                    decoded[offset + 2] = bytes[2];
                                                    decoded[offset + 3] = bytes[3];
                                                }
                                            }
                                            _ => {}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                return Ok(decoded);
            }
        }

        Err("No raw payload provided for Wolf RPG binary file.".to_string())
    }
}
