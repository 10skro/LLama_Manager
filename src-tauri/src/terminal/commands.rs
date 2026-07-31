use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri::webview::Color;

use crate::db::connection::DbManager;
use crate::db::repo;
use crate::terminal::manager::{ActiveTerminalInfo, TerminalManager};
use crate::theme::colors::theme_to_color;

/// Spawn a new terminal session for a given config/version.
#[tauri::command]
pub fn spawn_terminal(
    app: AppHandle,
    state_terminal: State<'_, TerminalManager>,
    config_id: String,
    version_id: i64,
    working_dir: String,
    startup_command: Option<String>,
) -> Result<String, String> {
    state_terminal.spawn(app, config_id, version_id, working_dir, startup_command)
}

/// Kill a terminal session.
/// Runs taskkill synchronously (Tauri IPC already executes on a separate thread).
/// Emits a "terminal-exit" event once the process tree is confirmed dead.
#[tauri::command]
pub fn kill_terminal(
    app: AppHandle,
    state_terminal: State<'_, TerminalManager>,
    session_id: String,
) -> Result<String, String> {
    state_terminal.kill(app, &session_id)
}

/// List all active terminal sessions.
/// Returns Vec<ActiveTerminalInfo> with session_id and config_id.
#[tauri::command]
pub fn list_active_terminals(
    state_terminal: State<'_, TerminalManager>,
) -> Vec<ActiveTerminalInfo> {
    let sessions = state_terminal.list_active_sessions();
    log::info!("[UPDATE] list_active_terminals: {} session(s) found", sessions.len());
    sessions
}

/// Get the active terminal session for a given config_id.
/// Returns the session_id if one exists, or null if not.
#[tauri::command]
pub fn get_terminal_by_config(
    state_terminal: State<'_, TerminalManager>,
    config_id: String,
) -> Option<String> {
    state_terminal.get_session_by_config_id(&config_id)
}

/// Kill all terminal sessions and their child processes.
#[tauri::command]
pub fn kill_all_terminals(
    state_terminal: State<'_, TerminalManager>,
) {
    let killed = state_terminal.kill_all();
    log::info!("[UPDATE] kill_all_terminals: killed {} session(s)", killed);
}

/// Get the buffered output for a terminal session.
/// Returns the last ~4KB of output for late-joining viewers.
#[tauri::command]
pub fn get_terminal_buffer(
    state_terminal: State<'_, TerminalManager>,
    session_id: String,
) -> String {
    state_terminal.get_output_buffer(&session_id)
}

/// Open (or focus) the floating terminal window.
/// Creates the window if it doesn't exist, or focuses it if already open.
#[tauri::command]
pub async fn open_terminal_window(app: AppHandle) -> Result<(), String> {
    let window_label = "terminal";

    if let Some(existing) = app.get_webview_window(window_label) {
        existing.minimize().ok();
        existing.unminimize().ok();
        existing.set_focus().ok();
        return Ok(());
    }

    // Read saved theme from SQLite BEFORE creating the window
    let theme = app
        .state::<DbManager>()
        .lock_conn()
        .ok()
        .and_then(|c| repo::get_setting(&c, "theme").ok().flatten())
        .unwrap_or_else(|| "catppuccin-mocha".to_string());

    let dev_mode = cfg!(debug_assertions);
    let dev_script = format!(r#"window.__DEV_MODE__={};"#, dev_mode);
    let Color(r, g, b, _) = theme_to_color(&theme);
    let bg_hex = format!("#{:02x}{:02x}{:02x}", r, g, b);
    // Null-guard: document.documentElement may not exist yet in some WebView2 contexts.
    // Sets window.__INITIAL_THEME__ and window.__INITIAL_BG__ for the head script
    // in index.html to re-apply after HTML parsing.
    let anti_flash_script = format!(
        r##"(function(){{console.log("[THEME-BOOT] ① initialization_script (terminal): theme={theme}, bg={bg}");var el=document.documentElement;if(el){{el.setAttribute("data-theme","{theme}");el.style.backgroundColor="{bg}";}}window.__INITIAL_THEME__="{theme}";window.__INITIAL_BG__="{bg}";}})();"##,
        theme = theme,
        bg = bg_hex,
    );
    let bg_color = theme_to_color(&theme);

    // Fire-and-forget: spawn on tokio so the command returns immediately
    // and doesn't block the main app's IPC thread.
    let app_handle = app.clone();
    tokio::spawn(async move {
        let result = WebviewWindow::builder(&app_handle, window_label, tauri::WebviewUrl::App("index.html?window=terminal".into()))
            .title("Terminals")
            .inner_size(900.0, 600.0)
            .min_inner_size(600.0, 400.0)
            .decorations(true)
            .theme(Some(tauri::Theme::Dark))
            .background_color(bg_color)
            .initialization_script(&dev_script)
            .initialization_script(&anti_flash_script)
            .build();

        if let Err(e) = result {
            log::error!("Failed to create terminal window: {}", e);
        }
    });

    Ok(())
}
