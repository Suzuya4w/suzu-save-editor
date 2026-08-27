use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use tokio::fs;

async fn parse_rpgm_items_json(path: &Path) -> Result<HashMap<u32, String>, String> {
    let mut map = HashMap::new();
    if !path.exists() {
        return Ok(map);
    }

    let content = fs::read_to_string(path).await.map_err(|e| e.to_string())?;
    let json: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(array) = json.as_array() {
        for item in array {
            if let Some(id) = item.get("id").and_then(|v| v.as_u64()) {
                if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                    if !name.is_empty() {
                        map.insert(id as u32, name.to_string());
                    }
                }
            }
        }
    }

    Ok(map)
}

async fn parse_rpgm_system_json(
    path: &Path,
) -> Result<(HashMap<u32, String>, HashMap<u32, String>), String> {
    let mut switches_map = HashMap::new();
    let mut variables_map = HashMap::new();

    if !path.exists() {
        return Ok((switches_map, variables_map));
    }

    let content = fs::read_to_string(path).await.map_err(|e| e.to_string())?;
    let json: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(switches) = json.get("switches").and_then(|v| v.as_array()) {
        for (index, name) in switches.iter().enumerate() {
            if let Some(n) = name.as_str() {
                if !n.is_empty() {
                    switches_map.insert(index as u32, n.to_string());
                }
            }
        }
    }

    if let Some(variables) = json.get("variables").and_then(|v| v.as_array()) {
        for (index, name) in variables.iter().enumerate() {
            if let Some(n) = name.as_str() {
                if !n.is_empty() {
                    variables_map.insert(index as u32, n.to_string());
                }
            }
        }
    }

    Ok((switches_map, variables_map))
}

#[tauri::command]
pub async fn load_game_database(
    folder_path: String,
) -> Result<HashMap<String, HashMap<u32, String>>, String> {
    let base_path = Path::new(&folder_path);

    let items_map = parse_rpgm_items_json(&base_path.join("Items.json"))
        .await
        .unwrap_or_default();
    let weapons_map = parse_rpgm_items_json(&base_path.join("Weapons.json"))
        .await
        .unwrap_or_default();
    let armors_map = parse_rpgm_items_json(&base_path.join("Armors.json"))
        .await
        .unwrap_or_default();

    let (switches_map, variables_map) = parse_rpgm_system_json(&base_path.join("System.json"))
        .await
        .unwrap_or_default();

    let mut final_db = HashMap::new();
    final_db.insert("items".to_string(), items_map);
    final_db.insert("weapons".to_string(), weapons_map);
    final_db.insert("armors".to_string(), armors_map);
    final_db.insert("switches".to_string(), switches_map);
    final_db.insert("variables".to_string(), variables_map);

    Ok(final_db)
}
