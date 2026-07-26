use crate::config::storage::SYSTEM_DIRS;
use crate::db::connection::DbManager;
use crate::db::repo;
use crate::models::types::{AppError, AppSettings};

/// Manages application settings stored in the database.
pub struct SettingsManager;

impl SettingsManager {
    /// Load settings from the database, returning defaults for missing keys.
    pub fn get_settings(db: &DbManager) -> Result<AppSettings, AppError> {
        let conn = db.lock_conn()?;
        let all = repo::get_all_settings(&conn)?;
        let mut map: std::collections::HashMap<String, String> =
            all.into_iter().collect();

        let storage_path = map
            .remove("storage_path")
            .unwrap_or_else(|| "".to_string());

        let theme = map.remove("theme").unwrap_or_else(|| "dark".to_string());

        let auto_check_str = map
            .remove("auto_check_updates")
            .unwrap_or_else(|| "true".to_string());
        let auto_check_updates = auto_check_str == "true";

        let show_update_modal_str = map
            .remove("show_update_modal")
            .unwrap_or_else(|| "true".to_string());
        let show_update_modal = show_update_modal_str == "true";

        let font_family = map.remove("font_family");

        let toast_duration_str = map.remove("toast_duration");
        let toast_duration = toast_duration_str
            .and_then(|s| s.parse::<i64>().ok())
            .or(Some(5000)); // default 5000ms

        let model_folder = map.remove("model_folder");

        let mmproj_folder = map.remove("mmproj_folder");

        Ok(AppSettings {
            storage_path,
            theme,
            auto_check_updates,
            show_update_modal,
            font_family,
            toast_duration,
            model_folder,
            mmproj_folder,
        })
    }

    /// Save settings to the database (upsert all keys).
    pub fn save_settings(db: &DbManager, settings: &AppSettings) -> Result<(), AppError> {
        let conn = db.lock_conn()?;
        repo::set_setting(&conn, "storage_path", &settings.storage_path)?;
        repo::set_setting(&conn, "theme", &settings.theme)?;
        repo::set_setting(
            &conn,
            "auto_check_updates",
            &settings.auto_check_updates.to_string(),
        )?;
        repo::set_setting(
            &conn,
            "show_update_modal",
            &settings.show_update_modal.to_string(),
        )?;
        // Save font_family
        match &settings.font_family {
            Some(family) if !family.is_empty() => {
                repo::set_setting(&conn, "font_family", family)?;
            }
            _ => {
                let _ = repo::delete_setting(&conn, "font_family");
            }
        }
        // Save toast_duration
        match settings.toast_duration {
            Some(duration) => {
                repo::set_setting(&conn, "toast_duration", &duration.to_string())?;
            }
            None => {
                let _ = repo::delete_setting(&conn, "toast_duration");
            }
        }
        // Save model_folder
        match &settings.model_folder {
            Some(folder) if !folder.is_empty() => {
                repo::set_setting(&conn, "model_folder", folder)?;
            }
            _ => {
                let _ = repo::delete_setting(&conn, "model_folder");
            }
        }
        // Save mmproj_folder
        match &settings.mmproj_folder {
            Some(folder) if !folder.is_empty() => {
                repo::set_setting(&conn, "mmproj_folder", folder)?;
            }
            _ => {
                let _ = repo::delete_setting(&conn, "mmproj_folder");
            }
        }
        Ok(())
    }

    /// Initialize default settings if they don't exist.
    pub fn init_defaults(db: &DbManager) -> Result<(), AppError> {
        let conn = db.lock_conn()?;

        // Only set defaults if they don't exist
        if repo::get_setting(&conn, "storage_path").ok().flatten().is_none() {
            repo::set_setting(&conn, "storage_path", "")?;
        }
        if repo::get_setting(&conn, "theme").ok().flatten().is_none() {
            repo::set_setting(&conn, "theme", "catppuccin-mocha")?;
        }
        if repo::get_setting(&conn, "auto_check_updates").ok().flatten().is_none() {
            repo::set_setting(&conn, "auto_check_updates", "true")?;
        }
        if repo::get_setting(&conn, "show_update_modal").ok().flatten().is_none() {
            repo::set_setting(&conn, "show_update_modal", "true")?;
        }
        if repo::get_setting(&conn, "font_family").ok().flatten().is_none() {
            repo::set_setting(&conn, "font_family", "Instrument Sans")?;
        }
        if repo::get_setting(&conn, "toast_duration").ok().flatten().is_none() {
            repo::set_setting(&conn, "toast_duration", "5000")?;
        }

        Ok(())
    }

    /// Get the configured storage path, falling back to the app data directory.
    /// Ensures the path exists on disk, creating it if necessary.
    pub fn get_storage_path(db: &DbManager, fallback: &str) -> String {
        let mut path = match Self::get_settings(db) {
            Ok(settings) if !settings.storage_path.is_empty() => settings.storage_path,
            _ => fallback.to_string(),
        };

        // Ensure the storage directory exists BEFORE canonicalize
        if let Err(e) = std::fs::create_dir_all(&path) {
            log::warn!("Failed to create storage directory {}: {}", path, e);
        }

        // Reject system directories
        let path_buf = std::path::PathBuf::from(&path);
        let resolved = match path_buf.canonicalize() {
            Ok(r) => r,
            Err(e) => {
                log::warn!("Failed to canonicalize storage path {}: {}", path, e);
                path_buf.clone()
            }
        };
        let path_str = resolved.to_string_lossy().to_string();
        if SYSTEM_DIRS.iter().any(|sd| path_str.starts_with(sd)) {
            log::warn!("Storage path {} is in a system directory, using fallback", path_str);
            path = fallback.to_string();
        }

        path
    }
}
