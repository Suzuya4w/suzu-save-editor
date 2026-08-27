use chrono::Local;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;
use tauri::Manager;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupMetadata {
    pub id: String,
    pub original_filename: String,
    pub original_path_or_uri: String,
    pub backup_filename: String,
    pub timestamp: String,
    pub size: u64,
    pub notes: Option<String>,
}

pub async fn get_backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup_dir = app_data_dir.join("backups");
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir).await.map_err(|e| e.to_string())?;
    }
    Ok(backup_dir)
}

pub async fn read_metadata_db(app: &tauri::AppHandle) -> Result<Vec<BackupMetadata>, String> {
    let backup_dir = get_backup_dir(app).await?;
    let mut entries = fs::read_dir(&backup_dir).await.map_err(|e| e.to_string())?;
    let mut backups = Vec::new();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(data) = fs::read_to_string(&path).await {
                if let Ok(metadata) = serde_json::from_str::<BackupMetadata>(&data) {
                    // Verify the actual .bak file exists before returning
                    let bak_path = backup_dir.join(&metadata.backup_filename);
                    if bak_path.exists() {
                        backups.push(metadata);
                    } else {
                        // Orphaned JSON (the .bak was deleted manually) - clean it up
                        let _ = fs::remove_file(path).await;
                    }
                }
            }
        }
    }
    
    Ok(backups)
}

pub async fn create_backup(target_path: &Path, notes: Option<String>, app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if !target_path.exists() {
        return Err(format!(
            "Target file does not exist: {}",
            target_path.display()
        ));
    }
    
    let raw_data = fs::read(target_path)
        .await
        .map_err(|e| format!("Failed to read target file for backup: {}", e))?;
        
    create_backup_from_bytes(target_path, &raw_data, notes, app).await
}

pub async fn create_backup_from_bytes(target_path: &Path, data: &[u8], notes: Option<String>, app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let display_timestamp = Local::now().format("%d %b %Y, %H:%M:%S").to_string();

    let file_stem = target_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("savefile");

    let extension = target_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let ext_part = if extension.is_empty() {
        "".to_string()
    } else {
        format!(".{}", extension)
    };

    let new_filename = format!("{}_{}{}.bak", file_stem, timestamp, ext_part);
    let backup_dir = get_backup_dir(app).await?;
    let backup_path = backup_dir.join(&new_filename);
    let meta_path = backup_dir.join(format!("{}.json", new_filename));

    match fs::write(&backup_path, data).await {
        Ok(_) => {
            let metadata = BackupMetadata {
                id: Uuid::new_v4().to_string(),
                original_filename: format!("{}{}", file_stem, ext_part),
                original_path_or_uri: target_path.to_string_lossy().into_owned(),
                backup_filename: new_filename,
                timestamp: display_timestamp,
                size: data.len() as u64,
                notes,
            };
            
            // Save sidecar metadata JSON
            if let Ok(meta_json) = serde_json::to_string_pretty(&metadata) {
                let _ = fs::write(&meta_path, meta_json).await;
            }
            
            Ok(backup_path)
        },
        Err(e) => Err(format!(
            "Failed to create backup: {}. Error: {}",
            backup_path.display(),
            e
        )),
    }
}

pub async fn delete_backup_by_id(id: &str, app: &tauri::AppHandle) -> Result<(), String> {
    let db = read_metadata_db(app).await?;
    if let Some(backup) = db.iter().find(|b| b.id == id) {
        let backup_dir = get_backup_dir(app).await?;
        let backup_path = backup_dir.join(&backup.backup_filename);
        let meta_path = backup_dir.join(format!("{}.json", backup.backup_filename));
        
        let _ = fs::remove_file(backup_path).await;
        let _ = fs::remove_file(meta_path).await;
        Ok(())
    } else {
        Err("Backup not found".to_string())
    }
}

pub async fn restore_backup_by_id(id: &str, app: &tauri::AppHandle) -> Result<(), String> {
    let db = read_metadata_db(app).await?;
    if let Some(backup) = db.iter().find(|b| b.id == id) {
        let backup_dir = get_backup_dir(app).await?;
        let backup_path = backup_dir.join(&backup.backup_filename);
        
        if !backup_path.exists() {
            return Err("Backup file is missing from disk".to_string());
        }

        let original_path = &backup.original_path_or_uri;

        if original_path.starts_with("content://") {
            #[cfg(target_os = "android")]
            {
                let bytes = fs::read(&backup_path).await.map_err(|e| e.to_string())?;
                crate::saf::write_content_uri_bytes(original_path.to_string(), bytes)?;
                return Ok(());
            }
        }
        
        fs::copy(&backup_path, original_path)
            .await
            .map(|_| ())
            .map_err(|e| format!("Failed to restore backup: {}", e))
    } else {
        Err("Backup metadata not found".to_string())
    }
}

pub async fn export_backup_by_id(id: &str, export_path: &str, app: &tauri::AppHandle) -> Result<(), String> {
    let db = read_metadata_db(app).await?;
    if let Some(backup) = db.iter().find(|b| b.id == id) {
        let backup_dir = get_backup_dir(app).await?;
        let backup_path = backup_dir.join(&backup.backup_filename);
        
        if !backup_path.exists() {
            return Err("Backup file is missing from disk".to_string());
        }

        if export_path.starts_with("content://") {
            #[cfg(target_os = "android")]
            {
                let bytes = fs::read(&backup_path).await.map_err(|e| e.to_string())?;
                crate::saf::write_content_uri_bytes(export_path.to_string(), bytes)?;
                return Ok(());
            }
        }
        
        fs::copy(&backup_path, export_path)
            .await
            .map(|_| ())
            .map_err(|e| format!("Failed to export backup: {}", e))
    } else {
        Err("Backup metadata not found".to_string())
    }
}
