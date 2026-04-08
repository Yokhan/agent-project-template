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

/// Build orchestrator context prefix for PA — uses scan cache instead of re-scanning
fn build_orchestrator_context(state: &AppState) -> String {
    // Use cached scan data (refreshed every 30s by frontend polling)
    let projects = {
        let cache = state.scan_cache.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(data) = &cache.data {
            if let Some(arr) = data.as_array() {
                arr.iter()
                    .filter_map(|v| {
                        let name = v.get("name")?.as_str()?;
                        let status = v.get("status")?.as_str().unwrap_or("idle");
                        let blockers = v.get("blockers")?.as_bool().unwrap_or(false);
                        Some((name.to_string(), status.to_string(), blockers))
                    })
                    .collect::<Vec<_>>()
            } else {
                Vec::new()
            }
        } else {
            // Cache empty — do a fresh scan
            let scanned = crate::scanner::scan_projects(&state.docs_dir, &state.project_segment);
            scanned.iter().map(|p| (p.name.clone(), p.status.clone(), p.blockers)).collect()
        }
    };

    let names: Vec<&str> = projects.iter().map(|p| p.0.as_str()).take(10).collect();
    let working: Vec<&str> = projects.iter().filter(|p| p.1 == "working").map(|p| p.0.as_str()).collect();
    let blocked: Vec<&str> = projects.iter().filter(|p| p.2).map(|p| p.0.as_str()).collect();

    format!(
        "[CONTEXT: You are PA Orchestrator managing {} projects.\n\
         Projects: {}\n\
         Working: {}. Blocked: {}.\n\
         COMMANDS:\n\
         - [DELEGATE:ProjectName]\\ntask\\n[/DELEGATE] — send task to project agent\n\
         - [DEPLOY:ProjectName] — sync template to project\n\
         - [HEALTH_CHECK:ProjectName] or [HEALTH_CHECK:all] — run health check\n\
         Be concise. Formulate clear tasks when delegating.]\n\n",
        projects.len(),
        names.join(", "),
        if working.is_empty() { "none".to_string() } else { working.join(", ") },
        if blocked.is_empty() { "none".to_string() } else { blocked.join(", ") },
    )
}


use super::claude_runner::{unique_tmp, run_claude, run_claude_with_opts, get_permission_path, set_activity, clear_activity};

