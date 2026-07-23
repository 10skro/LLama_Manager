#![allow(dead_code)]

mod config;
mod db;
mod download;
mod file;
mod github;
mod models;
mod utils;
mod version;

use std::path::PathBuf;

use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

use crate::config::settings::SettingsManager;
use crate::db::connection::DbManager;
use crate::db::repo;
use crate::download::manager::DownloadManager;
use crate::github::api::{FetchMode, GithubClient};
use crate::models::types::{
    AppError, AppSettings, Build, DownloadProgress, FavoriteBuild, InstalledVersion,
};
use crate::version::manager::VersionManager;

const DEFAULT_RELEASE_LIMIT: usize = 50;
const SEARCH_MAX_RELEASES: usize = 100;

// ─── Helpers ────────────────────────────────────────────────────────────

/// Spawn a background task that forwards download progress events to the frontend
/// and writes to the DB with throttling (every 5 events or on terminal status).
/// When `download_id` is `None`, the ID is taken from each progress message.
fn spawn_progress_forwarder(
    app: tauri::AppHandle,
    db: DbManager,
    mut rx: tokio::sync::mpsc::Receiver<DownloadProgress>,
    download_id: Option<i64>,
) {
    tokio::spawn(async move {
        let mut update_counter: u32 = 0;
        const DB_WRITE_INTERVAL: u32 = 5;
        while let Some(progress) = rx.recv().await {
            let _ = app.emit("download-progress", &progress);
            update_counter += 1;
            let is_terminal = ["completed", "failed", "cancelled"].contains(&progress.status.as_str());
            if is_terminal || update_counter % DB_WRITE_INTERVAL == 0 {
                let id = download_id.unwrap_or(progress.download_id);
                if let Ok(conn) = db.lock_conn() {
                    let _ = repo::update_download_progress(&conn, id, progress.downloaded, &progress.status);
                }
            }
        }
    });
}

// ─── Tauri Commands ─────────────────────────────────────────────────────

