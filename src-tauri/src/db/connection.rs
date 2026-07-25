use std::path::Path;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use crate::models::types::AppError;

/// Database manager wrapping a rusqlite connection with mutex for thread safety.
/// Wrapped in Arc so it can be cloned and shared across async tasks.
#[derive(Clone)]
pub struct DbManager {
    inner: Arc<DbManagerInner>,
}

struct DbManagerInner {
    conn: Mutex<Connection>,
    db_path: String,
}

impl DbManager {
    /// Create a new DbManager, opening (or creating) the database at the given path.
    pub fn new(db_path: &Path) -> Result<Self, AppError> {
        let path_str = db_path.to_string_lossy().to_string();
        let conn = Connection::open(db_path)?;
        Ok(Self {
            inner: Arc::new(DbManagerInner {
                conn: Mutex::new(conn),
                db_path: path_str,
            }),
        })
    }

    /// Get the database path string.
    pub fn db_path(&self) -> &str {
        &self.inner.db_path
    }

    /// Initialize all required tables.
    pub fn init_tables(&self) -> Result<(), AppError> {
        let conn = self.inner.conn.lock().map_err(|e| AppError::Generic(format!("Mutex poisoned: {}", e)))?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS installed_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                build_number TEXT NOT NULL,
                backend TEXT NOT NULL,
                architecture TEXT NOT NULL DEFAULT 'x64',
                install_path TEXT NOT NULL,
                installed_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'installed' CHECK(status IN ('installed', 'corrupt', 'pending')),
                download_id INTEGER,
                FOREIGN KEY (download_id) REFERENCES downloads(id),
                UNIQUE(build_number, backend, architecture)
            );

            CREATE TABLE IF NOT EXISTS downloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                build_number TEXT NOT NULL,
                download_url TEXT NOT NULL,
                file_path TEXT,
                total_size INTEGER NOT NULL DEFAULT 0,
                downloaded_size INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'downloading', 'extracting', 'completed', 'failed', 'cancelled')),
                error_message TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS builds_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                build_number TEXT NOT NULL,
                tag_name TEXT,
                published_at TEXT,
                platform TEXT,
                architecture TEXT,
                backend TEXT,
                download_url TEXT,
                file_size INTEGER,
                checksum TEXT,
                fetched_at TEXT NOT NULL,
                UNIQUE(build_number, backend, architecture)
            );

            CREATE TABLE IF NOT EXISTS favorite_builds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                build_number TEXT NOT NULL,
                backend TEXT NOT NULL,
                download_url TEXT NOT NULL DEFAULT '',
                architecture TEXT NOT NULL DEFAULT 'x64',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(download_url)
            );

            CREATE TABLE IF NOT EXISTS card_customizations (
                version_id INTEGER PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                header_color TEXT NOT NULL DEFAULT '',
                text_color TEXT NOT NULL DEFAULT '' CHECK(text_color IN ('white', 'black', '')),
                FOREIGN KEY (version_id) REFERENCES installed_versions(id)
            );

            CREATE TABLE IF NOT EXISTS custom_commands (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                command TEXT NOT NULL,
                description TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_custom_commands_updated_at
            ON custom_commands(updated_at);

            CREATE TABLE IF NOT EXISTS version_config_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version_id INTEGER NOT NULL,
                config_type TEXT NOT NULL CHECK(config_type IN ('launch', 'custom')),
                config_id TEXT NOT NULL,
                FOREIGN KEY (version_id) REFERENCES installed_versions(id) ON DELETE CASCADE,
                UNIQUE(version_id)
            );

            CREATE TABLE IF NOT EXISTS version_overrides (
                version_id INTEGER PRIMARY KEY,
                model_path TEXT,
                mmproj_path TEXT,
                FOREIGN KEY (version_id) REFERENCES installed_versions(id) ON DELETE CASCADE
            );
            ",
        )?;

        Ok(())
    }

    /// Get a reference to the connection (caller must manage the guard lifetime).
    /// Returns a MutexGuard that must NOT be held across .await points.
    pub fn lock_conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>, AppError> {
        self.inner.conn.lock().map_err(|e| AppError::Generic(format!("Mutex poisoned: {}", e)))
    }
}
