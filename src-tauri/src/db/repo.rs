use rusqlite::{Connection, params};
use chrono::Local;

use crate::models::types::{AppError, Build, CardCustomization, CustomCommand, FavoriteBuild, InstalledVersion, DownloadRecord, LaunchConfig, VersionConfigLink, VersionOverride};

// ─── Installed Versions ─────────────────────────────────────────────────

pub fn insert_version(conn: &Connection, version: &InstalledVersion) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO installed_versions (build_number, backend, architecture, install_path, installed_at, status, download_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            version.build_number,
            version.backend,
            version.architecture,
            version.install_path,
            version.installed_at,
            version.status,
            version.download_id,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_all_versions(conn: &Connection) -> Result<Vec<InstalledVersion>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, build_number, backend, architecture, install_path, installed_at, status, download_id
         FROM installed_versions ORDER BY id DESC",
    )?;

    let versions = stmt.query_map([], |row| {
        Ok(InstalledVersion {
            id: row.get(0)?,
            build_number: row.get(1)?,
            backend: row.get(2)?,
            architecture: row.get(3)?,
            install_path: row.get(4)?,
            installed_at: row.get(5)?,
            status: row.get(6)?,
            download_id: row.get(7)?,
        })
    })?;

    Ok(versions.collect::<Result<Vec<_>, rusqlite::Error>>()?)
}

pub fn delete_version(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let rows = conn.execute("DELETE FROM installed_versions WHERE id = ?1", params![id])?;
    Ok(rows > 0)
}

pub fn get_version_by_build(conn: &Connection, build: &str, backend: &str, architecture: &str) -> Result<Option<InstalledVersion>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, build_number, backend, architecture, install_path, installed_at, status, download_id
         FROM installed_versions WHERE build_number = ?1 AND backend = ?2 AND architecture = ?3",
    )?;

    let mut rows = stmt.query(params![build, backend, architecture])?;
    if let Some(row) = rows.next()? {
        Ok(Some(InstalledVersion {
            id: row.get(0)?,
            build_number: row.get(1)?,
            backend: row.get(2)?,
            architecture: row.get(3)?,
            install_path: row.get(4)?,
            installed_at: row.get(5)?,
            status: row.get(6)?,
            download_id: row.get(7)?,
        }))
    } else {
        Ok(None)
    }
}

/// Fetch a single installed version by its primary key ID.
/// Used by `uninstall_version` to avoid loading the entire table.
pub fn get_version_by_id(conn: &Connection, id: i64) -> Result<Option<InstalledVersion>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, build_number, backend, architecture, install_path, installed_at, status, download_id
         FROM installed_versions WHERE id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(InstalledVersion {
            id: row.get(0)?,
            build_number: row.get(1)?,
            backend: row.get(2)?,
            architecture: row.get(3)?,
            install_path: row.get(4)?,
            installed_at: row.get(5)?,
            status: row.get(6)?,
            download_id: row.get(7)?,
        }))
    } else {
        Ok(None)
    }
}

// ─── Downloads ──────────────────────────────────────────────────────────

