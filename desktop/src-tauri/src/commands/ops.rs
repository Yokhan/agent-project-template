//! Operations commands: deploy template, health check
use serde_json::{json, Value};
use tauri::State;
use crate::state::AppState;
use std::process::Command as Cmd;

/// Deploy template to a project via sync-template.sh
#[tauri::command]
pub fn deploy_template(state: State<AppState>, project: String) -> Value {
    let script = state.root.join("scripts").join("sync-template.sh");
    if !script.exists() {
        return json!({"status": "error", "error": "sync-template.sh not found"});
    }
    let project_dir = state.docs_dir.join(&project);
    if !project_dir.exists() {
        return json!({"status": "error", "error": format!("Project not found: {}", project)});
    }

    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };
    let cmd = format!("bash \"{}\" --from-git", script.display());

    match Cmd::new(shell).args([flag, &cmd]).current_dir(&project_dir).output() {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            json!({
                "status": if out.status.success() { "ok" } else { "error" },
                "project": project,
                "stdout": stdout,
                "stderr": stderr,
            })
        }
        Err(e) => json!({"status": "error", "error": format!("{}", e)}),
    }
}

/// Run health check (check-drift.sh) on one project or all
#[tauri::command]
pub fn health_check(state: State<AppState>, project: String) -> Value {
    let projects: Vec<String> = if project == "all" {
        std::fs::read_dir(&state.docs_dir)
            .map(|entries| {
                entries
                    .flatten()
                    .filter(|e| e.path().join("scripts").join("check-drift.sh").exists())
                    .filter_map(|e| e.file_name().into_string().ok())
                    .collect()
            })
            .unwrap_or_default()
    } else {
        vec![project]
    };

    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };

    let mut results = vec![];
    for proj in &projects {
        let project_dir = state.docs_dir.join(proj);
        let script = project_dir.join("scripts").join("check-drift.sh");
        if !script.exists() {
            results.push(json!({"project": proj, "status": "skip", "message": "no check-drift.sh"}));
            continue;
        }
        match Cmd::new(shell)
            .args([flag, &format!("bash \"{}\"", script.display())])
            .current_dir(&project_dir)
            .output()
        {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let warnings = stdout.lines()
                    .find(|l| l.contains("warnings"))
                    .unwrap_or("0 warnings, 0 errors")
                    .trim()
                    .to_string();
                results.push(json!({
                    "project": proj,
                    "status": if out.status.success() { "ok" } else { "warning" },
                    "summary": warnings,
                }));
            }
            Err(e) => results.push(json!({"project": proj, "status": "error", "message": format!("{}", e)})),
        }
    }
    json!({"results": results, "checked": results.len()})
}

/// Create new project from template
#[tauri::command]
pub fn create_project(state: State<AppState>, name: String, orchestrator: bool) -> Value {
    let setup = state.root.join("setup.sh");
    if !setup.exists() {
        return json!({"status": "error", "error": "setup.sh not found"});
    }

    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };
    let cmd = if orchestrator {
        format!("bash \"{}\" \"{}\" --orchestrator", setup.display(), name)
    } else {
        format!("bash \"{}\" \"{}\"", setup.display(), name)
    };

    match Cmd::new(shell)
        .args([flag, &cmd])
        .current_dir(&state.docs_dir)
        .output()
    {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            json!({
                "status": if out.status.success() { "ok" } else { "error" },
                "project": name,
                "orchestrator": orchestrator,
                "output": stdout,
            })
        }
        Err(e) => json!({"status": "error", "error": format!("{}", e)}),
    }
}

/// Inline deploy for use from chat.rs (not a tauri command)
pub fn execute_deploy_inline(root: &std::path::Path, docs_dir: &std::path::Path, project: &str) -> String {
    let script = root.join("scripts").join("sync-template.sh");
    if !script.exists() { return "sync-template.sh not found".to_string(); }
    let project_dir = docs_dir.join(project);
    if !project_dir.exists() { return format!("Project dir not found: {}", project); }
    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };
    match std::process::Command::new(shell)
        .args([flag, &format!("bash \"{}\" --from-git", script.display())])
        .current_dir(&project_dir)
        .output()
    {
        Ok(out) => {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if out.status.success() { format!("OK: {}", &s[..s.len().min(200)]) }
            else { format!("Failed: {}", &s[..s.len().min(200)]) }
        }
        Err(e) => format!("Error: {}", e),
    }
}

