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
                status TEXT NOT NULL DEFAULT 'installed',
                UNIQUE(build_number, backend, architecture)
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
                download_url TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(download_url)
            );
            ",
        )?;

        // Migration: if old favorite_builds table exists without download_url column,
        // recreate it with the new schema (old favorites without download_url will be lost)
        migrate_favorite_builds_table(&conn)?;

        // Migration: if old installed_versions table exists without architecture column,
        // recreate it with the new schema (existing records default to 'x64')
        migrate_installed_versions_table(&conn)?;

        Ok(())
    }

    /// Get a reference to the connection (caller must manage the guard lifetime).
    /// Returns a MutexGuard that must NOT be held across .await points.
    pub fn lock_conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>, AppError> {
        self.inner.conn.lock().map_err(|e| AppError::Generic(format!("Mutex poisoned: {}", e)))
    }
}

/// Migrate favorite_builds table from old schema (UNIQUE build_number+backend)
/// to new schema (UNIQUE download_url). Drops old entries since they can't be mapped.
fn migrate_favorite_builds_table(conn: &Connection) -> Result<(), AppError> {
    // Check if table exists
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='favorite_builds'",
        [],
        |row| row.get(0),
    )?;

    if !table_exists {
        return Ok(());
    }

    // Check if download_url column exists
    let has_download_url: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('favorite_builds') WHERE name = 'download_url'",
        [],
        |row| row.get(0),
    ).unwrap_or(false);

    if has_download_url {
        return Ok(());
    }

    // Recreate table with new schema, attempting to preserve existing favorites
    // by matching against builds_cache to reconstruct download_url
    conn.execute_batch(
        "
        CREATE TABLE favorite_builds_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            build_number TEXT NOT NULL,
            backend TEXT NOT NULL,
            download_url TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(download_url)
        );
        ",
    )?;

    // Try to migrate existing favorites by matching against builds_cache
    // LEFT JOIN preserves favorites even when builds_cache is empty (download_url will be empty string)
    conn.execute(
        "INSERT OR IGNORE INTO favorite_builds_new (build_number, backend, download_url)
         SELECT fb.build_number, fb.backend, COALESCE(bc.download_url, '')
         FROM favorite_builds fb
         LEFT JOIN builds_cache bc ON bc.build_number = fb.build_number AND bc.backend = fb.backend",
        [],
    )?;

    // Drop old table and rename new one
    conn.execute_batch(
        "
        DROP TABLE IF EXISTS favorite_builds;
        ALTER TABLE favorite_builds_new RENAME TO favorite_builds;
        ",
    )?;

    Ok(())
}

/// Migrate installed_versions table from old schema (UNIQUE build_number+backend)
/// to new schema (UNIQUE build_number+backend+architecture). Existing records default to 'x64'.
fn migrate_installed_versions_table(conn: &Connection) -> Result<(), AppError> {
    // Check if table exists
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='installed_versions'",
        [],
        |row| row.get(0),
    )?;

    if !table_exists {
        return Ok(());
    }

    // Check if architecture column exists
    let has_architecture: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('installed_versions') WHERE name = 'architecture'",
        [],
        |row| row.get(0),
    ).unwrap_or(false);

    if has_architecture {
        return Ok(());
    }

    // Recreate table with new schema, preserving existing data with default architecture 'x64'
    conn.execute_batch(
        "
        CREATE TABLE installed_versions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            build_number TEXT NOT NULL,
            backend TEXT NOT NULL,
            architecture TEXT NOT NULL DEFAULT 'x64',
            install_path TEXT NOT NULL,
            installed_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'installed',
            UNIQUE(build_number, backend, architecture)
        );
        ",
    )?;

    // Migrate existing data with default architecture 'x64'
    conn.execute(
        "INSERT OR IGNORE INTO installed_versions_new (id, build_number, backend, architecture, install_path, installed_at, status)
         SELECT id, build_number, backend, 'x64', install_path, installed_at, status
         FROM installed_versions",
        [],
    )?;

    // Drop old table and rename new one
    conn.execute_batch(
        "
        DROP TABLE IF EXISTS installed_versions;
        ALTER TABLE installed_versions_new RENAME TO installed_versions;
        ",
    )?;

    Ok(())
}
