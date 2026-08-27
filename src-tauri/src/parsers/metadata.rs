use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tokio::fs;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameMetadata {
    pub title: String,
    pub alttitle: Option<String>,
    pub image_url: Option<String>,
    pub description: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct VndbKanaRequest {
    filters: Vec<serde_json::Value>,
    fields: String,
    sort: String,
}

#[derive(Deserialize)]
struct VndbKanaImage {
    url: String,
}

#[derive(Deserialize)]
struct VndbDeveloper {
    name: Option<String>,
}

#[derive(Deserialize)]
struct VndbKanaResult {
    // id: String,
    title: Option<String>,
    alttitle: Option<String>,
    image: Option<VndbKanaImage>,
    description: Option<String>,
    developers: Option<Vec<VndbDeveloper>>,
}

#[derive(Deserialize)]
struct VndbKanaResponse {
    results: Vec<VndbKanaResult>,
}

#[derive(Deserialize)]
struct JikanImage {
    large_image_url: Option<String>,
}

#[derive(Deserialize)]
struct JikanImages {
    webp: Option<JikanImage>,
}

#[derive(Deserialize)]
struct JikanStudio {
    name: Option<String>,
}

#[derive(Deserialize)]
struct JikanResult {
    title: Option<String>,
    title_english: Option<String>,
    images: Option<JikanImages>,
    synopsis: Option<String>,
    studios: Option<Vec<JikanStudio>>,
}

#[derive(Deserialize)]
struct JikanResponse {
    data: Vec<JikanResult>,
}

#[derive(Deserialize)]
struct SteamSearchItem {
    id: u32,
}

#[derive(Deserialize)]
struct SteamSearchResponse {
    items: Option<Vec<SteamSearchItem>>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct SteamAppDetailsData {
    name: Option<String>,
    short_description: Option<String>,
    header_image: Option<String>,
    developers: Option<Vec<String>>,
    publishers: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct SteamAppDetailsResult {
    success: bool,
    data: Option<SteamAppDetailsData>,
}

const CACHE_FILE_NAME: &str = "metadata_cache.json";

fn get_cache_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to get app local data dir: {}", e))?;
    Ok(app_dir.join(CACHE_FILE_NAME))
}

async fn read_from_cache(app_handle: &AppHandle, query: &str) -> Option<GameMetadata> {
    let cache_path = get_cache_path(app_handle).ok()?;
    if cache_path.exists() {
        if let Ok(content) = fs::read_to_string(&cache_path).await {
            if let Ok(cache) = serde_json::from_str::<HashMap<String, GameMetadata>>(&content) {
                return cache.get(query).cloned();
            }
        }
    }
    None
}

async fn write_to_cache(app_handle: &AppHandle, query: &str, metadata: &GameMetadata) {
    if let Ok(cache_path) = get_cache_path(app_handle) {
        if let Some(parent) = cache_path.parent() {
            let _ = fs::create_dir_all(parent).await;
        }

        let mut cache: HashMap<String, GameMetadata> = HashMap::new();
        if cache_path.exists() {
            if let Ok(content) = fs::read_to_string(&cache_path).await {
                if let Ok(existing_cache) =
                    serde_json::from_str::<HashMap<String, GameMetadata>>(&content)
                {
                    cache = existing_cache;
                }
            }
        }

        cache.insert(query.to_string(), metadata.clone());

        if let Ok(new_content) = serde_json::to_string_pretty(&cache) {
            let _ = fs::write(&cache_path, new_content).await;
        }
    }
}

async fn fetch_vndb_api(
    client: &reqwest::Client,
    query: &str,
) -> Result<Option<GameMetadata>, String> {
    let request_body = VndbKanaRequest {
        filters: vec![
            serde_json::json!("search"),
            serde_json::json!("="),
            serde_json::json!(query),
        ],
        fields: "title, alttitle, image.url, description, developers.name".to_string(),
        sort: "searchrank".to_string(),
    };

    let response = client
        .post("https://api.vndb.org/kana/vn")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let vndb_response: VndbKanaResponse = response.json().await.map_err(|e| e.to_string())?;

        if let Some(first_result) = vndb_response.results.into_iter().next() {
            if let Some(title) = first_result.title {
                let developer = first_result.developers.and_then(|devs| devs.into_iter().filter_map(|d| d.name).next());
                return Ok(Some(GameMetadata {
                    title,
                    alttitle: first_result.alttitle,
                    image_url: first_result.image.map(|img| img.url),
                    description: first_result.description,
                    developer,
                    publisher: None,
                }));
            }
        }
    }

    Ok(None)
}

async fn fetch_jikan_api(
    client: &reqwest::Client,
    query: &str,
) -> Result<Option<GameMetadata>, String> {
    let url = format!(
        "https://api.jikan.moe/v4/anime?q={}&limit=1",
        urlencoding::encode(query)
    );

    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let jikan_res: JikanResponse = response.json().await.map_err(|e| e.to_string())?;

        if let Some(first) = jikan_res.data.into_iter().next() {
            if let Some(title) = first.title {
                let image_url = first
                    .images
                    .and_then(|imgs| imgs.webp)
                    .and_then(|webp| webp.large_image_url);

                let developer = first.studios.and_then(|studios| studios.into_iter().filter_map(|s| s.name).next());

                return Ok(Some(GameMetadata {
                    title,
                    alttitle: first.title_english,
                    image_url,
                    description: first.synopsis,
                    developer,
                    publisher: None,
                }));
            }
        }
    }

    Ok(None)
}

