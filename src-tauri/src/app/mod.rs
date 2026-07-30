//! Tauri application entry point — builder, plugins, setup, invoke handler.

use crate::setup;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| setup::init(app).map_err(|e| Box::new(e) as Box<dyn std::error::Error>))
        .invoke_handler(tauri::generate_handler![
            crate::github::commands::fetch_builds,
            crate::github::commands::check_new_builds,
            crate::github::commands::fetch_release_by_tag,
            crate::github::commands::search_builds,
            crate::github::commands::fetch_release_changelog,
            crate::github::commands::get_catalog_last_fetched,
            crate::version::commands::get_installed_versions,
            crate::version::commands::uninstall_version,
            crate::version::commands::get_storage_usage,
            crate::version::commands::install_version,
            crate::version::config_link::get_version_config_link,
            crate::version::config_link::save_version_config_link,
            crate::version::config_link::delete_version_config_link,
            crate::version::override_::get_version_override,
            crate::version::override_::save_version_override,
            crate::version::override_::delete_version_override,
            crate::version::commands::duplicate_version,
            crate::download::commands::cancel_download,
            crate::download::commands::get_download_status,
            crate::config::commands::get_settings,
            crate::config::commands::save_settings,
            crate::config::commands::open_folder_dialog,
            crate::config::commands::change_storage_path,
            crate::config::commands::save_github_token,
            crate::config::commands::has_github_token,
            crate::config::commands::delete_github_token,
            crate::config::commands::get_app_version,
            crate::favorites::commands::get_favorite_builds,
            crate::favorites::commands::toggle_favorite_build,
            crate::cards::commands::get_card_customizations,
            crate::cards::commands::save_card_customization,
            crate::cards::commands::delete_card_customization,
            crate::cards::commands::bulk_set_display_order,
            crate::cards::commands::reset_display_order,
            crate::custom_command::commands::save_custom_command,
            crate::custom_command::commands::get_custom_commands,
            crate::custom_command::commands::delete_custom_command,
            crate::file::commands::scan_model_files,
            crate::file::commands::scan_mmproj_files,
            crate::file::commands::validate_folder,
            crate::terminal::commands::spawn_terminal,
            crate::terminal::commands::kill_terminal,
            crate::terminal::commands::list_active_terminals,
            crate::terminal::commands::get_terminal_by_config,
            crate::terminal::commands::get_terminal_buffer,
            crate::terminal::commands::open_terminal_window,
            crate::terminal::commands::kill_all_terminals,
            crate::theme::commands::persist_theme_change,
            crate::theme::commands::get_saved_theme,
            crate::update::commands::check_app_update,
            crate::update::commands::install_app_update,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Tauri app");
}
