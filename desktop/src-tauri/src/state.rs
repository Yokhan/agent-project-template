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

/// Shared application state
pub struct AppState {
    pub root: PathBuf,
    pub docs_dir: PathBuf,
    pub config_path: PathBuf,
    pub chats_dir: PathBuf,
    pub delegations_path: PathBuf,
    pub n8n_url: String,
    pub start_time: Instant,

    // Caches
    pub scan_cache: Mutex<ScanCache>,
    pub segments: Mutex<HashMap<String, Vec<String>>>,
    pub project_segment: HashMap<String, String>,

    // Runtime state
    pub delegations: Mutex<HashMap<String, Delegation>>,
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

        let delegations_path = root.join("tasks").join(".delegations.json");

        // Load persisted delegations, reset "running" to "pending"
        let delegations = Self::load_delegations(&delegations_path);

        Self {
            root,
            docs_dir,
            config_path,
            chats_dir,
            delegations_path,
            n8n_url,
            start_time: Instant::now(),
            scan_cache: Mutex::new(ScanCache::default()),
            segments: Mutex::new(segments),
            project_segment,
            delegations: Mutex::new(delegations),
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

    fn load_delegations(path: &PathBuf) -> HashMap<String, Delegation> {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(mut map) = serde_json::from_str::<HashMap<String, Delegation>>(&content) {
                // Reset "running" to "pending" on restart
                for d in map.values_mut() {
                    if d.status == "running" {
                        d.status = "pending".to_string();
                    }
                }
                return map;
            }
        }
        HashMap::new()
    }

    /// Validate project name — no path traversal, must exist under docs_dir
    pub fn validate_project(&self, project: &str) -> Result<std::path::PathBuf, String> {
        // Block path traversal
        if project.contains("..") || project.contains('/') || project.contains('\\')
            || project.contains(':') || project.contains('\0') {
            return Err(format!("Invalid project name: {}", project));
        }
        let path = self.docs_dir.join(project);
        if !path.exists() {
            return Err(format!("Project not found: {}", project));
        }
        // Canonicalize and verify containment
        let canon = path.canonicalize().map_err(|e| e.to_string())?;
        let docs_canon = self.docs_dir.canonicalize().map_err(|e| e.to_string())?;
        if !canon.starts_with(&docs_canon) {
            return Err(format!("Project path escapes documents dir: {}", project));
        }
        Ok(canon)
    }

    /// Validate project name from LLM output against known project list
    pub fn validate_project_name_from_llm(&self, name: &str) -> Option<String> {
        let projects = crate::scanner::scan_projects(&self.docs_dir, &self.project_segment);
        projects.iter().find(|p| p.name.eq_ignore_ascii_case(name)).map(|p| p.name.clone())
    }

    pub fn save_delegations(&self) {
        if let Ok(delegations) = self.delegations.lock() {
            let _ = std::fs::write(
                &self.delegations_path,
                serde_json::to_string_pretty(&*delegations).unwrap_or_default(),
            );
        }
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