#[tauri::command]
pub async fn send_chat(
    state: State<'_, AppState>,
    project: String,
    message: String,
    model: Option<String>,
    reasoning_effort: Option<String>,
) -> Result<Value, String> {
    if message.is_empty() {
        return Ok(json!({"status": "error", "error": "Empty message"}));
    }

    let (_, pa_dir) = state.get_orch_dir();
    let cwd = if !project.is_empty() {
        match state.validate_project(&project) {
            Ok(p) => p,
            Err(e) => return Ok(json!({"status": "error", "error": e})),
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

    let prompt = if project.is_empty() {
        build_orchestrator_context(&state) + &message
    } else {
        message.clone()
    };

    let perm_path = get_permission_path(&state, &chat_key);
    set_activity(&state.root, &chat_key, "chatting", &message[..message.len().min(50)]);

    let response = run_claude_with_opts(
        &cwd, &prompt, &perm_path,
        model.as_deref(), reasoning_effort.as_deref(),
    );

    clear_activity(&state.root, &chat_key);

    // Save assistant response
    let ts2 = state.now_iso();
    let asst_entry = json!({"ts": ts2, "role": "assistant", "msg": response});
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true).open(&chat_file)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&asst_entry).unwrap_or_default())
        });

    // Check for delegation in PA response — validate project name against known list
    let mut final_response = response.clone();
    if project.is_empty() {
        if let Some((target, task)) = parse_delegation(&response) {
            if let Some(valid_name) = state.validate_project_name_from_llm(&target) {
                let did = crate::commands::delegation::queue_delegation_internal(&state, &valid_name, &task);
                final_response += &format!(
                    "\n\n---\n**⏳ Awaiting approval to run in {}:**\n{}\n\n<delegation id=\"{}\" project=\"{}\"/>",
                    valid_name, task, did, valid_name
                );
            } else {
                final_response += &format!("\n\n---\n**⚠ Unknown project in delegation: {}**", target);
            }
        }
    }

    // Check for DEPLOY/HEALTH_CHECK — validate project names
    if project.is_empty() {
        if let Some(target) = parse_deploy(&response) {
            if state.validate_project(&target).is_ok() {
                let result = crate::commands::ops::execute_deploy_inline(&state.root, &state.docs_dir, &target);
                final_response += &format!("\n\n---\n**Deploy {}:** {}", target, result);
            }
        }
        if let Some(target) = parse_health_check(&response) {
            if target == "all" || state.validate_project(&target).is_ok() {
                let result = crate::commands::ops::execute_health_inline(&state.docs_dir, &target);
                final_response += &format!("\n\n---\n**Health Check:**\n{}", result);
            }
        }
    }

    Ok(json!({
        "status": "complete",
        "response": final_response,
        "project": chat_key,
        "ts": ts2,
    }))
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
        match state.validate_project(&project) {
            Ok(p) => p,
            Err(e) => return Ok(json!({"status": "error", "error": e})),
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

    let prompt = if project.is_empty() {
        build_orchestrator_context(&state) + &message
    } else {
        message.clone()
    };

    let perm_path = get_permission_path(&state, &chat_key);
    set_activity(&state.root, &chat_key, "streaming", &message[..message.len().min(50)]);

    // Stream buffer file — frontend polls this
    let stream_buf = state.root.join("tasks").join(".stream-buffer.jsonl");
    let _ = std::fs::write(&stream_buf, ""); // Clear buffer

    let tmp = unique_tmp("stream");
    std::fs::write(&tmp, &prompt).map_err(|e| e.to_string())?;
    let stdin_file = std::fs::File::open(&tmp).map_err(|e| e.to_string())?;

    let claude_bin = super::claude_runner::find_claude();
    let mut child = std::process::Command::new(&claude_bin)
        .args(["--continue", "-p", "--output-format", "stream-json", "--verbose", "--settings", &perm_path])
        .current_dir(&cwd)
        .stdin(std::process::Stdio::from(stdin_file))
        .env("PYTHONIOENCODING", "utf-8")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let reader = std::io::BufReader::new(stdout);

    let mut full_text = String::new();
    let mut tool_blocks: Vec<Value> = Vec::new();
    // Track content blocks seen to emit individual events in order
    let mut last_emitted_text = String::new();

    // Read stdout line by line, parse stream-json, write individual events to buffer
    {
        let mut buf_file = std::fs::OpenOptions::new()
            .create(true).append(true).open(&stream_buf)
            .map_err(|e| e.to_string())?;

        use std::io::Write;

        for line in reader.lines() {
            let Ok(raw) = line else { break };
            let trimmed = raw.trim_end_matches('\r');
            if trimmed.is_empty() { continue; }

            if let Ok(evt) = serde_json::from_str::<Value>(trimmed) {
                let etype = evt.get("type").and_then(|t| t.as_str()).unwrap_or("");

                if etype == "assistant" {
                    if let Some(content) = evt.pointer("/message/content").and_then(|c| c.as_array()) {
                        // Emit each content block as a SEPARATE event (text, tool_use, tool_result)
                        for block in content {
                            match block.get("type").and_then(|t| t.as_str()) {
                                Some("text") => {
                                    let text = block.get("text").and_then(|t| t.as_str()).unwrap_or("");
                                    full_text = text.to_string();
                                    // Only emit if new text appeared
                                    if text != last_emitted_text {
                                        let _ = writeln!(buf_file, "{}", serde_json::to_string(&json!({
                                            "type": "text",
                                            "text": text,
                                        })).unwrap_or_default());
                                        let _ = buf_file.flush();
                                        last_emitted_text = text.to_string();
                                    }
                                }
                                Some("tool_use") => {
                                    let tool = block.get("name").and_then(|n| n.as_str()).unwrap_or("?");
                                    let input = block.get("input").cloned().unwrap_or(json!({}));
                                    let tb = json!({"tool": tool, "input": input});
                                    tool_blocks.push(tb.clone());
                                    // Emit tool as separate event
                                    let _ = writeln!(buf_file, "{}", serde_json::to_string(&json!({
                                        "type": "tool_use",
                                        "tool": tool,
                                        "input": input,
                                    })).unwrap_or_default());
                                    let _ = buf_file.flush();
                                }
                                Some("tool_result") => {
                                    let content_val = block.get("content").and_then(|c| c.as_str()).unwrap_or("");
                                    let is_error = block.get("is_error").and_then(|e| e.as_bool()).unwrap_or(false);
                                    let _ = writeln!(buf_file, "{}", serde_json::to_string(&json!({
                                        "type": "tool_result",
                                        "content": &content_val[..content_val.len().min(500)],
                                        "is_error": is_error,
                                    })).unwrap_or_default());
                                    let _ = buf_file.flush();
                                }
                                _ => {}
                            }
                        }
                    }
                } else if etype == "system" {
                    let subtype = evt.get("subtype").and_then(|s| s.as_str()).unwrap_or("");
                    let _ = writeln!(buf_file, "{}", serde_json::to_string(&json!({
                        "type": "system",
                        "system": subtype,
                    })).unwrap_or_default());
                    let _ = buf_file.flush();
                } else if etype == "result" {
                    let rt = evt.get("result").and_then(|r| r.as_str()).unwrap_or("");
                    if !rt.is_empty() && full_text.is_empty() { full_text = rt.to_string(); }
                    let _ = writeln!(buf_file, "{}", serde_json::to_string(&json!({
                        "type": "result",
                        "cost": evt.get("total_cost_usd"),
                        "duration_ms": evt.get("duration_ms"),
                        "tokens": evt.get("usage").and_then(|u| u.get("total_tokens")),
                    })).unwrap_or_default());
                    let _ = buf_file.flush();
                }
            }
        }
    }

    let _ = child.wait();
    let _ = std::fs::remove_file(&tmp);
    clear_activity(&state.root, &chat_key);

    // Save full response
    let ts2 = state.now_iso();
    let asst_entry = json!({"ts": ts2, "role": "assistant", "msg": full_text.trim(), "tools": tool_blocks});
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true).open(&chat_file)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&asst_entry).unwrap_or_default())
        });

    // Check delegation
    if project.is_empty() {
        if let Some((target, task)) = parse_delegation(&full_text) {
            if let Some(valid_name) = state.validate_project_name_from_llm(&target) {
                let did = crate::commands::delegation::queue_delegation_internal(&state, &valid_name, &task);
                // Append delegation marker to buffer
                let _ = std::fs::OpenOptions::new().append(true).open(&stream_buf)
                    .and_then(|mut f| {
                        use std::io::Write;
                        writeln!(f, "{}", serde_json::to_string(&json!({"type":"delegation","project":valid_name,"task":task,"id":did})).unwrap_or_default())
                    });
            }
        }
    }

    // Write "done" marker
    let _ = std::fs::OpenOptions::new().append(true).open(&stream_buf)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&json!({"type":"done","text":full_text.trim(),"tools":tool_blocks})).unwrap_or_default())
        });

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


