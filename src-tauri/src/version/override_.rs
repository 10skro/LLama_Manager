use tauri::State;

use crate::db::connection::DbManager;
use crate::db::repo;
use crate::models::types::VersionOverride;

/// Get the override for a version.
#[tauri::command]
pub fn get_version_override(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<Option<VersionOverride>, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::get_version_override(&conn, version_id).map_err(|e| e.to_string())
}

/// Save (upsert) an override for a version.
#[tauri::command]
pub fn save_version_override(
    state_db: State<'_, DbManager>,
    version_id: i64,
    model_path: Option<String>,
    mmproj_path: Option<String>,
) -> Result<(), String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::save_version_override(&conn, version_id, model_path, mmproj_path).map_err(|e| e.to_string())
}

/// Delete the override for a version.
#[tauri::command]
pub fn delete_version_override(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<bool, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::delete_version_override(&conn, version_id).map_err(|e| e.to_string())
}
