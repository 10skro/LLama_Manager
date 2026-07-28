mod cards;
mod config;
mod custom_command;
mod db;
mod download;
mod favorites;
mod file;
mod github;
mod logging;
mod models;
mod terminal;
mod theme;
mod utils;
mod version;

use tauri::{Listener, Manager, State};

use crate::config::settings::SettingsManager;
use crate::db::connection::DbManager;
use crate::db::repo;
use crate::download::manager::DownloadManager;
use crate::github::api::GithubClient;
use crate::terminal::manager::TerminalManager;
use crate::theme::colors::theme_to_color;
use crate::theme::inject::build_initialization_script;
// ─── Tauri Command Wrappers ─────────────────────────────────────────────
// #[tauri::command] must be in this module so generate_handler! can see
// the generated __cmd__* macros. Each wrapper delegates to the domain module.

// GitHub / builds
#[tauri::command]
async fn fetch_builds(
    state_github: State<'_, GithubClient>,
    state_db: State<'_, DbManager>,
    limit: Option<usize>,
    force_refresh: Option<bool>,
) -> Result<Vec<crate::models::types::Build>, String> {
    github::commands::fetch_builds(state_github, state_db, limit, force_refresh).await
}
#[tauri::command]
async fn check_new_builds(
    state_github: State<'_, GithubClient>,
    state_db: State<'_, DbManager>,
) -> Result<Vec<crate::models::types::Build>, String> {
    github::commands::check_new_builds(state_github, state_db).await
}
#[tauri::command]
async fn fetch_release_by_tag(
    state_github: State<'_, GithubClient>,
    tag: String,
) -> Result<Vec<crate::models::types::Build>, String> {
    github::commands::fetch_release_by_tag(state_github, tag).await
}
#[tauri::command]
async fn search_builds(
    state_github: State<'_, GithubClient>,
    query: String,
) -> Result<Vec<crate::models::types::Build>, String> {
    github::commands::search_builds(state_github, query).await
}
#[tauri::command]
async fn fetch_release_changelog(
    state_github: State<'_, GithubClient>,
    tag: String,
) -> Result<Option<String>, String> {
    github::commands::fetch_release_changelog(state_github, tag).await
}
#[tauri::command]
fn get_catalog_last_fetched(
    state_db: State<'_, DbManager>,
) -> Result<Option<String>, String> {
    github::commands::get_catalog_last_fetched(state_db)
}

