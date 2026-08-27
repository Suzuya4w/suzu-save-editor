use crate::models::ipc::{EngineType, StandardJson};

use quick_xml::Reader;
use quick_xml::events::Event;
use serde_json::{Map, Value};
use std::path::Path;

pub struct CSharpXmlParser;

fn parse_xml_to_json(xml: &str) -> Result<Value, String> {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();

    let mut stack: Vec<(String, Map<String, Value>)> = Vec::new();
    stack.push(("root".to_string(), Map::new()));

    let append_text = |stack: &mut Vec<(String, Map<String, Value>)>, text: &str| {
        if let Some(top) = stack.last_mut() {
            if let Some(Value::String(s)) = top.1.get_mut("$text") {
                s.push_str(text);
            } else if !text.is_empty() {
                top.1.insert("$text".to_string(), Value::String(text.to_string()));
            }
        }
    };

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                let mut map = Map::new();
                for attr in e.attributes() {
                    if let Ok(a) = attr {
                        let k = format!("@{}", String::from_utf8_lossy(a.key.as_ref()));
                        let v = String::from_utf8_lossy(&a.value).into_owned();
                        map.insert(k, Value::String(v));
                    }
                }
                stack.push((name, map));
            }
            Ok(Event::Empty(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                let mut map = Map::new();
                for attr in e.attributes() {
                    if let Ok(a) = attr {
                        let k = format!("@{}", String::from_utf8_lossy(a.key.as_ref()));
                        let v = String::from_utf8_lossy(&a.value).into_owned();
                        map.insert(k, Value::String(v));
                    }
                }
                insert_into_parent(&mut stack, name, Value::Object(map));
            }
            Ok(Event::Text(e)) => {
                let text = String::from_utf8_lossy(&e);
                append_text(&mut stack, &text);
            }
            Ok(Event::CData(e)) => {
                let text = String::from_utf8_lossy(&e);
                append_text(&mut stack, &text);
            }
            Ok(Event::GeneralRef(e)) => {
                let entity = String::from_utf8_lossy(e.as_ref());
                let unescaped = match entity.as_ref() {
                    "apos" => "'",
                    "quot" => "\"",
                    "amp" => "&",
                    "lt" => "<",
                    "gt" => ">",
                    _ => "",
                };
                if unescaped.is_empty() {
                    append_text(&mut stack, &format!("&{};", entity));
                } else {
                    append_text(&mut stack, unescaped);
                }
            }
            Ok(Event::End(_)) => {
                let (name, mut map) = stack.pop().unwrap();

                if let Some(Value::String(text)) = map.get("$text") {
                    let has_children = map.keys().any(|k| !k.starts_with('@') && k != "$text");
                    if has_children {
                        if text.trim().is_empty() {
                            map.remove("$text");
                        }
                    } else {
                        let trimmed = text.trim().to_string();
                        if trimmed.is_empty() {
                            map.remove("$text");
                        } else {
                            map.insert("$text".to_string(), Value::String(trimmed));
                        }
                    }
                }

                let val = if map.len() == 1 && map.contains_key("$text") {
                    map.get("$text").unwrap().clone()
                } else if map.is_empty() {
                    Value::String(String::new())
                } else {
                    Value::Object(map)
                };

                insert_into_parent(&mut stack, name, val);
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(e.to_string()),
            _ => (),
        }
        buf.clear();
    }

    if stack.len() == 1 {
        let mut root_map = stack.pop().unwrap().1;
        root_map.remove("$text");
        Ok(Value::Object(root_map))
    } else {
        Err("Invalid XML structure".to_string())
    }
}

fn insert_into_parent(stack: &mut Vec<(String, Map<String, Value>)>, name: String, val: Value) {
    if let Some(parent) = stack.last_mut() {
        if let Some(existing) = parent.1.get_mut(&name) {
            if let Value::Array(arr) = existing {
                arr.push(val);
            } else {
                let old = existing.take();
                *existing = Value::Array(vec![old, val]);
            }
        } else {
            parent.1.insert(name, val);
        }
    }
}

fn escape_xml(s: &str) -> String {
    s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;")
}

fn build_xml(name: &str, value: &Value, out: &mut String) {
    match value {
        Value::Object(map) => {
            let mut attrs = String::new();
            let mut inner_text = String::new();
            let mut children = String::new();

            for (k, v) in map {
                if k.starts_with('@') {
                    let attr_name = &k[1..];
                    if let Value::String(s) = v {
                        attrs.push_str(&format!(" {}=\"{}\"", attr_name, escape_xml(s)));
                    } else {
                        attrs.push_str(&format!(
                            " {}=\"{}\"",
                            attr_name,
                            escape_xml(&v.to_string().replace("\"", ""))
                        ));
                    }
                } else if k == "$text" || k == "#text" || k == "text" {
                    if let Value::String(s) = v {
                        inner_text.push_str(&escape_xml(s));
                    } else {
                        inner_text.push_str(&escape_xml(&v.to_string()));
                    }
                } else {
                    build_xml(k, v, &mut children);
                }
            }

            if inner_text.is_empty() && children.is_empty() {
                out.push_str(&format!("<{}{} />", name, attrs));
            } else {
                out.push_str(&format!("<{}{}>", name, attrs));
                out.push_str(&inner_text);
                out.push_str(&children);
                out.push_str(&format!("</{}>", name));
            }
        }
        Value::Array(arr) => {
            for item in arr {
                build_xml(name, item, out);
            }
        }
        Value::String(s) => {
            out.push_str(&format!("<{}>{}</{}>", name, escape_xml(s), name));
        }
        Value::Number(n) => {
            out.push_str(&format!("<{}>{}</{}>", name, n, name));
        }
        Value::Bool(b) => {
            out.push_str(&format!("<{}>{}</{}>", name, b, name));
        }
        Value::Null => {
            out.push_str(&format!("<{} xsi:nil=\"true\" />", name));
        }
    }
}

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for CSharpXmlParser {
    fn engine_type(&self) -> EngineType {
        EngineType::CSharpXml
    }

    async fn detect(&self, path: &Path, magic_bytes: &[u8]) -> Result<bool, String> {
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        let text = String::from_utf8_lossy(magic_bytes);
        let trimmed = text.trim_start_matches('\u{FEFF}').trim_start();

        if ext == "xml" {
            if trimmed.starts_with("<?xml") || trimmed.starts_with("<") {
                return Ok(true);
            }
        } else {
            if trimmed.starts_with("<?xml") {
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
        let xml_str =
            String::from_utf8(data.to_vec()).map_err(|e| format!("Not valid UTF-8 XML: {}", e))?;

        let parsed_variables = parse_xml_to_json(&xml_str)?;

        Ok(StandardJson {
            engine_type: EngineType::CSharpXml,
            parsed_variables,
            raw_payload: Some(serde_json::json!(
                xml_str
                    .lines()
                    .next()
                    .unwrap_or("<?xml version=\"1.0\" encoding=\"utf-8\"?>")
                    .to_string()
            )),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        let mut out = String::new();

        if let Some(map) = standard_json.parsed_variables.as_object() {
            for (k, v) in map {
                build_xml(k, v, &mut out);
            }
        }

        let final_xml = format!("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n{}", out);

        Ok(final_xml.into_bytes())
    }
}
