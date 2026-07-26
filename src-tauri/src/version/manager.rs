use std::path::PathBuf;

use chrono::Local;
use tokio::sync::{mpsc, oneshot};

use crate::db::connection::DbManager;
use crate::db::repo;
use crate::download::manager::DownloadManager;
use crate::file::manager::FileManager;
use crate::models::types::{
    AppError, Build, DownloadProgress, DownloadRecord, DownloadResult, InstalledVersion,
};

/// Orchestrates version installation, uninstallation, and listing.
pub struct VersionManager;

/// Holds paths and metadata needed for post-download installation steps.
pub struct InstallPaths {
    download_path: String,
    install_path: String,
    build_number: String,
    backend: String,
    architecture: String,
}

impl VersionManager {
    /// Starts the download pipeline and returns the download_id immediately.
    /// Also returns a oneshot receiver that resolves when the download completes.
    /// Does NOT wait for download completion. Extraction/validation runs
    /// asynchronously via `post_download_tasks`.
    pub async fn start_install(
        db: &DbManager,
        download_mgr: &DownloadManager,
        build: &Build,
        storage_base: PathBuf,
        progress_tx: mpsc::Sender<DownloadProgress>,
    ) -> Result<(i64, InstallPaths, oneshot::Receiver<DownloadResult>), AppError> {
        // 1. Check if already installed (any row with matching build/backend/arch)
        {
            let conn = db.lock_conn()?;
            if repo::version_build_exists(&conn, &build.build_number, &build.backend, &build.architecture)? {
                return Err(AppError::AlreadyInstalled(format!(
                    "{} ({} {})",
                    build.build_number, build.backend, build.architecture
                )));
            }
        }

        // 2. Determine file paths
        let filename = build
            .download_url
            .split('/')
            .next_back()
            .unwrap_or("download.exe");
        let download_path = FileManager::get_download_path(&storage_base, filename);
        let install_path = FileManager::get_install_path(
            &storage_base,
            &build.build_number,
            &build.backend,
            &build.architecture,
        );

        let download_path_str = download_path.to_string_lossy().to_string();
        let install_path_str = install_path.to_string_lossy().to_string();

        // 3. Create download record in DB
        let now = Local::now().to_rfc3339();
        let download = DownloadRecord {
            id: 0,
            build_number: build.build_number.clone(),
            download_url: build.download_url.clone(),
            file_path: Some(download_path_str.clone()),
            total_size: build.file_size,
            downloaded_size: 0,
            status: "pending".to_string(),
            error_message: None,
            created_at: now.clone(),
            updated_at: now.clone(),
        };

        let download_id = {
            let conn = db.lock_conn()?;
            repo::insert_download(&conn, &download)?
        };

        // 4. Start download with progress - now returns oneshot receiver
        {
            let conn = db.lock_conn()?;
            repo::update_download_progress(&conn, download_id, 0, "downloading")?;
        }

        let download_rx = download_mgr
            .start_download(
                download_id,
                build.download_url.clone(),
                download_path_str.clone(),
                build.file_size,
                build.build_number.clone(),
                progress_tx.clone(),
            )
            .await?;

        let paths = InstallPaths {
            download_path: download_path_str,
            install_path: install_path_str,
            build_number: build.build_number.clone(),
            backend: build.backend.clone(),
            architecture: build.architecture.clone(),
        };

        Ok((download_id, paths, download_rx))
    }

