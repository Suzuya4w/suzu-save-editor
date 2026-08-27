use crate::models::ipc::{EngineType, StandardJson};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use regex::Regex;
use std::path::Path;
use tokio::fs;

pub struct KirikiriParser;


fn tjs2_to_json(tjs2_str: &str) -> String {
    let mut out = String::with_capacity(tjs2_str.len());
    let mut chars = tjs2_str.chars().peekable();
    let mut in_string = false;
    let mut escape_next = false;

    if tjs2_str.starts_with("//") {
        while let Some(&c) = chars.peek() {
            if c == '\n' || c == '\r' {
                break;
            }
            chars.next();
        }
    }

    while let Some(c) = chars.next() {
        if escape_next {
            out.push(c);
            escape_next = false;
            continue;
        }

        if c == '"' {
            in_string = !in_string;
            out.push(c);
            continue;
        }

        if c == '\\' {
            if chars.peek() == Some(&'\'') {
                chars.next();
                out.push('\'');
                continue;
            }
            escape_next = true;
            out.push(c);
            continue;
        }

        if in_string {
            out.push(c);
            continue;
        }


        if c == '/' && chars.peek() == Some(&'*') {
            chars.next();
            while let Some(comment_char) = chars.next() {
                if comment_char == '*' && chars.peek() == Some(&'/') {
                    chars.next();
                    break;
                }
            }
            continue;
        }

        if c == '/' && chars.peek() == Some(&'/') {
            chars.next();
            while let Some(&comment_char) = chars.peek() {
                if comment_char == '\n' || comment_char == '\r' {
                    break;
                }
                chars.next();
            }
            continue;
        }

        match c {
            '%' => {
                if chars.peek() == Some(&'[') {
                    chars.next();
                    out.push('{');
                } else {
                    out.push(c);
                }
            }
            '=' => {
                if chars.peek() == Some(&'>') {
                    chars.next();
                    out.push(':');
                } else {
                    out.push(c);
                }
            }
            '(' => {

                let mut buffer = String::new();
                buffer.push(c);

                let mut temp_chars = chars.clone();
                for expected in ['c', 'o', 'n', 's', 't', ')'].iter() {
                    if temp_chars.next() == Some(*expected) {
                        buffer.push(*expected);
                    } else {
                        break;
                    }
                }

                if buffer == "(const)" {

                    for _ in 0..6 {
                        chars.next();
                    }

                } else {
                    out.push(c);
                }
            }
            'v' => {

                if chars.clone().take(3).collect::<String>() == "oid" {
                    out.push_str("null");
                    for _ in 0..3 {
                        chars.next();
                    }
                } else {
                    out.push(c);
                }
            }
            ']' => {
                out.push('}');
            }
            _ => out.push(c),
        }
    }

    let re_hex_float = Regex::new(r"0x[0-9a-fA-F]+\.[0-9a-fA-F]+p[-+]?[0-9]+").unwrap();
    let mut out = re_hex_float.replace_all(&out, |caps: &regex::Captures| {
        match hexf_parse::parse_hexf64(&caps[0], false) {
            Ok(val) => val.to_string(),
            Err(_) => "0.0".to_string(),
        }
    }).to_string();

    let re_hex_int = Regex::new(r"0x([0-9a-fA-F]+)").unwrap();
    out = re_hex_int.replace_all(&out, |caps: &regex::Captures| {
        if let Ok(val) = i64::from_str_radix(&caps[1], 16) {
            val.to_string()
        } else {
            "0".to_string()
        }
    }).to_string();

    // Remove trailing commas before closing braces or brackets (invalid in JSON)
    let re_trailing_comma = Regex::new(r",\s*([\]}])").unwrap();
    let out = re_trailing_comma.replace_all(&out, "$1").to_string();

    fix_brackets(&out)
}

fn fix_brackets(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut stack = Vec::new();
    let mut in_string = false;
    let mut escape_next = false;

    for c in input.chars() {
        if escape_next {
            out.push(c);
            escape_next = false;
            continue;
        }
        if c == '"' {
            in_string = !in_string;
            out.push(c);
            continue;
        }
        if c == '\\' {
            escape_next = true;
            out.push(c);
            continue;
        }

        if in_string {
            out.push(c);
            continue;
        }

        match c {
            '{' => {
                stack.push('{');
                out.push(c);
            }
            '[' => {
                stack.push('[');
                out.push(c);
            }
            '}' | ']' => {
                if let Some(top) = stack.pop() {
                    if top == '{' {
                        out.push('}');
                    } else if top == '[' {
                        out.push(']');
                    }
                } else {
                    out.push('}');
                }
            }
            _ => out.push(c),
        }
    }
    out
}