pub fn insert_download(conn: &Connection, download: &DownloadRecord) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO downloads (build_number, download_url, file_path, total_size, downloaded_size, status, error_message, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            download.build_number,
            download.download_url,
            download.file_path,
            download.total_size,
            download.downloaded_size,
            download.status,
            download.error_message,
            download.created_at,
            download.updated_at,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_download_progress(
    conn: &Connection,
    id: i64,
    downloaded: u64,
    status: &str,
) -> Result<(), AppError> {
    let now = Local::now().to_rfc3339();
    conn.execute(
        "UPDATE downloads SET downloaded_size = ?1, status = ?2, updated_at = ?3 WHERE id = ?4",
        params![downloaded, status, now, id],
    )?;
    Ok(())
}

pub fn update_download_error(
    conn: &Connection,
    id: i64,
    error_message: &str,
) -> Result<(), AppError> {
    let now = Local::now().to_rfc3339();
    conn.execute(
        "UPDATE downloads SET status = 'failed', error_message = ?1, updated_at = ?2 WHERE id = ?3",
        params![error_message, now, id],
    )?;
    Ok(())
}

pub fn update_download_completed(conn: &Connection, id: i64) -> Result<(), AppError> {
    let now = Local::now().to_rfc3339();
    conn.execute(
        "UPDATE downloads SET status = 'completed', updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(())
}

pub fn get_download(conn: &Connection, id: i64) -> Result<Option<DownloadRecord>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, build_number, download_url, file_path, total_size, downloaded_size, status, error_message, created_at, updated_at
         FROM downloads WHERE id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(DownloadRecord {
            id: row.get(0)?,
            build_number: row.get(1)?,
            download_url: row.get(2)?,
            file_path: row.get(3)?,
            total_size: row.get(4)?,
            downloaded_size: row.get(5)?,
            status: row.get(6)?,
            error_message: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn get_active_downloads(conn: &Connection) -> Result<Vec<DownloadRecord>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, build_number, download_url, file_path, total_size, downloaded_size, status, error_message, created_at, updated_at
         FROM downloads WHERE status IN ('pending', 'downloading', 'extracting')
         ORDER BY id DESC",
    )?;

    let downloads = stmt.query_map([], |row| {
        Ok(DownloadRecord {
            id: row.get(0)?,
            build_number: row.get(1)?,
            download_url: row.get(2)?,
            file_path: row.get(3)?,
            total_size: row.get(4)?,
            downloaded_size: row.get(5)?,
            status: row.get(6)?,
            error_message: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })?;

    Ok(downloads.collect::<Result<Vec<_>, rusqlite::Error>>()?)
}

pub fn cancel_download(conn: &Connection, id: i64) -> Result<bool, AppError> {
    let now = Local::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE downloads SET status = 'cancelled', updated_at = ?1 WHERE id = ?2 AND status IN ('pending', 'downloading')",
        params![now, id],
    )?;
    Ok(rows > 0)
}

/// Delete old download records that are in terminal states (completed, failed, cancelled)
/// and were last updated more than `days` ago.
pub fn cleanup_old_downloads(conn: &Connection, days: i64) -> Result<usize, AppError> {
    // SQLite datetime modifier requires the format '-N days' as a single string argument.
    // We use string concatenation in SQL to safely inject the parameter.
    let rows = conn.execute(
        "DELETE FROM downloads WHERE status IN ('completed', 'failed', 'cancelled')
         AND updated_at < datetime('now', '-' || ?1 || ' days')",
        params![days],
    )?;
    Ok(rows)
}

// ─── Settings ───────────────────────────────────────────────────────────

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, AppError> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_all_settings(conn: &Connection) -> Result<Vec<(String, String)>, AppError> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?))
    })?;

    Ok(rows.collect::<Result<Vec<_>, rusqlite::Error>>()?)
}

pub fn delete_setting(conn: &Connection, key: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
    Ok(())
}

// ─── Builds Cache ───────────────────────────────────────────────────────

pub fn cache_builds(conn: &mut Connection, builds: &[Build]) -> Result<(), AppError> {
    let fetched_at = Local::now().to_rfc3339();

    let tx = conn.transaction()?;

    // Clear old cache inside transaction for atomicity
    tx.execute("DELETE FROM builds_cache", [])?;

    for build in builds {
        tx.execute(
            "INSERT OR REPLACE INTO builds_cache
             (build_number, tag_name, published_at, platform, architecture, backend, download_url, file_size, checksum, fetched_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                build.build_number,
                build.tag_name,
                build.published_at,
                build.platform,
                build.architecture,
                build.backend,
                build.download_url,
                build.file_size as i64,
                build.checksum,
                fetched_at,
            ],
        )?;
    }

    tx.commit()?;
    Ok(())
}

pub fn get_cached_builds(conn: &Connection) -> Result<Vec<Build>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT build_number, tag_name, published_at, platform, architecture, backend, download_url, file_size, checksum
         FROM builds_cache ORDER BY build_number DESC",
    )?;

    let builds = stmt.query_map([], |row| {
        Ok(Build {
            build_number: row.get(0)?,
            tag_name: row.get(1)?,
            published_at: row.get(2)?,
            platform: row.get(3)?,
            architecture: row.get(4)?,
            backend: row.get(5)?,
            download_url: row.get(6)?,
            file_size: row.get::<_, i64>(7)? as u64,
            checksum: row.get(8)?,
        })
    })?;

    Ok(builds.collect::<Result<Vec<_>, rusqlite::Error>>()?)
}

