use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::db::connection::DbManager;
use crate::db::repo;

/// Return the saved theme ID from SQLite, or the default if not set.
/// Called by the frontend on startup to hydrate the theme store.
#[tauri::command]
pub fn get_saved_theme(db: State<'_, DbManager>) -> Result<String, String> {
    let conn = db.lock_conn().map_err(|e| e.to_string())?;
    Ok(repo::get_setting(&conn, "theme")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "catppuccin-mocha".to_string()))
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ThemeChangedEvent {
    theme_id: String,
}

/// Persist an explicit user theme choice to SQLite.
/// Called only when the user actively switches themes (not on startup).
/// Also emits "theme-changed" to ALL webviews (main + terminal widget)
/// so that open secondary windows react immediately to the theme switch.
#[tauri::command]
pub async fn persist_theme_change(
    app: AppHandle,
    db: State<'_, DbManager>,
    theme_id: String,
) -> Result<(), String> {
    let conn = db.lock_conn().map_err(|e| e.to_string())?;
    repo::set_setting(&conn, "theme", &theme_id)
        .map_err(|e| e.to_string())?;
    log::debug!("Theme changed to: {}", theme_id);

    // Emit to ALL webviews (main window + terminal widget + any future windows)
    let _ = app.emit("theme-changed", ThemeChangedEvent { theme_id });

    Ok(())
}
