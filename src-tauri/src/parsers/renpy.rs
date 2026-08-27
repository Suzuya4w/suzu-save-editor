use crate::models::ipc::{EngineType, StandardJson};

use flate2::Compression;
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use std::io::{Read, Write};
use std::path::Path;

pub struct RenPyParser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for RenPyParser {
    fn engine_type(&self) -> EngineType {
        EngineType::RenPy
    }

    async fn detect(&self, _path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        if raw_bytes.len() >= 2 {
            if raw_bytes[0] == 0x78
                && (raw_bytes[1] == 0x9c
                    || raw_bytes[1] == 0xda
                    || raw_bytes[1] == 0x01
                    || raw_bytes[1] == 0x5e)
            {
                return Ok(true);
            }
        }

        Ok(false)
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        let content = raw_data.to_vec();

        let mut decoder = ZlibDecoder::new(&content[..]);
        let mut decompressed = Vec::new();
        decoder
            .read_to_end(&mut decompressed)
            .map_err(|e| format!("Failed to decompress Zlib data: {}", e))?;

        Ok(decompressed)
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let pickle_val: serde_pickle::Value =
            serde_pickle::value_from_slice(data, serde_pickle::DeOptions::default())
                .map_err(|e| format!("Failed to parse Pickle: {}", e))?;

        let parsed_value = pickle_to_json(&pickle_val);

        Ok(StandardJson {
            engine_type: EngineType::RenPy,
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

        let pickle_val = json_to_pickle(&merged_json)?;

        let serialized =
            serde_pickle::value_to_vec(&pickle_val, serde_pickle::SerOptions::default())
                .map_err(|e| format!("Failed to serialize to Pickle: {}", e))?;

        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
        encoder
            .write_all(&serialized)
            .map_err(|e| format!("Failed to compress Zlib data: {}", e))?;

        let compressed = encoder
            .finish()
            .map_err(|e| format!("Failed to finish Zlib compression: {}", e))?;

        Ok(compressed)
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


fn pickle_to_json(val: &serde_pickle::Value) -> serde_json::Value {
    match val {
        serde_pickle::Value::None => serde_json::Value::Null,
        serde_pickle::Value::Bool(b) => serde_json::Value::Bool(*b),
        serde_pickle::Value::I64(i) => serde_json::json!(*i),
        serde_pickle::Value::F64(f) => serde_json::json!(*f),
        serde_pickle::Value::Bytes(b) => {
            serde_json::json!({
                "__python_type__": "bytes",
                "data": b
            })
        }
        serde_pickle::Value::String(s) => serde_json::Value::String(s.clone()),
        serde_pickle::Value::List(l) => {
            let json_list: Vec<serde_json::Value> = l.iter().map(pickle_to_json).collect();
            serde_json::Value::Array(json_list)
        }
        serde_pickle::Value::Tuple(t) => {
            let json_tuple: Vec<serde_json::Value> = t.iter().map(pickle_to_json).collect();
            serde_json::json!({
                "__python_type__": "tuple",
                "items": json_tuple
            })
        }
        serde_pickle::Value::Set(s) => {

            let items: Vec<serde_json::Value> = s.iter().map(|h| hashable_to_json(h)).collect();
            serde_json::json!({
                "__python_type__": "set",
                "items": items
            })
        }
        serde_pickle::Value::Dict(d) => {
            let mut map = serde_json::Map::new();
            for (k, v) in d {

                let key_str = hashable_to_string(k);
                map.insert(key_str, pickle_to_json(v));
            }
            serde_json::Value::Object(map)
        }
        _ => serde_json::Value::String("Unsupported Pickle Type".to_string()),
    }
}


fn json_to_pickle(val: &serde_json::Value) -> Result<serde_pickle::Value, String> {
    if val.is_null() {
        return Ok(serde_pickle::Value::None);
    } else if val.is_boolean() {
        return Ok(serde_pickle::Value::Bool(val.as_bool().unwrap()));
    } else if val.is_i64() {
        return Ok(serde_pickle::Value::I64(val.as_i64().unwrap()));
    } else if val.is_u64() {
        return Ok(serde_pickle::Value::I64(val.as_u64().unwrap() as i64));
    } else if val.is_f64() {
        return Ok(serde_pickle::Value::F64(val.as_f64().unwrap()));
    } else if val.is_string() {
        return Ok(serde_pickle::Value::String(
            val.as_str().unwrap().to_string(),
        ));
    } else if val.is_array() {
        let mut list = Vec::new();
        for item in val.as_array().unwrap() {
            list.push(json_to_pickle(item)?);
        }
        return Ok(serde_pickle::Value::List(list));
    } else if val.is_object() {
        let obj = val.as_object().unwrap();
        if let Some(t) = obj.get("__python_type__") {
            if t == "tuple" {
                let mut tuple_items = Vec::new();
                if let Some(items) = obj.get("items").and_then(|i| i.as_array()) {
                    for item in items {
                        tuple_items.push(json_to_pickle(item)?);
                    }
                }
                return Ok(serde_pickle::Value::Tuple(tuple_items));
            } else if t == "set" {

                return Ok(serde_pickle::Value::List(Vec::new()));
            } else if t == "bytes" {
                let mut bytes = Vec::new();
                if let Some(data) = obj.get("data").and_then(|d| d.as_array()) {
                    for b in data {
                        bytes.push(b.as_u64().unwrap_or(0) as u8);
                    }
                }
                return Ok(serde_pickle::Value::Bytes(bytes));
            }
        }


        let mut dict = std::collections::BTreeMap::new();
        for (k, v) in obj {

            let key = serde_pickle::HashableValue::String(k.clone());
            dict.insert(key, json_to_pickle(v)?);
        }
        return Ok(serde_pickle::Value::Dict(dict));
    }

    Err("Unknown JSON type mapping to Pickle".to_string())
}

fn hashable_to_json(h: &serde_pickle::HashableValue) -> serde_json::Value {
    match h {
        serde_pickle::HashableValue::None => serde_json::Value::Null,
        serde_pickle::HashableValue::Bool(b) => serde_json::Value::Bool(*b),
        serde_pickle::HashableValue::I64(i) => serde_json::json!(*i),
        serde_pickle::HashableValue::F64(f) => serde_json::json!(*f),
        serde_pickle::HashableValue::Bytes(b) => {
            serde_json::json!({ "__python_type__": "bytes", "data": b })
        }
        serde_pickle::HashableValue::String(s) => serde_json::Value::String(s.clone()),
        serde_pickle::HashableValue::Tuple(t) => {
            let json_tuple: Vec<serde_json::Value> = t.iter().map(hashable_to_json).collect();
            serde_json::json!({ "__python_type__": "tuple", "items": json_tuple })
        }

        _ => serde_json::Value::String("Unsupported HashableValue".to_string()),
    }
}

fn hashable_to_string(h: &serde_pickle::HashableValue) -> String {
    match h {
        serde_pickle::HashableValue::String(s) => s.clone(),
        serde_pickle::HashableValue::I64(i) => i.to_string(),
        serde_pickle::HashableValue::Bool(b) => b.to_string(),
        _ => "unknown_key".to_string(),
    }
}
