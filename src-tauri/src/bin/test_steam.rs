use serde::Deserialize;

#[derive(Deserialize, Debug)]
struct SteamSearchItem {
    id: u32,
}

#[derive(Deserialize, Debug)]
struct SteamSearchResponse {
    items: Option<Vec<SteamSearchItem>>,
}

#[derive(Deserialize, Debug)]
struct SteamAppDetailsData {
    name: Option<String>,
    short_description: Option<String>,
    header_image: Option<String>,
}

#[derive(Deserialize, Debug)]
struct SteamAppDetailsResult {
    success: bool,
    data: Option<SteamAppDetailsData>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder()
        .user_agent("SuzuSaveEditor/1.0 (Windows NT 10.0; Win64; x64)")
        .timeout(std::time::Duration::from_secs(4))
        .build()?;

    let query = "MISIDE";
    let search_url = format!(
        "https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=US",
        urlencoding::encode(query)
    );

    println!("Searching: {}", search_url);
    let search_res = client.get(&search_url).send().await?;
    let text = search_res.text().await?;
    println!("Search JSON: {}", text);
    
    let search_data: SteamSearchResponse = serde_json::from_str(&text)?;
    
    if let Some(items) = search_data.items {
        if let Some(first_item) = items.into_iter().next() {
            let app_id = first_item.id;
            println!("App ID: {}", app_id);
            
            let details_url = format!("https://store.steampowered.com/api/appdetails?appids={}&l=english", app_id);
            let details_res = client.get(&details_url).send().await?;
            let details_text = details_res.text().await?;
            println!("Details JSON: {}", &details_text[..200]);

            let details_json: std::collections::HashMap<String, SteamAppDetailsResult> = 
                serde_json::from_str(&details_text)?;
                
            if let Some(app) = details_json.get(&app_id.to_string()) {
                println!("Success: {}", app.success);
            }
        }
    }
    
    Ok(())
}
