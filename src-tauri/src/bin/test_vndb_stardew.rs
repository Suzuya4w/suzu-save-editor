use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct VndbKanaRequest {
    filters: Vec<serde_json::Value>,
    fields: String,
    sort: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let request_body = VndbKanaRequest {
        filters: vec![
            serde_json::json!("search"),
            serde_json::json!("="),
            serde_json::json!("stardew valley"),
        ],
        fields: "title".to_string(),
        sort: "searchrank".to_string(),
    };

    let response = client
        .post("https://api.vndb.org/kana/vn")
        .json(&request_body)
        .send()
        .await?;

    let text = response.text().await?;
    println!("Response: {}", text);
    Ok(())
}
