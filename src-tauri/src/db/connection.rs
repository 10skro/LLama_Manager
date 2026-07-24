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

            CREATE TABLE IF NOT EXISTS launch_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                shell_type TEXT NOT NULL DEFAULT 'cmd',
                model_path TEXT NOT NULL DEFAULT '',
                args_json TEXT NOT NULL DEFAULT '[]',
                description TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_launch_configs_updated_at
            ON launch_configs(updated_at);
            ",
        )?;

        // Run all migrations
        run_migrations(&conn)?;

        Ok(())
    }

    /// Get a reference to the connection (caller must manage the guard lifetime).
    /// Returns a MutexGuard that must NOT be held across .await points.
    pub fn lock_conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>, AppError> {
        self.inner.conn.lock().map_err(|e| AppError::Generic(format!("Mutex poisoned: {}", e)))
    }
}

// ─── Migration Runner ───────────────────────────────────────────────────

/// Check if a table exists in the database.
fn table_exists(conn: &Connection, table_name: &str) -> Result<bool, AppError> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name = ?1",
        [table_name],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Check if a column exists in a table.
fn column_exists(conn: &Connection, table_name: &str, column_name: &str) -> Result<bool, AppError> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) > 0 FROM pragma_table_info(?1) WHERE name = ?2",
        [table_name, column_name],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Get the SQL definition of a table from sqlite_master.
fn table_sql(conn: &Connection, table_name: &str) -> Result<String, AppError> {
    let sql: String = conn.query_row(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?1",
        [table_name],
        |row| row.get(0),
    )?;
    Ok(sql)
}

/// Run all available migrations in order.
/// Each migration is idempotent and checks if it's already been applied.
fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    // Create schema_migrations tracking table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )?;

    // Helper to check if a migration has been applied
    let is_applied = |conn: &Connection, version: i64| -> Result<bool, AppError> {
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
            [version],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    };

    // Helper to mark a migration as applied
    let mark_applied = |conn: &Connection, version: i64, description: &str| -> Result<(), AppError> {
        conn.execute(
            "INSERT OR IGNORE INTO schema_migrations (version, description) VALUES (?1, ?2)",
            rusqlite::params![version, description],
        )?;
        Ok(())
    };

    // V1: Original favorite_builds migration (download_url column)
    if !is_applied(conn, 1)? {
        log::info!("Applying migration v1: favorite_builds download_url column");
        migrate_favorite_builds_table(conn)?;
        mark_applied(conn, 1, "Add download_url to favorite_builds")?;
    }

    // V2: Original installed_versions migration (architecture column)
    if !is_applied(conn, 2)? {
        log::info!("Applying migration v2: installed_versions architecture column");
        migrate_installed_versions_table(conn)?;
        mark_applied(conn, 2, "Add architecture to installed_versions")?;
    }

    // V3: Fix builds_cache UNIQUE constraint to include architecture
    if !is_applied(conn, 3)? {
        log::info!("Applying migration v3: builds_cache UNIQUE(build_number, backend, architecture)");
        migrate_builds_cache_unique(conn)?;
        mark_applied(conn, 3, "Fix builds_cache UNIQUE constraint")?;
    }

    // V4: Add CHECK constraint on installed_versions.status
    if !is_applied(conn, 4)? {
        log::info!("Applying migration v4: CHECK constraint on installed_versions.status");
        migrate_installed_versions_check(conn)?;
        mark_applied(conn, 4, "Add CHECK on installed_versions.status")?;
    }

    // V5: Add CHECK constraint on downloads.status
    if !is_applied(conn, 5)? {
        log::info!("Applying migration v5: CHECK constraint on downloads.status");
        migrate_downloads_check(conn)?;
        mark_applied(conn, 5, "Add CHECK on downloads.status")?;
    }

    // V6: Add download_id column to installed_versions
    if !is_applied(conn, 6)? {
        log::info!("Applying migration v6: download_id column in installed_versions");
        migrate_installed_versions_download_id(conn)?;
        mark_applied(conn, 6, "Add download_id to installed_versions")?;
    }

    // V7: Add architecture column to favorite_builds
    if !is_applied(conn, 7)? {
        log::info!("Applying migration v7: architecture column in favorite_builds");
        migrate_favorite_builds_architecture(conn)?;
        mark_applied(conn, 7, "Add architecture to favorite_builds")?;
    }

    // V8: Create card_customizations table
    if !is_applied(conn, 8)? {
        log::info!("Applying migration v8: card_customizations table");
        migrate_card_customizations_table(conn)?;
        mark_applied(conn, 8, "Create card_customizations table")?;
    }

    // V9: Create custom_commands table
    if !is_applied(conn, 9)? {
        log::info!("Applying migration v9: custom_commands table");
        migrate_custom_commands_table(conn)?;
        mark_applied(conn, 9, "Create custom_commands table")?;
    }

    // V10: Create version_config_links table
    if !is_applied(conn, 10)? {
        log::info!("Applying migration v10: version_config_links table");
        migrate_version_config_links_table(conn)?;
        mark_applied(conn, 10, "Create version_config_links table")?;
    }

    // V11: Change config_id from INTEGER to TEXT to support UUID config IDs
    if !is_applied(conn, 11)? {
        log::info!("Applying migration v11: version_config_links config_id TEXT");
        migrate_version_config_links_config_id_text(conn)?;
        mark_applied(conn, 11, "Change config_id to TEXT in version_config_links")?;
    }

    Ok(())
}

