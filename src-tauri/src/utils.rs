use std::fs;
use std::io;
use std::path::Path;
use zip::ZipArchive;

pub fn detect_engine_from_zip(zip_path: &Path) -> Result<String, String> {
    let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    let mut has_rpgsave = false;
    let mut has_rvdata2 = false;
    let mut has_renpy_save = false;
    let mut has_xp3 = false;
    let mut has_wolf = false;
    let mut has_tyrano = false;

    for i in 0..archive.len() {
        let file = match archive.by_index(i) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let name = file.name().to_lowercase();
        
        if name.ends_with(".rpgsave") { has_rpgsave = true; }
        if name.ends_with(".rvdata2") { has_rvdata2 = true; }
        if name.ends_with(".save") || name.ends_with(".rpyc") { has_renpy_save = true; }
        if name.ends_with(".xp3") || name.ends_with(".tjs") { has_xp3 = true; }
        if name.ends_with(".wolf") || name.contains("data.wolf") { has_wolf = true; }
        if name.contains("tyrano") { has_tyrano = true; }
    }
    
    if has_rpgsave { return Ok("RPG Maker MV/MZ".to_string()); }
    if has_rvdata2 { return Ok("RPG Maker VX Ace".to_string()); }
    if has_renpy_save { return Ok("Ren'Py".to_string()); }
    if has_xp3 { return Ok("KiriKiri".to_string()); }
    if has_wolf { return Ok("WOLF RPG Editor".to_string()); }
    if has_tyrano { return Ok("TyranoBuilder".to_string()); }
    
    Ok("Unknown".to_string())
}

pub fn check_zip_collisions(zip_path: &Path, dest_dir: &Path) -> Result<Vec<String>, String> {
    let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    let canonical_dest = dest_dir.canonicalize().unwrap_or_else(|_| dest_dir.to_path_buf());
    let mut collisions = Vec::new();

    for i in 0..archive.len() {
        let file = archive.by_index(i).map_err(|e| e.to_string())?;
        
        let safe_path = match file.enclosed_name() {
            Some(path) => path,
            None => continue,
        };

        if (*file.name()).ends_with('/') {
            continue;
        }

        let outpath = canonical_dest.join(&safe_path);
        if outpath.exists() {
            collisions.push(safe_path.to_string_lossy().into_owned());
        }
    }
    
    Ok(collisions)
}

pub fn secure_extract_zip(zip_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    let canonical_dest = dest_dir.canonicalize().unwrap_or_else(|_| dest_dir.to_path_buf());

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;

        let safe_path = match file.enclosed_name() {
            Some(path) => path,
            None => {
                println!("⚠️ [SECURITY WARNING] Dangerous path detected inside the zip. Skipping this file.");
                continue;
            }
        };

        // Defense in Depth: Block dangerous executable extensions from being extracted
        let ext = safe_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        let dangerous_exts = ["exe", "dll", "bat", "cmd", "sh", "vbs", "ps1", "elf", "msi", "scr", "appimage"];
        if dangerous_exts.contains(&ext.as_str()) {
            return Err(format!("Extraction Rejected: Dangerous executable file type detected inside ZIP ({})", safe_path.display()));
        }

        let outpath = canonical_dest.join(&safe_path);

        if (*file.name()).ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            
            // Zip Bomb Protection: Max size per file 50MB
            let max_extracted_size: u64 = 50 * 1024 * 1024; 
            if file.size() > max_extracted_size {
                return Err(format!("File {} is too large to extract (Potential Zip Bomb).", safe_path.display()));
            }
            
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}

use crate::parsers::profiles::ChecksumRule;
use crc::{Crc, CRC_16_IBM_3740};

pub fn apply_checksums(payload: &mut [u8], checksums: &[ChecksumRule]) -> Result<(), String> {
    for rule in checksums {
        if rule.range_start >= payload.len() || rule.range_end >= payload.len() {
            return Err(format!(
                "Checksum range out of bounds: {}..{} for payload length {}",
                rule.range_start, rule.range_end, payload.len()
            ));
        }
        
        if rule.range_start > rule.range_end {
            return Err(format!(
                "Invalid checksum range: start {} > end {}",
                rule.range_start, rule.range_end
            ));
        }

        let required_space = match rule.r#type.as_str() {
            "SUM-8" | "XOR-8" => 1,
            "CRC-16-LE" | "CRC-16-BE" | "CRC-16-CCITT-LE" | "CRC-16-CCITT-BE" => 2,
            _ => return Err(format!("Unknown checksum type: {}", rule.r#type)),
        };

        if rule.offset + required_space > payload.len() {
            return Err(format!(
                "Checksum write offset out of bounds: {} (needs {} bytes) for payload length {}",
                rule.offset, required_space, payload.len()
            ));
        }

        let data_slice = &payload[rule.range_start..=rule.range_end];
        
        match rule.r#type.as_str() {
            "SUM-8" => {
                let sum = data_slice.iter().fold(0u8, |acc, &x| acc.wrapping_add(x));
                payload[rule.offset] = sum;
            }
            "XOR-8" => {
                let xor_sum = data_slice.iter().fold(0u8, |acc, &x| acc ^ x);
                payload[rule.offset] = xor_sum;
            }
            "CRC-16-CCITT-LE" => {
                let crc_alg = Crc::<u16>::new(&CRC_16_IBM_3740);
                let sum = crc_alg.checksum(data_slice);
                let bytes = sum.to_le_bytes();
                payload[rule.offset] = bytes[0];
                payload[rule.offset + 1] = bytes[1];
            }
            "CRC-16-CCITT-BE" => {
                let crc_alg = Crc::<u16>::new(&CRC_16_IBM_3740);
                let sum = crc_alg.checksum(data_slice);
                let bytes = sum.to_be_bytes();
                payload[rule.offset] = bytes[0];
                payload[rule.offset + 1] = bytes[1];
            }
            "CRC-16-LE" => {
                let crc_alg = Crc::<u16>::new(&CRC_16_IBM_3740);
                let sum = crc_alg.checksum(data_slice);
                let bytes = sum.to_le_bytes();
                payload[rule.offset] = bytes[0];
                payload[rule.offset + 1] = bytes[1];
            }
            "CRC-16-BE" => {
                let crc_alg = Crc::<u16>::new(&CRC_16_IBM_3740);
                let sum = crc_alg.checksum(data_slice);
                let bytes = sum.to_be_bytes();
                payload[rule.offset] = bytes[0];
                payload[rule.offset + 1] = bytes[1];
            }
            _ => {
                return Err(format!("Unsupported checksum type: {}", rule.r#type));
            }
        }
    }
    
    Ok(())
}
