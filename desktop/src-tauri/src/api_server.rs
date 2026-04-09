//! Lightweight HTTP API server running alongside Tauri.
//! Provides REST endpoints for browser mode, testing, orchestrator, and n8n.
//! Shares AppState with Tauri commands via Arc.

use crate::scanner;
use crate::state::AppState;
use axum::{
    extract::State as AxState,
    extract::{Json, Path},
    http::{header, Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

pub async fn start(state: Arc<AppState>, port: u16) {
    let app = Router::new()
        // Project scanning
        .route("/api/agents", get(get_agents))
        .route("/api/segments", get(get_segments))
        // Chat
        .route("/api/chat/{project}", get(get_chat_history))
        .route("/api/chat", post(send_chat))
        .route("/api/chats", get(get_chats))
        // Feed & status
        .route("/api/feed", get(get_feed))
        .route("/api/activity", get(get_activity))
        .route("/api/plan", get(get_plan))
        // Config
        .route("/api/config", get(get_config))
        .route("/api/config", post(set_config))
        .route("/api/permissions", get(get_permissions))
        // Health
        .route("/api/health", get(health))
        // Delegations
        .route("/api/delegations", get(get_delegations))
        .route("/api/delegation/approve", post(approve_delegation))
        .route("/api/delegation/reject", post(reject_delegation))
        .layer(CorsLayer::new()
            .allow_origin(Any)
            .allow_methods([Method::GET, Method::POST])
            .allow_headers([header::CONTENT_TYPE]))
        .with_state(state);

    // Try port, fallback to port+1, port+2
    for p in [port, port + 1, port + 2] {
        let addr = format!("127.0.0.1:{}", p);
        match tokio::net::TcpListener::bind(&addr).await {
            Ok(listener) => {
                println!("HTTP API server: http://{}", addr);
                axum::serve(listener, app).await.unwrap();
                return;
            }
            Err(e) => {
                eprintln!("Port {} busy ({}), trying next...", p, e);
            }
        }
    }
    eprintln!("WARNING: HTTP API server could not start — all ports busy");
}

async fn health(AxState(state): AxState<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "uptime_secs": state.uptime_secs(),
    }))
}

async fn get_agents(AxState(state): AxState<Arc<AppState>>) -> impl IntoResponse {
    let mut cache = state.scan_cache.lock().unwrap_or_else(|e| e.into_inner());
    let stale = cache.updated.map(|t| t.elapsed().as_secs() > 10).unwrap_or(true);

    if stale || cache.data.is_none() {
        let projects = scanner::scan_projects(&state.docs_dir, &state.project_segment);
        let data: Vec<Value> = projects.iter().map(|p| p.to_json()).collect();
        let val = Value::Array(data);
        cache.data = Some(val.clone());
        cache.updated = Some(std::time::Instant::now());
        Json(json!({"agents": val}))
    } else {
        Json(json!({"agents": cache.data.clone().unwrap_or(json!([]))}))
    }
}

async fn get_segments(AxState(state): AxState<Arc<AppState>>) -> impl IntoResponse {
    let segs = state.segments.lock().unwrap_or_else(|e| e.into_inner());
    Json(json!({
        "segments": *segs,
        "project_segment": state.project_segment,
    }))
}

async fn get_chats(AxState(state): AxState<Arc<AppState>>) -> impl IntoResponse {
    // Reuse Tauri command logic
    let mut chats = Vec::new();
    let entries = match std::fs::read_dir(&state.chats_dir) {
        Ok(e) => e,
        Err(_) => return Json(json!({"chats": []})),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) if n.ends_with(".jsonl") => n[..n.len() - 6].to_string(),
            _ => continue,
        };
        let msg_count = std::fs::read_to_string(&path)
            .map(|c| c.lines().count())
            .unwrap_or(0);
        chats.push(json!({"project": name, "msg_count": msg_count}));
    }
    Json(json!({"chats": chats}))
}

async fn get_chat_history(
    AxState(state): AxState<Arc<AppState>>,
    Path(project): Path<String>,
) -> impl IntoResponse {
    let path = state.chats_dir.join(format!("{}.jsonl", project));
    let mut messages = Vec::new();
    if let Ok(content) = std::fs::read_to_string(&path) {
        let lines: Vec<&str> = content.lines().collect();
        let recent = &lines[lines.len().saturating_sub(50)..];
        for line in recent {
            if let Ok(msg) = serde_json::from_str::<Value>(line) {
                messages.push(msg);
            }
        }
    }
    Json(json!({"project": project, "messages": messages}))
}

