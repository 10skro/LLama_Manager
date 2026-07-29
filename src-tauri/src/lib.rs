mod cards;
mod config;
mod custom_command;
mod db;
mod download;
mod favorites;
mod file;
mod github;
mod logging;
mod models;
mod setup;
mod terminal;
mod theme;
mod update;
mod utils;
mod version;

use tauri::State;

use crate::db::connection::DbManager;
use crate::download::manager::DownloadManager;
use crate::github::api::GithubClient;
use crate::terminal::manager::TerminalManager;
// ─── Tauri Command Wrappers ─────────────────────────────────────────────
// #[tauri::command] must be in this module so generate_handler! can see
// the generated __cmd__* macros. Each wrapper delegates to the domain module.

// GitHub / builds
#[tauri::command]
async fn fetch_builds(
    state_github: State<'_, GithubClient>,
    state_db: State<'_, DbManager>,
    limit: Option<usize>,
    force_refresh: Option<bool>,
) -> Result<Vec<crate::models::types::Build>, String> {
    github::commands::fetch_builds(state_github, state_db, limit, force_refresh).await
}
#[tauri::command]
async fn check_new_builds(
    state_github: State<'_, GithubClient>,
    state_db: State<'_, DbManager>,
) -> Result<Vec<crate::models::types::Build>, String> {
    github::commands::check_new_builds(state_github, state_db).await
}
#[tauri::command]
async fn fetch_release_by_tag(
    state_github: State<'_, GithubClient>,
    tag: String,
) -> Result<Vec<crate::models::types::Build>, String> {
    github::commands::fetch_release_by_tag(state_github, tag).await
}
#[tauri::command]
async fn search_builds(
    state_github: State<'_, GithubClient>,
    query: String,
) -> Result<Vec<crate::models::types::Build>, String> {
    github::commands::search_builds(state_github, query).await
}
#[tauri::command]
async fn fetch_release_changelog(
    state_github: State<'_, GithubClient>,
    tag: String,
) -> Result<Option<String>, String> {
    github::commands::fetch_release_changelog(state_github, tag).await
}
#[tauri::command]
fn get_catalog_last_fetched(
    state_db: State<'_, DbManager>,
) -> Result<Option<String>, String> {
    github::commands::get_catalog_last_fetched(state_db)
}