// Version management
#[tauri::command]
fn get_installed_versions(state: State<'_, DbManager>) -> Result<Vec<crate::models::types::InstalledVersion>, String> {
    version::commands::get_installed_versions(state)
}
#[tauri::command]
fn uninstall_version(
    state: State<'_, DbManager>,
    id: i64,
) -> Result<bool, String> {
    version::commands::uninstall_version(state, id)
}
#[tauri::command]
async fn get_storage_usage(
    app: tauri::AppHandle,
    state_db: State<'_, DbManager>,
) -> Result<u64, String> {
    version::commands::get_storage_usage(app, state_db).await
}
#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn install_version(
    app: tauri::AppHandle,
    state_db: State<'_, DbManager>,
    state_download: State<'_, DownloadManager>,
    build_number: String,
    backend: String,
    architecture: String,
    url: String,
    total_size: u64,
) -> Result<i64, String> {
    version::commands::install_version(app, state_db, state_download, build_number, backend, architecture, url, total_size).await
}
#[tauri::command]
fn get_version_config_link(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<Option<crate::models::types::VersionConfigLink>, String> {
    version::commands::get_version_config_link(state_db, version_id)
}
#[tauri::command]
fn save_version_config_link(
    state_db: State<'_, DbManager>,
    version_id: i64,
    config_type: String,
    config_id: String,
) -> Result<i64, String> {
    version::commands::save_version_config_link(state_db, version_id, config_type, config_id)
}
#[tauri::command]
fn delete_version_config_link(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<bool, String> {
    version::commands::delete_version_config_link(state_db, version_id)
}
#[tauri::command]
fn get_version_override(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<Option<crate::models::types::VersionOverride>, String> {
    version::commands::get_version_override(state_db, version_id)
}
#[tauri::command]
fn save_version_override(
    state_db: State<'_, DbManager>,
    version_id: i64,
    model_path: Option<String>,
    mmproj_path: Option<String>,
) -> Result<(), String> {
    version::commands::save_version_override(state_db, version_id, model_path, mmproj_path)
}
#[tauri::command]
fn delete_version_override(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<bool, String> {
    version::commands::delete_version_override(state_db, version_id)
}
#[tauri::command]
fn duplicate_version(
    state_db: State<'_, DbManager>,
    version_id: i64,
    with_settings: bool,
) -> Result<i64, String> {
    version::commands::duplicate_version(state_db, version_id, with_settings)
}

// Download management
#[tauri::command]
async fn cancel_download(
    state: State<'_, DownloadManager>,
    id: i64,
) -> Result<bool, String> {
    download::commands::cancel_download(state, id).await
}
#[tauri::command]
fn get_download_status(
    state: State<'_, DbManager>,
    id: i64,
) -> Result<Option<serde_json::Value>, String> {
    download::commands::get_download_status(state, id)
}

// Settings & config
#[tauri::command]
fn get_settings(state: State<'_, DbManager>) -> Result<serde_json::Value, String> {
    config::commands::get_settings(state)
}
#[tauri::command]
fn save_settings(
    state: State<'_, DbManager>,
    settings: serde_json::Value,
) -> Result<(), String> {
    config::commands::save_settings(state, settings)
}
#[tauri::command]
fn open_folder_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    config::commands::open_folder_dialog(app)
}
#[tauri::command]
fn change_storage_path(
    state_db: State<'_, DbManager>,
    old_path: String,
    new_path: String,
) -> Result<String, String> {
    config::commands::change_storage_path(state_db, old_path, new_path)
}
#[tauri::command]
fn save_github_token(
    state_db: State<'_, DbManager>,
    state_github: State<'_, GithubClient>,
    token: String,
) -> Result<(), String> {
    config::commands::save_github_token(state_db, state_github, token)
}
#[tauri::command]
fn has_github_token(
    state_db: State<'_, DbManager>,
) -> Result<bool, String> {
    config::commands::has_github_token(state_db)
}
#[tauri::command]
fn delete_github_token(
    state_db: State<'_, DbManager>,
    state_github: State<'_, GithubClient>,
) -> Result<(), String> {
    config::commands::delete_github_token(state_db, state_github)
}
#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    config::commands::get_app_version(app)
}

// Favorites
#[tauri::command]
fn get_favorite_builds(state: State<'_, DbManager>) -> Result<Vec<crate::models::types::FavoriteBuild>, String> {
    favorites::commands::get_favorite_builds(state)
}
#[tauri::command]
fn toggle_favorite_build(
    state: State<'_, DbManager>,
    build_number: String,
    backend: String,
    download_url: String,
    architecture: String,
) -> Result<bool, String> {
    favorites::commands::toggle_favorite_build(state, build_number, backend, download_url, architecture)
}

// Card customization
#[tauri::command]
fn get_card_customizations(
    state_db: State<'_, DbManager>,
) -> Result<Vec<crate::models::types::CardCustomization>, String> {
    cards::commands::get_card_customizations(state_db)
}
#[tauri::command]
fn save_card_customization(
    state_db: State<'_, DbManager>,
    version_id: i64,
    title: String,
    header_color: String,
    text_color: String,
) -> Result<(), String> {
    cards::commands::save_card_customization(state_db, version_id, title, header_color, text_color)
}
#[tauri::command]
fn delete_card_customization(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<bool, String> {
    cards::commands::delete_card_customization(state_db, version_id)
}
#[tauri::command]
fn bulk_set_display_order(
    state_db: State<'_, DbManager>,
    orders: Vec<(i64, i64)>,
) -> Result<(), String> {
    cards::commands::bulk_set_display_order(state_db, orders)
}
#[tauri::command]
fn reset_display_order(state_db: State<'_, DbManager>) -> Result<(), String> {
    cards::commands::reset_display_order(state_db)
}

// Custom commands
#[tauri::command]
fn save_custom_command(
    state_db: State<'_, DbManager>,
    config: serde_json::Value,
) -> Result<String, String> {
    custom_command::commands::save_custom_command(state_db, config)
}
#[tauri::command]
fn get_custom_commands(
    state_db: State<'_, DbManager>,
) -> Result<Vec<serde_json::Value>, String> {
    custom_command::commands::get_custom_commands(state_db)
}
#[tauri::command]
fn delete_custom_command(
    state_db: State<'_, DbManager>,
    id: String,
) -> Result<bool, String> {
    custom_command::commands::delete_custom_command(state_db, id)
}

// File scanning
#[tauri::command]
fn scan_model_files(
    folder_path: String,
    extensions: String,
) -> Result<Vec<crate::models::types::ModelFile>, String> {
    file::commands::scan_model_files(folder_path, extensions)
}
#[tauri::command]
fn scan_mmproj_files(
    folder_path: String,
    extensions: String,
) -> Result<Vec<crate::models::types::ModelFile>, String> {
    file::commands::scan_mmproj_files(folder_path, extensions)
}
#[tauri::command]
fn validate_folder(path: String) -> Result<bool, String> {
    file::commands::validate_folder(path)
}

// Terminal
#[tauri::command]
fn spawn_terminal(
    app: tauri::AppHandle,
    state_terminal: State<'_, TerminalManager>,
    config_id: String,
    version_id: i64,
    working_dir: String,
    startup_command: Option<String>,
) -> Result<String, String> {
    terminal::commands::spawn_terminal(app, state_terminal, config_id, version_id, working_dir, startup_command)
}
#[tauri::command]
fn write_terminal_input(
    state_terminal: State<'_, TerminalManager>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    terminal::commands::write_terminal_input(state_terminal, session_id, input)
}
#[tauri::command]
async fn kill_terminal(
    app: tauri::AppHandle,
    state_terminal: State<'_, TerminalManager>,
    session_id: String,
) -> Result<String, String> {
    terminal::commands::kill_terminal(app, state_terminal, session_id)
}
#[tauri::command]
fn list_active_terminals(
    state_terminal: State<'_, TerminalManager>,
) -> Vec<crate::terminal::manager::ActiveTerminalInfo> {
    terminal::commands::list_active_terminals(state_terminal)
}
#[tauri::command]
fn get_terminal_by_config(
    state_terminal: State<'_, TerminalManager>,
    config_id: String,
) -> Option<String> {
    terminal::commands::get_terminal_by_config(state_terminal, config_id)
}
#[tauri::command]
fn get_terminal_buffer(
    state_terminal: State<'_, TerminalManager>,
    session_id: String,
) -> String {
    terminal::commands::get_terminal_buffer(state_terminal, session_id)
}
#[tauri::command]
async fn open_terminal_window(app: tauri::AppHandle) -> Result<(), String> {
    terminal::commands::open_terminal_window(app).await
}
#[tauri::command]
fn kill_all_terminals(
    state_terminal: State<'_, TerminalManager>,
) {
    terminal::commands::kill_all_terminals(state_terminal)
}

// App Update
use tauri::Emitter;
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
async fn check_app_update(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let updater = app.updater()
        .map_err(|e| format!("Failed to initialize updater: {}", e))?;

    if let Some(update) = updater.check().await.map_err(|e| format!("Failed to check for updates: {}", e))? {
        let version = update.version.clone();
        let body = update.body.clone();
        let date = update.date.map(|d| d.to_string());
        log::info!("Update available: {}", version);
        Ok(serde_json::json!({
            "available": true,
            "version": version,
            "date": date,
            "body": body,
        }))
    } else {
        log::info!("No update available");
        Ok(serde_json::json!({
            "available": false,
            "version": null,
            "date": null,
            "body": null,
        }))
    }
}

#[tauri::command]
async fn install_app_update(
    app: tauri::AppHandle,
    changelog_version: Option<String>,
    changelog_body: Option<String>,
) -> Result<(), String> {
    log::info!("[UPDATE] install_app_update: starting update installation");

    // Persist changelog to database BEFORE download/restart (eliminates race condition)
    if let (Some(ref version), Some(ref body)) = (&changelog_version, &changelog_body) {
        let db = app.state::<DbManager>();
        {
            let conn = db.lock_conn()
                .map_err(|e| format!("Failed to lock database: {}", e))?;
            repo::set_setting(&conn, "pending_changelog_version", version)
                .map_err(|e| format!("Failed to save changelog version: {}", e))?;
            repo::set_setting(&conn, "pending_changelog_body", body)
                .map_err(|e| format!("Failed to save changelog body: {}", e))?;
        }
        log::info!("[UPDATE] persisting changelog for version {}", version);

        // Force WAL checkpoint to guarantee data is flushed to disk before restart
        if let Err(e) = db.checkpoint() {
            log::warn!("[UPDATE] checkpoint failed: {} (data may not be persisted)", e);
        }
    }

    // Kill all terminal sessions before updating (safety net)
    let terminal = app.state::<TerminalManager>();
    terminal.kill_all();

    let updater = app.updater()
        .map_err(|e| format!("Failed to initialize updater: {}", e))?;

    let update = updater.check().await
        .map_err(|e| format!("Failed to check for updates: {}", e))?
        .ok_or("No update available")?;

    update.download_and_install(
        move |chunk_length: usize, content_length: Option<u64>| {
            app.emit("update:download-progress", serde_json::json!({
                "chunk": chunk_length,
                "total": content_length,
            })).ok();
        },
        || {
            log::info!("Update download finished");
        },
    ).await.map_err(|e| format!("Download or install failed: {}", e))?;

    Ok(())
}

// Theme
#[tauri::command]
async fn persist_theme_change(
    app: tauri::AppHandle,
    db: State<'_, DbManager>,
    theme_id: String,
) -> Result<(), String> {
    theme::commands::persist_theme_change(app, db, theme_id).await
}

// ─── App Entry Point ───────────────────────────────────────────────────

pub fn run_tauri_app() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_local_data_dir()
                .expect("Failed to get app data dir");

            // Create required directories
            utils::setup_directories(&app_dir).map_err(|e| e.to_string())?;

            // Initialize file-based logging (must be after directories are created)
            logging::init(&app_dir).map_err(|e| e.to_string())?;

            // Initialize database
            let db_path = app_dir.join("database").join("llama.db");
            let db = DbManager::new(&db_path).map_err(|e| e.to_string())?;
            db.init_tables().map_err(|e| e.to_string())?;

            // Initialize default settings
            SettingsManager::init_defaults(&db).map_err(|e| e.to_string())?;

            // Load GitHub token from DB settings table
            let github_token = {
                let conn = db.lock_conn().ok();
                conn.and_then(|c| repo::get_setting(&c, "github_token").ok().flatten())
            };

            // Load persisted ETag from DB for conditional requests on startup
            let persisted_etag = {
                let conn = db.lock_conn().map_err(|e| e.to_string())?;
                repo::get_setting(&conn, "github_etag").map_err(|e| e.to_string())?
            };

            // Clean up old downloads (30 days retention)
            {
                let conn = db.lock_conn().map_err(|e| e.to_string())?;
                let cleaned = repo::cleanup_old_downloads(&conn, 30).map_err(|e| e.to_string())?;
                if cleaned > 0 {
                    log::info!("Cleaned up {} old download records", cleaned);
                }
            }

            // Read saved theme from SQLite BEFORE db is moved into Tauri state
            let initial_theme = {
                let conn = db.lock_conn().ok();
                conn.and_then(|c| repo::get_setting(&c, "theme").ok().flatten())
            }.unwrap_or_else(|| "catppuccin-mocha".to_string());

            // Register state
            app.manage(db);
            app.manage(DownloadManager::new());
            app.manage(GithubClient::new(github_token, persisted_etag));
            app.manage(TerminalManager::new());

            // Listen for app destroy event to kill terminal sessions
            {
                let app_handle = app.app_handle().clone();
                app_handle.clone().listen("tauri://destroy", move |_| {
                    let terminal = app_handle.state::<TerminalManager>();
                    terminal.kill_all();
                });
            }

            // Build initialization script for the main window (runs BEFORE HTML is parsed)
            let init_script = build_initialization_script(&initial_theme);

            // Inject dev mode flag for frontend banner
            let dev_mode = cfg!(debug_assertions);
            let dev_script = format!(r#"window.__DEV_MODE__={};"#, dev_mode);

            // Create main window with theme injection via initialization_script
            let bg_color = theme_to_color(&initial_theme);
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
            let app_handle = app.handle().clone();
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_builds,
            check_new_builds,
            fetch_release_by_tag,
            search_builds,
            fetch_release_changelog,
            get_catalog_last_fetched,
            get_installed_versions,
            uninstall_version,
            get_storage_usage,
            install_version,
            get_version_config_link,
            save_version_config_link,
            delete_version_config_link,
            get_version_override,
            save_version_override,
            delete_version_override,
            duplicate_version,
            cancel_download,
            get_download_status,
            get_settings,
            save_settings,
            open_folder_dialog,
            change_storage_path,
            save_github_token,
            has_github_token,
            delete_github_token,
            get_app_version,
            get_favorite_builds,
            toggle_favorite_build,
            get_card_customizations,
            save_card_customization,
            delete_card_customization,
            bulk_set_display_order,
            reset_display_order,
            save_custom_command,
            get_custom_commands,
            delete_custom_command,
            scan_model_files,
            scan_mmproj_files,
            validate_folder,
            spawn_terminal,
            write_terminal_input,
            kill_terminal,
            list_active_terminals,
            get_terminal_by_config,
            get_terminal_buffer,
            open_terminal_window,
            kill_all_terminals,
            persist_theme_change,
            check_app_update,
            install_app_update,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Tauri app");
}
