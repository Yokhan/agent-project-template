use crate::state::AppState;
use serde_json::{json, Value};
use tauri::State;

pub fn queue_delegation_internal(state: &AppState, project: &str, task: &str) -> String {
    let id = format!(
        "{}-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0),
        std::process::id()
    );

    let delegation = crate::state::Delegation {
        id: id.clone(),
        project: project.to_string(),
        task: task.to_string(),
        ts: state.now_iso(),
        status: "pending".to_string(),
        response: None,
        retries: 0,
    };

    if let Ok(mut delegations) = state.delegations.lock() {
        delegations.insert(id.clone(), delegation);
    }
    state.save_delegations();

    id
}

#[tauri::command]
pub fn get_delegations(state: State<AppState>) -> Value {
    let delegations = match state.delegations.lock() {
        Ok(d) => d
            .values()
            .filter(|d| d.status == "pending")
            .map(|d| serde_json::to_value(d).unwrap_or_default())
            .collect::<Vec<_>>(),
        Err(_) => Vec::new(),
    };

    json!({"delegations": delegations})
}

#[tauri::command]
pub fn approve_delegation(state: State<AppState>, id: String) -> Value {
    let delegation = match state.delegations.lock() {
        Ok(d) => d.get(&id).cloned(),
        Err(_) => return json!({"status": "error", "error": "lock error"}),
    };

    let d = match delegation {
        Some(d) if d.status == "pending" => d,
        _ => return json!({"status": "error", "error": "Delegation not found or already executed"}),
    };

    let project_dir = match state.validate_project(&d.project) {
        Ok(p) => p,
        Err(e) => return json!({"status": "error", "error": e}),
    };

    // Mark as running
    if let Ok(mut delegations) = state.delegations.lock() {
        if let Some(del) = delegations.get_mut(&id) {
            del.status = "running".to_string();
        }
    }

    // Write task to project chat
    let chat_file = state.chats_dir.join(format!("{}.jsonl", d.project));
    let ts = state.now_iso();
    let user_entry = json!({"ts": ts, "role": "user", "msg": format!("[via PA] {}", d.task)});
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true).open(&chat_file)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&user_entry).unwrap_or_default())
        });

    // Execute — use permission profiles, no --dangerously-skip-permissions
    let perm_path = super::claude_runner::get_permission_path(&state, &d.project);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = std::env::temp_dir().join(format!("delegate-{}-{}.txt", nanos, std::process::id()));

    let response = if std::fs::write(&tmp, &d.task).is_ok() {
        let stdin_file = match std::fs::File::open(&tmp) {
            Ok(f) => f,
            Err(e) => {
                let _ = std::fs::remove_file(&tmp);
                return json!({"status": "error", "error": format!("Cannot open temp file: {}", e)});
            }
        };

        let result = std::process::Command::new("claude")
            .args(["-p", "--settings", &perm_path])
            .current_dir(&project_dir)
            .stdin(std::process::Stdio::from(stdin_file))
            .env("PYTHONIOENCODING", "utf-8")
            .output();

        let _ = std::fs::remove_file(&tmp);

        match result {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                if stdout.is_empty() {
                    if stderr.is_empty() { "Agent returned empty response".to_string() } else { format!("Error: {}", stderr) }
                } else {
                    stdout
                }
            }
            Err(e) => format!("Error running claude: {}", e),
        }
    } else {
        "Error: could not write temp file".to_string()
    };

    // Save response
    let ts2 = state.now_iso();
    let asst_entry = json!({"ts": ts2, "role": "assistant", "msg": response});
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true).open(&chat_file)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&asst_entry).unwrap_or_default())
        });

    // Log in orchestrator chat
    let orch_file = state.chats_dir.join("_orchestrator.jsonl");
    let sys_entry = json!({"ts": ts2, "role": "system", "msg": format!("✓ Executed in {}: {}", d.project, &response[..response.len().min(200)])});
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true).open(&orch_file)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&sys_entry).unwrap_or_default())
        });

    // Mark as done
    if let Ok(mut delegations) = state.delegations.lock() {
        if let Some(del) = delegations.get_mut(&id) {
            del.status = "done".to_string();
            del.response = Some(response.clone());
        }
    }
    state.save_delegations();

    // Log delegation
    log_delegation(&state.root, &d.project, &d.task, "success");

    json!({
        "status": "complete",
        "project": d.project,
        "task": d.task,
        "response": response,
    })
}

#[tauri::command]
pub fn reject_delegation(state: State<AppState>, id: String) -> Value {
    if let Ok(mut delegations) = state.delegations.lock() {
        if let Some(del) = delegations.get_mut(&id) {
            del.status = "rejected".to_string();
            drop(delegations);
            state.save_delegations();
            return json!({"status": "rejected"});
        }
    }
    json!({"status": "error", "error": "Not found"})
}

#[tauri::command]
pub fn get_analytics(state: State<AppState>) -> Value {
    let log_path = state.root.join("tasks").join(".delegation-log.jsonl");
    if !log_path.exists() {
        return json!({"total": 0, "by_project": {}, "by_status": {}, "patterns": []});
    }

    let mut entries = Vec::new();
    if let Ok(content) = std::fs::read_to_string(&log_path) {
        for line in content.lines() {
            if let Ok(entry) = serde_json::from_str::<Value>(line) {
                entries.push(entry);
            }
        }
    }

    let mut by_project: std::collections::HashMap<String, Value> = std::collections::HashMap::new();
    let mut by_status: std::collections::HashMap<String, u64> = std::collections::HashMap::new();

    for e in &entries {
        let p = e.get("project").and_then(|v| v.as_str()).unwrap_or("unknown");
        let s = e.get("status").and_then(|v| v.as_str()).unwrap_or("unknown");

        *by_status.entry(s.to_string()).or_insert(0) += 1;

        let proj = by_project.entry(p.to_string()).or_insert_with(|| json!({"total": 0, "success": 0, "error": 0}));
        if let Some(obj) = proj.as_object_mut() {
            let total = obj.get("total").and_then(|v| v.as_u64()).unwrap_or(0);
            obj.insert("total".to_string(), json!(total + 1));
            if s == "success" {
                let count = obj.get("success").and_then(|v| v.as_u64()).unwrap_or(0);
                obj.insert("success".to_string(), json!(count + 1));
            }
            if s == "error" {
                let count = obj.get("error").and_then(|v| v.as_u64()).unwrap_or(0);
                obj.insert("error".to_string(), json!(count + 1));
            }
        }
    }

    json!({
        "total": entries.len(),
        "by_project": by_project,
        "by_status": by_status,
        "patterns": [],
    })
}

fn log_delegation(root: &std::path::Path, project: &str, task: &str, status: &str) {
    let log_path = root.join("tasks").join(".delegation-log.jsonl");
    let entry = json!({
        "ts": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        "project": project,
        "task": &task[..task.len().min(100)],
        "status": status,
    });
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true).open(&log_path)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&entry).unwrap_or_default())
        });
}