#[tauri::command]
async fn fetch_builds(
    state_github: tauri::State<'_, GithubClient>,
    state_db: tauri::State<'_, DbManager>,
    limit: Option<usize>,
    force_refresh: Option<bool>,
) -> Result<Vec<Build>, String> {
    let release_limit = limit.unwrap_or(DEFAULT_RELEASE_LIMIT);
    let mode = if force_refresh == Some(true) {
        FetchMode::ForceRefresh
    } else {
        FetchMode::Conditional
    };
    github::api::fetch_builds_from_cache_or_api(&state_github, &state_db, release_limit, mode)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_new_builds(
    state_github: tauri::State<'_, GithubClient>,
    state_db: tauri::State<'_, DbManager>,
) -> Result<Vec<Build>, String> {
    let installed = VersionManager::list_installed(&state_db).map_err(|e| e.to_string())?;
    let available_builds = github::api::fetch_builds_from_cache_or_api(&state_github, &state_db, DEFAULT_RELEASE_LIMIT, FetchMode::Conditional)
        .await
        .map_err(|e| e.to_string())?;
    Ok(github::api::check_for_new_builds(&installed, &available_builds))
}

#[tauri::command]
async fn fetch_release_by_tag(
    state_github: tauri::State<'_, GithubClient>,
    tag: String,
) -> Result<Vec<Build>, String> {
    github::api::fetch_release_by_tag(&state_github, tag)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_builds(
    state_github: tauri::State<'_, GithubClient>,
    query: String,
) -> Result<Vec<Build>, String> {
    github::api::search_builds(&state_github, query, SEARCH_MAX_RELEASES)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_installed_versions(state: tauri::State<'_, DbManager>) -> Result<Vec<InstalledVersion>, String> {
    VersionManager::list_installed(&state).map_err(|e| e.to_string())
}

#[tauri::command]
fn uninstall_version(
    state: tauri::State<'_, DbManager>,
    id: i64,
) -> Result<bool, String> {
    VersionManager::uninstall_version(&state, id).map(|_| true).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_folder(
    app: tauri::AppHandle,
    state_db: tauri::State<'_, DbManager>,
    path: String,
) -> Result<String, String> {
    // Get the actual storage base (respects user-configured custom path)
    let fallback_path = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .to_string_lossy()
        .to_string();
    let storage_dir = std::path::PathBuf::from(SettingsManager::get_storage_path(&state_db, &fallback_path));

    // Canonicalize both paths to resolve .. and symlinks
    let canonical_storage = storage_dir.canonicalize()
        .map_err(|e| format!("Storage directory not found: {}", e))?;
    let path_buf = std::path::PathBuf::from(&path);
    let canonical_path = path_buf.canonicalize()
        .map_err(|e| format!("Path not found: {}", e))?;

    // Check that the canonical path starts with the canonical storage dir
    if !canonical_path.starts_with(&canonical_storage) {
        return Err("Access denied: path is outside the storage directory".to_string());
    }

    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;

    Ok("Folder opened".to_string())
}

#[tauri::command]
async fn cancel_download(
    state_download: tauri::State<'_, DownloadManager>,
    id: i64,
) -> Result<bool, String> {
    state_download.cancel_download(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
fn get_download_status(
    state: tauri::State<'_, DbManager>,
    id: i64,
) -> Result<Option<serde_json::Value>, String> {
    let conn = state.lock_conn().map_err(|e| e.to_string())?;
    let record = repo::get_download(&conn, id).map_err(|e| e.to_string())?;
    Ok(record.map(|r| serde_json::to_value(r).unwrap_or_default()))
}

#[tauri::command]
fn get_settings(state: tauri::State<'_, DbManager>) -> Result<serde_json::Value, String> {
    let settings = SettingsManager::get_settings(&state).map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(settings).map_err(|e| e.to_string())?)
}

#[tauri::command]
fn save_settings(
    state: tauri::State<'_, DbManager>,
    settings: serde_json::Value,
) -> Result<(), String> {
    let s: AppSettings = serde_json::from_value(settings).map_err(|e| e.to_string())?;
    SettingsManager::save_settings(&state, &s).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_folder_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
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

#[tauri::command]
async fn install_version(
    app: tauri::AppHandle,
    state_db: tauri::State<'_, DbManager>,
    state_download: tauri::State<'_, DownloadManager>,
    build_number: String,
    backend: String,
    url: String,
    total_size: u64,
) -> Result<i64, String> {
    // Get storage base path from settings
    let fallback_path = app.path().app_local_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy().to_string();
    let storage_base = PathBuf::from(SettingsManager::get_storage_path(&state_db, &fallback_path));

    // Build the Build struct for VersionManager
    let build = Build {
        build_number,
        backend,
        download_url: url,
        file_size: total_size,
        tag_name: String::new(),
        published_at: String::new(),
        platform: String::new(),
        architecture: String::new(),
        checksum: None,
    };

    // Create progress channel and spawn forwarder task
    let (tx, rx) = tokio::sync::mpsc::channel::<DownloadProgress>(64);
    spawn_progress_forwarder(app.clone(), (*state_db).clone(), rx, None);

    // Run the full install pipeline: download -> extract -> validate -> register
    let result = VersionManager::install_version(
        &state_db,
        &state_download,
        &build,
        storage_base,
        tx,
    ).await;

    match result {
        Ok(version) => Ok(version.id),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn fetch_release_changelog(
    state_github: tauri::State<'_, GithubClient>,
    tag: String,
) -> Result<Option<String>, String> {
    github::api::fetch_release_changelog(&state_github, tag)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_favorite_builds(state: tauri::State<'_, DbManager>) -> Result<Vec<FavoriteBuild>, String> {
    let conn = state.lock_conn().map_err(|e| e.to_string())?;
    repo::get_favorite_builds(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_favorite_build(
    state: tauri::State<'_, DbManager>,
    build_number: String,
    backend: String,
    download_url: String,
) -> Result<bool, String> {
    let conn = state.lock_conn().map_err(|e| e.to_string())?;
    repo::toggle_favorite_build(&conn, &build_number, &backend, &download_url).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_github_token(
    state_github: tauri::State<'_, GithubClient>,
    token: String,
) -> Result<(), String> {
    if token.is_empty() {
        crate::config::credential::CredentialManager::delete_github_token()
            .map_err(|e| e.to_string())?;
        state_github.set_token(None);
    } else {
        crate::config::credential::CredentialManager::save_github_token(&token)
            .map_err(|e| e.to_string())?;
        state_github.set_token(Some(token));
    }
    Ok(())
}

#[tauri::command]
fn has_github_token() -> Result<bool, String> {
    crate::config::credential::CredentialManager::has_github_token()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_github_token(
    state_github: tauri::State<'_, GithubClient>,
) -> Result<(), String> {
    crate::config::credential::CredentialManager::delete_github_token()
        .map_err(|e| e.to_string())?;
    state_github.set_token(None);
    Ok(())
}

#[tauri::command]
fn get_catalog_last_fetched(
    state_db: tauri::State<'_, DbManager>,
) -> Result<Option<String>, String> {
    Ok(github::api::get_catalog_last_fetched(&state_db))
}

#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

// ─── App Entry Point ───────────────────────────────────────────────────

pub fn run_tauri_app() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_local_data_dir()
                .expect("Failed to get app data dir");

            // Create required directories
            setup_directories(&app_dir).map_err(|e| e.to_string())?;

            // Initialize database
            let db_path = app_dir.join("database").join("llama.db");
            let db = DbManager::new(&db_path).map_err(|e| e.to_string())?;
            db.init_tables().map_err(|e| e.to_string())?;

            // Initialize default settings
            SettingsManager::init_defaults(&db).map_err(|e| e.to_string())?;

            // Load GitHub token from secure keyring (not from settings DB)
            let github_token = crate::config::credential::CredentialManager::get_github_token()
                .map_err(|e| e.to_string())?;

            // Load persisted ETag from DB for conditional requests on startup
            let persisted_etag = {
                let conn = db.lock_conn().map_err(|e| e.to_string())?;
                repo::get_setting(&conn, "github_etag").map_err(|e| e.to_string())?
            };

            // Register state
            app.manage(db);
            app.manage(DownloadManager::new());
            app.manage(GithubClient::new(github_token, persisted_etag));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_builds,
            check_new_builds,
            fetch_release_by_tag,
            search_builds,
            get_installed_versions,
            uninstall_version,
            open_folder,
            cancel_download,
            get_download_status,
            get_settings,
            save_settings,
            open_folder_dialog,
            install_version,
            fetch_release_changelog,
            get_favorite_builds,
            toggle_favorite_build,
            save_github_token,
            has_github_token,
            delete_github_token,
            get_catalog_last_fetched,
            get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Tauri app");
}

// ─── Directory Setup ────────────────────────────────────────────────────

fn setup_directories(base: &PathBuf) -> Result<(), AppError> {
    let dirs = ["versions", "database", "downloads", "logs"];
    for dir in &dirs {
        let path = base.join(dir);
        std::fs::create_dir_all(&path)?;
    }
    Ok(())
}
