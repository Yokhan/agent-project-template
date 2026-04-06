use crate::state::AppState;
use serde_json::{json, Value};
use tauri::State;

/// Proxy a request to n8n webhook endpoint
#[tauri::command]
pub async fn proxy_webhook(
    state: State<'_, AppState>,
    path: String,
    method: String,
    body: Option<String>,
) -> Result<Value, String> {
    let url = format!("{}{}", state.n8n_url, path);

    let client = reqwest::Client::new();
    let request = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => {
            let mut req = client.post(&url);
            if let Some(b) = body {
                req = req.header("Content-Type", "application/json").body(b);
            }
            req
        }
        _ => return Err(format!("Unsupported method: {}", method)),
    };

    match request.send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            match serde_json::from_str::<Value>(&text) {
                Ok(data) => Ok(json!({"status": status, "data": data})),
                Err(_) => Ok(json!({"status": status, "data": text})),
            }
        }
        Err(e) => Ok(json!({"status": 502, "error": e.to_string()})),
    }
}
