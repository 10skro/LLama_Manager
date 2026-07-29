//! Database initialization: tables, default settings, GitHub token, ETag,
//! old downloads cleanup, and saved theme retrieval.

use crate::config::settings::SettingsManager;
use crate::db::connection::DbManager;
use crate::db::repo;
use crate::models::types::AppError;

/// Data loaded from the database during setup, before it's moved into Tauri state.
pub struct DatabaseSetupResult {
    pub db: DbManager,
    pub github_token: Option<String>,
    pub persisted_etag: Option<String>,
    pub initial_theme: String,
}

/// Initialize the database: create tables, seed defaults, and read startup values.
/// Returns the DbManager handle (for Tauri state) alongside the values needed
/// to configure the GithubClient and the main window theme.
pub fn init(app_dir: &std::path::Path) -> Result<DatabaseSetupResult, AppError> {
    let db_path = app_dir.join("database").join("llama.db");
    let db = DbManager::new(&db_path)?;
    db.init_tables()?;

    SettingsManager::init_defaults(&db)?;

    // Load GitHub token from settings table
    let github_token = {
        let conn = db.lock_conn().ok();
        conn.and_then(|c| repo::get_setting(&c, "github_token").ok().flatten())
    };

    // Load persisted ETag for conditional GitHub requests on startup
    let persisted_etag = {
        let conn = db.lock_conn()?;
        repo::get_setting(&conn, "github_etag")?
    };

    // Clean up old downloads (30 days retention)
    {
        let conn = db.lock_conn()?;
        let cleaned = repo::cleanup_old_downloads(&conn, 30)?;
        if cleaned > 0 {
            log::info!("Cleaned up {} old download records", cleaned);
        }
    }

    // Read saved theme before db is moved into Tauri state
    let initial_theme = {
        let conn = db.lock_conn().ok();
        conn.and_then(|c| repo::get_setting(&c, "theme").ok().flatten())
    }
    .unwrap_or_else(|| "catppuccin-mocha".to_string());

    Ok(DatabaseSetupResult {
        db,
        github_token,
        persisted_etag,
        initial_theme,
    })
}
