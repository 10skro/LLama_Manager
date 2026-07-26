use tauri::State;

use crate::db::connection::DbManager;
use crate::db::repo;

/// Persist an explicit user theme choice to SQLite.
/// Called only when the user actively switches themes (not on startup).
pub async fn persist_theme_change(
    db: State<'_, DbManager>,
    theme_id: String,
) -> Result<(), String> {
    let conn = db.lock_conn().map_err(|e| e.to_string())?;
    repo::set_setting(&conn, "theme", &theme_id)
        .map_err(|e| e.to_string())?;
    log::info!("Theme changed to: {}", theme_id);
    Ok(())
}
