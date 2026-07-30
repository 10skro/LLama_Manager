//! Main window creation: theme injection, initialization scripts,
//! and close event handling.

use crate::terminal::manager::TerminalManager;
use crate::theme::colors::theme_to_color;
use tauri::webview::Color;
use tauri::{Listener, Manager};

/// Create the main window with theme injection and register the close handler.
/// Must be called after all state (DbManager, DownloadManager, GithubClient,
/// TerminalManager) has been registered via `app.manage()`.
pub fn create_main_window(app: &tauri::AppHandle, initial_theme: &str) {
    // Inject dev mode flag for frontend banner
    let dev_mode = cfg!(debug_assertions);
    let dev_script = format!(r#"window.__DEV_MODE__={};"#, dev_mode);

    // Resolve theme colors from embedded JSON.
    let Color(r, g, b, _) = theme_to_color(initial_theme);
    let bg_hex = format!("#{:02x}{:02x}{:02x}", r, g, b);

    // Inject anti-flash style DIRECTLY via initialization_script.
    // This runs BEFORE any DOM parsing, eliminating the gap between
    // WebView creation and CSS load. No need for theme-init.js.
    // Null-guard: document.documentElement may not exist yet in some WebView2 contexts.
    //
    // Sets window.__INITIAL_THEME__ and window.__INITIAL_BG__ for the head script
    // in index.html to re-apply after HTML parsing (init script DOM changes are
    // lost when the HTML document replaces the blank initial document).
    let anti_flash_script = format!(
        r##"(function(){{console.log("[THEME-BOOT] ① initialization_script: theme={theme}, bg={bg}");var el=document.documentElement;if(el){{el.setAttribute("data-theme","{theme}");el.style.backgroundColor="{bg}";}}window.__INITIAL_THEME__="{theme}";window.__INITIAL_BG__="{bg}";}})();"##,
        theme = initial_theme,
        bg = bg_hex,
    );

    // Create main window with native background_color (prevents flash before HTML paints)
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
        .initialization_script(&dev_script)
        .initialization_script(&anti_flash_script)
        .build()
        .expect("Failed to create main window");

    // Handle main window close: kill terminals (async) + close terminal widget
    // Spawn kill_all on std::thread to avoid blocking the main UI thread.
    // Uses std::thread (not tokio) since the Tokio runtime may be dropped at shutdown.
    let app_handle = app.clone();
    main_window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            log::info!("[APP] CloseRequested: spawning async kill_all for terminal sessions");
            // Clone for the spawn closure BEFORE moving into it
            let kill_handle = app_handle.clone();
            std::thread::spawn(move || {
                let terminal = kill_handle.state::<TerminalManager>();
                terminal.kill_all();
            });
            if let Some(widget) = app_handle.get_webview_window("terminal") {
                let _ = widget.close();
            }
        }
    });
}

/// Register the tauri://destroy listener that kills all terminal sessions
/// on app shutdown. Spawns kill_all on std::thread to avoid blocking the
/// main thread. Acts as a safety net in case CloseRequested's thread didn't finish.
pub fn register_destroy_listener(app: &tauri::AppHandle) {
    let app_handle = app.clone();
    app_handle.clone().listen("tauri://destroy", move |_| {
        let app_handle = app_handle.clone();
        std::thread::spawn(move || {
            let terminal = app_handle.state::<TerminalManager>();
            terminal.kill_all();
        });
    });
}
