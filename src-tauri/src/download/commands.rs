use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, State};

use crate::db::connection::DbManager;
use crate::db::repo;
use crate::download::manager::DownloadManager;
use crate::models::types::DownloadProgress;

/// Spawn a background task that forwards download progress events to the frontend
/// and writes to the DB with throttling (every 5 events or on terminal status).
/// When `download_id` is `None`, the ID is taken from each progress message.
pub fn spawn_progress_forwarder(
    app: AppHandle,
    db: DbManager,
    mut rx: tokio::sync::mpsc::Receiver<DownloadProgress>,
    download_id: Option<i64>,
) {
    tokio::spawn(async move {
        let mut update_counter: u32 = 0;
        const DB_WRITE_INTERVAL: u32 = 5;
        // Throttle frontend event emission to max ~5 events/sec (200ms interval)
        let mut last_emit = Instant::now();
        const EMIT_INTERVAL: Duration = Duration::from_millis(200);

        while let Some(progress) = rx.recv().await {
            update_counter += 1;
            let is_terminal = ["completed", "failed", "cancelled", "downloaded"].contains(&progress.status.as_str());

            // THROTTLED emit: only emit if enough time has passed OR it's a terminal event
            let now = Instant::now();
            if is_terminal || now.duration_since(last_emit) >= EMIT_INTERVAL {
                let _ = app.emit("download-progress", &progress);
                last_emit = now;
            }

            // DB write throttling (every 5 events or terminal) - keep existing logic
            if is_terminal || update_counter.is_multiple_of(DB_WRITE_INTERVAL) {
                let id = download_id.unwrap_or(progress.download_id);
                if let Ok(conn) = db.lock_conn() {
                    // Map "downloaded" -> "completed" for DB writes so post_download_tasks can proceed
                    let db_status = if progress.status == "downloaded" { "completed" } else { &progress.status };
                    let _ = repo::update_download_progress(&conn, id, progress.downloaded, db_status);
                }
            }
        }
    });
}

/// Cancel an in-progress download.
#[tauri::command]
pub async fn cancel_download(
    state_download: State<'_, DownloadManager>,
    id: i64,
) -> Result<bool, String> {
    state_download.cancel_download(id).await.map_err(|e| e.to_string())
}

/// Get the current download status from the database.
#[tauri::command]
pub fn get_download_status(
    state: State<'_, DbManager>,
    id: i64,
) -> Result<Option<serde_json::Value>, String> {
    let conn = state.lock_conn().map_err(|e| e.to_string())?;
    let record = repo::get_download(&conn, id).map_err(|e| e.to_string())?;
    Ok(record.map(|r| serde_json::to_value(r).unwrap_or_default()))
}


