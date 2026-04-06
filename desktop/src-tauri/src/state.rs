use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;

/// Cached scan result
pub struct ScanCache {
    pub data: Option<serde_json::Value>,
    pub updated: Option<Instant>,
}

impl Default for ScanCache {
    fn default() -> Self {
        Self {
            data: None,
            updated: None,
        }
    }
}

/// Running task info
#[derive(Clone, Serialize, Deserialize)]
pub struct RunningTask {
    pub action: String,
    pub detail: String,
    pub started: f64,
}

/// Pending delegation
#[derive(Clone, Serialize, Deserialize)]
pub struct Delegation {
    pub id: String,
    pub project: String,
    pub task: String,
    pub ts: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response: Option<String>,
    #[serde(default)]
    pub retries: u32,
}

/// Health history entry
#[derive(Clone, Serialize, Deserialize)]
pub struct HealthEntry {
    pub ts: String,
    pub project: String,
    pub warnings: u32,
    pub errors: u32,
}

/// Shared application state
pub struct AppState {
    pub root: PathBuf,
    pub docs_dir: PathBuf,
    pub config_path: PathBuf,
    pub chats_dir: PathBuf,
    pub n8n_url: String,
    pub start_time: Instant,

    // Caches
    pub scan_cache: Mutex<ScanCache>,
    pub segments: HashMap<String, Vec<String>>,
    pub project_segment: HashMap<String, String>,

    // Runtime state
    pub delegations: Mutex<HashMap<String, Delegation>>,
    pub health_history: Mutex<Vec<HealthEntry>>,
    pub monitoring_active: Mutex<bool>,
}

impl AppState {
    pub fn new(root: PathBuf) -> Self {
        let config_path = root.join("n8n").join("config.json");
        let docs_dir = Self::load_docs_dir(&config_path);
        let chats_dir = root.join("tasks").join("chats");
        let n8n_url =
            std::env::var("N8N_URL").unwrap_or_else(|_| "http://localhost:5678".to_string());

        // Load segments
        let segments_file = root.join("n8n").join("dashboard").join("segments.json");
        let (segments, project_segment) = Self::load_segments(&segments_file);

        // Ensure chats dir exists
        let _ = std::fs::create_dir_all(&chats_dir);

        Self {
            root,
            docs_dir,
            config_path,
            chats_dir,
            n8n_url,
            start_time: Instant::now(),
            scan_cache: Mutex::new(ScanCache::default()),
            segments,
            project_segment,
            delegations: Mutex::new(HashMap::new()),
            health_history: Mutex::new(Vec::new()),
            monitoring_active: Mutex::new(false),
        }
    }

    fn load_docs_dir(config_path: &PathBuf) -> PathBuf {
        if let Ok(content) = std::fs::read_to_string(config_path) {
            if let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(dir) = cfg.get("documents_dir").and_then(|v| v.as_str()) {
                    return PathBuf::from(dir);
                }
            }
        }
        dirs::document_dir().unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Documents"))
    }

    fn load_segments(
        path: &PathBuf,
    ) -> (HashMap<String, Vec<String>>, HashMap<String, String>) {
        let mut segments: HashMap<String, Vec<String>> = HashMap::new();
        let mut project_segment: HashMap<String, String> = HashMap::new();

        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(segs) = data.get("segments").and_then(|v| v.as_object()) {
                    for (seg_name, projects) in segs {
                        if let Some(arr) = projects.as_array() {
                            let names: Vec<String> = arr
                                .iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect();
                            for name in &names {
                                project_segment.insert(name.clone(), seg_name.clone());
                            }
                            segments.insert(seg_name.clone(), names);
                        }
                    }
                }
            }
        }

        (segments, project_segment)
    }

    pub fn get_orch_dir(&self) -> (String, PathBuf) {
        let mut orch_name = String::new();
        if let Ok(content) = std::fs::read_to_string(&self.config_path) {
            if let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(name) = cfg.get("orchestrator_project").and_then(|v| v.as_str()) {
                    orch_name = name.to_string();
                }
            }
        }

        if !orch_name.is_empty() {
            let orch_dir = self.docs_dir.join(&orch_name);
            if orch_dir.exists() {
                return (orch_name, orch_dir);
            }
        }

        (String::new(), self.root.clone())
    }

    pub fn now_iso(&self) -> String {
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
    }

    pub fn uptime_secs(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }
}
