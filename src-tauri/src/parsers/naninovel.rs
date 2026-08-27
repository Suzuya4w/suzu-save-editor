use crate::models::ipc::{EngineType, StandardJson};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use flate2::Compression;
use flate2::read::{DeflateDecoder, GzDecoder, ZlibDecoder};
use flate2::write::{DeflateEncoder, GzEncoder, ZlibEncoder};
use std::io::{Read, Write};
use std::path::Path;

pub struct NaninovelParser;

fn read_7bit_encoded_int(data: &[u8], offset: &mut usize) -> Option<usize> {
    let mut value = 0;
    let mut shift = 0;
    while *offset < data.len() && shift < 35 {
        let b = data[*offset];
        *offset += 1;
        value |= ((b & 0x7F) as usize) << shift;
        shift += 7;
        if (b & 0x80) == 0 {
            return Some(value);
        }
    }
    None
}

fn write_7bit_encoded_int(mut value: usize, out: &mut Vec<u8>) {
    while value >= 0x80 {
        out.push((value as u8) | 0x80);
        value >>= 7;
    }
    out.push(value as u8);
}

fn deep_parse(val: &mut serde_json::Value, paths: &mut Vec<String>, current_path: String) {
    match val {
        serde_json::Value::Object(map) => {
            let mut replacements = Vec::new();
            for (k, v) in map.iter_mut() {
                let next_path = if current_path.is_empty() {
                    k.clone()
                } else {
                    format!("{}.{}", current_path, k)
                };

                if let serde_json::Value::String(s) = v {
                    let s_trim = s.trim();
                    if (s_trim.starts_with('{') && s_trim.ends_with('}'))
                        || (s_trim.starts_with('[') && s_trim.ends_with(']'))
                    {
                        if let Ok(mut parsed_json) =
                            serde_json::from_str::<serde_json::Value>(s_trim)
                        {
                            paths.push(next_path.clone());
                            deep_parse(&mut parsed_json, paths, next_path.clone());
                            replacements.push((k.clone(), parsed_json));
                            continue;
                        }
                    }
                }
                deep_parse(v, paths, next_path);
            }
            for (k, new_val) in replacements {
                map.insert(k, new_val);
            }
        }
        serde_json::Value::Array(arr) => {
            for (i, v) in arr.iter_mut().enumerate() {
                let next_path = format!("{}[{}]", current_path, i);
                let mut replace_val = None;

                if let serde_json::Value::String(s) = v {
                    let s_trim = s.trim();
                    if (s_trim.starts_with('{') && s_trim.ends_with('}'))
                        || (s_trim.starts_with('[') && s_trim.ends_with(']'))
                    {
                        if let Ok(mut parsed_json) =
                            serde_json::from_str::<serde_json::Value>(s_trim)
                        {
                            paths.push(next_path.clone());
                            deep_parse(&mut parsed_json, paths, next_path.clone());
                            replace_val = Some(parsed_json);
                        }
                    }
                }

                if let Some(new_val) = replace_val {
                    *v = new_val;
                } else {
                    deep_parse(v, paths, next_path);
                }
            }
        }
        _ => {}
    }
}

