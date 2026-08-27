use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
use winreg::RegKey;
#[cfg(target_os = "windows")]
use winreg::enums::*;

#[derive(Debug, Serialize, Deserialize)]
pub struct DetectedGame {
    pub name: String,
    pub path: String,
    pub save_path: Option<String>,
}

#[cfg(target_os = "windows")]
fn get_steam_path() -> Option<String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam") {
        if let Ok(val) = key.get_value("InstallPath") {
            return Some(val);
        }
    }
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey("Software\\Valve\\Steam") {
        if let Ok(val) = key.get_value("SteamPath") {
            return Some(val);
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn get_steam_path() -> Option<String> {
    if let Ok(home) = std::env::var("HOME") {
        let steam_path = PathBuf::from(home).join("Library/Application Support/Steam");
        if steam_path.exists() {
            return Some(steam_path.to_string_lossy().to_string());
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn get_steam_path() -> Option<String> {
    if let Ok(home) = std::env::var("HOME") {
        let path1 = PathBuf::from(&home).join(".steam/steam");
        if path1.exists() {
            return Some(path1.to_string_lossy().to_string());
        }
        let path2 = PathBuf::from(&home).join(".local/share/Steam");
        if path2.exists() {
            return Some(path2.to_string_lossy().to_string());
        }
    }
    None
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn get_steam_path() -> Option<String> {
    None
}

#[tauri::command]
pub async fn detect_installed_games() -> Result<Vec<DetectedGame>, String> {
    let mut games = Vec::new();

    let steam_path_str = match get_steam_path() {
        Some(path) => path,
        None => return Ok(games),
    };

    let steam_path = Path::new(&steam_path_str);
    let library_vdf = steam_path.join("steamapps/libraryfolders.vdf");

    let mut library_paths = Vec::new();
    library_paths.push(steam_path.to_path_buf());

    if library_vdf.exists() {
        if let Ok(content) = fs::read_to_string(&library_vdf) {
            let re_path = Regex::new(r#""path"\s+"([^"]+)""#).unwrap();
            for cap in re_path.captures_iter(&content) {
                #[allow(unused_mut)]
                let mut path_str = cap[1].to_string();
                #[cfg(target_os = "windows")]
                {
                    path_str = path_str.replace("\\\\", "\\");
                }
                library_paths.push(PathBuf::from(path_str));
            }
        }
    }

    let mut seen_paths = HashSet::new();

    for lib_path in library_paths {
        let common_path = lib_path.join("steamapps/common");

        if common_path.exists() {
            let entries = match fs::read_dir(&common_path) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for entry in entries {
                let entry = match entry {
                    Ok(e) => e,
                    Err(_) => continue,
                };
                if entry.path().is_dir() {
                    let game_name = entry.file_name().to_string_lossy().to_string();
                    #[allow(unused_mut)]
                    let mut normalized_path = entry.path().to_string_lossy().to_string();
                    
                    #[cfg(target_os = "windows")]
                    {
                        normalized_path = normalized_path.replace("\\\\", "\\").replace("/", "\\");
                    }

                    if !seen_paths.contains(&normalized_path) {
                        seen_paths.insert(normalized_path.clone());
                        games.push(DetectedGame {
                            name: game_name,
                            path: normalized_path,
                            save_path: None,
                        });
                    }
                }
            }
        }
    }

    Ok(games)
}
