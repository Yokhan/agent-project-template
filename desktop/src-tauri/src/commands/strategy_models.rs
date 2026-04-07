//! Strategy data models and persistence.

use crate::state::AppState;
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
pub struct Goal {
    pub id: String,
    pub title: String,
    pub description: String,
    pub deadline: Option<String>,
    pub status: String,
    pub projects: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Strategy {
    pub id: String,
    pub goal_id: String,
    pub title: String,
    pub plans: Vec<Plan>,
    pub status: String,
    pub created: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Plan {
    pub project: String,
    pub steps: Vec<Step>,
    pub priority: String,
    pub depends_on: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Step {
    pub id: String,
    pub task: String,
    pub status: String,
    pub response: Option<String>,
    pub depends_on: Vec<String>,
}

pub fn strategies_path(state: &AppState) -> std::path::PathBuf {
    state.root.join("tasks").join(".strategies.json")
}

pub fn goals_path(state: &AppState) -> std::path::PathBuf {
    state.root.join("tasks").join("goals.md")
}

pub fn load_strategies(state: &AppState) -> Vec<Strategy> {
    let path = strategies_path(state);
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

pub fn save_strategies(state: &AppState, strategies: &[Strategy]) {
    let path = strategies_path(state);
    let _ = std::fs::write(&path, serde_json::to_string_pretty(strategies).unwrap_or_default());
}