/// Poll stream buffer — frontend calls this every 300ms during streaming
#[tauri::command]
pub fn poll_stream(state: State<AppState>, offset: usize) -> Value {
    let buf_path = state.root.join("tasks").join(".stream-buffer.jsonl");
    let content = std::fs::read_to_string(&buf_path).unwrap_or_default();
    let lines: Vec<&str> = content.lines().collect();

    if offset >= lines.len() {
        return json!({"events": [], "offset": offset, "done": false});
    }

    let new_lines = &lines[offset..];
    let mut events: Vec<Value> = Vec::new();
    let mut done = false;

    for line in new_lines {
        if let Ok(evt) = serde_json::from_str::<Value>(line) {
            if evt.get("type").and_then(|t| t.as_str()) == Some("done") {
                done = true;
            }
            events.push(evt);
        }
    }

    json!({"events": events, "offset": lines.len(), "done": done})
}

fn parse_deploy(response: &str) -> Option<String> {
    let re = regex::Regex::new(r"\[DEPLOY:([^\]]+)\]").ok()?;
    Some(re.captures(response)?.get(1)?.as_str().trim().to_string())
}

fn parse_health_check(response: &str) -> Option<String> {
    let re = regex::Regex::new(r"\[HEALTH_CHECK:([^\]]+)\]").ok()?;
    Some(re.captures(response)?.get(1)?.as_str().trim().to_string())
}
