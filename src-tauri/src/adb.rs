use std::process::Command;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AdbFileMeta {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub date: String,
}

pub fn get_adb_path(custom_path: Option<String>) -> Result<String, String> {
    if let Some(path) = custom_path {
        if !path.trim().is_empty() {
            let p = std::path::Path::new(&path);
            if let Some(file_name) = p.file_name() {
                let name = file_name.to_string_lossy().to_lowercase();
                if name == "adb" || name == "adb.exe" {
                    return Ok(path);
                }
            }
            return Err("Invalid ADB executable path. Must be 'adb' or 'adb.exe'".to_string());
        }
    }
    Ok("adb".to_string())
}

pub fn get_adb_path_and_track(
    custom_path: Option<String>,
    state: &tauri::State<'_, crate::AdbState>,
) -> Result<String, String> {
    let p = get_adb_path(custom_path)?;
    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(p.clone());
    }
    Ok(p)
}

pub fn create_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AdbDevice {
    pub id: String,
    pub model: String,
}

#[tauri::command]
pub async fn adb_list_devices(adb_path: Option<String>, state: tauri::State<'_, crate::AdbState>) -> Result<Vec<AdbDevice>, String> {
    let program = get_adb_path_and_track(adb_path, &state)?;
    let output = create_command(&program)
        .arg("devices")
        .output()
        .map_err(|e| format!("Failed to execute ADB: {}. Make sure ADB is installed and the path is correct in Settings.", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut adb_devices = Vec::new();

    for line in stdout.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() == 2 && parts[1] == "device" {
            let id = parts[0].to_string();
            
            // Try to get the model name
            let model = if let Ok(prop_out) = create_command(&program).args(["-s", &id, "shell", "getprop", "ro.product.model"]).output() {
                if prop_out.status.success() {
                    let m = String::from_utf8_lossy(&prop_out.stdout).trim().to_string();
                    if m.is_empty() { id.clone() } else { m }
                } else {
                    id.clone()
                }
            } else {
                id.clone()
            };
            
            adb_devices.push(AdbDevice { id, model });
        }
    }

    Ok(adb_devices)
}

#[tauri::command]
pub async fn adb_list_files(adb_path: Option<String>, device_id: String, path: String, state: tauri::State<'_, crate::AdbState>) -> Result<Vec<AdbFileMeta>, String> {
    let program = get_adb_path_and_track(adb_path, &state)?;
    // Escape single quotes by closing, escaping, and reopening: ' -> '\''
    let safe_path = path.replace('\'', "'\\''");
    let shell_path_arg = format!("'{}'", safe_path);
    
    let output = create_command(&program)
        .args(["-s", &device_id, "shell", "ls", "-la", &shell_path_arg])
        .output()
        .map_err(|e| format!("Failed to execute ADB: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
        // If directory doesn't exist or permission denied
        return Err(err_msg);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut files = Vec::new();

    for line in stdout.lines() {
        if line.starts_with("total") {
            continue;
        }
        
        // Example output:
        // drwxrwx--x 2 u0_a150 sdcard_rw 4096 2023-10-25 12:00 saves
        // -rw-rw---- 1 u0_a150 sdcard_rw 5231 2023-10-25 12:00 my_save.xml
        
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 6 {
            let is_dir = parts[0].starts_with('d');
            
            // Find the time column (usually contains ':')
            let mut name_start_idx = 7.min(parts.len() - 1);
            for i in 4..parts.len() {
                if parts[i].contains(':') {
                    name_start_idx = i + 1;
                    break;
                }
            }
            
            if name_start_idx > parts.len() {
                continue;
            }
            
            let time_str = parts[name_start_idx - 1];
            let date_str = parts[name_start_idx - 2];
            let date = format!("{} {}", date_str, time_str);
            
            // Find exact string in the original line to preserve spaces
            let time_idx = line.find(time_str).unwrap_or(0);
            let mut name = line[time_idx + time_str.len()..].trim_start().to_string();
            
            // Handle symlinks (e.g. "my_link -> /target")
            if let Some(arrow_idx) = name.find(" -> ") {
                name = name[..arrow_idx].to_string();
            }
            
            if name == "." || name == ".." || name.is_empty() {
                continue;
            }
            
            // Try to parse size (usually the column before date)
            let size_str = parts[name_start_idx - 3];
            let size = size_str.parse::<u64>().unwrap_or(0);

            files.push(AdbFileMeta {
                name,
                is_dir,
                size,
                date,
            });
        }
    }

    // Sort: Directories first, then alphabetically
    files.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(files)
}

#[tauri::command]
pub async fn adb_pull_file(adb_path: Option<String>, device_id: String, remote_path: String, state: tauri::State<'_, crate::AdbState>) -> Result<String, String> {
    let program = get_adb_path_and_track(adb_path, &state)?;
    let file_name = PathBuf::from(&remote_path).file_name().unwrap_or_default().to_string_lossy().into_owned();
    let temp_dir = std::env::temp_dir();
    let local_path = temp_dir.join(format!("suzu_adb_{}", file_name));

    let output = create_command(&program)
        .args(["-s", &device_id, "pull", &remote_path, &local_path.to_string_lossy()])
        .output()
        .map_err(|e| format!("Failed to execute ADB pull: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(local_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn adb_push_file(adb_path: Option<String>, device_id: String, local_path: String, remote_path: String, state: tauri::State<'_, crate::AdbState>) -> Result<String, String> {
    let program = get_adb_path_and_track(adb_path, &state)?;
    let output = create_command(&program)
        .args(["-s", &device_id, "push", &local_path, &remote_path])
        .output()
        .map_err(|e| format!("Failed to execute ADB push: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok("Success".to_string())
}

#[tauri::command]
pub async fn adb_backup_file(adb_path: Option<String>, device_id: String, remote_path: String, state: tauri::State<'_, crate::AdbState>) -> Result<String, String> {
    let program = get_adb_path_and_track(adb_path, &state)?;
    
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    
    let (dir, filename) = match remote_path.rfind('/') {
        Some(idx) => (&remote_path[..idx+1], &remote_path[idx+1..]),
        None => ("", remote_path.as_str()),
    };
    
    let backup_name = format!("{}_{}.bak", filename, timestamp);
    let backup_path = format!("{}{}", dir, backup_name);

    let safe_remote = remote_path.replace('\'', "'\\''");
    let safe_backup = backup_path.replace('\'', "'\\''");
    
    let shell_arg = format!("cp '{}' '{}'", safe_remote, safe_backup);
    let output = create_command(&program)
        .args(["-s", &device_id, "shell", &shell_arg])
        .output()
        .map_err(|e| format!("Failed to execute ADB backup: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok("Success".to_string())
}