fn value_to_tjs2(value: &serde_json::Value, indent: usize) -> String {
    let tabs = " ".repeat(indent);
    match value {
        serde_json::Value::Null => "void".to_string(),
        serde_json::Value::Bool(b) => {
            if *b {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => {
            let escaped = s
                .replace('\\', "\\\\")
                .replace('"', "\\\"")
                .replace('\n', "\\n")
                .replace('\r', "\\r")
                .replace('\t', "\\t");
            format!("\"{}\"", escaped)
        }
        serde_json::Value::Array(arr) => {
            if arr.is_empty() {
                return "(const) []".to_string();
            }
            let inner_tabs = " ".repeat(indent + 1);
            let elements: Vec<String> = arr
                .iter()
                .map(|v| format!("{}{}", inner_tabs, value_to_tjs2(v, indent + 1)))
                .collect();
            format!("(const) [\r\n{}\r\n{}]", elements.join(",\r\n"), tabs)
        }
        serde_json::Value::Object(obj) => {
            if obj.is_empty() {
                return "(const) %[]".to_string();
            }
            let inner_tabs = " ".repeat(indent + 1);
            let elements: Vec<String> = obj
                .iter()
                .map(|(k, v)| {
                    let escaped_key = k.replace('\\', "\\\\").replace('"', "\\\"");
                    format!(
                        "{}\"{}\" => {}",
                        inner_tabs,
                        escaped_key,
                        value_to_tjs2(v, indent + 1)
                    )
                })
                .collect();
            format!("(const) %[\r\n{}\r\n{}]", elements.join(",\r\n"), tabs)
        }
    }
}

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for KirikiriParser {
    fn engine_type(&self) -> EngineType {
        EngineType::Kirikiri
    }

    async fn detect(&self, path: &Path, raw_bytes: &[u8]) -> Result<bool, String> {
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        if ext == "bmp" {
            if raw_bytes.len() > 14 && raw_bytes[0] == b'B' && raw_bytes[1] == b'M' {
                let bmp_size = u32::from_le_bytes([raw_bytes[2], raw_bytes[3], raw_bytes[4], raw_bytes[5]]) as usize;
                return Ok(raw_bytes.len() > bmp_size);
            }
            return Ok(false);
        }

        Ok(ext == "ksd" || ext == "qdt" || ext == "sav" || ext == "dat")
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let mut debug_log = String::new();
        let mut uncompressed_data = Vec::new();

        let mut payload = data;

        if data.len() > 14 && data[0] == b'B' && data[1] == b'M' {
            let bmp_pure_size = u32::from_le_bytes([data[2], data[3], data[4], data[5]]) as usize;
            if data.len() > bmp_pure_size {
                payload = &data[bmp_pure_size..];
            }
        }

        if payload.len() > 5
            && payload[0] == 0xFE
            && payload[1] == 0xFE
            && payload[3] == 0xFF
            && payload[4] == 0xFE
        {
            if payload[2] == 0x01 || payload[2] == 0x02 {
                let mut zlib_start = 5;
                for i in 5..payload.len() - 1 {
                    if payload[i] == 0x78
                        && (payload[i + 1] == 0x9C
                            || payload[i + 1] == 0xDA
                            || payload[i + 1] == 0x01
                            || payload[i + 1] == 0x5E)
                    {
                        zlib_start = i;
                        break;
                    }
                }

                use flate2::read::ZlibDecoder;
                use std::io::Read;
                let mut zl = ZlibDecoder::new(&payload[zlib_start..]);
                let mut out = Vec::new();
                match zl.read_to_end(&mut out) {
                    Ok(_) => uncompressed_data = out,
                    Err(e) => debug_log = format!("Zlib Error: {}", e),
                }
            } else if payload[2] == 0x00 {
                uncompressed_data = payload[5..].to_vec();
            }
        } else {
            uncompressed_data = payload.to_vec();
        }

        if debug_log.is_empty() {
            let text_result = std::str::from_utf8(&uncompressed_data)
                .map(|s| s.to_string())
                .or_else(|_| {
                    let u16_data: Vec<u16> = uncompressed_data
                        .chunks_exact(2)
                        .map(|c| u16::from_le_bytes([c[0], c[1]]))
                        .collect();
                    String::from_utf16(&u16_data)
                });

            match text_result {
                Ok(text) => {
                    let text = text
                        .trim_start_matches('\u{FEFF}')
                        .trim_start_matches('\u{FFFE}')
                        .trim_matches('\0');

                    if text.contains("%[") || text.contains("=>") {
                        let json_string = tjs2_to_json(text);

                        match serde_json::from_str::<serde_json::Value>(&json_string) {
                            Ok(parsed) => {
                                return Ok(StandardJson {
                                    engine_type: EngineType::Kirikiri,
                                    parsed_variables: parsed,
                                    raw_payload: None,
                                });
                            }
                            Err(e) => {
                                let line_num = e.line() as usize;
                                let lines: Vec<&str> = json_string.lines().collect();
                                let error_line = if line_num > 0 && line_num <= lines.len() {
                                    lines[line_num - 1]
                                } else {
                                    "Unknown line"
                                };
                                debug_log = format!(
                                    "JSON Parse Error: {} --> Di baris {}: {}",
                                    e, line_num, error_line
                                );
                            }
                        }
                    } else {
                        debug_log = "Text decoded successfully, EMPTY FILE: You haven't started the game yet. Please open the game, click 'Start', skip a few lines of text, then Save again!.".to_string();
                    }
                }
                Err(e) => {
                    return Err(format!("Failed to decode or read file: {}", e));
                }
            }
        }

        if debug_log.is_empty() {
            Err("Failed to parse Kirikiri save data".to_string())
        } else {
            Err(debug_log)
        }
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        if standard_json.raw_payload.is_none() {
            let is_bmp_save = _original_file_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| s.to_lowercase()) == Some("bmp".to_string());

            let obj = standard_json.parsed_variables.clone();
            let tjs2_content = value_to_tjs2(&obj, 0);
            let tjs2_string = format!("{}\r\n", tjs2_content);

            if is_bmp_save {
                let orig_disk_bytes = fs::read(_original_file_path).await.map_err(|e| e.to_string())?;
                if orig_disk_bytes.len() >= 6 && orig_disk_bytes[0] == b'B' && orig_disk_bytes[1] == b'M' {
                    let bmp_pure_size = u32::from_le_bytes([
                        orig_disk_bytes[2], orig_disk_bytes[3], orig_disk_bytes[4], orig_disk_bytes[5]
                    ]) as usize;
                    
                    if orig_disk_bytes.len() >= bmp_pure_size {
                        let mut final_bmp_save = orig_disk_bytes[..bmp_pure_size].to_vec();
                        final_bmp_save.extend_from_slice(tjs2_string.as_bytes());
                        return Ok(final_bmp_save);
                    }
                }
            }

            let utf16_data: Vec<u16> = tjs2_string.encode_utf16().collect();
            let mut uncompressed_bytes = Vec::with_capacity(utf16_data.len() * 2);
            for &val in &utf16_data {
                let bytes = val.to_le_bytes();
                uncompressed_bytes.push(bytes[0]);
                uncompressed_bytes.push(bytes[1]);
            }

            let uncompressed_len = uncompressed_bytes.len() as u64;

            use flate2::Compression;
            use flate2::write::ZlibEncoder;
            use std::io::Write;

            let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
            encoder
                .write_all(&uncompressed_bytes)
                .map_err(|e| e.to_string())?;
            let compressed_bytes = encoder.finish().map_err(|e| e.to_string())?;

            let compressed_len = compressed_bytes.len() as u64;

            let mut final_data = vec![0xFE, 0xFE, 0x02, 0xFF, 0xFE];

            final_data.extend_from_slice(&compressed_len.to_le_bytes());
            final_data.extend_from_slice(&uncompressed_len.to_le_bytes());

            final_data.extend_from_slice(&compressed_bytes);

            return Ok(final_data);
        }

        if let Some(payload_value) = &standard_json.raw_payload {
            if let Some(base64_str) = payload_value.as_str() {
                return STANDARD.decode(base64_str).map_err(|e| e.to_string());
            }
        }
        Err("No raw payload provided.".to_string())
    }
}
