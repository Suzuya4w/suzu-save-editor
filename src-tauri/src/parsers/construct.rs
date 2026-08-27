use crate::models::ipc::StandardJson;
use crate::parsers::SaveEngineDecoder;
use async_trait::async_trait;
use std::io::{Read, Write};
use std::path::Path;
use tokio::fs;
use tokio::io::AsyncReadExt;

pub struct ConstructParser;

#[async_trait]
impl SaveEngineDecoder for ConstructParser {
    fn engine_type(&self) -> crate::models::ipc::EngineType {
        crate::models::ipc::EngineType::Construct
    }

    async fn detect(&self, path: &Path, _raw_bytes: &[u8]) -> Result<bool, String> {
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
        
        if ext == "c3save" {
            return Ok(true);
        }

        let mut bytes = vec![0; 4];
        if let Ok(mut file) = tokio::fs::File::open(path).await {
            if file.read_exact(&mut bytes).await.is_ok() && bytes == [0x50, 0x4B, 0x03, 0x04] {
                return Ok(true);
            }
        }

        if ext == "json" || ext == "txt" {
            if let Ok(content) = fs::read_to_string(path).await {
                if content.trim_start().starts_with('{') || content.trim_start().starts_with('[') {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        // ZIP magic number
        if raw_data.len() >= 4 && raw_data[0..4] == [0x50, 0x4B, 0x03, 0x04] {
            let cursor = std::io::Cursor::new(raw_data.to_vec());
            let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;
            
            let mut target_index = 0; // Fallback to 0 if no match found
            
            for i in 0..archive.len() {
                if let Ok(file) = archive.by_index(i) {
                    let name = file.name().to_lowercase();
                    if name.ends_with(".json") || name.contains("c2dictionary") {
                        target_index = i;
                        break;
                    }
                }
            }

            let mut file = archive.by_index(target_index).map_err(|e| format!("Gagal membaca file di dalam ZIP: {}", e))?;
            let mut extracted = Vec::new();
            file.read_to_end(&mut extracted).map_err(|e| e.to_string())?;
            return Ok(extracted);
        }

        Ok(raw_data.to_vec()) // Raw JSON
    }

    async fn parse_to_standard_json(
        &self,
        raw_data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let json_str = String::from_utf8_lossy(raw_data);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;

        Ok(StandardJson {
            engine_type: crate::models::ipc::EngineType::Construct,
            parsed_variables: parsed,
            raw_payload: None,
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        let json_bytes = serde_json::to_vec(&standard_json.parsed_variables).map_err(|e| e.to_string())?;

        let mut header = vec![0; 4];
        let is_zip = if let Ok(mut file) = tokio::fs::File::open(original_file_path).await {
            file.read_exact(&mut header).await.is_ok() && header == [0x50, 0x4B, 0x03, 0x04]
        } else {
            false
        };

        if is_zip {
            let original_bytes = fs::read(original_file_path).await.map_err(|e| e.to_string())?;
            let cursor = std::io::Cursor::new(original_bytes);
            let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;
            
            let mut file_name = "data.json".to_string(); // Fallback
            for i in 0..archive.len() {
                if let Ok(file) = archive.by_index(i) {
                    let name = file.name().to_lowercase();
                    if name.ends_with(".json") || name.contains("c2dictionary") {
                        file_name = file.name().to_string();
                        break;
                    }
                }
            }

            let mut out_cursor = std::io::Cursor::new(Vec::new());
            {
                let mut zip = zip::ZipWriter::new(&mut out_cursor);
                
                // Use SimpleFileOptions to avoid type inference issues in newer zip versions
                let options = zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Deflated);
                
                zip.start_file(file_name, options).map_err(|e| e.to_string())?;
                zip.write_all(&json_bytes).map_err(|e| e.to_string())?;
                zip.finish().map_err(|e| e.to_string())?;
            }
            Ok(out_cursor.into_inner())
        } else {
            Ok(json_bytes)
        }
    }
}