// Version management
#[tauri::command]
fn get_installed_versions(state: State<'_, DbManager>) -> Result<Vec<crate::models::types::InstalledVersion>, String> {
    version::commands::get_installed_versions(state)
}
#[tauri::command]
fn uninstall_version(
    state: State<'_, DbManager>,
    id: i64,
) -> Result<bool, String> {
    version::commands::uninstall_version(state, id)
}
#[tauri::command]
async fn get_storage_usage(
    app: tauri::AppHandle,
    state_db: State<'_, DbManager>,
) -> Result<u64, String> {
    version::commands::get_storage_usage(app, state_db).await
}
#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn install_version(
    app: tauri::AppHandle,
    state_db: State<'_, DbManager>,
    state_download: State<'_, DownloadManager>,
    build_number: String,
    backend: String,
    architecture: String,
    url: String,
    total_size: u64,
) -> Result<i64, String> {
    version::commands::install_version(app, state_db, state_download, build_number, backend, architecture, url, total_size).await
}
#[tauri::command]
fn get_version_config_link(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<Option<crate::models::types::VersionConfigLink>, String> {
    version::commands::get_version_config_link(state_db, version_id)
}
#[tauri::command]
fn save_version_config_link(
    state_db: State<'_, DbManager>,
    version_id: i64,
    config_type: String,
    config_id: String,
) -> Result<i64, String> {
    version::commands::save_version_config_link(state_db, version_id, config_type, config_id)
}
#[tauri::command]
fn delete_version_config_link(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<bool, String> {
    version::commands::delete_version_config_link(state_db, version_id)
}
#[tauri::command]
fn get_version_override(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<Option<crate::models::types::VersionOverride>, String> {
    version::commands::get_version_override(state_db, version_id)
}
#[tauri::command]
fn save_version_override(
    state_db: State<'_, DbManager>,
    version_id: i64,
    model_path: Option<String>,
    mmproj_path: Option<String>,
) -> Result<(), String> {
    version::commands::save_version_override(state_db, version_id, model_path, mmproj_path)
}
#[tauri::command]
fn delete_version_override(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<bool, String> {
    version::commands::delete_version_override(state_db, version_id)
}
#[tauri::command]
fn duplicate_version(
    state_db: State<'_, DbManager>,
    version_id: i64,
    with_settings: bool,
) -> Result<i64, String> {
    version::commands::duplicate_version(state_db, version_id, with_settings)
}

// Download management
#[tauri::command]
async fn cancel_download(
    state: State<'_, DownloadManager>,
    id: i64,
) -> Result<bool, String> {
    download::commands::cancel_download(state, id).await
}
#[tauri::command]
fn get_download_status(
    state: State<'_, DbManager>,
    id: i64,
) -> Result<Option<serde_json::Value>, String> {
    download::commands::get_download_status(state, id)
}

// Settings & config
#[tauri::command]
fn get_settings(state: State<'_, DbManager>) -> Result<serde_json::Value, String> {
    config::commands::get_settings(state)
}
#[tauri::command]
fn save_settings(
    state: State<'_, DbManager>,
    settings: serde_json::Value,
) -> Result<(), String> {
    config::commands::save_settings(state, settings)
}
#[tauri::command]
fn open_folder_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    config::commands::open_folder_dialog(app)
}
#[tauri::command]
fn change_storage_path(
    state_db: State<'_, DbManager>,
    old_path: String,
    new_path: String,
) -> Result<String, String> {
    config::commands::change_storage_path(state_db, old_path, new_path)
}
#[tauri::command]
fn save_github_token(
    state_db: State<'_, DbManager>,
    state_github: State<'_, GithubClient>,
    token: String,
) -> Result<(), String> {
    config::commands::save_github_token(state_db, state_github, token)
}
#[tauri::command]
fn has_github_token(
    state_db: State<'_, DbManager>,
) -> Result<bool, String> {
    config::commands::has_github_token(state_db)
}
#[tauri::command]
fn delete_github_token(
    state_db: State<'_, DbManager>,
    state_github: State<'_, GithubClient>,
) -> Result<(), String> {
    config::commands::delete_github_token(state_db, state_github)
}
#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    config::commands::get_app_version(app)
}

// Favorites
#[tauri::command]
fn get_favorite_builds(state: State<'_, DbManager>) -> Result<Vec<crate::models::types::FavoriteBuild>, String> {
    favorites::commands::get_favorite_builds(state)
}
#[tauri::command]
fn toggle_favorite_build(
    state: State<'_, DbManager>,
    build_number: String,
    backend: String,
    download_url: String,
    architecture: String,
) -> Result<bool, String> {
    favorites::commands::toggle_favorite_build(state, build_number, backend, download_url, architecture)
}

// Card customization
#[tauri::command]
fn get_card_customizations(
    state_db: State<'_, DbManager>,
) -> Result<Vec<crate::models::types::CardCustomization>, String> {
    cards::commands::get_card_customizations(state_db)
}
#[tauri::command]
fn save_card_customization(
    state_db: State<'_, DbManager>,
    version_id: i64,
    title: String,
    header_color: String,
    text_color: String,
) -> Result<(), String> {
    cards::commands::save_card_customization(state_db, version_id, title, header_color, text_color)
}
#[tauri::command]
fn delete_card_customization(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<bool, String> {
    cards::commands::delete_card_customization(state_db, version_id)
}
#[tauri::command]
fn bulk_set_display_order(
    state_db: State<'_, DbManager>,
    orders: Vec<(i64, i64)>,
) -> Result<(), String> {
    cards::commands::bulk_set_display_order(state_db, orders)
}
#[tauri::command]
fn reset_display_order(state_db: State<'_, DbManager>) -> Result<(), String> {
    cards::commands::reset_display_order(state_db)
}

// Custom commands
#[tauri::command]
fn save_custom_command(
    state_db: State<'_, DbManager>,
    config: serde_json::Value,
) -> Result<String, String> {
    custom_command::commands::save_custom_command(state_db, config)
}
#[tauri::command]
fn get_custom_commands(
    state_db: State<'_, DbManager>,
) -> Result<Vec<serde_json::Value>, String> {
    custom_command::commands::get_custom_commands(state_db)
}
#[tauri::command]
fn delete_custom_command(
    state_db: State<'_, DbManager>,
    id: String,
) -> Result<bool, String> {
    custom_command::commands::delete_custom_command(state_db, id)
}

// File scanning
#[tauri::command]
fn scan_model_files(
    folder_path: String,
    extensions: String,
) -> Result<Vec<crate::models::types::ModelFile>, String> {
    file::commands::scan_model_files(folder_path, extensions)
}
#[tauri::command]
fn scan_mmproj_files(
    folder_path: String,
    extensions: String,
) -> Result<Vec<crate::models::types::ModelFile>, String> {
    file::commands::scan_mmproj_files(folder_path, extensions)
}
#[tauri::command]
fn validate_folder(path: String) -> Result<bool, String> {
    file::commands::validate_folder(path)
}

// Terminal
#[tauri::command]
fn spawn_terminal(
    app: tauri::AppHandle,
    state_terminal: State<'_, TerminalManager>,
    config_id: String,
    version_id: i64,
    working_dir: String,
    startup_command: Option<String>,
) -> Result<String, String> {
    terminal::commands::spawn_terminal(app, state_terminal, config_id, version_id, working_dir, startup_command)
}
#[tauri::command]
fn write_terminal_input(
    state_terminal: State<'_, TerminalManager>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    terminal::commands::write_terminal_input(state_terminal, session_id, input)
}
#[tauri::command]
async fn kill_terminal(
    app: tauri::AppHandle,
    state_terminal: State<'_, TerminalManager>,
    session_id: String,
) -> Result<String, String> {
    terminal::commands::kill_terminal(app, state_terminal, session_id)
}
#[tauri::command]
fn list_active_terminals(
    state_terminal: State<'_, TerminalManager>,
) -> Vec<crate::terminal::manager::ActiveTerminalInfo> {
    terminal::commands::list_active_terminals(state_terminal)
}
#[tauri::command]
fn get_terminal_by_config(
    state_terminal: State<'_, TerminalManager>,
    config_id: String,
) -> Option<String> {
    terminal::commands::get_terminal_by_config(state_terminal, config_id)
}
#[tauri::command]
fn get_terminal_buffer(
    state_terminal: State<'_, TerminalManager>,
    session_id: String,
) -> String {
    terminal::commands::get_terminal_buffer(state_terminal, session_id)
}
#[tauri::command]
async fn open_terminal_window(app: tauri::AppHandle) -> Result<(), String> {
    terminal::commands::open_terminal_window(app).await
}
#[tauri::command]
fn kill_all_terminals(
    state_terminal: State<'_, TerminalManager>,
) {
    terminal::commands::kill_all_terminals(state_terminal)
}

// App Update
#[tauri::command]
async fn check_app_update(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    update::commands::check_app_update(app).await
}
#[tauri::command]
async fn install_app_update(
    app: tauri::AppHandle,
    changelog_version: Option<String>,
    changelog_body: Option<String>,
) -> Result<(), String> {
    update::commands::install_app_update(app, changelog_version, changelog_body).await
}

// Theme
#[tauri::command]
async fn persist_theme_change(
    app: tauri::AppHandle,
    db: State<'_, DbManager>,
    theme_id: String,
) -> Result<(), String> {
    theme::commands::persist_theme_change(app, db, theme_id).await
}

// ─── App Entry Point ───────────────────────────────────────────────────

pub fn run_tauri_app() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| setup::init(app).map_err(|e| Box::new(e) as Box<dyn std::error::Error>))
        .invoke_handler(tauri::generate_handler![
            fetch_builds,
            check_new_builds,
            fetch_release_by_tag,
            search_builds,
            fetch_release_changelog,
            get_catalog_last_fetched,
            get_installed_versions,
            uninstall_version,
            get_storage_usage,
            install_version,
            get_version_config_link,
            save_version_config_link,
            delete_version_config_link,
            get_version_override,
            save_version_override,
            delete_version_override,
            duplicate_version,
            cancel_download,
            get_download_status,
            get_settings,
            save_settings,
            open_folder_dialog,
            change_storage_path,
            save_github_token,
            has_github_token,
            delete_github_token,
            get_app_version,
            get_favorite_builds,
            toggle_favorite_build,
            get_card_customizations,
            save_card_customization,
            delete_card_customization,
            bulk_set_display_order,
            reset_display_order,
            save_custom_command,
            get_custom_commands,
            delete_custom_command,
            scan_model_files,
            scan_mmproj_files,
            validate_folder,
            spawn_terminal,
            write_terminal_input,
            kill_terminal,
            list_active_terminals,
            get_terminal_by_config,
            get_terminal_buffer,
            open_terminal_window,
            kill_all_terminals,
            persist_theme_change,
            check_app_update,
            install_app_update,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Tauri app");
}
