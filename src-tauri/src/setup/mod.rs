//! Application setup orchestration.
//!
//! This module coordinates the initialization order:
//! 1. Create application directories
//! 2. Initialize logging
//! 3. Initialize database + read startup values
//! 4. Register Tauri state
//! 5. Register event listeners
//! 6. Create the main window

mod database;
mod window;

use crate::download::manager::DownloadManager;
use crate::github::api::GithubClient;
use crate::terminal::manager::TerminalManager;
use crate::utils;
use tauri::Manager;

/// Run the full application setup.
/// Called from the Tauri `.setup()` closure.
pub fn init(app: &tauri::App) -> Result<(), crate::models::types::AppError> {
    let app_dir = app
        .path()
        .app_local_data_dir()
        .expect("Failed to get app data dir");

    // 1. Create required directories
    utils::setup_directories(&app_dir)?;

    // 2. Initialize file-based logging (must be after directories are created)
    crate::logging::init(&app_dir)?;

    // 3. Initialize database + read startup values
    let database::DatabaseSetupResult {
        db,
        github_token,
        persisted_etag,
        initial_theme,
    } = database::init(&app_dir)?;

    // 4. Register Tauri state
    app.manage(db);
    app.manage(DownloadManager::new());
    app.manage(GithubClient::new(github_token, persisted_etag));
    app.manage(TerminalManager::new());

    // 5. Register event listeners
    let app_handle = app.app_handle();
    window::register_destroy_listener(app_handle);

    // 6. Create the main window
    window::create_main_window(app_handle, &initial_theme);

    Ok(())
}
