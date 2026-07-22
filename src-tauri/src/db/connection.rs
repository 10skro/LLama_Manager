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
                install_path TEXT NOT NULL,
                installed_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'installed',
                UNIQUE(build_number, backend)
            );

            CREATE TABLE IF NOT EXISTS downloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                build_number TEXT NOT NULL,
                download_url TEXT NOT NULL,
                file_path TEXT,
                total_size INTEGER NOT NULL DEFAULT 0,
                downloaded_size INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

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
                UNIQUE(build_number, backend)
            );

            CREATE TABLE IF NOT EXISTS favorite_builds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                build_number TEXT NOT NULL,
                backend TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(build_number, backend)
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
