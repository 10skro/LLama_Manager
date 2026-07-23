use std::fs::{self, File};
use std::path::Path;

use crate::db::connection::DbManager;
use crate::models::types::AppError;

pub const SYSTEM_DIRS: &[&str] = &[
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\ProgramData",
];

pub fn validate_storage_path(new_path: &str, current_path: &str) -> Result<(), AppError> {
    if new_path == current_path {
        return Err(AppError::Generic("The path is identical to the current one".to_string()));
    }
    if new_path.is_empty() {
        return Ok(());
    }
    let path = Path::new(new_path);
    let resolved = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let resolved_str = resolved.to_string_lossy().to_string();
    for sys_dir in SYSTEM_DIRS {
        if resolved_str.starts_with(sys_dir) {
            return Err(AppError::Generic(format!(
                "Cannot use system directory as storage path: {}",
                sys_dir
            )));
        }
    }
    if let Err(e) = fs::create_dir_all(new_path) {
        return Err(AppError::Generic(format!(
            "Unable to create folder {}: {}",
            new_path, e
        )));
    }
    let test_file = path.join(".write_perm_test");
    if File::create(&test_file).is_err() {
        return Err(AppError::Generic(format!(
            "No write permission for path: {}",
            new_path
        )));
    }
    let _ = fs::remove_file(&test_file);
    Ok(())
}

pub fn migrate_storage_path(
    old_path: &str,
    new_path: &str,
    db: &DbManager,
) -> Result<(), AppError> {
    if old_path.is_empty() {
        log::info!("Old storage path is empty, nothing to migrate");
        return Ok(());
    }
    if !Path::new(old_path).exists() {
        log::info!("Old storage path does not exist, nothing to migrate");
        return Ok(());
    }
    if old_path == new_path {
        log::info!("Old and new paths are identical, nothing to migrate");
        return Ok(());
    }
    fs::create_dir_all(new_path)?;
    log::info!("Migrating storage from {} to {}", old_path, new_path);
    let old_canonical = Path::new(old_path)
        .canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| old_path.to_string());
    let new_canonical = Path::new(new_path)
        .canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| new_path.to_string());
    let rename_ok = if let Err(e) = fs::rename(old_path, new_path) {
        log::warn!("Direct rename failed ({}), falling back to recursive copy", e);
        copy_dir_all(old_path, new_path)?;
        if let Err(e) = fs::remove_dir_all(old_path) {
            log::warn!("Failed to remove old storage directory after copy: {}", e);
        }
        false
    } else {
        true
    };
    if rename_ok {
        log::info!("Successfully renamed storage directory");
    } else {
        log::info!("Successfully copied storage directory");
    }
    update_db_paths(db, &old_canonical, &new_canonical)?;
    Ok(())
}

fn copy_dir_all(src: &str, dst: &str) -> Result<(), AppError> {
    let dst_path = Path::new(dst);
    fs::create_dir_all(dst_path)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst_path.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_all(src_path.to_str().unwrap_or(""), dst_path.to_str().unwrap_or(""))?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

fn update_db_paths(
    db: &DbManager,
    old_canonical: &str,
    new_canonical: &str,
) -> Result<(), AppError> {
    let conn = db.lock_conn()?;

    // Add a separator to avoid partial replacement
    let old_with_sep = format!("{}{}", old_canonical, std::path::MAIN_SEPARATOR);
    let old_pattern = format!("{}%", old_with_sep);

    let updated_versions = conn.execute(
        "UPDATE installed_versions SET install_path = ?2 || SUBSTR(install_path, LENGTH(?1)+1)
         WHERE install_path LIKE ?3",
        rusqlite::params![old_with_sep, new_canonical, old_pattern],
    )?;
    log::info!("Updated {} installed version entries", updated_versions);

    let updated_downloads = conn.execute(
        "UPDATE downloads SET file_path = ?2 || SUBSTR(file_path, LENGTH(?1)+1)
         WHERE file_path LIKE ?3",
        rusqlite::params![old_with_sep, new_canonical, old_pattern],
    )?;
    log::info!("Updated {} download entries", updated_downloads);
    Ok(())
}

pub fn cleanup_old_storage(old_path: &str) {
    if old_path.is_empty() {
        return;
    }
    if !Path::new(old_path).exists() {
        return;
    }
    if let Err(e) = fs::remove_dir_all(old_path) {
        log::warn!("Failed to remove old storage directory {}: {}", old_path, e);
    } else {
        log::info!("Cleaned up old storage directory: {}", old_path);
    }
}