// ─── Favorite Builds ────────────────────────────────────────────────────

pub fn get_favorite_builds(conn: &Connection) -> Result<Vec<FavoriteBuild>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, build_number, backend, download_url, architecture FROM favorite_builds ORDER BY id DESC",
    )?;
    let builds = stmt.query_map([], |row| {
        Ok(FavoriteBuild {
            id: row.get(0)?,
            build_number: row.get(1)?,
            backend: row.get(2)?,
            download_url: row.get(3)?,
            architecture: row.get(4)?,
        })
    })?;
    Ok(builds.collect::<Result<Vec<_>, rusqlite::Error>>()?)
}

pub fn toggle_favorite_build(conn: &mut Connection, build_number: &str, backend: &str, download_url: &str, architecture: &str) -> Result<bool, AppError> {
    let tx = conn.transaction()?;

    // Check if already favorited — propagate DB errors instead of silently swallowing them
    let exists: bool = tx.query_row(
        "SELECT COUNT(*) > 0 FROM favorite_builds WHERE download_url = ?1",
        params![download_url],
        |row| row.get(0),
    ).map_err(|e| {
        log::warn!("Error checking favorite build existence for '{}': {}", download_url, e);
        e
    })?;

    if exists {
        tx.execute("DELETE FROM favorite_builds WHERE download_url = ?1", params![download_url])?;
    } else {
        tx.execute(
            "INSERT INTO favorite_builds (build_number, backend, download_url, architecture) VALUES (?1, ?2, ?3, ?4)",
            params![build_number, backend, download_url, architecture],
        )?;
    }

    tx.commit()?;
    Ok(!exists)
}

// ─── Launch Configs ─────────────────────────────────────────────────────

pub fn insert_launch_config(conn: &Connection, config: &LaunchConfig) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO launch_configs (id, name, shell_type, model_path, args_json, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            config.id,
            config.name,
            config.shell_type,
            config.model_path,
            config.args_json,
            config.description,
            config.created_at,
            config.updated_at,
        ],
    )?;
    Ok(())
}

pub fn update_launch_config(conn: &Connection, config: &LaunchConfig) -> Result<(), AppError> {
    conn.execute(
        "UPDATE launch_configs SET name = ?1, shell_type = ?2, model_path = ?3, args_json = ?4, description = ?5, updated_at = ?6 WHERE id = ?7",
        params![
            config.name,
            config.shell_type,
            config.model_path,
            config.args_json,
            config.description,
            config.updated_at,
            config.id,
        ],
    )?;
    Ok(())
}

pub fn get_all_launch_configs(conn: &Connection) -> Result<Vec<LaunchConfig>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, shell_type, model_path, args_json, description, created_at, updated_at FROM launch_configs ORDER BY updated_at DESC",
    )?;

    let configs = stmt.query_map([], |row| {
        Ok(LaunchConfig {
            id: row.get(0)?,
            name: row.get(1)?,
            shell_type: row.get(2)?,
            model_path: row.get(3)?,
            args_json: row.get(4)?,
            description: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;

    Ok(configs.collect::<Result<Vec<_>, rusqlite::Error>>()?)
}

pub fn delete_launch_config_by_id(conn: &Connection, id: &str) -> Result<bool, AppError> {
    let rows = conn.execute("DELETE FROM launch_configs WHERE id = ?1", params![id])?;
    Ok(rows > 0)
}

pub fn launch_config_exists(conn: &Connection, id: &str) -> Result<bool, AppError> {
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM launch_configs WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(exists)
}

// ─── Card Customizations ────────────────────────────────────────────────

pub fn get_all_card_customizations(conn: &Connection) -> Result<Vec<CardCustomization>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT version_id, title, header_color, text_color FROM card_customizations",
    )?;

    let customs = stmt.query_map([], |row| {
        Ok(CardCustomization {
            version_id: row.get(0)?,
            title: row.get(1)?,
            header_color: row.get(2)?,
            text_color: row.get(3)?,
        })
    })?;

    Ok(customs.collect::<Result<Vec<_>, rusqlite::Error>>()?)
}

pub fn upsert_card_customization(conn: &Connection, customization: &CardCustomization) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO card_customizations (version_id, title, header_color, text_color)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(version_id) DO UPDATE SET
           title = excluded.title,
           header_color = excluded.header_color,
           text_color = excluded.text_color",
        params![
            customization.version_id,
            customization.title,
            customization.header_color,
            customization.text_color,
        ],
    )?;
    Ok(())
}

