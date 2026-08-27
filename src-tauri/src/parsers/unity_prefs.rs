use crate::models::ipc::{EngineType, StandardJson};
use crate::parsers::SaveEngineDecoder;
use serde_json::Value;
use std::path::Path;

#[cfg(target_os = "windows")]
use winreg::RegKey;
#[cfg(target_os = "windows")]
use winreg::enums::*;

pub struct UnityPrefsParser;

#[async_trait::async_trait]
impl SaveEngineDecoder for UnityPrefsParser {
    fn engine_type(&self) -> EngineType {
        EngineType::Unknown
    }

    async fn detect(&self, path: &Path, _raw_bytes: &[u8]) -> Result<bool, String> {
        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        if extension == "xml" || extension == "json" || extension == "prefs" {
            let content = String::from_utf8(_raw_bytes.to_vec()).unwrap_or_default();
            if content.contains("<PlayerPrefs") || content.contains("\"PlayerPrefs\"") {
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

        let json_str = String::from_utf8(data.to_vec()).map_err(|e| e.to_string())?;
        let val: Value =
            serde_json::from_str(&json_str).unwrap_or(serde_json::json!({ "raw": json_str }));

        Ok(StandardJson {
            engine_type: EngineType::Unknown,
            parsed_variables: val.clone(),
            raw_payload: Some(val),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        let json_str =
            serde_json::to_string(&standard_json.parsed_variables).map_err(|e| e.to_string())?;
        Ok(json_str.into_bytes())
    }
}

#[tauri::command]
pub async fn load_unity_registry_prefs(developer: String, game: String) -> Result<Value, String> {
    if developer.contains('\\') || developer.contains('/') || game.contains('\\') || game.contains('/') {
        return Err("Security Violation: Invalid characters in developer or game name".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let path = format!("Software\\{developer}\\{game}");
        let key = hkcu
            .open_subkey(&path)
            .map_err(|e| format!("Registry key not found: {}", e))?;

        let mut map = serde_json::Map::new();

        for val in key.enum_values().flatten() {
            let name = val.0;
            let value = val.1;
            let clean_name = name.split("_h").next().unwrap_or(&name).to_string();

            match value.vtype {
                REG_SZ => {
                    map.insert(clean_name, serde_json::Value::String(value.to_string()));
                }
                REG_DWORD => {
                    let num = u32::from_le_bytes(value.bytes[0..4].try_into().unwrap_or([0; 4]));
                    map.insert(clean_name, serde_json::json!(num));
                }
                REG_QWORD => {
                    let num = u64::from_le_bytes(value.bytes[0..8].try_into().unwrap_or([0; 8]));
                    map.insert(clean_name, serde_json::json!(num));
                }
                _ => {
                    map.insert(
                        clean_name,
                        serde_json::Value::String("[Unsupported]".to_string()),
                    );
                }
            }
        }
        return Ok(serde_json::Value::Object(map));
    }

    #[cfg(not(target_os = "windows"))]
    {

        Ok(serde_json::json!({
            "_notice": "Linux/Mac native registry parsing requires manual user.reg parsing.",
            "_help": format!("Look for [Software\\\\{}\\\\{}] in your Wine/Proton user.reg file.", developer, game)
        }))
    }
}

#[tauri::command]
pub async fn save_unity_registry_prefs(
    developer: String,
    game: String,
    #[allow(unused_variables)] prefs: Value,
) -> Result<String, String> {
    if developer.contains('\\') || developer.contains('/') || game.contains('\\') || game.contains('/') {
        return Err("Security Violation: Invalid characters in developer or game name".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let path = format!("Software\\{developer}\\{game}");
        let key = hkcu
            .open_subkey_with_flags(&path, KEY_WRITE | KEY_READ)
            .map_err(|e| format!("Registry key not found: {}", e))?;

        if let Some(map) = prefs.as_object() {
            for (k, v) in map {
                let mut original_name = k.clone();
                for val in key.enum_values().flatten() {
                    if val.0.starts_with(&format!("{}_h", k)) {
                        original_name = val.0;
                        break;
                    }
                }

                if v.is_string() {
                    let _ = key.set_value(&original_name, &v.as_str().unwrap());
                } else if v.is_number() {
                    if let Some(n) = v.as_u64() {
                        let _ = key.set_value(&original_name, &(n as u32));
                    }
                }
            }
        }
        return Ok("Saved to Windows Registry".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(
            "Registry saving on Linux/Mac Proton fallback is not fully implemented yet."
                .to_string(),
        )
    }
}
