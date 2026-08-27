use serde::{Deserialize, Serialize};
use tokio::fs;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct GithubContent {
    pub name: String,
    pub download_url: Option<String>,
    pub r#type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileRule {
    pub r#type: String,
    pub value: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keys: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prefixes: Option<Vec<String>>,
    pub offset: Option<usize>,
    pub size: Option<usize>,
    pub value_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecksumRule {
    pub r#type: String,
    pub offset: usize,
    pub range_start: usize,
    pub range_end: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GameProfile {
    pub id: String,
    pub title: String,
    pub developer: String,
    pub engine: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checksums: Option<Vec<ChecksumRule>>,
    pub rules: Vec<ProfileRule>,
}

#[tauri::command]
pub async fn save_local_profile(app: AppHandle, profile: GameProfile) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let profiles_dir = app_dir.join("profiles");

    if !profiles_dir.exists() {
        fs::create_dir_all(&profiles_dir).await.map_err(|e| e.to_string())?;
    }

    let safe_id = std::path::Path::new(&profile.id).file_name().unwrap_or_default().to_string_lossy();
    if safe_id.is_empty() { return Err("Invalid profile ID".to_string()); }
    let file_path = profiles_dir.join(format!("{}.json", safe_id));
    let json_str = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;

    fs::write(&file_path, json_str).await.map_err(|e| e.to_string())?;

    Ok(format!("Profile {} saved successfully", profile.title))
}

#[tauri::command]
pub async fn delete_local_profile(app: AppHandle, id: String) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let profiles_dir = app_dir.join("profiles");
    
    let safe_id = std::path::Path::new(&id).file_name().unwrap_or_default().to_string_lossy();
    if safe_id.is_empty() { return Err("Invalid profile ID".to_string()); }
    let file_path = profiles_dir.join(format!("{}.json", safe_id));
    if file_path.exists() {
        fs::remove_file(&file_path).await.map_err(|e| e.to_string())?;
        Ok(format!("Profile deleted successfully"))
    } else {
        Err("Profile not found".to_string())
    }
}

#[tauri::command]
pub async fn sync_profiles_from_github(app: AppHandle) -> Result<usize, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let profiles_dir = app_dir.join("profiles");

    if !profiles_dir.exists() {
        fs::create_dir_all(&profiles_dir).await.map_err(|e| e.to_string())?;
    }

    let client = reqwest::Client::builder()
        .user_agent("suzu-save-editor")
        .build()
        .map_err(|e| e.to_string())?;

    let repo_url =
        "https://api.github.com/repos/Suzuya4w/suzu-save-editor-profiles/contents/profiles";

    let resp = client
        .get(repo_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch profile list: {}", resp.status()));
    }

    let contents: Vec<GithubContent> = resp.json().await.map_err(|e| e.to_string())?;
    let mut updated_count = 0;

    for item in contents {
        if item.r#type == "file" && item.name.ends_with(".json") {
            let safe_file_name = std::path::Path::new(&item.name)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
                
            if safe_file_name.is_empty() { continue; }

            if let Some(url) = item.download_url {
                let file_resp = client.get(url).send().await.map_err(|e| e.to_string())?;
                let body = file_resp.bytes().await.map_err(|e| e.to_string())?;

                if serde_json::from_slice::<GameProfile>(&body).is_ok() {
                    let target_path = profiles_dir.join(safe_file_name);

                    fs::write(target_path, body).await.map_err(|e| e.to_string())?;
                    updated_count += 1;
                } else {
                    println!(
                        "Warning: Skipping malformed or malicious profile -> {}",
                        item.name
                    );
                }
            }
        }
    }

    Ok(updated_count)
}

#[tauri::command]
pub async fn load_local_profiles(app: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let profiles_dir = app_dir.join("profiles");

    if !profiles_dir.exists() {
        return Ok(vec![]);
    }

    let mut profiles = vec![];
    let mut entries = fs::read_dir(profiles_dir).await.map_err(|e| e.to_string())?;

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(path).await.map_err(|e| e.to_string())?;
            if let Ok(profile) = serde_json::from_str::<GameProfile>(&content) {
                if let Ok(json) = serde_json::to_value(profile) {
                    profiles.push(json);
                }
            }
        }
    }

    Ok(profiles)
}