async fn send_chat(
    AxState(state): AxState<Arc<AppState>>,
    Json(body): Json<Value>,
) -> impl IntoResponse {
    let message = body.get("message").and_then(|m| m.as_str()).unwrap_or("").to_string();
    let project = body.get("project").and_then(|p| p.as_str()).unwrap_or("").to_string();

    if message.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Empty message"})));
    }

    let (_, pa_dir) = state.get_orch_dir();
    let cwd = if !project.is_empty() {
        match state.validate_project(&project) {
            Ok(p) => p,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({"error": e}))),
        }
    } else {
        pa_dir
    };

    let chat_key = if project.is_empty() { "_orchestrator".to_string() } else { project.clone() };
    let chat_file = state.chats_dir.join(format!("{}.jsonl", chat_key));
    let ts = state.now_iso();

    // Save user message
    let user_entry = json!({"ts": ts, "role": "user", "msg": message});
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true).open(&chat_file)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&user_entry).unwrap_or_default())
        });

    let perm_path = crate::commands::claude_runner::get_permission_path(&state, &chat_key);
    let response = crate::commands::claude_runner::run_claude(&cwd, &message, &perm_path);

    // Save response
    let ts2 = state.now_iso();
    let asst_entry = json!({"ts": ts2, "role": "assistant", "msg": response});
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true).open(&chat_file)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&asst_entry).unwrap_or_default())
        });

    (StatusCode::OK, Json(json!({"status": "complete", "response": response})))
}

async fn get_feed(AxState(state): AxState<Arc<AppState>>) -> impl IntoResponse {
    let feed_path = state.root.join("tasks").join(".chat-history.jsonl");
    let mut items = Vec::new();
    if let Ok(content) = std::fs::read_to_string(&feed_path) {
        for line in content.lines().rev().take(20) {
            if let Ok(item) = serde_json::from_str::<Value>(line) {
                items.push(item);
            }
        }
    }
    Json(json!({"items": items}))
}

async fn get_activity(AxState(state): AxState<Arc<AppState>>) -> impl IntoResponse {
    let tasks_file = state.root.join("tasks").join(".running-tasks.json");
    let tasks: Value = std::fs::read_to_string(&tasks_file)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or(json!({}));
    Json(json!({"tasks": tasks}))
}

async fn get_plan(AxState(state): AxState<Arc<AppState>>) -> impl IntoResponse {
    let projects = scanner::scan_projects(&state.docs_dir, &state.project_segment);
    let issues: Vec<Value> = projects.iter()
        .filter(|p| p.uncommitted > 20 || p.blockers)
        .map(|p| json!({"project": p.name, "issue": if p.blockers {"has blockers"} else {"needs commit"}, "uncommitted": p.uncommitted}))
        .collect();
    Json(json!({"issues": issues, "total": issues.len()}))
}

async fn get_config(AxState(state): AxState<Arc<AppState>>) -> impl IntoResponse {
    let config: Value = std::fs::read_to_string(&state.config_path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or(json!({}));
    Json(config)
}

async fn set_config(
    AxState(state): AxState<Arc<AppState>>,
    Json(body): Json<Value>,
) -> impl IntoResponse {
    let _ = std::fs::write(&state.config_path, serde_json::to_string_pretty(&body).unwrap_or_default());
    Json(json!({"status": "saved"}))
}

async fn get_permissions(AxState(state): AxState<Arc<AppState>>) -> impl IntoResponse {
    let perms_dir = state.root.join("n8n").join("dashboard").join("permissions");
    let mut profiles = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&perms_dir) {
        for e in entries.flatten() {
            if let Some(name) = e.file_name().to_str() {
                if name.ends_with(".json") {
                    profiles.push(name[..name.len()-5].to_string());
                }
            }
        }
    }
    Json(json!({"profiles": profiles}))
}

async fn get_delegations(AxState(state): AxState<Arc<AppState>>) -> impl IntoResponse {
    let delegations = match state.delegations.lock() {
        Ok(d) => d.values()
            .filter(|d| d.status == "pending")
            .map(|d| serde_json::to_value(d).unwrap_or_default())
            .collect::<Vec<_>>(),
        Err(_) => Vec::new(),
    };
    Json(json!({"delegations": delegations}))
}

async fn approve_delegation(
    AxState(state): AxState<Arc<AppState>>,
    Json(body): Json<Value>,
) -> impl IntoResponse {
    let id = body.get("id").and_then(|i| i.as_str()).unwrap_or("");
    if id.is_empty() {
        return Json(json!({"error": "Missing id"}));
    }
    // Simplified — full logic is in delegation.rs
    Json(json!({"status": "use Tauri command for full approve flow"}))
}

async fn reject_delegation(
    AxState(state): AxState<Arc<AppState>>,
    Json(body): Json<Value>,
) -> impl IntoResponse {
    let id = body.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string();
    if let Ok(mut delegations) = state.delegations.lock() {
        if let Some(del) = delegations.get_mut(&id) {
            del.status = "rejected".to_string();
            drop(delegations);
            state.save_delegations();
            return Json(json!({"status": "rejected"}));
        }
    }
    Json(json!({"error": "Not found"}))
}
