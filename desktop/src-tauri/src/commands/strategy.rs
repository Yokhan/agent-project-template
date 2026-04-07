//! Strategy engine: goals → strategies → plans → steps
//! PA thinks strategically about user's goals, treats projects as tools.

use crate::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;

#[derive(Clone, Serialize, Deserialize)]
pub struct Goal {
    pub id: String,
    pub title: String,
    pub description: String,
    pub deadline: Option<String>,
    pub status: String, // active, achieved, paused
    pub projects: Vec<String>, // contributing projects
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Strategy {
    pub id: String,
    pub goal_id: String,
    pub title: String,
    pub plans: Vec<Plan>,
    pub status: String, // draft, approved, executing, done, failed
    pub created: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Plan {
    pub project: String,
    pub steps: Vec<Step>,
    pub priority: String, // HIGH, MED, LOW
    pub depends_on: Vec<String>, // other project names that must complete first
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Step {
    pub id: String,
    pub task: String,
    pub status: String, // pending, approved, running, done, failed, skipped
    pub response: Option<String>,
    pub depends_on: Vec<String>, // step IDs within same project
}

fn strategies_path(state: &AppState) -> std::path::PathBuf {
    state.root.join("tasks").join(".strategies.json")
}

fn goals_path(state: &AppState) -> std::path::PathBuf {
    state.root.join("tasks").join("goals.md")
}

fn load_strategies(state: &AppState) -> Vec<Strategy> {
    let path = strategies_path(state);
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

fn save_strategies(state: &AppState, strategies: &[Strategy]) {
    let path = strategies_path(state);
    let _ = std::fs::write(&path, serde_json::to_string_pretty(strategies).unwrap_or_default());
}

/// Get all goals from goals.md
#[tauri::command]
pub fn get_goals(state: State<AppState>) -> Value {
    let path = goals_path(&state);
    let mut goals: Vec<Goal> = Vec::new();

    if let Ok(content) = std::fs::read_to_string(&path) {
        let mut current: Option<Goal> = None;
        for line in content.lines() {
            if line.starts_with("## ") {
                if let Some(g) = current.take() {
                    goals.push(g);
                }
                let title = line[3..].trim();
                let id = title.to_lowercase().replace(' ', "-");
                current = Some(Goal {
                    id,
                    title: title.to_string(),
                    description: String::new(),
                    deadline: None,
                    status: "active".to_string(),
                    projects: Vec::new(),
                });
            } else if let Some(ref mut g) = current {
                let trimmed = line.trim();
                if trimmed.starts_with("Deadline:") {
                    g.deadline = Some(trimmed[9..].trim().to_string());
                } else if trimmed.starts_with("Status:") {
                    g.status = trimmed[7..].trim().to_lowercase();
                } else if trimmed.starts_with("Projects:") {
                    g.projects = trimmed[9..].split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                } else if !trimmed.is_empty() && !trimmed.starts_with('#') {
                    if !g.description.is_empty() {
                        g.description.push('\n');
                    }
                    g.description.push_str(trimmed);
                }
            }
        }
        if let Some(g) = current {
            goals.push(g);
        }
    }

    json!({"goals": goals})
}

/// Save a goal
#[tauri::command]
pub fn save_goal(state: State<AppState>, title: String, description: String, deadline: Option<String>, projects: Vec<String>) -> Value {
    let path = goals_path(&state);
    let entry = format!(
        "\n## {}\n{}\nDeadline: {}\nStatus: active\nProjects: {}\n",
        title,
        description,
        deadline.as_deref().unwrap_or("none"),
        projects.join(", "),
    );

    match std::fs::OpenOptions::new()
        .create(true).append(true).open(&path)
        .and_then(|mut f| {
            use std::io::Write;
            write!(f, "{}", entry)
        }) {
        Ok(_) => json!({"status": "ok"}),
        Err(e) => json!({"status": "error", "error": e.to_string()}),
    }
}

/// Get all strategies
#[tauri::command]
pub fn get_strategies(state: State<AppState>) -> Value {
    json!({"strategies": load_strategies(&state)})
}

/// Generate a strategy via PA (claude -p)
/// PA analyzes goal + projects → creates multi-project plan
#[tauri::command]
pub async fn generate_strategy(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    goal: String,
    context: Option<String>,
) -> Result<Value, String> {
    let (_, pa_dir) = state.get_orch_dir();
    let agents = crate::scanner::scan_projects(&state.docs_dir, &state.project_segment);
    let project_list: Vec<String> = agents.iter().map(|a| {
        format!("- {}: {} (branch: {}, {} uncommitted, {})",
            a.name, if a.task.is_empty() { "idle" } else { &a.task },
            if a.branch.is_empty() { "?" } else { &a.branch },
            a.uncommitted, if a.blockers { "BLOCKED" } else { "ok" })
    }).collect();

    let prompt = format!(
        r#"[STRATEGY MODE]
You are a strategic orchestrator. The user's goal:

GOAL: {}
{}

Available projects and their current state:
{}

Generate a JSON strategy with this EXACT format (nothing else, just JSON):
{{
  "title": "Strategy title",
  "plans": [
    {{
      "project": "ProjectName",
      "priority": "HIGH",
      "depends_on": [],
      "steps": [
        {{"task": "Specific task description", "depends_on": []}}
      ]
    }}
  ]
}}

Rules:
- Only include projects that contribute to this goal
- Order by dependency: if Project A needs API from Project B, B goes first
- Each step must be a SINGLE atomic task (one file change or one command)
- Maximum 5 steps per project
- Steps will execute in separate fresh sessions — include enough context in each step
- Think about what ACTUALLY moves the needle toward the goal
- Be token-efficient: don't add unnecessary research steps, trust project's CLAUDE.md
"#,
        goal,
        context.as_deref().unwrap_or(""),
        project_list.join("\n"),
    );

    let perm_path = crate::commands::chat::get_permission_path_pub(&state, "_orchestrator");
    let tmp = crate::commands::chat::unique_tmp_pub("strategy");
    std::fs::write(&tmp, &prompt).map_err(|e| e.to_string())?;

    let stdin_file = std::fs::File::open(&tmp).map_err(|e| e.to_string())?;
    let output = std::process::Command::new("claude")
        .args(["-p", "--settings", &perm_path])
        .current_dir(&pa_dir)
        .stdin(std::process::Stdio::from(stdin_file))
        .env("PYTHONIOENCODING", "utf-8")
        .output()
        .map_err(|e| e.to_string())?;

    let _ = std::fs::remove_file(&tmp);
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Try to parse JSON from response (might be wrapped in markdown)
    let json_str = text
        .find('{')
        .and_then(|start| text.rfind('}').map(|end| &text[start..=end]))
        .unwrap_or(&text);

    let strategy_data: Value = serde_json::from_str(json_str)
        .unwrap_or(json!({"error": "PA did not return valid JSON", "raw": text}));

    if strategy_data.get("error").is_some() {
        return Ok(strategy_data);
    }

    // Build Strategy struct
    let id = format!("{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis()).unwrap_or(0));

    let plans: Vec<Plan> = strategy_data.get("plans")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|p| {
            let project = p.get("project")?.as_str()?.to_string();
            let priority = p.get("priority")?.as_str().unwrap_or("MED").to_string();
            let depends_on: Vec<String> = p.get("depends_on")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let steps: Vec<Step> = p.get("steps")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().enumerate().map(|(i, s)| {
                    Step {
                        id: format!("{}-{}", project, i),
                        task: s.get("task").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        status: "pending".to_string(),
                        response: None,
                        depends_on: s.get("depends_on")
                            .and_then(|v| v.as_array())
                            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                            .unwrap_or_default(),
                    }
                }).collect())
                .unwrap_or_default();
            Some(Plan { project, steps, priority, depends_on })
        }).collect())
        .unwrap_or_default();

    let strategy = Strategy {
        id: id.clone(),
        goal_id: goal.to_lowercase().replace(' ', "-"),
        title: strategy_data.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string(),
        plans,
        status: "draft".to_string(),
        created: state.now_iso(),
    };

    // Save
    let mut strategies = load_strategies(&state);
    strategies.push(strategy.clone());
    save_strategies(&state, &strategies);

    let _ = tauri::Emitter::emit(&app, "strategy-generated", json!({"id": id}));

    Ok(json!({"status": "ok", "strategy": strategy}))
}

/// Approve specific steps in a strategy
#[tauri::command]
pub fn approve_strategy_steps(state: State<AppState>, strategy_id: String, approved_steps: Vec<String>) -> Value {
    let mut strategies = load_strategies(&state);
    let s = match strategies.iter_mut().find(|s| s.id == strategy_id) {
        Some(s) => s,
        None => return json!({"status": "error", "error": "Strategy not found"}),
    };

    for plan in &mut s.plans {
        for step in &mut plan.steps {
            if approved_steps.contains(&step.id) {
                step.status = "approved".to_string();
            } else if step.status == "pending" {
                step.status = "skipped".to_string();
            }
        }
    }
    s.status = "approved".to_string();
    save_strategies(&state, &strategies);

    json!({"status": "ok"})
}

/// Execute next available step in an approved strategy
#[tauri::command]
pub fn execute_strategy_step(state: State<AppState>, strategy_id: String) -> Value {
    let mut strategies = load_strategies(&state);
    let s = match strategies.iter_mut().find(|s| s.id == strategy_id) {
        Some(s) if s.status == "approved" || s.status == "executing" => s,
        _ => return json!({"status": "error", "error": "Strategy not found or not approved"}),
    };

    s.status = "executing".to_string();

    // Find next executable step (approved + all dependencies done)
    let mut next_step: Option<(String, String, String)> = None; // (project, step_id, task)

    for plan in &s.plans {
        // Check project-level dependencies
        let project_deps_done = plan.depends_on.iter().all(|dep_proj| {
            s.plans.iter()
                .filter(|p| p.project == *dep_proj)
                .all(|p| p.steps.iter().all(|st| st.status == "done" || st.status == "skipped"))
        });
        if !project_deps_done {
            continue;
        }

        for step in &plan.steps {
            if step.status != "approved" {
                continue;
            }
            // Check step-level dependencies
            let step_deps_done = step.depends_on.iter().all(|dep_id| {
                plan.steps.iter().any(|st| st.id == *dep_id && (st.status == "done" || st.status == "skipped"))
            });
            if step_deps_done {
                next_step = Some((plan.project.clone(), step.id.clone(), step.task.clone()));
                break;
            }
        }
        if next_step.is_some() {
            break;
        }
    }

    let (project, step_id, task) = match next_step {
        Some(n) => n,
        None => {
            // No more steps — strategy complete
            s.status = "done".to_string();
            save_strategies(&state, &strategies);
            return json!({"status": "complete", "message": "All steps executed"});
        }
    };

    // Build context from completed steps BEFORE marking as running (borrow checker)
    let prev_context: Vec<String> = s.plans.iter()
        .filter(|p| p.project == project)
        .flat_map(|p| p.steps.iter())
        .filter(|st| st.status == "done" && st.response.is_some())
        .map(|st| format!("Previously: {} → Result: {}", st.task, st.response.as_deref().unwrap_or("")
            .chars().take(150).collect::<String>()))
        .collect();

    // Mark step as running
    for plan in &mut s.plans {
        for step in &mut plan.steps {
            if step.id == step_id {
                step.status = "running".to_string();
            }
        }
    }
    save_strategies(&state, &strategies);

    // Execute via claude -p (FRESH context — no --continue)
    let project_dir = match state.validate_project(&project) {
        Ok(p) => p,
        Err(e) => return json!({"status": "error", "error": e}),
    };

    // Compose prompt: context + task + token policy
    let prompt = if prev_context.is_empty() {
        format!("[TASK] {}\n\n[RULES] Be concise. One task only. No unnecessary file reads. \
                 Output result, not process. If done, say DONE + what changed.", task)
    } else {
        format!("[CONTEXT FROM PREVIOUS STEPS]\n{}\n\n[TASK] {}\n\n\
                 [RULES] Be concise. One task only. No unnecessary file reads. \
                 Don't re-read files mentioned in context unless you need to modify them. \
                 Output result, not process. If done, say DONE + what changed.",
                prev_context.join("\n"), task)
    };

    let perm_path = crate::commands::chat::get_permission_path_pub(&state, &project);
    let response = crate::commands::chat::run_claude_pub(&project_dir, &prompt, &perm_path);

    // Save to project chat
    let chat_file = state.chats_dir.join(format!("{}.jsonl", project));
    let ts = state.now_iso();
    let user_entry = json!({"ts": ts, "role": "user", "msg": format!("[strategy] {}", task)});
    let asst_entry = json!({"ts": state.now_iso(), "role": "assistant", "msg": response});
    let _ = std::fs::OpenOptions::new()
        .create(true).append(true).open(&chat_file)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "{}", serde_json::to_string(&user_entry).unwrap_or_default())?;
            writeln!(f, "{}", serde_json::to_string(&asst_entry).unwrap_or_default())
        });

    // Update step status
    let mut strategies = load_strategies(&state);
    if let Some(s) = strategies.iter_mut().find(|s| s.id == strategy_id) {
        for plan in &mut s.plans {
            for step in &mut plan.steps {
                if step.id == step_id {
                    step.status = if response.starts_with("Error:") || response.starts_with("Error running") { "failed".to_string() } else { "done".to_string() };
                    step.response = Some(response[..response.len().min(500)].to_string());
                }
            }
        }
    }
    save_strategies(&state, &strategies);

    json!({
        "status": "step_done",
        "project": project,
        "step_id": step_id,
        "response": response[..response.len().min(200)].to_string(),
    })
}
