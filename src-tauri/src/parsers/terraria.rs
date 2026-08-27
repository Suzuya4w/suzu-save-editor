use crate::models::ipc::{EngineType, StandardJson};
use std::path::Path;
use std::io::{Cursor, Read};
use byteorder::{LittleEndian, ReadBytesExt};
use aes::Aes128;
use cbc::{Decryptor, Encryptor};
use cipher::{KeyIvInit, block_padding::Pkcs7, BlockDecryptMut};
use serde_json::json;

type Aes128CbcDec = Decryptor<Aes128>;
#[allow(dead_code)]
type Aes128CbcEnc = Encryptor<Aes128>;

// Terraria AES key is "h3y_gUyZ" but cast as a Unicode byte array (UTF-16LE).
// Length matches the required 16 bytes for AES-128.
const ENCRYPTION_KEY: &[u8; 16] = b"h\03\0y\0_\0g\0U\0y\0Z\0";

pub struct TerrariaParser;

#[async_trait::async_trait]
impl crate::parsers::SaveEngineDecoder for TerrariaParser {
    fn engine_type(&self) -> EngineType {
        EngineType::Terraria
    }

    async fn detect(&self, path: &Path, _raw_bytes: &[u8]) -> Result<bool, String> {
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
        Ok(ext == "plr")
    }

    async fn decode(&self, _path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String> {
        // Pass directly to parse_to_standard_json so we can preserve IV/metadata in raw_payload
        Ok(raw_data.to_vec())
    }

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String> {
        let mut cursor = Cursor::new(data);
        
        // 1. Membaca Unencrypted Header (24 Bytes)
        let version = cursor.read_i32::<LittleEndian>().unwrap_or(0);
        let mut magic = [0u8; 7];
        let _ = cursor.read_exact(&mut magic);
        let file_type = cursor.read_u8().unwrap_or(0);
        let revision = cursor.read_u32::<LittleEndian>().unwrap_or(0);
        let is_favorite = cursor.read_u64::<LittleEndian>().unwrap_or(0);

        let header_len = 24;
        let mut is_encrypted = false;
        let mut decrypted_data = Vec::new();

        // 2. Dekripsi Payload (Mulai dari offset 24)
        if data.len() > header_len {
            let encrypted_payload = &data[header_len..];
            let mut clone_data = encrypted_payload.to_vec();
            let iv = [0u8; 16]; // Di Terraria, CBC biasanya diinisialisasi dengan IV kosong atau static
            
            if let Ok(dec) = Aes128CbcDec::new(ENCRYPTION_KEY.into(), &iv.into())
                .decrypt_padded_mut::<Pkcs7>(&mut clone_data) 
            {
                decrypted_data = dec.to_vec();
                is_encrypted = true;
            }
        }
        
        // Jika dekripsi gagal, kita asumsikan file unencrypted (pre 1.3)
        let payload_to_parse = if is_encrypted { &decrypted_data } else { &data[header_len..] };
        let mut payload_cursor = Cursor::new(payload_to_parse);
        
        // Helper function untuk membaca length-prefixed string (LEB128)
        let read_net_string = |c: &mut Cursor<&[u8]>| -> String {
            let mut length: usize = 0;
            let mut shift: usize = 0;
            while let Ok(b) = c.read_u8() {
                length |= ((b & 0x7F) as usize) << shift;
                if (b & 0x80) == 0 { break; }
                shift += 7;
            }
            let mut buf = vec![0u8; length];
            if c.read_exact(&mut buf).is_ok() {
                String::from_utf8_lossy(&buf).to_string()
            } else {
                "Unknown".to_string()
            }
        };

        let read_rgb = |c: &mut Cursor<&[u8]>| -> serde_json::Value {
            let r = c.read_u8().unwrap_or(0);
            let g = c.read_u8().unwrap_or(0);
            let b = c.read_u8().unwrap_or(0);
            json!({"r": r, "g": g, "b": b})
        };

        // 3. Membaca Offset Dasar (Berdasarkan urutan Terraria 1.4.5+)
        let player_name = read_net_string(&mut payload_cursor);
        let difficulty = payload_cursor.read_u8().unwrap_or(0);
        let play_time = payload_cursor.read_i64::<LittleEndian>().unwrap_or(0);
        let hair = payload_cursor.read_i32::<LittleEndian>().unwrap_or(0);
        let hair_dye = payload_cursor.read_u8().unwrap_or(0);
        
        // Visual flags (HideVisuals 1-4 + HideMisc) - 5 bytes total
        let mut hide_flags = [0u8; 5];
        let _ = payload_cursor.read_exact(&mut hide_flags);
        
        let skin_variant = payload_cursor.read_u8().unwrap_or(0);
        
        // HP & Mana
        let stat_life = payload_cursor.read_i32::<LittleEndian>().unwrap_or(0);
        let stat_life_max = payload_cursor.read_i32::<LittleEndian>().unwrap_or(0);
        let stat_mana = payload_cursor.read_i32::<LittleEndian>().unwrap_or(0);
        let stat_mana_max = payload_cursor.read_i32::<LittleEndian>().unwrap_or(0);
        
        // Extra flags (ExtraAccessory, DD2, TaxMoney) - 6 bytes total
        let mut extra_flags = [0u8; 6];
        let _ = payload_cursor.read_exact(&mut extra_flags);
        
        // Player Colors
        let hair_color = read_rgb(&mut payload_cursor);
        let skin_color = read_rgb(&mut payload_cursor);
        let eye_color = read_rgb(&mut payload_cursor);
        let shirt_color = read_rgb(&mut payload_cursor);
        let under_shirt_color = read_rgb(&mut payload_cursor);
        let pants_color = read_rgb(&mut payload_cursor);
        let shoe_color = read_rgb(&mut payload_cursor);

        let parsed = json!({
            "header": {
                "version": version,
                "magic": String::from_utf8_lossy(&magic).to_string(),
                "file_type": file_type,
                "revision": revision,
                "is_favorite": is_favorite
            },
            "player": {
                "name": player_name,
                "difficulty": difficulty,
                "play_time": play_time,
                "hair": hair,
                "hair_dye": hair_dye,
                "skin_variant": skin_variant,
                "stats": {
                    "health": stat_life,
                    "max_health": stat_life_max,
                    "mana": stat_mana,
                    "max_mana": stat_mana_max,
                },
                "colors": {
                    "hair": hair_color,
                    "skin": skin_color,
                    "eye": eye_color,
                    "shirt": shirt_color,
                    "under_shirt": under_shirt_color,
                    "pants": pants_color,
                    "shoe": shoe_color,
                }
            }
        });

        use base64::{Engine as _, engine::general_purpose::STANDARD};
        Ok(StandardJson {
            engine_type: EngineType::Terraria,
            parsed_variables: parsed,
            raw_payload: Some(json!({
                "is_encrypted": is_encrypted,
                "original_bytes": STANDARD.encode(data)
            })),
        })
    }

    async fn encode(
        &self,
        standard_json: &StandardJson,
        _original_file_path: &Path,
        _profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String> {
        // For the skeleton, simply return the original binary payload to avoid data corruption.
        // Once write support is implemented, you would re-encrypt with Aes128CbcEnc.
        
        if let Some(payload) = &standard_json.raw_payload {
            if let Some(b64) = payload.get("original_bytes").and_then(|v| v.as_str()) {
                use base64::{Engine as _, engine::general_purpose::STANDARD};
                let original = STANDARD.decode(b64).map_err(|e| e.to_string())?;
                return Ok(original);
            }
        }
        
        Err("Terraria save encoding is currently read-only in this skeleton.".to_string())
    }
}
