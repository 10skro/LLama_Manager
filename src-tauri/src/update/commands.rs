use tauri::{Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

use crate::db::connection::DbManager;
use crate::db::repo;
use crate::terminal::manager::TerminalManager;

/// Check if a new application update is available.
/// Returns a JSON object with `available`, `version`, `date`, and `body` fields.
#[tauri::command]
pub async fn check_app_update(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let updater = app
        .updater()
        .map_err(|e| format!("Failed to initialize updater: {}", e))?;

    if let Some(update) = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?
    {
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

/// Download and install the application update.
/// Persists changelog data to the database before restart to eliminate race conditions.
/// Kills all terminal sessions as a safety net before updating.
#[tauri::command]
pub async fn install_app_update(
    app: tauri::AppHandle,
    changelog_version: Option<String>,
    changelog_body: Option<String>,
) -> Result<(), String> {
    log::info!("[UPDATE] install_app_update: starting update installation");

    // Persist changelog to database BEFORE download/restart (eliminates race condition)
    if let (Some(ref version), Some(ref body)) = (&changelog_version, &changelog_body) {
        let db = app.state::<DbManager>();
        {
            let conn = db
                .lock_conn()
                .map_err(|e| format!("Failed to lock database: {}", e))?;
            repo::set_setting(&conn, "pending_changelog_version", version)
                .map_err(|e| format!("Failed to save changelog version: {}", e))?;
            repo::set_setting(&conn, "pending_changelog_body", body)
                .map_err(|e| format!("Failed to save changelog body: {}", e))?;
        }
        log::info!("[UPDATE] persisting changelog for version {}", version);

        // Force WAL checkpoint to guarantee data is flushed to disk before restart
        if let Err(e) = db.checkpoint() {
            log::warn!(
                "[UPDATE] checkpoint failed: {} (data may not be persisted)",
                e
            );
        }
    }

    // Kill all terminal sessions before updating (safety net)
    let terminal = app.state::<TerminalManager>();
    terminal.kill_all();

    let updater = app
        .updater()
        .map_err(|e| format!("Failed to initialize updater: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?
        .ok_or("No update available")?;

    update
        .download_and_install(
            move |chunk_length: usize, content_length: Option<u64>| {
                app.emit(
                    "update:download-progress",
                    serde_json::json!({
                        "chunk": chunk_length,
                        "total": content_length,
                    }),
                )
                .ok();
            },
            || {
                log::info!("Update download finished");
            },
        )
        .await
        .map_err(|e| format!("Download or install failed: {}", e))?;

    Ok(())
}
