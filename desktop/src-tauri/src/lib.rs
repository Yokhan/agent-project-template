use std::path::PathBuf;
use std::process::Command as StdCommand;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, RunEvent, WindowEvent,
};

mod commands;

/// Shared state: the Python sidecar process handle
pub struct SidecarState {
    pub process: Mutex<Option<std::process::Child>>,
    pub port: u16,
}

/// Find the project root (two levels up from desktop/src-tauri/)
fn project_root() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    // In dev mode, we're in desktop/src-tauri/
    // Try to find the project root by looking for CLAUDE.md
    for ancestor in exe_dir.ancestors() {
        if ancestor.join("CLAUDE.md").exists() {
            return ancestor.to_path_buf();
        }
    }

    // Fallback: look relative to current working directory
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    for ancestor in cwd.ancestors() {
        if ancestor.join("CLAUDE.md").exists() {
            return ancestor.to_path_buf();
        }
    }

    cwd
}

/// Start the Python sidecar (serve.py) on the given port
fn start_sidecar(root: &PathBuf, port: u16) -> Option<std::process::Child> {
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
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port: u16 = std::env::var("AGENT_OS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3333);

    let root = project_root();
    println!("Agent OS starting — root: {:?}, port: {}", root, port);

    // Start the Python sidecar
    let sidecar_process = start_sidecar(&root, port);

    let sidecar_state = SidecarState {
        process: Mutex::new(sidecar_process),
        port,
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
            let sep = MenuItem::with_id(app, "sep", "────────────", false, None::<&str>)?;
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
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("tray-status-request", ());
                        }
                    }
                    "quit" => {
                        // Kill sidecar before exit
                        let state = app.state::<SidecarState>();
                        if let Ok(mut proc) = state.process.lock() {
                            if let Some(ref mut child) = *proc {
                                let _ = child.kill();
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

            // === Main Window — load dashboard from sidecar ===
            // The window is configured in tauri.conf.json to load the local UI files
            // In Phase 1 we proxy to the Python sidecar

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
            RunEvent::ExitRequested { api, .. } => {
                // Allow exit only from tray quit
                let _ = api;
            }
            _ => {}
        });
}
