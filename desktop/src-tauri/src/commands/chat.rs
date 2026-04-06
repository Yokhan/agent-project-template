use crate::state::AppState;
use serde_json::{json, Value};
use std::io::BufRead;
use tauri::{Emitter, State};

#[tauri::command]
pub fn get_chats(state: State<AppState>) -> Value {
    let mut chats = Vec::new();
    let entries = match std::fs::read_dir(&state.chats_dir) {
        Ok(e) => e,
        Err(_) => return json!({"chats": []}),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) if n.ends_with(".jsonl") => n[..n.len() - 6].to_string(),
            _ => continue,
        };

        let (last_msg, last_ts, msg_count, role) = match std::fs::read_to_string(&path) {
            Ok(content) => {
                let lines: Vec<&str> = content.lines().collect();
                let count = lines.len();
                if let Some(last_line) = lines.last() {
                    if let Ok(entry) = serde_json::from_str::<Value>(last_line) {
                        let msg = entry.get("msg").and_then(|v| v.as_str()).unwrap_or("");
                        let ts = entry.get("ts").and_then(|v| v.as_str()).unwrap_or("");
                        let r = entry.get("role").and_then(|v| v.as_str()).unwrap_or("");
                        (msg[..msg.len().min(60)].to_string(), ts.to_string(), count, r.to_string())
                    } else {
                        (String::new(), String::new(), count, String::new())
                    }
                } else {
                    (String::new(), String::new(), 0, String::new())
                }
            }
            Err(_) => (String::new(), String::new(), 0, String::new()),
        };

        chats.push(json!({
            "project": name,
            "last_msg": last_msg,
            "last_ts": last_ts,
            "msg_count": msg_count,
            "role": role,
        }));
    }

    chats.sort_by(|a, b| {
        let ts_a = a.get("last_ts").and_then(|v| v.as_str()).unwrap_or("");
        let ts_b = b.get("last_ts").and_then(|v| v.as_str()).unwrap_or("");
        ts_b.cmp(ts_a)
    });

    json!({"chats": chats})
}

#[tauri::command]
pub fn get_chat_history(state: State<AppState>, project: String) -> Value {
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

    json!({"project": project, "messages": messages})
}

/// Build orchestrator context prefix for PA
fn build_orchestrator_context(state: &AppState) -> String {
    let projects = crate::scanner::scan_projects(&state.docs_dir, &state.project_segment);
    let names: Vec<&str> = projects.iter().map(|p| p.name.as_str()).take(10).collect();
    let working: Vec<&str> = projects.iter().filter(|p| p.status == "working").map(|p| p.name.as_str()).collect();
    let blocked: Vec<&str> = projects.iter().filter(|p| p.blockers).map(|p| p.name.as_str()).collect();

    format!(
        "[CONTEXT: You are PA Orchestrator managing {} projects.\n\
         Projects: {}\n\
         Working: {}. Blocked: {}.\n\
         DELEGATION: When user asks you to do something in a specific project, \
         write your response with this EXACT format at the end:\n\
         [DELEGATE:ProjectName]\n\
         <exact task message for that project's agent, as if from the user>\n\
         [/DELEGATE]\n\
         The dashboard will automatically send this to the project's agent and report back.\n\
         Be concise.]\n\n",
        projects.len(),
        names.join(", "),
        if working.is_empty() { "none".to_string() } else { working.join(", ") },
        if blocked.is_empty() { "none".to_string() } else { blocked.join(", ") },
    )
}

