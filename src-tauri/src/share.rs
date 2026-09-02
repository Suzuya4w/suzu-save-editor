use axum::{
    extract::{State, Json},
    routing::post,
    Router,
    http::{StatusCode, HeaderMap},
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tauri::async_runtime::JoinHandle;
use std::sync::Mutex;
use local_ip_address::local_ip;

#[derive(Clone)]
struct AppState {
    app: AppHandle,
    expected_pin: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct SharePayload {
    pub engine_type: String,
    pub parsed_variables: Option<serde_json::Value>,
    pub raw_payload: Option<String>,
    pub original_filename: Option<String>,
}

lazy_static::lazy_static! {
    static ref SERVER_TASK: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);
}

async fn upload_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<SharePayload>,
) -> Result<&'static str, (StatusCode, &'static str)> {
    let pin = headers.get("x-share-pin").and_then(|v| v.to_str().ok()).unwrap_or("");
    if pin != state.expected_pin {
        return Err((StatusCode::UNAUTHORIZED, "Invalid PIN"));
    }

    if payload.parsed_variables.is_none() && payload.raw_payload.is_none() {
         return Err((StatusCode::BAD_REQUEST, "Payload is completely empty"));
    }

    state.app.emit("local-share-received", payload).map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to emit event to frontend")
    })?;

    Ok("Success")
}

#[tauri::command]
pub async fn start_share_server(app: AppHandle, pin: String) -> Result<u16, String> {
    let state = AppState { app, expected_pin: pin };
    let router = Router::new()
        .route("/upload", post(upload_handler))
        .with_state(state);

    let mut port = 41234;
    let mut listener = TcpListener::bind(format!("0.0.0.0:{}", port)).await;
    
    if listener.is_err() {
        port = 0;
        listener = TcpListener::bind("0.0.0.0:0").await;
    }

    let listener = listener.map_err(|e| format!("Failed to bind to port: {}", e))?;
    let actual_port = listener.local_addr().unwrap().port();

    let handle = tauri::async_runtime::spawn(async move {
        axum::serve(listener, router).await.unwrap_or_else(|e| {
            println!("Share server error: {}", e);
        });
    });

    let mut lock = SERVER_TASK.lock().unwrap();
    if let Some(old) = lock.take() {
        old.abort();
    }
    *lock = Some(handle);

    Ok(actual_port)
}

#[tauri::command]
pub async fn stop_share_server() -> Result<(), String> {
    let mut lock = SERVER_TASK.lock().unwrap();
    if let Some(task) = lock.take() {
        task.abort();
    }
    Ok(())
}

#[tauri::command]
pub fn get_local_ip() -> Result<String, String> {
    local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| format!("Failed to detect local IP: {}", e))
}
