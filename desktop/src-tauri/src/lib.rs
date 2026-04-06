use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};

mod commands;
mod scanner;
mod state;

/// Find the project root.
/// Priority: AGENT_OS_ROOT env → walk up from exe → walk up from cwd.
fn project_root() -> PathBuf {
    if let Ok(root) = std::env::var("AGENT_OS_ROOT") {
        let p = PathBuf::from(&root);
        if p.join("CLAUDE.md").exists() {
            return p;
        }
        eprintln!(
            "AGENT_OS_ROOT={} but CLAUDE.md not found there, falling back",
            root
        );
    }

    if let Ok(exe) = std::env::current_exe() {
        for ancestor in exe.ancestors().skip(1) {
            if ancestor.join("CLAUDE.md").exists() {
                return ancestor.to_path_buf();
            }
        }
    }

    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    for ancestor in cwd.ancestors() {
        if ancestor.join("CLAUDE.md").exists() {
            return ancestor.to_path_buf();
        }
    }

    eprintln!(
        "Warning: could not find project root. Using cwd: {:?}",
        cwd
    );
    cwd
}

pub fn run() {
    let root = project_root();
    println!("Agent OS v0.2.0 starting — root: {:?}", root);

    let app_state = state::AppState::new(root);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Agents
            commands::agents::get_agents,
            commands::agents::get_segments,
            // Feed & health
            commands::feed::get_feed,
            commands::feed::get_activity,
            commands::feed::get_health,
            commands::feed::get_plan,
            commands::feed::get_digest,
            commands::feed::get_project_plan,
            // Chat
            commands::chat::get_chats,
            commands::chat::get_chat_history,
            commands::chat::send_chat,
            commands::chat::stream_chat,
            // Delegation
            commands::delegation::get_delegations,
            commands::delegation::approve_delegation,
            commands::delegation::reject_delegation,
            commands::delegation::get_analytics,
            // Config
            commands::config::get_permissions,
            commands::config::set_permission,
            commands::config::get_health_history,
            commands::config::get_impact,
            commands::config::run_action,
            commands::config::get_modules,
            // Operations
            commands::ops::deploy_template,
            commands::ops::health_check,
            commands::ops::create_project,
            // Proxy
            commands::proxy::proxy_webhook,
        ])
        .setup(move |app| {
            // === System Tray ===
            let open_i =
                MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
            let status_i = MenuItem::with_id(app, "status", "Status", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i =
                MenuItem::with_id(app, "quit", "Quit Agent OS", true, None::<&str>)?;

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
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
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
                api.prevent_close();
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            _ => {}
        });
}