fn deep_stringify(val: &mut serde_json::Value, paths: &[String], current_path: String) {
    match val {
        serde_json::Value::Object(map) => {
            for (k, v) in map.iter_mut() {
                let next_path = if current_path.is_empty() {
                    k.clone()
                } else {
                    format!("{}.{}", current_path, k)
                };
                deep_stringify(v, paths, next_path.clone());

                if paths.contains(&next_path) {
                    if let Ok(stringified) = serde_json::to_string(v) {
                        *v = serde_json::Value::String(stringified);
                    }
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for (i, v) in arr.iter_mut().enumerate() {
                let next_path = format!("{}[{}]", current_path, i);
                deep_stringify(v, paths, next_path.clone());

                if paths.contains(&next_path) {
                    if let Ok(stringified) = serde_json::to_string(v) {
                        *v = serde_json::Value::String(stringified);
                    }
                }
            }
        }
        _ => {}
    }
}

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for NaninovelParser {
    fn engine_type(&self) -> EngineType {
        EngineType::Naninovel
    }

    async fn detect(&self, path: &Path, _raw_bytes: &[u8]) -> Result<bool, String> {
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        Ok(ext == "nson")
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let mut slice = data;
        if slice.starts_with(&[0xEF, 0xBB, 0xBF]) {
            slice = &slice[3..];
        }
        let starts_with_json = slice
            .iter()
            .find(|&&b| !b.is_ascii_whitespace())
            .map_or(false, |&b| b == b'{' || b == b'[');

        if starts_with_json {
            if let Ok(parsed) = serde_json::from_slice::<serde_json::Value>(slice) {
                return Ok(StandardJson {
                    engine_type: EngineType::Naninovel,
                    parsed_variables: parsed,
                    raw_payload: None,
                });
            }
        }

        let mut decompressed = data.to_vec();
        let mut compression_type = "none";

        let mut gz = GzDecoder::new(data);
        let mut out = Vec::new();
        if gz.read_to_end(&mut out).is_ok() && !out.is_empty() {
            decompressed = out;
            compression_type = "gzip";
        } else {
            let mut zl = ZlibDecoder::new(data);
            let mut out2 = Vec::new();
            if zl.read_to_end(&mut out2).is_ok() && !out2.is_empty() {
                decompressed = out2;
                compression_type = "zlib";
            } else {
                let mut def = DeflateDecoder::new(data);
                let mut out3 = Vec::new();
                if def.read_to_end(&mut out3).is_ok() && !out3.is_empty() {
                    decompressed = out3;
                    compression_type = "deflate";
                }
            }
        }

        let mut map = serde_json::Map::new();
        let mut found_json = false;
        let mut json_start = 0;
        let mut json_end = 0;
        let mut json_length_prefix_start = 0;
        let mut json_length_prefix_end = 0;
        let mut escaped_paths: Vec<String> = Vec::new();

        for i in 0..decompressed.len() {
            if decompressed[i] == b'{' {
                let mut brace_count = 0;
                for j in i..decompressed.len() {
                    if decompressed[j] == b'{' {
                        brace_count += 1;
                    }
                    if decompressed[j] == b'}' {
                        brace_count -= 1;
                        if brace_count == 0 {
                            let slice = &decompressed[i..=j];
                            if let Ok(mut parsed) =
                                serde_json::from_slice::<serde_json::Value>(slice)
                            {
                                deep_parse(&mut parsed, &mut escaped_paths, String::new());

                                map.insert("GameState".to_string(), parsed);
                                found_json = true;
                                json_start = i;
                                json_end = j;

                                let mut temp_offset = 0;
                                while temp_offset < i {
                                    let current = temp_offset;
                                    if let Some(length) =
                                        read_7bit_encoded_int(&decompressed, &mut temp_offset)
                                    {
                                        if temp_offset == i && length == (j - i + 1) {
                                            json_length_prefix_start = current;
                                            json_length_prefix_end = temp_offset;
                                        }
                                    } else {
                                        temp_offset += 1;
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
                if found_json {
                    break;
                }
            }
        }

        let base64_encoded = STANDARD.encode(data);

        if !found_json {
            return Err("Failed to find JSON data in Naninovel binary".to_string());
        }

        map.insert(
            "__metadata__".to_string(),
            serde_json::json!({
                "compression": compression_type,
                "json_start": json_start,
                "json_end": json_end,
                "prefix_start": json_length_prefix_start,
                "prefix_end": json_length_prefix_end,
                "escaped_paths": escaped_paths
            }),
        );

        Ok(StandardJson {
            engine_type: EngineType::Naninovel,
            parsed_variables: serde_json::Value::Object(map),
            raw_payload: Some(serde_json::Value::String(base64_encoded)),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        if standard_json.raw_payload.is_none() {
            return serde_json::to_vec_pretty(&standard_json.parsed_variables)
                .map_err(|e| format!("Failed to encode JSON: {}", e));
        }

        let payload_val = standard_json.raw_payload.as_ref().unwrap();
        let base64_str = payload_val.as_str().ok_or("Invalid raw payload")?;
        let original_data = STANDARD
            .decode(base64_str)
            .map_err(|e| format!("Failed to decode base64: {}", e))?;

        let mut compression_type = String::from("none");
        let mut json_start = 0;
        let mut json_end = 0;
        let mut prefix_start = 0;
        let mut prefix_end = 0;
        let mut escaped_paths = Vec::new();
        let mut new_json_str = String::new();

        let mut cloned_vars = standard_json.parsed_variables.clone();

        if let Some(obj) = cloned_vars.as_object_mut() {
            if let Some(meta) = obj.get("__metadata__") {
                if let Some(comp) = meta.get("compression").and_then(|c| c.as_str()) {
                    compression_type = comp.to_string();
                }
                if let Some(start) = meta.get("json_start").and_then(|n| n.as_u64()) {
                    json_start = start as usize;
                }
                if let Some(end) = meta.get("json_end").and_then(|n| n.as_u64()) {
                    json_end = end as usize;
                }
                if let Some(ps) = meta.get("prefix_start").and_then(|n| n.as_u64()) {
                    prefix_start = ps as usize;
                }
                if let Some(pe) = meta.get("prefix_end").and_then(|n| n.as_u64()) {
                    prefix_end = pe as usize;
                }

                if let Some(paths) = meta.get("escaped_paths").and_then(|p| p.as_array()) {
                    escaped_paths = paths
                        .iter()
                        .filter_map(|p| p.as_str().map(|s| s.to_string()))
                        .collect();
                }
            }

            if let Some(game_state) = obj.get_mut("GameState") {
                deep_stringify(game_state, &escaped_paths, String::new());
            }

            if let Some(game_state) = obj.get("GameState") {
                new_json_str = serde_json::to_string(game_state).unwrap_or_default();
            }
        }

        if new_json_str.is_empty() {
            return Err("GameState not found in parsed variables".to_string());
        }

        let mut decompressed = original_data.clone();
        match compression_type.as_str() {
            "gzip" => {
                let mut gz = GzDecoder::new(&original_data[..]);
                let mut out = Vec::new();
                if gz.read_to_end(&mut out).is_ok() {
                    decompressed = out;
                }
            }
            "zlib" => {
                let mut zl = ZlibDecoder::new(&original_data[..]);
                let mut out = Vec::new();
                if zl.read_to_end(&mut out).is_ok() {
                    decompressed = out;
                }
            }
            "deflate" => {
                let mut def = DeflateDecoder::new(&original_data[..]);
                let mut out = Vec::new();
                if def.read_to_end(&mut out).is_ok() {
                    decompressed = out;
                }
            }
            _ => {}
        }

        let new_bytes = new_json_str.as_bytes();
        let mut patched = Vec::new();

        if prefix_start != prefix_end {
            let mut new_length_bytes = Vec::new();
            write_7bit_encoded_int(new_bytes.len(), &mut new_length_bytes);

            patched.extend_from_slice(&decompressed[..prefix_start]);
            patched.extend_from_slice(&new_length_bytes);
            patched.extend_from_slice(new_bytes);
            if json_end + 1 < decompressed.len() {
                patched.extend_from_slice(&decompressed[json_end + 1..]);
            }
        } else {
            patched.extend_from_slice(&decompressed[..json_start]);
            patched.extend_from_slice(new_bytes);
            if json_end + 1 < decompressed.len() {
                patched.extend_from_slice(&decompressed[json_end + 1..]);
            }
        }

        let final_compressed = match compression_type.as_str() {
            "gzip" => {
                let mut enc = GzEncoder::new(Vec::new(), Compression::default());
                enc.write_all(&patched).map_err(|e| e.to_string())?;
                enc.finish().map_err(|e| e.to_string())?
            }
            "zlib" => {
                let mut enc = ZlibEncoder::new(Vec::new(), Compression::default());
                enc.write_all(&patched).map_err(|e| e.to_string())?;
                enc.finish().map_err(|e| e.to_string())?
            }
            "deflate" => {
                let mut enc = DeflateEncoder::new(Vec::new(), Compression::default());
                enc.write_all(&patched).map_err(|e| e.to_string())?;
                enc.finish().map_err(|e| e.to_string())?
            }
            _ => patched,
        };

        Ok(final_compressed)
    }
}
