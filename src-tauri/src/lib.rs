#![allow(dead_code)]

mod config;
mod custom_command;
mod db;
mod download;
mod file;
mod github;
mod launch_config;
mod models;
mod terminal;
mod utils;
mod version;

use std::path::PathBuf;
use std::time::{Duration, Instant};

use tauri::{Emitter, Listener, Manager};
use tauri_plugin_dialog::DialogExt;

use crate::config::settings::SettingsManager;
use crate::config::storage::{validate_storage_path, migrate_storage_path, cleanup_old_storage};
use crate::db::connection::DbManager;
use crate::db::repo;
use crate::download::manager::DownloadManager;
use crate::github::api::{FetchMode, GithubClient};
use crate::models::types::{
    AppError, AppSettings, Build, CardCustomization, DownloadProgress, FavoriteBuild, InstalledVersion,
    ModelFile, VersionConfigLink,
};
use crate::terminal::manager::TerminalManager;
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
            if is_terminal || update_counter % DB_WRITE_INTERVAL == 0 {
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

    let (tx, rx) = tokio::sync::mpsc::channel::<DownloadProgress>(64);
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
        let result = VersionManager::post_download_tasks(&db_clone, download_id, paths, tx, download_rx).await;
        match result {
            Ok(_) => {},
            Err(e) => {
                log::error!("Post-download tasks failed: {}", e);
            }
        }
    });

    Ok(download_id)
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
    architecture: String,
) -> Result<bool, String> {
    let mut conn = state.lock_conn().map_err(|e| e.to_string())?;
    repo::toggle_favorite_build(&mut conn, &build_number, &backend, &download_url, &architecture).map_err(|e| e.to_string())
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
fn change_storage_path(
    state_db: tauri::State<'_, DbManager>,
    old_path: String,
    new_path: String,
) -> Result<String, String> {
    // 1. Validate the new path
    validate_storage_path(&new_path, &old_path).map_err(|e| e.to_string())?;

    // 2. Migrate files from old to new location
    migrate_storage_path(&old_path, &new_path, &state_db)
        .map_err(|e| e.to_string())?;

    // 3. Save new path to database (only after successful migration)
    // Load current settings, update storage_path, save back
    let mut settings = SettingsManager::get_settings(&state_db)
        .map_err(|e| format!("Failed to load settings: {}", e))?;
    settings.storage_path = new_path.clone();
    SettingsManager::save_settings(&state_db, &settings)
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    // 4. Clean up old directory
    cleanup_old_storage(&old_path);

    Ok(new_path)
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

#[tauri::command]
async fn get_storage_usage(
    app: tauri::AppHandle,
    state_db: tauri::State<'_, DbManager>,
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

// ─── Model File Scanning ─────────────────────────────────────────────────

#[tauri::command]
fn scan_model_files(folder_path: String) -> Result<Vec<ModelFile>, String> {
    let path = std::path::Path::new(&folder_path);

    if !path.exists() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", folder_path));
    }

    let mut files: Vec<ModelFile> = Vec::new();

    for entry in std::fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_path = entry.path();

        // Non-recursive: only files directly in the folder
        if !file_path.is_file() {
            continue;
        }

        let extension = file_path.extension().and_then(|e| e.to_str());
        if extension != Some("gguf") {
            continue;
        }

        let metadata = entry.metadata().map_err(|e| format!("Failed to read metadata: {}", e))?;
        let name = file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        files.push(ModelFile {
            path: file_path.to_string_lossy().to_string(),
            name,
            size: metadata.len(),
        });
    }

    // Sort by name for consistent ordering
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(files)
}

// ─── Launch Config Commands ──────────────────────────────────────────────

#[tauri::command]
fn save_launch_config(
    state_db: tauri::State<'_, DbManager>,
    config: serde_json::Value,
) -> Result<String, String> {
    launch_config::save_launch_config(&state_db, config).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_launch_configs(
    state_db: tauri::State<'_, DbManager>,
) -> Result<Vec<serde_json::Value>, String> {
    launch_config::get_launch_configs(&state_db).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_launch_config(
    state_db: tauri::State<'_, DbManager>,
    id: String,
) -> Result<bool, String> {
    launch_config::delete_launch_config(&state_db, &id).map_err(|e| e.to_string())
}

// ─── Card Customization Commands ────────────────────────────────────────

#[tauri::command]
fn get_card_customizations(
    state_db: tauri::State<'_, DbManager>,
) -> Result<Vec<CardCustomization>, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::get_all_card_customizations(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_card_customization(
    state_db: tauri::State<'_, DbManager>,
    version_id: i64,
    title: String,
    header_color: String,
    text_color: String,
) -> Result<(), String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    let customization = CardCustomization {
        version_id,
        title,
        header_color,
        text_color,
    };
    repo::upsert_card_customization(&conn, &customization).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_card_customization(
    state_db: tauri::State<'_, DbManager>,
    version_id: i64,
) -> Result<bool, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::delete_card_customization(&conn, version_id).map_err(|e| e.to_string())
}

// ─── Custom Command Commands ────────────────────────────────────────────

#[tauri::command]
fn save_custom_command(
    state_db: tauri::State<'_, DbManager>,
    config: serde_json::Value,
) -> Result<String, String> {
    custom_command::save_custom_command(&state_db, config).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_custom_commands(
    state_db: tauri::State<'_, DbManager>,
) -> Result<Vec<serde_json::Value>, String> {
    custom_command::get_custom_commands(&state_db).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_custom_command(
    state_db: tauri::State<'_, DbManager>,
    id: String,
) -> Result<bool, String> {
    custom_command::delete_custom_command(&state_db, &id).map_err(|e| e.to_string())
}

// ─── Version Config Link Commands ──────────────────────────────────────

#[tauri::command]
fn get_version_config_link(
    state_db: tauri::State<'_, DbManager>,
    version_id: i64,
) -> Result<Option<VersionConfigLink>, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::get_version_config_link(&conn, version_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_version_config_link(
    state_db: tauri::State<'_, DbManager>,
    version_id: i64,
    config_type: String,
    config_id: String,
) -> Result<i64, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::save_version_config_link(&conn, version_id, &config_type, &config_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_version_config_link(
    state_db: tauri::State<'_, DbManager>,
    version_id: i64,
) -> Result<bool, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::delete_version_config_link(&conn, version_id).map_err(|e| e.to_string())
}

// ─── Terminal Commands ─────────────────────────────────────────────────

#[tauri::command]
fn spawn_terminal(
    app: tauri::AppHandle,
    state_terminal: tauri::State<'_, TerminalManager>,
    config_id: String,
    shell_type: String,
    working_dir: String,
) -> Result<String, String> {
    state_terminal.spawn(app, config_id, shell_type, working_dir)
}

#[tauri::command]
fn write_terminal_input(
    state_terminal: tauri::State<'_, TerminalManager>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    state_terminal.write_input(&session_id, input)
}

#[tauri::command]
fn kill_terminal(
    state_terminal: tauri::State<'_, TerminalManager>,
    session_id: String,
) -> Result<String, String> {
    state_terminal.kill(&session_id)
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

            // Clean up old downloads (30 days retention)
            {
                let conn = db.lock_conn().map_err(|e| e.to_string())?;
                let cleaned = repo::cleanup_old_downloads(&conn, 30).map_err(|e| e.to_string())?;
                if cleaned > 0 {
                    log::info!("Cleaned up {} old download records", cleaned);
                }
            }

            // Register state
            app.manage(db);
            app.manage(DownloadManager::new());
            app.manage(GithubClient::new(github_token, persisted_etag));
            app.manage(TerminalManager::new());

            // Cleanup terminal sessions on app close
            {
                let app_handle = app.app_handle().clone();
                app_handle.clone().listen("tauri://destroy", move |_| {
                    let terminal = app_handle.state::<TerminalManager>();
                    terminal.kill_all();
                });
            }

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
            change_storage_path,
            get_app_version,
            get_storage_usage,
            scan_model_files,
            save_launch_config,
            get_launch_configs,
            delete_launch_config,
            get_card_customizations,
            save_card_customization,
            delete_card_customization,
            save_custom_command,
            get_custom_commands,
            delete_custom_command,
            get_version_config_link,
            save_version_config_link,
            delete_version_config_link,
            spawn_terminal,
            write_terminal_input,
            kill_terminal,
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
