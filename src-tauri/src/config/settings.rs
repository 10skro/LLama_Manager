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

        let last_fetch = map.remove("last_fetch");

        let auto_check_str = map
            .remove("auto_check_updates")
            .unwrap_or_else(|| "true".to_string());
        let auto_check_updates = auto_check_str == "true";

        let github_token = map.remove("github_token");

        Ok(AppSettings {
            storage_path,
            theme,
            last_fetch,
            auto_check_updates,
            github_token,
        })
    }

    /// Save settings to the database (upsert all keys).
    pub fn save_settings(db: &DbManager, settings: &AppSettings) -> Result<(), AppError> {
        let conn = db.lock_conn()?;
        repo::set_setting(&conn, "storage_path", &settings.storage_path)?;
        repo::set_setting(&conn, "theme", &settings.theme)?;
        repo::set_setting(
            &conn,
            "last_fetch",
            &settings.last_fetch.clone().unwrap_or_default(),
        )?;
        repo::set_setting(
            &conn,
            "auto_check_updates",
            &settings.auto_check_updates.to_string(),
        )?;
        // Save github_token (empty string means "not set")
        match &settings.github_token {
            Some(token) if !token.is_empty() => {
                repo::set_setting(&conn, "github_token", token)?;
            }
            _ => {
                // Remove the token if it's empty/None
                let _ = repo::delete_setting(&conn, "github_token");
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
            repo::set_setting(&conn, "theme", "dark")?;
        }
        if repo::get_setting(&conn, "auto_check_updates").ok().flatten().is_none() {
            repo::set_setting(&conn, "auto_check_updates", "true")?;
        }

        Ok(())
    }

    /// Get the configured storage path, falling back to the app data directory.
    pub fn get_storage_path(db: &DbManager, fallback: &str) -> String {
        match Self::get_settings(db) {
            Ok(settings) if !settings.storage_path.is_empty() => settings.storage_path,
            _ => fallback.to_string(),
        }
    }
}
