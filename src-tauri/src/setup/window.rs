//! Main window creation: theme injection, initialization scripts,
//! and close event handling.

use crate::terminal::manager::TerminalManager;
use crate::theme::colors::theme_to_color;
use crate::theme::inject::build_initialization_script;
use tauri::{Listener, Manager};

/// Create the main window with theme injection and register the close handler.
/// Must be called after all state (DbManager, DownloadManager, GithubClient,
/// TerminalManager) has been registered via `app.manage()`.
pub fn create_main_window(app: &tauri::AppHandle, initial_theme: &str) {
    // Build initialization script for the main window (runs BEFORE HTML is parsed)
    let init_script = build_initialization_script(initial_theme);

    // Inject dev mode flag for frontend banner
    let dev_mode = cfg!(debug_assertions);
    let dev_script = format!(r#"window.__DEV_MODE__={};"#, dev_mode);

    // Create main window with theme injection via initialization_script
    let bg_color = theme_to_color(initial_theme);
    let main_window = tauri::WebviewWindow::builder(app, "main", tauri::WebviewUrl::App("index.html".into()))
        .title("Llama Manager")
        .inner_size(1280.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .fullscreen(false)
        .decorations(true)
        .theme(Some(tauri::Theme::Dark))
        .background_color(bg_color)
        .initialization_script(&init_script)
        .initialization_script(&dev_script)
        .build()
        .expect("Failed to create main window");

    // Handle main window close: kill terminals + close terminal widget
    let app_handle = app.clone();
    main_window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            log::info!("[APP] CloseRequested: killing all terminal sessions");
            let terminal = app_handle.state::<TerminalManager>();
            terminal.kill_all();
            if let Some(widget) = app_handle.get_webview_window("terminal") {
                let _ = widget.close();
            }
        }
    });
}

/// Register the tauri://destroy listener that kills all terminal sessions
/// on app shutdown.
pub fn register_destroy_listener(app: &tauri::AppHandle) {
    let app_handle = app.clone();
    app_handle.clone().listen("tauri://destroy", move |_| {
        let terminal = app_handle.state::<TerminalManager>();
        terminal.kill_all();
    });
}