    /// Waits for download completion via oneshot channel, then extracts, validates, and registers.
    /// Emits progress events through `progress_tx` for extracting/completed/failed.
    pub async fn post_download_tasks(
        db: &DbManager,
        download_id: i64,
        paths: InstallPaths,
        progress_tx: mpsc::Sender<DownloadProgress>,
        download_rx: oneshot::Receiver<DownloadResult>,
    ) -> Result<InstalledVersion, AppError> {
        // 1. Wait for download completion via oneshot channel (no polling needed)
        match download_rx.await {
            Ok(DownloadResult::Completed) => {},
            Ok(DownloadResult::Failed(msg)) => {
                let _ = progress_tx.send(DownloadProgress {
                    download_id,
                    build_number: paths.build_number.clone(),
                    downloaded: 0,
                    total: 0,
                    speed: 0.0,
                    percentage: 0.0,
                    eta_seconds: 0.0,
                    status: "failed".to_string(),
                }).await;
                return Err(AppError::Generic(format!("Download failed: {}", msg)));
            }
            Ok(DownloadResult::Cancelled) => {
                let _ = progress_tx.send(DownloadProgress {
                    download_id,
                    build_number: paths.build_number.clone(),
                    downloaded: 0,
                    total: 0,
                    speed: 0.0,
                    percentage: 0.0,
                    eta_seconds: 0.0,
                    status: "cancelled".to_string(),
                }).await;
                return Err(AppError::Cancelled);
            }
            Err(_) => {
                return Err(AppError::Generic("Download channel closed unexpectedly".to_string()));
            }
        }

        // 2. Get total_size from DB and update status to extracting
        let total_size = {
            let conn = db.lock_conn()?;
            let rec = repo::get_download(&conn, download_id)?
                .ok_or_else(|| AppError::Generic("Download record not found".to_string()))?;
            // Update status to extracting, keeping downloaded_size at total (download is complete)
            repo::update_download_progress(&conn, download_id, rec.total_size, "extracting")?;
            rec.total_size
        };

        // 3. Emit extracting status starting at 90% (download was 0-100%, extraction is 90-99%)
        let _ = progress_tx.send(DownloadProgress {
            download_id,
            build_number: paths.build_number.clone(),
            downloaded: 0,
            total: total_size,
            speed: 0.0,
            percentage: 90.0,
            eta_seconds: 0.0,
            status: "extracting".to_string(),
        }).await;

        // 4. Extract to install directory with progress reporting
        FileManager::extract_zip(
            &paths.download_path,
            &paths.install_path,
            download_id,
            &paths.build_number,
            total_size,
            Some(progress_tx.clone()),
        ).await?;

        // 5. Validate installation
        let valid = FileManager::validate_installation(&paths.install_path)?;
        let status = if valid { "installed" } else { "corrupt" };

        // 6. Register in installed_versions table with download_id
        let version = InstalledVersion {
            id: 0,
            build_number: paths.build_number.clone(),
            backend: paths.backend.clone(),
            architecture: paths.architecture.clone(),
            install_path: paths.install_path.clone(),
            installed_at: Local::now().to_rfc3339(),
            status: status.to_string(),
            download_id: Some(download_id),
        };

        let version_id = {
            let conn = db.lock_conn()?;
            let id = repo::insert_version(&conn, &version)?;
            repo::update_download_completed(&conn, download_id)?;
            id
        };

        // 7. Emit completed status
        let _ = progress_tx.send(DownloadProgress {
            download_id,
            build_number: paths.build_number.clone(),
            downloaded: 0,
            total: 0,
            speed: 0.0,
            percentage: 100.0,
            eta_seconds: 0.0,
            status: "completed".to_string(),
        }).await;

        // 8. Clean up downloaded file
        let _ = std::fs::remove_file(&paths.download_path);

        Ok(InstalledVersion { id: version_id, ..version })
    }

    /// Uninstall a version: delete DB record and files (only if no other version shares the path).
    pub fn uninstall_version(db: &DbManager, version_id: i64) -> Result<(), AppError> {
        // 1. Get version from DB by ID (avoids loading the entire table)
        let version = {
            let conn = db.lock_conn()?;
            repo::get_version_by_id(&conn, version_id)?
        };

        let version = version.ok_or_else(|| {
            AppError::NotFound(format!("Version with ID {} not found", version_id))
        })?;

        // 2. Safe-delete: only remove files if this is the last version using this install_path
        let should_delete_files = {
            let conn = db.lock_conn()?;
            let count = repo::count_versions_by_install_path(&conn, &version.install_path)?;
            count <= 1 // Only this version uses the path
        };

        if should_delete_files {
            FileManager::remove_version(&version.install_path)?;
        } else {
            log::info!(
                "Skipping file deletion for version {} — install_path is shared by other versions",
                version_id
            );
        }

        // 3. Remove from DB
        {
            let conn = db.lock_conn()?;
            repo::delete_card_customization(&conn, version_id)?;
            repo::delete_version(&conn, version_id)?;
        }

        Ok(())
    }

