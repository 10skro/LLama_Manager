use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};

use crate::config::settings::SettingsManager;
use crate::db::connection::DbManager;
use crate::download::commands::spawn_progress_forwarder;
use crate::download::manager::DownloadManager;
use crate::db::repo;
use crate::models::types::{AppError, Build, InstalledVersion, VersionConfigLink, VersionOverride};
use crate::version::manager::VersionManager;

/// List all installed versions from the database.
#[tauri::command]
pub fn get_installed_versions(state: State<'_, DbManager>) -> Result<Vec<InstalledVersion>, String> {
    VersionManager::list_installed(&state).map_err(|e| e.to_string())
}

/// Uninstall a version by its database ID.
#[tauri::command]
pub fn uninstall_version(
    state: State<'_, DbManager>,
    id: i64,
) -> Result<bool, String> {
    VersionManager::uninstall_version(&state, id).map(|_| true).map_err(|e| e.to_string())
}

/// Calculate total storage usage of installed versions.
#[tauri::command]
pub async fn get_storage_usage(
    app: AppHandle,
    state_db: State<'_, DbManager>,
) -> Result<u64, String> {
    let fallback_path = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .to_string_lossy()
        .to_string();
    let db = (*state_db).clone();
    tokio::task::spawn_blocking(move || {
        VersionManager::calculate_storage_usage(&db, &fallback_path)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| e.to_string())
}

/// Start installing a new version (download + post-download tasks).
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn install_version(
    app: AppHandle,
    state_db: State<'_, DbManager>,
    state_download: State<'_, DownloadManager>,
    build_number: String,
    backend: String,
    architecture: String,
    url: String,
    total_size: u64,
) -> Result<i64, String> {
    let fallback_path = app.path().app_local_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy().to_string();
    let storage_base = PathBuf::from(SettingsManager::get_storage_path(&state_db, &fallback_path));

    let build = Build {
        build_number,
        backend,
        architecture,
        download_url: url,
        file_size: total_size,
        tag_name: String::new(),
        published_at: String::new(),
        platform: String::new(),
        checksum: None,
    };

    let (tx, rx) = tokio::sync::mpsc::channel::<crate::models::types::DownloadProgress>(64);
    spawn_progress_forwarder(app.clone(), (*state_db).clone(), rx, None);

    // Start install and get download_id + oneshot receiver immediately (non-blocking)
    let (download_id, paths, download_rx) = VersionManager::start_install(
        &state_db,
        &state_download,
        &build,
        storage_base,
        tx.clone(),
    ).await.map_err(|e| e.to_string())?;

    // Spawn post-download tasks (extract, validate, register) in background
    let db_clone = (*state_db).clone();
    tokio::spawn(async move {
        let result = VersionManager::post_download_tasks(&db_clone, download_id, paths.clone(), tx, download_rx).await;
        match result {
            Ok(_) => {},
            Err(AppError::Cancelled) => {
                log::info!("Installation cancelled: build {}", paths.build_number);
            }
            Err(e) => {
                // Persist error message in DB
                if let Ok(conn) = db_clone.lock_conn() {
                    let _ = repo::update_download_error(&conn, download_id, &e.to_string());
                }
                log::error!("Post-download tasks failed for {}: {}", paths.build_number, e);
            }
        }
    });

    Ok(download_id)
}

// ─── Version Config Link Commands ──────────────────────────────────────

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

// ─── Version Override Commands ─────────────────────────────────────────

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

/// Duplicate a version: creates an independent card sharing the same binary files.
/// If `with_settings` is true, also copies customization, config link, and override.
/// Returns the new version's ID.
#[tauri::command]
pub fn duplicate_version(
    state_db: State<'_, DbManager>,
    version_id: i64,
    with_settings: bool,
) -> Result<i64, String> {
    VersionManager::duplicate_version(&state_db, version_id, with_settings).map_err(|e| e.to_string())
}


