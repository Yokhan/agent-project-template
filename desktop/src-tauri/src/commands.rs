use crate::SidecarState;
use tauri::State;

/// Return the port where the Python sidecar is running.
/// The frontend uses this to know where to send API requests.
#[tauri::command]
pub fn get_sidecar_port(state: State<SidecarState>) -> u16 {
    state.port
}

/// Check if the Python sidecar process is still alive.
#[tauri::command]
pub fn get_sidecar_status(state: State<SidecarState>) -> String {
    let mut proc = state.process.lock().unwrap();
    match *proc {
        Some(ref mut child) => match child.try_wait() {
            Ok(Some(status)) => format!("exited: {}", status),
            Ok(None) => "running".to_string(),
            Err(e) => format!("error: {}", e),
        },
        None => "not started".to_string(),
    }
}

/// Restart the Python sidecar.
#[tauri::command]
pub fn restart_sidecar(state: State<SidecarState>) -> String {
    let mut proc = state.process.lock().unwrap();

    // Kill existing process
    if let Some(ref mut child) = *proc {
        let _ = child.kill();
        let _ = child.wait();
    }

    // Find project root and restart
    let root = crate::project_root();
    let serve_py = root.join("n8n").join("dashboard").join("serve.py");

    if !serve_py.exists() {
        *proc = None;
        return "error: serve.py not found".to_string();
    }

    for python in &["python3", "python"] {
        match std::process::Command::new(python)
            .arg(&serve_py)
            .arg(state.port.to_string())
            .current_dir(&root)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
        {
            Ok(child) => {
                *proc = Some(child);
                return "restarted".to_string();
            }
            Err(_) => continue,
        }
    }

    *proc = None;
    "error: python not found".to_string()
}
