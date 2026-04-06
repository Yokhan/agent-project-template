use std::path::PathBuf;
use std::process::Command as StdCommand;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};

mod commands;

/// Shared state: the Python sidecar process handle
pub struct SidecarState {
    pub process: Mutex<Option<std::process::Child>>,
    pub port: u16,
    pub root: PathBuf,
}

impl Drop for SidecarState {
    fn drop(&mut self) {
        if let Ok(mut proc) = self.process.lock() {
            if let Some(ref mut child) = *proc {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

/// Find the project root.
/// Priority: AGENT_OS_ROOT env → walk up from exe → walk up from cwd.
fn project_root() -> PathBuf {
    // 1. Explicit env var — most reliable for installed apps
    if let Ok(root) = std::env::var("AGENT_OS_ROOT") {
        let p = PathBuf::from(&root);
        if p.join("n8n").join("dashboard").join("serve.py").exists() {
            return p;
        }
        eprintln!("AGENT_OS_ROOT={} but serve.py not found there, falling back", root);
    }

    // 2. Walk up from executable location
    if let Ok(exe) = std::env::current_exe() {
        for ancestor in exe.ancestors().skip(1) {
            if ancestor.join("CLAUDE.md").exists() {
                return ancestor.to_path_buf();
            }
        }
    }

    // 3. Walk up from current working directory
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    for ancestor in cwd.ancestors() {
        if ancestor.join("CLAUDE.md").exists() {
            return ancestor.to_path_buf();
        }
    }

    eprintln!("Warning: could not find project root (no CLAUDE.md found). Using cwd: {:?}", cwd);
    cwd
}

/// Spawn the Python sidecar (serve.py) on the given port.
/// Returns None if Python is not found or serve.py doesn't exist.
pub fn spawn_sidecar(root: &PathBuf, port: u16) -> Option<std::process::Child> {
    let serve_py = root.join("n8n").join("dashboard").join("serve.py");
    if !serve_py.exists() {
        eprintln!("serve.py not found at {:?}", serve_py);
        return None;
    }

    // Try python3 first, then python
    for python in &["python3", "python"] {
        match StdCommand::new(python)
            .arg(&serve_py)
            .arg(port.to_string())
            .current_dir(root)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::inherit())
            .spawn()
        {
            Ok(child) => {
                println!("Sidecar started: {} serve.py on port {}", python, port);
                return Some(child);
            }
            Err(_) => continue,
        }
    }

    eprintln!("Failed to start sidecar: python not found");
    None
}

pub fn run() {
    let port: u16 = std::env::var("AGENT_OS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3333);

    let root = project_root();
    println!("Agent OS starting — root: {:?}, port: {}", root, port);

    // Start the Python sidecar
    let sidecar_process = spawn_sidecar(&root, port);

    let sidecar_state = SidecarState {
        process: Mutex::new(sidecar_process),
        port,
        root,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .manage(sidecar_state)
        .invoke_handler(tauri::generate_handler![
            commands::get_sidecar_port,
            commands::get_sidecar_status,
            commands::restart_sidecar,
        ])
        .setup(move |app| {
            // === System Tray ===
            let open_i = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
            let status_i = MenuItem::with_id(app, "status", "Status", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Agent OS", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&open_i, &status_i, &sep, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Agent OS — Command Center")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "status" => {
                        // Show status via notification
                        let state = app.state::<SidecarState>();
                        let status = match state.process.lock() {
                            Ok(mut proc) => match *proc {
                                Some(ref mut child) => match child.try_wait() {
                                    Ok(Some(s)) => format!("Sidecar exited: {}", s),
                                    Ok(None) => format!("Running on port {}", state.port),
                                    Err(e) => format!("Error: {}", e),
                                },
                                None => "Sidecar not started".to_string(),
                            },
                            Err(_) => "State lock error".to_string(),
                        };
                        eprintln!("Status: {}", status);
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        // Kill sidecar before exit
                        let state = app.state::<SidecarState>();
                        if let Ok(mut proc) = state.process.lock() {
                            if let Some(ref mut child) = *proc {
                                let _ = child.kill();
                                let _ = child.wait();
                            }
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building Agent OS")
        .run(|app_handle, event| match event {
            RunEvent::WindowEvent {
                label,
                event: WindowEvent::CloseRequested { api, .. },
                ..
            } if label == "main" => {
                // Don't quit on window close — minimize to tray instead
                api.prevent_close();
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            _ => {}
        });
}
