use crate::SidecarState;
use tauri::State;

/// Return the port where the Python sidecar is running.
#[tauri::command]
pub fn get_sidecar_port(state: State<SidecarState>) -> u16 {
    state.port
}

/// Check if the Python sidecar process is still alive.
#[tauri::command]
pub fn get_sidecar_status(state: State<SidecarState>) -> String {
    let mut proc = match state.process.lock() {
        Ok(p) => p,
        Err(_) => return "error: lock poisoned".to_string(),
    };
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
    let mut proc = match state.process.lock() {
        Ok(p) => p,
        Err(_) => return "error: lock poisoned".to_string(),
    };

    // Kill existing process
    if let Some(ref mut child) = *proc {
        let _ = child.kill();
        let _ = child.wait();
    }

    // Reuse shared spawn logic
    match crate::spawn_sidecar(&state.root, state.port) {
        Some(child) => {
            *proc = Some(child);
            "restarted".to_string()
        }
        None => {
            *proc = None;
            "error: failed to start sidecar".to_string()
        }
    }
}
