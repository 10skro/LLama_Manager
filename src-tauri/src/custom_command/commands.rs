use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};

use crate::custom_command::logic;
use crate::db::connection::DbManager;

/// Derive the config directory path from the app handle.
/// Must match the same base path used in setup/mod.rs (app_local_data_dir).
fn config_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .expect("Failed to get app data directory")
        .join("config")
}

/// Save a custom command configuration.
#[tauri::command]
pub fn save_custom_command(
    app: AppHandle,
    state_db: State<'_, DbManager>,
    config: serde_json::Value,
) -> Result<String, String> {
    logic::save_custom_command(&state_db, config, &config_dir(&app)).map_err(|e| e.to_string())
}

/// Get all custom command configurations.
#[tauri::command]
pub fn get_custom_commands(
    state_db: State<'_, DbManager>,
) -> Result<Vec<serde_json::Value>, String> {
    logic::get_custom_commands(&state_db).map_err(|e| e.to_string())
}

/// Delete a custom command by its ID.
#[tauri::command]
pub fn delete_custom_command(
    app: AppHandle,
    state_db: State<'_, DbManager>,
    id: String,
) -> Result<bool, String> {
    logic::delete_custom_command(&state_db, &id, &config_dir(&app)).map_err(|e| e.to_string())
}


