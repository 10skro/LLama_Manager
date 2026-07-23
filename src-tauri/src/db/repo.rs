use rusqlite::{Connection, params};
use chrono::Local;

use crate::models::types::{AppError, Build, FavoriteBuild, InstalledVersion, DownloadRecord};

// ─── Installed Versions ─────────────────────────────────────────────────

pub fn insert_version(conn: &Connection, version: &InstalledVersion) -> Result<i64, AppError> {
    let id = conn.execute(
        "INSERT INTO installed_versions (build_number, backend, architecture, install_path, installed_at, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            version.build_number,
            version.backend,
            version.architecture,
            version.install_path,
            version.installed_at,
            version.status,
        ],
    )?;
    Ok(id as i64)
}

pub fn get_all_versions(conn: &Connection) -> Result<Vec<InstalledVersion>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, build_number, backend, architecture, install_path, installed_at, status
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
        "SELECT id, build_number, backend, architecture, install_path, installed_at, status
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
        }))
    } else {
        Ok(None)
    }
}

// ─── Downloads ──────────────────────────────────────────────────────────

pub fn insert_download(conn: &Connection, download: &DownloadRecord) -> Result<i64, AppError> {
    let id = conn.execute(
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
    Ok(id as i64)
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
        "SELECT id, build_number, backend, download_url FROM favorite_builds ORDER BY id DESC",
    )?;
    let builds = stmt.query_map([], |row| {
        Ok(FavoriteBuild {
            id: row.get(0)?,
            build_number: row.get(1)?,
            backend: row.get(2)?,
            download_url: row.get(3)?,
        })
    })?;
    Ok(builds.collect::<Result<Vec<_>, rusqlite::Error>>()?)
}

pub fn toggle_favorite_build(conn: &Connection, build_number: &str, backend: &str, download_url: &str) -> Result<bool, AppError> {
    // Check if already favorite
    let mut stmt = conn.prepare(
        "SELECT id FROM favorite_builds WHERE download_url = ?1",
    )?;
    let mut rows = stmt.query(params![download_url])?;

    if rows.next()?.is_some() {
        // Remove favorite
        conn.execute(
            "DELETE FROM favorite_builds WHERE download_url = ?1",
            params![download_url],
        )?;
        Ok(false) // was favorite, now removed
    } else {
        // Add favorite
        conn.execute(
            "INSERT INTO favorite_builds (build_number, backend, download_url) VALUES (?1, ?2, ?3)",
            params![build_number, backend, download_url],
        )?;
        Ok(true) // was not favorite, now added
    }
}
