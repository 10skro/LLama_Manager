use tauri::State;

use crate::custom_command::logic;
use crate::db::connection::DbManager;

/// Save a custom command configuration.
#[tauri::command]
pub fn save_custom_command(
    state_db: State<'_, DbManager>,
    config: serde_json::Value,
) -> Result<String, String> {
    logic::save_custom_command(&state_db, config).map_err(|e| e.to_string())
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
    state_db: State<'_, DbManager>,
    id: String,
) -> Result<bool, String> {
    logic::delete_custom_command(&state_db, &id).map_err(|e| e.to_string())
}


