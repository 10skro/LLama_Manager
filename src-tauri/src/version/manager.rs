use std::path::PathBuf;

use chrono::Local;
use tokio::sync::mpsc;

use crate::db::connection::DbManager;
use crate::db::repo;
use crate::download::manager::DownloadManager;
use crate::file::manager::FileManager;
use crate::models::types::{
    AppError, Build, DownloadProgress, DownloadRecord, InstalledVersion,
};

/// Orchestrates version installation, uninstallation, and listing.
pub struct VersionManager;

impl VersionManager {
    /// Full install pipeline: download → extract → validate → register.
    pub async fn install_version(
        db: &DbManager,
        download_mgr: &DownloadManager,
        build: &Build,
        storage_base: PathBuf,
        progress_tx: mpsc::Sender<DownloadProgress>,
    ) -> Result<InstalledVersion, AppError> {
        // 1. Check if already installed
        {
            let conn = db.lock_conn()?;
            if let Some(existing) = repo::get_version_by_build(&conn, &build.build_number, &build.backend)? {
                if existing.status == "installed" {
                    return Err(AppError::AlreadyInstalled(format!(
                        "{} ({})",
                        build.build_number, build.backend
                    )));
                }
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

        // 4. Start download with progress
        {
            let conn = db.lock_conn()?;
            repo::update_download_progress(&conn, download_id, 0, "downloading")?;
        }

        download_mgr
            .start_download(
                download_id,
                build.download_url.clone(),
                download_path_str.clone(),
                build.file_size,
                build.build_number.clone(),
                progress_tx.clone(),
            )
            .await?;

        // Wait for download completion signal via a separate channel
        let (_done_tx, _done_rx) = mpsc::channel::<Result<(), AppError>>(1);
        let download_id_clone = download_id;

        // We need to monitor the download status. For now, we'll poll the DB.
        // In a production app, you'd use a more sophisticated event system.

        // 5. Poll until download completes or fails
        let max_wait_seconds = 3600; // 1 hour max
        let mut waited = 0;
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            waited += 1;

            let status = {
                let conn = db.lock_conn().map_err(|_| AppError::Generic("DB lock failed".to_string()))?;
                if let Some(rec) = repo::get_download(&conn, download_id_clone).map_err(|_| AppError::Generic("DB query failed".to_string()))? {
                    rec.status
                } else {
                    "unknown".to_string()
                }
            };

            match status.as_str() {
                "completed" => break,
                "failed" | "cancelled" => {
                    return Err(AppError::Generic(format!(
                        "Download was {}",
                        status
                    )));
                }
                _ => {}
            }

            if waited >= max_wait_seconds {
                return Err(AppError::Generic("Download timed out".to_string()));
            }
        }

        // 6. Extract to install directory
        {
            let conn = db.lock_conn()?;
            repo::update_download_progress(&conn, download_id, 0, "extracting")?;
        }

        FileManager::extract_zip(&download_path_str, &install_path_str)?;

        // 7. Validate installation
        let valid = FileManager::validate_installation(&install_path_str)?;
        let status = if valid { "installed" } else { "corrupt" };

        // 8. Register in installed_versions table
        let version = InstalledVersion {
            id: 0,
            build_number: build.build_number.clone(),
            backend: build.backend.clone(),
            install_path: install_path_str,
            installed_at: Local::now().to_rfc3339(),
            status: status.to_string(),
        };

        let version_id = {
            let conn = db.lock_conn()?;
            let id = repo::insert_version(&conn, &version)?;
            repo::update_download_completed(&conn, download_id)?;
            id
        };

        // Clean up downloaded file
        let _ = std::fs::remove_file(&download_path_str);

        Ok(InstalledVersion { id: version_id, ..version })
    }

    /// Uninstall a version: delete files and DB record.
    pub fn uninstall_version(db: &DbManager, version_id: i64) -> Result<(), AppError> {
        // 1. Get version from DB
        let version = {
            let conn = db.lock_conn()?;
            let all = repo::get_all_versions(&conn)?;
            all.into_iter().find(|v| v.id == version_id)
        };

        let version = version.ok_or_else(|| {
            AppError::NotFound(format!("Version with ID {} not found", version_id))
        })?;

        // 2. Delete files from disk
        FileManager::remove_version(&version.install_path)?;

        // 3. Remove from DB
        {
            let conn = db.lock_conn()?;
            repo::delete_version(&conn, version_id)?;
        }

        Ok(())
    }

    /// List all installed versions.
    pub fn list_installed(db: &DbManager) -> Result<Vec<InstalledVersion>, AppError> {
        let conn = db.lock_conn()?;
        repo::get_all_versions(&conn)
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
