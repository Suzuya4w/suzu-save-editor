use serde::Serialize;
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct FarmCollisionData {
    grid: Vec<Vec<u8>>,
    #[serde(rename = "lockedStructures")]
    locked_structures: Vec<String>,
    width: usize,
    height: usize,
}

pub fn parse_tmx_collision(xml_data: &str) -> Result<(Vec<Vec<u8>>, usize, usize), String> {
    let mut reader = Reader::from_str(xml_data);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut in_buildings_layer = false;
    let mut in_data = false;
    
    let mut width = 0;
    let mut height = 0;
    let mut csv_data = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Err(e) => return Err(format!("Error at position {}: {:?}", reader.buffer_position(), e)),
            Ok(Event::Eof) => break,
            Ok(Event::Start(ref e)) => {
                let name = e.name();
                if name.as_ref() == b"layer" {
                    let mut is_buildings = false;
                    let mut tmp_width = 0;
                    let mut tmp_height = 0;
                    
                    for attr in e.attributes() {
                        if let Ok(a) = attr {
                            if a.key.as_ref() == b"name" && a.value.as_ref() == b"Buildings" {
                                is_buildings = true;
                            } else if a.key.as_ref() == b"width" {
                                tmp_width = std::str::from_utf8(&a.value).unwrap_or("0").parse().unwrap_or(0);
                            } else if a.key.as_ref() == b"height" {
                                tmp_height = std::str::from_utf8(&a.value).unwrap_or("0").parse().unwrap_or(0);
                            }
                        }
                    }
                    
                    if is_buildings {
                        in_buildings_layer = true;
                        width = tmp_width;
                        height = tmp_height;
                    }
                } else if name.as_ref() == b"data" && in_buildings_layer {
                    in_data = true;
                }
            },
            Ok(Event::Text(e)) => {
                if in_data {
                    csv_data.push_str(std::str::from_utf8(&e).unwrap_or(""));
                }
            },
            Ok(Event::End(ref e)) => {
                let name = e.name();
                if name.as_ref() == b"layer" && in_buildings_layer {

                    break;
                } else if name.as_ref() == b"data" && in_data {
                    in_data = false;
                }
            },
            Ok(Event::Empty(ref e)) => {
                // If it's a self-closing layer tag, we check if it was buildings layer
                // but usually the data node is inside, so an empty <layer .../> has no data.
                if e.name().as_ref() == b"layer" {
                    for attr in e.attributes() {
                        if let Ok(a) = attr {
                            if a.key.as_ref() == b"name" && a.value.as_ref() == b"Buildings" {
                                return Err("Buildings layer is empty".to_string());
                            }
                        }
                    }
                }
            },
            _ => (),
        }
        buf.clear();
    }
    
    if width == 0 || height == 0 || csv_data.is_empty() {
        return Err("Could not find Buildings layer data".to_string());
    }
    
    let mut grid = vec![vec![0; width]; height];
    let mut row = 0;
    let mut col = 0;
    
    for val_str in csv_data.split(|c| c == ',' || c == '\n' || c == '\r') {
        let val_str = val_str.trim();
        if val_str.is_empty() {
            continue;
        }
        
        let tile_id: u32 = val_str.parse().unwrap_or(0);
        let is_valid = if tile_id == 0 { 1 } else { 0 };
        
        if row < height && col < width {
            grid[row][col] = is_valid;
            col += 1;
            if col >= width {
                col = 0;
                row += 1;
            }
        }
    }

    Ok((grid, width, height))
}

#[tauri::command]
pub async fn get_farm_collision_grid(unpacked_content_path: String, farm_id: String) -> Result<FarmCollisionData, String> {
    let tmx_name = match farm_id.as_str() {
        "1" => "Farm_Fishing.tmx",
        "2" => "Farm_Foraging.tmx",
        "3" => "Farm_Mining.tmx",
        "4" => "Farm_Combat.tmx",
        "5" => "Farm_FourCorners.tmx",
        "6" => "Farm_Island.tmx",
        "7" => "Farm_Ranching.tmx",
        _ => "Farm.tmx",
    };

    let map_path = Path::new(&unpacked_content_path).join("Maps").join(tmx_name);
    
    if !map_path.exists() {
        return Err(format!("TMX file not found: {}", map_path.display()));
    }

    let tmx_content = fs::read_to_string(&map_path).map_err(|e| e.to_string())?;
    let (grid, width, height) = parse_tmx_collision(&tmx_content)?;
    
    let locked_structures = vec![
        "Farmhouse".to_string(),
        "Greenhouse".to_string(),
        "Pet Bowl".to_string(),
        "Cave".to_string(),
        "Shipping Bin".to_string(),
    ];
    
    Ok(FarmCollisionData {
        grid,
        locked_structures,
        width,
        height,
    })
}