    /// Duplicate an installed version, creating an independent card that shares the same binary files.
    /// If `with_settings` is true, also copies customization, config link, and override.
    /// Returns the new version's ID.
    pub fn duplicate_version(db: &DbManager, source_id: i64, with_settings: bool) -> Result<i64, AppError> {
        let conn = db.lock_conn()?;

        // 1. Get source version
        let source = repo::get_version_by_id(&conn, source_id)?
            .ok_or_else(|| AppError::NotFound(format!("Version with ID {} not found", source_id)))?;

        // 2. Insert new version row (same build/backend/arch/path, new timestamp)
        let new_version = InstalledVersion {
            id: 0,
            build_number: source.build_number.clone(),
            backend: source.backend.clone(),
            architecture: source.architecture.clone(),
            install_path: source.install_path.clone(),
            installed_at: chrono::Local::now().to_rfc3339(),
            status: source.status.clone(),
            download_id: None, // Clone doesn't have a download record
        };

        let new_id = repo::insert_version(&conn, &new_version)?;

        if with_settings {
            // 3a. Copy card customization
            if let Ok(Some(custom)) = repo::get_card_customization_by_version_id(&conn, source_id) {
                let new_custom = crate::models::types::CardCustomization {
                    version_id: new_id,
                    title: custom.title,
                    header_color: custom.header_color,
                    text_color: custom.text_color,
                };
                let _ = repo::upsert_card_customization(&conn, &new_custom);
            }

            // 3b. Copy version config link
            if let Ok(Some(link)) = repo::get_version_config_link(&conn, source_id) {
                let _ = repo::save_version_config_link(&conn, new_id, &link.config_type, &link.config_id);
            }

            // 3c. Copy version override
            if let Ok(Some(override_val)) = repo::get_version_override(&conn, source_id) {
                let _ = repo::save_version_override(
                    &conn,
                    new_id,
                    override_val.model_path,
                    override_val.mmproj_path,
                );
            }
        }

        Ok(new_id)
    }

    /// List all installed versions.
    pub fn list_installed(db: &DbManager) -> Result<Vec<InstalledVersion>, AppError> {
        let conn = db.lock_conn()?;
        repo::get_all_versions(&conn)
    }

    /// Calculate total storage used by iterating over the versions directory.
    /// Uses iterative directory walking (not recursive) for performance.
    /// Designed to be called from `tokio::task::spawn_blocking` to avoid blocking the main thread.
    pub fn calculate_storage_usage(
        db: &DbManager,
        fallback_path: &str,
    ) -> Result<u64, AppError> {
        let storage_path = crate::config::settings::SettingsManager::get_storage_path(db, fallback_path);
        let versions_dir = std::path::PathBuf::from(&storage_path).join("versions");

        if !versions_dir.exists() {
            return Ok(0);
        }

        let mut total_size: u64 = 0;
        // Iterative walk using a stack to avoid recursion depth issues
        let mut stack: Vec<std::path::PathBuf> = vec![versions_dir];

        while let Some(current) = stack.pop() {
            match std::fs::read_dir(&current) {
                Ok(entries) => {
                    for entry in entries {
                        match entry {
                            Ok(entry) => {
                                let path = entry.path();
                                if path.is_dir() {
                                    stack.push(path);
                                } else {
                                    match std::fs::metadata(&path) {
                                        Ok(metadata) => {
                                            total_size += metadata.len();
                                        }
                                        Err(e) => {
                                            log::warn!(
                                                "Failed to read metadata for {}: {}",
                                                path.display(),
                                                e
                                            );
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                log::warn!(
                                    "Failed to read directory entry in {}: {}",
                                    current.display(),
                                    e
                                );
                            }
                        }
                    }
                }
                Err(e) => {
                    log::warn!("Failed to read directory {}: {}", current.display(), e);
                }
            }
        }

        Ok(total_size)
    }

    /// Open a folder in the system file explorer.
    pub fn open_folder(path: &str) -> Result<(), AppError> {
        #[cfg(windows)]
        {
            std::process::Command::new("explorer")
                .arg(path)
                .spawn()
                .map_err(|e| AppError::Generic(format!("Failed to open explorer: {}", e)))?;
        }

        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(path)
                .spawn()
                .map_err(|e| AppError::Generic(format!("Failed to open finder: {}", e)))?;
        }

        #[cfg(target_os = "linux")]
        {
            std::process::Command::new("xdg-open")
                .arg(path)
                .spawn()
                .map_err(|e| AppError::Generic(format!("Failed to open file manager: {}", e)))?;
        }

        Ok(())
    }
}