async fn fetch_steam_api(
    client: &reqwest::Client,
    query: &str,
) -> Result<Option<GameMetadata>, String> {
    let search_url = format!(
        "https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=US",
        urlencoding::encode(query)
    );

    let search_res = client.get(&search_url).send().await.map_err(|e| e.to_string())?;
    
    if !search_res.status().is_success() {
        return Ok(None);
    }

    let search_data: SteamSearchResponse = search_res.json().await.map_err(|e| e.to_string())?;
    
    if let Some(items) = search_data.items {
        if let Some(first_item) = items.into_iter().next() {
            let app_id = first_item.id;
            
            let details_url = format!("https://store.steampowered.com/api/appdetails?appids={}", app_id);
            let details_res = client.get(&details_url).send().await.map_err(|e| e.to_string())?;
            
            if details_res.status().is_success() {
                let details_json: std::collections::HashMap<String, SteamAppDetailsResult> = 
                    details_res.json().await.map_err(|e| e.to_string())?;
                
                if let Some(app) = details_json.get(&app_id.to_string()) {
                    if app.success {
                        if let Some(data) = &app.data {
                            if let Some(title) = &data.name {
                                let image_url = Some(format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{}/library_600x900.jpg", app_id));
                                
                                let developer = data.developers.as_ref().and_then(|devs| devs.first().cloned());
                                let publisher = data.publishers.as_ref().and_then(|pubs| pubs.first().cloned());
                                
                                return Ok(Some(GameMetadata {
                                    title: title.clone(),
                                    alttitle: None,
                                    image_url,
                                    description: data.short_description.clone(),
                                    developer,
                                    publisher,
                                }));
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(None)
}

async fn fetch_metadata_waterfall(query: &str) -> Result<Option<GameMetadata>, String> {
    let client = reqwest::Client::new();

    // Stage 1: Steam API
    if let Ok(Some(metadata)) = fetch_steam_api(&client, query).await {
        return Ok(Some(metadata));
    }

    // Stage 2: VNDB Kana API
    if let Ok(Some(metadata)) = fetch_vndb_api(&client, query).await {
        return Ok(Some(metadata));
    }

    // Stage 3: Jikan API
    if let Ok(Some(metadata)) = fetch_jikan_api(&client, query).await {
        return Ok(Some(metadata));
    }

    Ok(None)
}

#[tauri::command]
pub async fn fetch_game_metadata(
    app_handle: tauri::AppHandle,
    query: String,
    cache_key: Option<String>,
    force_refresh: Option<bool>,
) -> Result<Option<GameMetadata>, String> {
    let key = cache_key.unwrap_or_else(|| query.clone());
    let force = force_refresh.unwrap_or(false);

    if !force {
        if let Some(cached_metadata) = read_from_cache(&app_handle, &key).await {
            return Ok(Some(cached_metadata));
        }
    }

    match fetch_metadata_waterfall(&query).await {
        Ok(Some(metadata)) => {
            write_to_cache(&app_handle, &key, &metadata).await;
            Ok(Some(metadata))
        }
        Ok(None) => {

            Ok(None)
        }
        Err(_) => {

            Ok(None)
        }
    }
}