/// Migrate favorite_builds table from old schema (UNIQUE build_number+backend)
/// to new schema (UNIQUE download_url). Drops old entries since they can't be mapped.
fn migrate_favorite_builds_table(conn: &Connection) -> Result<(), AppError> {
    if !table_exists(conn, "favorite_builds")? {
        return Ok(());
    }

    if column_exists(conn, "favorite_builds", "download_url")? {
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
    if !table_exists(conn, "installed_versions")? {
        return Ok(());
    }

    if column_exists(conn, "installed_versions", "architecture")? {
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

/// Migrate builds_cache to fix UNIQUE constraint: (build_number, backend) → (build_number, backend, architecture).
/// Uses INSERT OR IGNORE to handle potential duplicates (keeps first occurrence).
fn migrate_builds_cache_unique(conn: &Connection) -> Result<(), AppError> {
    if !table_exists(conn, "builds_cache")? {
        return Ok(());
    }

    // Check if a unique index exists on builds_cache
    let has_unique_index: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM pragma_index_list('builds_cache') WHERE origin = 'u'",
        [],
        |row| row.get(0),
    ).map_err(|e| {
        log::warn!("Failed to read builds_cache index info for migration v3: {}", e);
        e
    })?;

    if !has_unique_index {
        return Ok(());
    }

    // Dynamically discover the unique index name and check if it includes architecture
    let unique_index_name: Option<String> = conn.query_row(
        "SELECT name FROM pragma_index_list('builds_cache') WHERE origin = 'u' LIMIT 1",
        [],
        |row| row.get(0),
    ).ok();

    let unique_includes_arch = match unique_index_name {
        Some(name) => {
            conn.query_row(
                "SELECT COUNT(*) > 0 FROM pragma_index_info(?1) WHERE name = 'architecture'",
                [name],
                |row| row.get::<_, bool>(0),
            ).unwrap_or(false)
        }
        None => false,
    };

    if unique_includes_arch {
        return Ok(());
    }

    // Recreate table with new UNIQUE constraint
    conn.execute_batch(
        "
        CREATE TABLE builds_cache_new (
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
        ",
    )?;

    // Migrate data using INSERT OR IGNORE to handle duplicates (keeps first occurrence)
    conn.execute(
        "INSERT OR IGNORE INTO builds_cache_new (id, build_number, tag_name, published_at, platform, architecture, backend, download_url, file_size, checksum, fetched_at)
         SELECT id, build_number, tag_name, published_at, platform, architecture, backend, download_url, file_size, checksum, fetched_at
         FROM builds_cache
         ORDER BY id ASC",
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

/// Create the card_customizations table for persistent dashboard card customizations.
fn migrate_card_customizations_table(conn: &Connection) -> Result<(), AppError> {
    if table_exists(conn, "card_customizations")? {
        return Ok(());
    }

    conn.execute_batch(
        "
        CREATE TABLE card_customizations (
            version_id INTEGER PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            header_color TEXT NOT NULL DEFAULT '',
            text_color TEXT NOT NULL DEFAULT '' CHECK(text_color IN ('white', 'black', '')),
            FOREIGN KEY (version_id) REFERENCES installed_versions(id)
        );
        ",
    )?;

    Ok(())
}

/// Migrate installed_versions to add CHECK constraint on status column.
/// Recreates the table if CHECK constraint is missing.
fn migrate_installed_versions_check(conn: &Connection) -> Result<(), AppError> {
    if !table_exists(conn, "installed_versions")? {
        return Ok(());
    }

    let sql = table_sql(conn, "installed_versions")?;
    if sql.contains("CHECK") {
        return Ok(());
    }

    // Recreate table with CHECK constraint
    conn.execute_batch(
        "
        CREATE TABLE installed_versions_new (
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
        ",
    )?;

    // Migrate existing data
    conn.execute(
        "INSERT OR IGNORE INTO installed_versions_new (id, build_number, backend, architecture, install_path, installed_at, status, download_id)
         SELECT id, build_number, backend, architecture, install_path, installed_at, status, download_id
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

/// Migrate downloads to add CHECK constraint on status column.
/// Recreates the table if CHECK constraint is missing.
fn migrate_downloads_check(conn: &Connection) -> Result<(), AppError> {
    if !table_exists(conn, "downloads")? {
        return Ok(());
    }

    let sql = table_sql(conn, "downloads")?;
    if sql.contains("CHECK") {
        return Ok(());
    }

    // Recreate table with CHECK constraint
    conn.execute_batch(
        "
        CREATE TABLE downloads_new (
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
        ",
    )?;

    // Migrate existing data
    conn.execute(
        "INSERT OR IGNORE INTO downloads_new (id, build_number, download_url, file_path, total_size, downloaded_size, status, error_message, created_at, updated_at)
         SELECT id, build_number, download_url, file_path, total_size, downloaded_size, status, error_message, created_at, updated_at
         FROM downloads",
        [],
    )?;

    // Recreate the index on the new table
    conn.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads_new(status);
        ",
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

/// Create the custom_commands table for user-defined command configurations.
fn migrate_custom_commands_table(conn: &Connection) -> Result<(), AppError> {
    if table_exists(conn, "custom_commands")? {
        return Ok(());
    }

    conn.execute_batch(
        "
        CREATE TABLE custom_commands (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            command TEXT NOT NULL,
            description TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_custom_commands_updated_at
        ON custom_commands(updated_at);
        ",
    )?;

    Ok(())
}

/// Migrate installed_versions to add download_id column if it doesn't exist.
fn migrate_installed_versions_download_id(conn: &Connection) -> Result<(), AppError> {
    if !table_exists(conn, "installed_versions")? {
        return Ok(());
    }

    if column_exists(conn, "installed_versions", "download_id")? {
        return Ok(());
    }

    // Recreate table with download_id column (including FOREIGN KEY constraint)
    conn.execute_batch(
        "
        CREATE TABLE installed_versions_new (
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
        ",
    )?;

    // Migrate existing data
    conn.execute(
        "INSERT OR IGNORE INTO installed_versions_new (id, build_number, backend, architecture, install_path, installed_at, status)
         SELECT id, build_number, backend, architecture, install_path, installed_at, status
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

/// Create the version_config_links table for linking installed versions to configurations.
fn migrate_version_config_links_table(conn: &Connection) -> Result<(), AppError> {
    if table_exists(conn, "version_config_links")? {
        return Ok(());
    }

    conn.execute_batch(
        "
        CREATE TABLE version_config_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id INTEGER NOT NULL,
            config_type TEXT NOT NULL CHECK(config_type IN ('launch', 'custom')),
            config_id INTEGER NOT NULL,
            FOREIGN KEY (version_id) REFERENCES installed_versions(id) ON DELETE CASCADE,
            UNIQUE(version_id)
        );
        ",
    )?;

    Ok(())
}

/// Migrate version_config_links to change config_id from INTEGER to TEXT.
/// This allows storing UUID-based config IDs (launch configs and custom commands use string UUIDs).
fn migrate_version_config_links_config_id_text(conn: &Connection) -> Result<(), AppError> {
    if !table_exists(conn, "version_config_links")? {
        return Ok(());
    }

    // Check if config_id is already TEXT
    let sql = table_sql(conn, "version_config_links")?;
    if sql.contains("config_id TEXT") {
        return Ok(());
    }

    // Recreate table with config_id as TEXT
    conn.execute_batch(
        "
        CREATE TABLE version_config_links_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id INTEGER NOT NULL,
            config_type TEXT NOT NULL CHECK(config_type IN ('launch', 'custom')),
            config_id TEXT NOT NULL,
            FOREIGN KEY (version_id) REFERENCES installed_versions(id) ON DELETE CASCADE,
            UNIQUE(version_id)
        );
        ",
    )?;

    // Migrate existing data, converting integer config_id to text
    conn.execute(
        "INSERT INTO version_config_links_new (id, version_id, config_type, config_id)
         SELECT id, version_id, config_type, CAST(config_id AS TEXT)
         FROM version_config_links",
        [],
    )?;

    // Drop old table and rename new one
    conn.execute_batch(
        "
        DROP TABLE IF EXISTS version_config_links;
        ALTER TABLE version_config_links_new RENAME TO version_config_links;
        ",
    )?;

    Ok(())
}

/// Migrate favorite_builds to add architecture column if it doesn't exist.
/// Uses LEFT JOIN with builds_cache to infer architecture from cached builds.
fn migrate_favorite_builds_architecture(conn: &Connection) -> Result<(), AppError> {
    if !table_exists(conn, "favorite_builds")? {
        return Ok(());
    }

    if column_exists(conn, "favorite_builds", "architecture")? {
        return Ok(());
    }

    // Recreate table with architecture column
    conn.execute_batch(
        "
        CREATE TABLE favorite_builds_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            build_number TEXT NOT NULL,
            backend TEXT NOT NULL,
            download_url TEXT NOT NULL DEFAULT '',
            architecture TEXT NOT NULL DEFAULT 'x64',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(download_url)
        );
        ",
    )?;

    // Migrate existing data, using LEFT JOIN with builds_cache to infer architecture
    conn.execute(
        "INSERT OR IGNORE INTO favorite_builds_new (build_number, backend, download_url, architecture)
         SELECT fb.build_number, fb.backend, fb.download_url, COALESCE(bc.architecture, 'x64')
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