/// Get permission settings path for a project
fn get_permission_path(state: &AppState, project: &str) -> String {
    let profile = if let Ok(content) = std::fs::read_to_string(&state.config_path) {
        serde_json::from_str::<Value>(&content)
            .ok()
            .and_then(|cfg| {
                cfg.get("project_permissions")
                    .and_then(|pp| pp.get(project))
                    .and_then(|v| v.as_str())
                    .map(String::from)
            })
            .unwrap_or_else(|| "balanced".to_string())
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

/// Save a running task to file
fn set_activity(root: &std::path::Path, project: &str, action: &str, detail: &str) {
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

fn clear_activity(root: &std::path::Path, project: &str) {
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

/// Run claude -p via subprocess and return result
fn run_claude(cwd: &std::path::Path, prompt: &str, perm_path: &str) -> String {
    let tmp = std::env::temp_dir().join(format!("chat-{}.txt", std::process::id()));
    if std::fs::write(&tmp, prompt).is_err() {
        return "Error: could not write temp file".to_string();
    }

    let cmd = if cfg!(target_os = "windows") {
        format!(
            "chcp 65001 >nul 2>&1 & claude --continue -p --settings \"{}\" < \"{}\"",
            perm_path,
            tmp.to_string_lossy()
        )
    } else {
        format!(
            "claude --continue -p --settings '{}' < '{}'",
            perm_path,
            tmp.to_string_lossy()
        )
    };

    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };

    let result = std::process::Command::new(shell)
        .args([flag, &cmd])
        .current_dir(cwd)
        .env("PYTHONIOENCODING", "utf-8")
        .env("LANG", "en_US.UTF-8")
        .output();

    let _ = std::fs::remove_file(&tmp);

    match result {
        Ok(output) => {
            let text = String::from_utf8(output.stdout)
                .unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).to_string());
            let trimmed = text.trim();
            if trimmed.is_empty() {
                String::from_utf8_lossy(&output.stderr).trim().to_string()
            } else {
                trimmed.to_string()
            }
        }
        Err(e) => format!("Error: {}", e),
    }
}

#[tauri::command]
pub fn send_chat(state: State<AppState>, project: String, message: String) -> Value {
    if message.is_empty() {
        return json!({"status": "error", "error": "Empty message"});
    }

    let (_, pa_dir) = state.get_orch_dir();
    let cwd = if !project.is_empty() {
        state.docs_dir.join(&project)
    } else {
        pa_dir
    };

    if !project.is_empty() && !cwd.exists() {
        return json!({"status": "error", "error": format!("Project not found: {}", project)});
    }

    let chat_key = if project.is_empty() { "_orchestrator" } else { &project };
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

    let prompt = if project.is_empty() {
        build_orchestrator_context(&state) + &message
    } else {
        message.clone()
    };

    let perm_path = get_permission_path(&state, chat_key);
    set_activity(&state.root, chat_key, "chatting", &message[..message.len().min(50)]);

    let response = run_claude(&cwd, &prompt, &perm_path);

    clear_activity(&state.root, chat_key);

    // Save assistant response
    let ts2 = state.now_iso();
    let asst_entry = json!({"ts": ts2, "role": "assistant", "msg": response});
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true).open(&chat_file)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&asst_entry).unwrap_or_default())
        });

    // Check for delegation in PA response
    let mut final_response = response.clone();
    if project.is_empty() {
        if let Some((target, task)) = parse_delegation(&response) {
            let did = crate::commands::delegation::queue_delegation_internal(&state, &target, &task);
            final_response += &format!(
                "\n\n---\n**⏳ Awaiting approval to run in {}:**\n{}\n\n<delegation id=\"{}\" project=\"{}\"/>",
                target, task, did, target
            );
        }
    }

    json!({
        "status": "complete",
        "response": final_response,
        "project": chat_key,
        "ts": ts2,
    })
}

#[tauri::command]
pub async fn stream_chat(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    project: String,
    message: String,
) -> Result<Value, String> {
    if message.is_empty() {
        return Ok(json!({"status": "error", "error": "Empty message"}));
    }

    let (_, pa_dir) = state.get_orch_dir();
    let cwd = if !project.is_empty() {
        state.docs_dir.join(&project)
    } else {
        pa_dir
    };

    if !project.is_empty() && !cwd.exists() {
        return Ok(json!({"status": "error", "error": format!("Project not found: {}", project)}));
    }

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

    let prompt = if project.is_empty() {
        build_orchestrator_context(&state) + &message
    } else {
        message.clone()
    };

    let perm_path = get_permission_path(&state, &chat_key);
    set_activity(&state.root, &chat_key, "streaming", &message[..message.len().min(50)]);

    // Write prompt to temp file
    let tmp = std::env::temp_dir().join(format!("stream-{}.txt", std::process::id()));
    std::fs::write(&tmp, &prompt).map_err(|e| e.to_string())?;

    let cmd = if cfg!(target_os = "windows") {
        format!(
            "chcp 65001 >nul 2>&1 & claude --continue -p --output-format stream-json --verbose --include-partial-messages --settings \"{}\" < \"{}\"",
            perm_path, tmp.to_string_lossy()
        )
    } else {
        format!(
            "claude --continue -p --output-format stream-json --verbose --include-partial-messages --settings '{}' < '{}'",
            perm_path, tmp.to_string_lossy()
        )
    };

    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };

    // Spawn process and stream
    let mut child = std::process::Command::new(shell)
        .args([flag, &cmd])
        .current_dir(&cwd)
        .env("PYTHONIOENCODING", "utf-8")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let reader = std::io::BufReader::new(stdout);

    let mut full_response = String::new();
    for line in reader.lines() {
        match line {
            Ok(text) => {
                full_response.push_str(&text);
                full_response.push('\n');
                let _ = app.emit("chat-stream", json!({"text": text}));
            }
            Err(_) => break,
        }
    }

    let _ = child.wait();
    let _ = std::fs::remove_file(&tmp);

    clear_activity(&state.root, &chat_key);

    // Save full response
    let ts2 = state.now_iso();
    let asst_entry = json!({"ts": ts2, "role": "assistant", "msg": full_response.trim()});
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true).open(&chat_file)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&asst_entry).unwrap_or_default())
        });

    // Check for delegation
    if project.is_empty() {
        if let Some((target, task)) = parse_delegation(&full_response) {
            let did = crate::commands::delegation::queue_delegation_internal(&state, &target, &task);
            let report = format!(
                "\n\n---\n**⏳ Awaiting approval to run in {}:**\n{}\n\n<delegation id=\"{}\" project=\"{}\"/>",
                target, task, did, target
            );
            let _ = app.emit("chat-stream", json!({"text": report}));
        }
    }

    let _ = app.emit("chat-stream-done", json!({}));

    Ok(json!({"status": "complete"}))
}

fn parse_delegation(response: &str) -> Option<(String, String)> {
    let re = regex::Regex::new(r"\[DELEGATE:([^\]]+)\]\s*\n?(.*?)\n?\[/DELEGATE\]").ok()?;
    let caps = re.captures(response)?;
    Some((
        caps.get(1)?.as_str().trim().to_string(),
        caps.get(2)?.as_str().trim().to_string(),
    ))
}