pub fn delete_card_customization(conn: &Connection, version_id: i64) -> Result<bool, AppError> {
    let rows = conn.execute(
        "DELETE FROM card_customizations WHERE version_id = ?1",
        params![version_id],
    )?;
    Ok(rows > 0)
}

// ─── Custom Commands ───────────────────────────────────────────────────

pub fn insert_custom_command(conn: &Connection, command: &CustomCommand) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO custom_commands (id, name, command, description, shell_type, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            command.id,
            command.name,
            command.command,
            command.description,
            command.shell_type,
            command.created_at,
            command.updated_at,
        ],
    )?;
    Ok(())
}

pub fn update_custom_command(conn: &Connection, command: &CustomCommand) -> Result<(), AppError> {
    conn.execute(
        "UPDATE custom_commands SET name = ?1, command = ?2, description = ?3, shell_type = ?4, updated_at = ?5 WHERE id = ?6",
        params![
            command.name,
            command.command,
            command.description,
            command.shell_type,
            command.updated_at,
            command.id,
        ],
    )?;
    Ok(())
}

pub fn get_all_custom_commands(conn: &Connection) -> Result<Vec<CustomCommand>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, command, description, shell_type, created_at, updated_at FROM custom_commands ORDER BY updated_at DESC",
    )?;

    let commands = stmt.query_map([], |row| {
        Ok(CustomCommand {
            id: row.get(0)?,
            name: row.get(1)?,
            command: row.get(2)?,
            description: row.get(3)?,
            shell_type: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;

    Ok(commands.collect::<Result<Vec<_>, rusqlite::Error>>()?)
}

pub fn delete_custom_command_by_id(conn: &Connection, id: &str) -> Result<bool, AppError> {
    let rows = conn.execute("DELETE FROM custom_commands WHERE id = ?1", params![id])?;
    Ok(rows > 0)
}

pub fn custom_command_exists(conn: &Connection, id: &str) -> Result<bool, AppError> {
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM custom_commands WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(exists)
}

// ─── Version Config Links ───────────────────────────────────────────────

pub fn get_version_config_link(conn: &Connection, version_id: i64) -> Result<Option<VersionConfigLink>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT version_id, config_type, config_id FROM version_config_links WHERE version_id = ?1",
    )?;

    let mut rows = stmt.query(params![version_id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(VersionConfigLink {
            version_id: row.get(0)?,
            config_type: row.get(1)?,
            config_id: row.get(2)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn save_version_config_link(
    conn: &Connection,
    version_id: i64,
    config_type: &str,
    config_id: &str,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO version_config_links (version_id, config_type, config_id)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(version_id) DO UPDATE SET
           config_type = excluded.config_type,
           config_id = excluded.config_id",
        params![version_id, config_type, config_id],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_version_config_link(conn: &Connection, version_id: i64) -> Result<bool, AppError> {
    let rows = conn.execute(
        "DELETE FROM version_config_links WHERE version_id = ?1",
        params![version_id],
    )?;
    Ok(rows > 0)
}

// ─── Version Overrides ──────────────────────────────────────────────────

pub fn get_version_override(conn: &Connection, version_id: i64) -> Result<Option<VersionOverride>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT version_id, model_path, mmproj_path FROM version_overrides WHERE version_id = ?1",
    )?;

    let mut rows = stmt.query(params![version_id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(VersionOverride {
            version_id: row.get(0)?,
            model_path: row.get(1)?,
            mmproj_path: row.get(2)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn save_version_override(
    conn: &Connection,
    version_id: i64,
    model_path: Option<String>,
    mmproj_path: Option<String>,
) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO version_overrides (version_id, model_path, mmproj_path)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(version_id) DO UPDATE SET
           model_path = excluded.model_path,
           mmproj_path = excluded.mmproj_path",
        params![version_id, model_path, mmproj_path],
    )?;
    Ok(())
}

pub fn delete_version_override(conn: &Connection, version_id: i64) -> Result<bool, AppError> {
    let rows = conn.execute(
        "DELETE FROM version_overrides WHERE version_id = ?1",
        params![version_id],
    )?;
    Ok(rows > 0)
}
