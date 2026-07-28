use tauri::{AppHandle, State};

use crate::config::settings::SettingsManager;
use crate::config::storage::{validate_storage_path, migrate_storage_path, cleanup_old_storage};
use crate::db::connection::DbManager;
use crate::db::repo;
use crate::github::api::GithubClient;
use tauri_plugin_dialog::DialogExt;

/// Get current application settings from the database.
pub fn get_settings(state: State<'_, DbManager>) -> Result<serde_json::Value, String> {
    let settings = SettingsManager::get_settings(&state).map_err(|e| e.to_string())?;
    serde_json::to_value(settings).map_err(|e| e.to_string())
}

/// Save application settings to the database.
pub fn save_settings(
    state: State<'_, DbManager>,
    settings: serde_json::Value,
) -> Result<(), String> {
    let s: crate::models::types::AppSettings = serde_json::from_value(settings).map_err(|e| e.to_string())?;
    SettingsManager::save_settings(&state, &s).map_err(|e| e.to_string())
}

/// Open a native folder picker dialog.
pub fn open_folder_dialog(app: AppHandle) -> Result<Option<String>, String> {
    // .file() is the correct builder for folder dialogs in Tauri's dialog API.
    // The .blocking_pick_folder() method turns the file dialog builder into a
    // folder picker, overriding the default file-selection behavior.
    let folder = app
        .dialog()
        .file()
        .set_title("Select Storage Folder")
        .blocking_pick_folder();
    Ok(folder.map(|p| p.to_string()))
}

/// Change the storage path: validate, migrate files, update DB, clean up old path.
pub fn change_storage_path(
    state_db: State<'_, DbManager>,
    old_path: String,
    new_path: String,
) -> Result<String, String> {
    // 1. Validate the new path
    validate_storage_path(&new_path, &old_path).map_err(|e| e.to_string())?;

    // 2. Migrate files from old to new location
    migrate_storage_path(&old_path, &new_path, &state_db)
        .map_err(|e| e.to_string())?;

    // 3. Save new path to database (only after successful migration)
    // Load current settings, update storage_path, save back
    let mut settings = SettingsManager::get_settings(&state_db)
        .map_err(|e| format!("Failed to load settings: {}", e))?;
    settings.storage_path = new_path.clone();
    SettingsManager::save_settings(&state_db, &settings)
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    // 4. Clean up old directory
    cleanup_old_storage(&old_path);

    Ok(new_path)
}

/// Save (or clear) the GitHub API token.
pub fn save_github_token(
    state_db: State<'_, DbManager>,
    state_github: State<'_, GithubClient>,
    token: String,
) -> Result<(), String> {
    if token.is_empty() {
        let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
        repo::delete_setting(&conn, "github_token").map_err(|e| e.to_string())?;
        state_github.set_token(None);
    } else {
        let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
        repo::set_setting(&conn, "github_token", &token).map_err(|e| e.to_string())?;
        state_github.set_token(Some(token));
    }
    Ok(())
}

/// Check whether a GitHub token is configured.
pub fn has_github_token(
    state_db: State<'_, DbManager>,
) -> Result<bool, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    Ok(repo::get_setting(&conn, "github_token").map_err(|e| e.to_string())?.is_some())
}

/// Delete the GitHub token from the database and clear it from the client.
pub fn delete_github_token(
    state_db: State<'_, DbManager>,
    state_github: State<'_, GithubClient>,
) -> Result<(), String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::delete_setting(&conn, "github_token").map_err(|e| e.to_string())?;
    state_github.set_token(None);
    Ok(())
}

/// Get the application version from package info.
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}


