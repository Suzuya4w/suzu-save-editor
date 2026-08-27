use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct DiffResult {
    pub offset: usize,
    pub original_byte: u8,
    pub modified_byte: u8,
}

#[tauri::command]
pub async fn compare_files(path_a: String, path_b: String) -> Result<Vec<DiffResult>, String> {
    let p_a = Path::new(&path_a);
    let p_b = Path::new(&path_b);

    let meta_a =
        fs::metadata(&p_a).map_err(|e| format!("Failed to read metadata for file A: {}", e))?;
    let meta_b =
        fs::metadata(&p_b).map_err(|e| format!("Failed to read metadata for file B: {}", e))?;

    if meta_a.len() > 52_428_800 || meta_b.len() > 52_428_800 {
        return Err(
            "File too large. Maximum supported file size for Diff Tool is 50 MB.".to_string(),
        );
    }

    let bytes_a = fs::read(&path_a).map_err(|e| format!("Failed to read file A: {}", e))?;
    let bytes_b = fs::read(&path_b).map_err(|e| format!("Failed to read file B: {}", e))?;

    let magic_a = if bytes_a.len() > 16 {
        &bytes_a[0..16]
    } else {
        &bytes_a[..]
    };
    let magic_b = if bytes_b.len() > 16 {
        &bytes_b[0..16]
    } else {
        &bytes_b[..]
    };

    let engine_a = crate::detect_engine_type(p_a, magic_a, None).await;
    let engine_b = crate::detect_engine_type(p_b, magic_b, None).await;

    if engine_a != engine_b {
        return Err(format!(
            "Engine mismatch. File A is detected as {:?}, but File B is detected as {:?}.",
            engine_a, engine_b
        ));
    }

    let size_diff = (bytes_a.len() as isize - bytes_b.len() as isize).abs();

    let max_diff = match engine_a {
        crate::models::ipc::EngineType::RenPy
        | crate::models::ipc::EngineType::Kirikiri
        | crate::models::ipc::EngineType::Naninovel => 512,
        _ => 51200,
    };

    if size_diff > max_diff {
        return Err(format!(
            "Size mismatch. The files differ by {} bytes. For {:?} engine, Diff Tool limits difference to {} bytes to prevent false positives.",
            size_diff, engine_a, max_diff
        ));
    }

    let mut diffs = Vec::new();
    let max_len = std::cmp::max(bytes_a.len(), bytes_b.len());

    for i in 0..max_len {
        let byte_a = bytes_a.get(i).cloned().unwrap_or(0);
        let byte_b = bytes_b.get(i).cloned().unwrap_or(0);

        if byte_a != byte_b {
            diffs.push(DiffResult {
                offset: i,
                original_byte: byte_a,
                modified_byte: byte_b,
            });
        }

        if diffs.len() > 10000 {
            break;
        }
    }

    Ok(diffs)
}