/// Inline health check for use from chat.rs
pub fn execute_health_inline(docs_dir: &std::path::Path, project: &str) -> String {
    let projects: Vec<String> = if project == "all" {
        std::fs::read_dir(docs_dir).map(|entries| {
            entries.flatten()
                .filter(|e| e.path().join("scripts").join("check-drift.sh").exists())
                .filter_map(|e| e.file_name().into_string().ok())
                .collect()
        }).unwrap_or_default()
    } else {
        vec![project.to_string()]
    };
    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };
    let mut results = vec![];
    for proj in &projects {
        let pd = docs_dir.join(proj);
        let script = pd.join("scripts").join("check-drift.sh");
        if !script.exists() { results.push(format!("{}: skip", proj)); continue; }
        match std::process::Command::new(shell)
            .args([flag, &format!("bash \"{}\"", script.display())])
            .current_dir(&pd).output()
        {
            Ok(out) => {
                let s = String::from_utf8_lossy(&out.stdout);
                let summary = s.lines().find(|l| l.contains("warnings") || l.contains("errors"))
                    .unwrap_or("OK").trim();
                results.push(format!("{}: {}", proj, summary));
            }
            Err(e) => results.push(format!("{}: {}", proj, e)),
        }
    }
    results.join("\n")
}

/// Get task queue from tasks/queue.md
#[tauri::command]
pub fn get_queue(state: State<AppState>) -> Value {
    let queue_path = state.root.join("tasks").join("queue.md");
    let mut tasks = Vec::new();

    if let Ok(content) = std::fs::read_to_string(&queue_path) {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("- [ ] ") {
                tasks.push(json!({
                    "text": &trimmed[6..],
                    "done": false,
                }));
            } else if trimmed.starts_with("- [x] ") {
                tasks.push(json!({
                    "text": &trimmed[6..],
                    "done": true,
                }));
            }
        }
    }

    json!({"tasks": tasks, "total": tasks.len()})
}

/// Send message to Telegram bot
#[tauri::command]
pub async fn send_telegram(state: State<'_, AppState>, text: String) -> Result<Value, String> {
    let cfg: Value = std::fs::read_to_string(&state.config_path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or(json!({}));

    let token = cfg.get("tg_bot_token").and_then(|v| v.as_str()).unwrap_or("");
    let chat_id = cfg.get("tg_chat_id").and_then(|v| v.as_str()).unwrap_or("");

    if token.is_empty() || chat_id.is_empty() {
        return Ok(json!({"status": "error", "error": "Telegram not configured. Set tg_bot_token and tg_chat_id in settings."}));
    }

    let url = format!("https://api.telegram.org/bot{}/sendMessage", token);
    let client = reqwest::Client::new();
    let res = client.post(&url)
        .json(&json!({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status().is_success();
    Ok(json!({"status": if status { "ok" } else { "error" }, "sent": status}))
}

/// Save attached file for chat context (returns local path for claude)
#[tauri::command]
pub fn save_attachment(state: State<AppState>, name: String, data: Vec<u8>) -> Value {
    let att_dir = state.root.join("tasks").join("attachments");
    let _ = std::fs::create_dir_all(&att_dir);

    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let safe_name = name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let filename = format!("{}-{}", nanos, safe_name);
    let path = att_dir.join(&filename);

    match std::fs::write(&path, &data) {
        Ok(_) => json!({"status": "ok", "path": path.to_string_lossy(), "size": data.len()}),
        Err(e) => json!({"status": "error", "error": e.to_string()}),
    }
}

/// Add task to queue
#[tauri::command]
pub fn add_to_queue(state: State<AppState>, task: String) -> Value {
    let queue_path = state.root.join("tasks").join("queue.md");
    let entry = format!("- [ ] {}\n", task);

    match std::fs::OpenOptions::new()
        .create(true).append(true).open(&queue_path)
        .and_then(|mut f| {
            use std::io::Write;
            write!(f, "{}", entry)
        }) {
        Ok(_) => json!({"status": "ok"}),
        Err(e) => json!({"status": "error", "error": e.to_string()}),
    }
}
