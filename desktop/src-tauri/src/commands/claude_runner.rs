//! Shared Claude subprocess utilities.
//! Used by chat.rs, delegation.rs, strategy.rs.

use crate::state::AppState;
use serde_json::{json, Value};

/// Generate unique temp file path (nanos + pid, no collisions)
pub fn unique_tmp(prefix: &str) -> std::path::PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("{}-{}-{}.txt", prefix, nanos, std::process::id()))
}

/// Run claude -p via subprocess — no shell wrapper, direct Command::new("claude")
/// Returns stdout text or error message.
pub fn run_claude(cwd: &std::path::Path, prompt: &str, perm_path: &str) -> String {
    let tmp = unique_tmp("chat");
    if std::fs::write(&tmp, prompt).is_err() {
        return "Error: could not write temp file".to_string();
    }

    let stdin_file = match std::fs::File::open(&tmp) {
        Ok(f) => f,
        Err(e) => {
            let _ = std::fs::remove_file(&tmp);
            return format!("Error opening temp file: {}", e);
        }
    };

    let result = std::process::Command::new("claude")
        .args(["--continue", "-p", "--settings", perm_path])
        .current_dir(cwd)
        .stdin(std::process::Stdio::from(stdin_file))
        .env("PYTHONIOENCODING", "utf-8")
        .env("LANG", "en_US.UTF-8")
        .output();

    let _ = std::fs::remove_file(&tmp);

    match result {
        Ok(output) => {
            let text = String::from_utf8(output.stdout)
                .unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).to_string());
            let stderr = String::from_utf8_lossy(&output.stderr);
            let trimmed = text.trim();
            if trimmed.is_empty() {
                if stderr.trim().is_empty() {
                    "Agent returned empty response".to_string()
                } else {
                    stderr.trim().to_string()
                }
            } else {
                trimmed.to_string()
            }
        }
        Err(e) => format!("Error running claude: {}", e),
    }
}

/// Get permission settings path for a project
pub fn get_permission_path(state: &AppState, project: &str) -> String {
    let valid_profiles = ["restrictive", "balanced", "permissive"];
    let profile = if let Ok(content) = std::fs::read_to_string(&state.config_path) {
        let raw = serde_json::from_str::<Value>(&content)
            .ok()
            .and_then(|cfg| {
                cfg.get("project_permissions")
                    .and_then(|pp| pp.get(project))
                    .and_then(|v| v.as_str())
                    .map(String::from)
            })
            .unwrap_or_else(|| "balanced".to_string());
        if valid_profiles.contains(&raw.as_str()) { raw } else { "balanced".to_string() }
    } else {
        "balanced".to_string()
    };

    let perms_dir = state.root.join("n8n").join("dashboard").join("permissions");
    let path = perms_dir.join(format!("{}.json", profile));
    if path.exists() {
        path.to_string_lossy().to_string()
    } else {
        perms_dir.join("balanced.json").to_string_lossy().to_string()
    }
}

/// Save a running task indicator
pub fn set_activity(root: &std::path::Path, project: &str, action: &str, detail: &str) {
    let tasks_file = root.join("tasks").join(".running-tasks.json");
    let mut tasks: Value = std::fs::read_to_string(&tasks_file)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or(json!({}));

    tasks[project] = json!({
        "action": action,
        "detail": detail,
        "started": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs_f64())
            .unwrap_or(0.0),
    });

    let _ = std::fs::write(&tasks_file, serde_json::to_string(&tasks).unwrap_or_default());
}

pub fn clear_activity(root: &std::path::Path, project: &str) {
    let tasks_file = root.join("tasks").join(".running-tasks.json");
    if let Ok(content) = std::fs::read_to_string(&tasks_file) {
        if let Ok(mut tasks) = serde_json::from_str::<Value>(&content) {
            if let Some(obj) = tasks.as_object_mut() {
                obj.remove(project);
                let _ = std::fs::write(&tasks_file, serde_json::to_string(&tasks).unwrap_or_default());
            }
        }
    }
}
