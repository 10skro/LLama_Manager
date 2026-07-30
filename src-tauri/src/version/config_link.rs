use tauri::State;

use crate::db::connection::DbManager;
use crate::db::repo;
use crate::models::types::VersionConfigLink;

/// Get the config link for a version.
#[tauri::command]
pub fn get_version_config_link(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<Option<VersionConfigLink>, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::get_version_config_link(&conn, version_id).map_err(|e| e.to_string())
}

/// Save (upsert) a config link for a version.
#[tauri::command]
pub fn save_version_config_link(
    state_db: State<'_, DbManager>,
    version_id: i64,
    config_type: String,
    config_id: String,
) -> Result<i64, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::save_version_config_link(&conn, version_id, &config_type, &config_id).map_err(|e| e.to_string())
}

/// Delete the config link for a version.
#[tauri::command]
pub fn delete_version_config_link(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<bool, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::delete_version_config_link(&conn, version_id).map_err(|e| e.to_string())
}
