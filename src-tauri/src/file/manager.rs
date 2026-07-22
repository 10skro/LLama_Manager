use std::fs;
use std::path::{Path, PathBuf};

use crate::models::types::{AppError, VersionInfo};

/// File operations: ZIP extraction, validation, cleanup.
pub struct FileManager;

/// Validate that a file path is safely within the target directory.
/// This prevents ZIP SLIP attacks where malicious archives contain paths
/// like `../../etc/passwd` that escape the target directory.
fn is_path_safe(target_dir: &Path, file_path: &Path) -> bool {
    // Canonicalize the target directory to resolve any symlinks
    let canonical_target = match std::fs::canonicalize(target_dir) {
        Ok(p) => p,
        Err(_) => return false,
    };

    // Resolve the file path relative to the target directory
    let resolved_path = match file_path.strip_prefix(".") {
        Ok(p) => target_dir.join(p),
        Err(_) => target_dir.join(file_path),
    };

    // Canonicalize the resolved path (may not exist yet, so use parent)
    if let Some(parent) = resolved_path.parent() {
        match std::fs::canonicalize(parent) {
            Ok(canonical_parent) => canonical_parent.starts_with(&canonical_target),
            Err(_) => false,
        }
    } else {
        false
    }
}

impl FileManager {
    /// Extract a ZIP (or SFX .exe that contains a ZIP payload) to the target directory.
    ///
    /// llama.cpp releases are SFX executables. They contain a ZIP archive after a small
    /// stub header. We try to locate the ZIP local file header signature (`PK\x03\x04`)
    /// and open from there.
    pub fn extract_zip(zip_path: &str, target_dir: &str) -> Result<(), AppError> {
        let zip_path = Path::new(zip_path);
        let target = Path::new(target_dir);

        // Ensure target directory exists
        fs::create_dir_all(target).map_err(|e| {
            AppError::Extraction(format!("Failed to create target directory {}: {}", crate::utils::mask_path(target.to_string_lossy().as_ref()), e))
        })?;

        // Read file contents
        let data = fs::read(zip_path).map_err(|e| {
            AppError::Extraction(format!("Failed to read archive {}: {}", crate::utils::mask_path(zip_path.to_string_lossy().as_ref()), e))
        })?;

        // Try to find ZIP signature
        let zip_offset = find_zip_offset(&data);

        let zip_data = if zip_offset > 0 {
            &data[zip_offset..]
        } else {
            &data[..]
        };

        // Open as ZIP archive
        let mut archive = zip::ZipArchive::new(std::io::Cursor::new(zip_data)).map_err(|e| {
            AppError::Extraction(format!("Failed to open ZIP archive: {}", e))
        })?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| {
                AppError::Extraction(format!("Failed to read entry {}: {}", i, e))
            })?;

            let outpath_name = file.mangled_name();
            let outpath = outpath_name.as_path();

            // Skip directory entries (they'll be created automatically)
            if file.is_dir() {
                let full_path = target.join(&outpath);
                // ZIP SLIP prevention: validate path is within target directory
                if !is_path_safe(target, &outpath) {
                    log::warn!("Skipping unsafe ZIP entry (ZIP SLIP): {:?}", outpath);
                    continue;
                }
                let _ = fs::create_dir_all(&full_path);
                continue;
            }

            let full_path = target.join(&outpath);

            // ZIP SLIP prevention: validate path is within target directory
            if !is_path_safe(target, &outpath) {
                return Err(AppError::Extraction(format!(
                    "Unsafe ZIP entry detected (ZIP SLIP prevention): {:?}",
                    outpath
                )));
            }

            // Create parent directories
            if let Some(parent) = full_path.parent() {
                fs::create_dir_all(parent).map_err(|e| {
                    AppError::Extraction(format!("Failed to create parent dir {}: {}", crate::utils::mask_path(full_path.to_string_lossy().as_ref()), e))
                })?;
            }

            // Extract file
            let mut outfile = fs::File::create(&full_path).map_err(|e| {
                AppError::Extraction(format!("Failed to create file {}: {}", crate::utils::mask_path(full_path.to_string_lossy().as_ref()), e))
            })?;

            std::io::copy(&mut file, &mut outfile).map_err(|e| {
                AppError::Extraction(format!("Failed to write file {}: {}", crate::utils::mask_path(full_path.to_string_lossy().as_ref()), e))
            })?;

            // Preserve permissions if available
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = file.unix_mode() {
                    let _ = fs::set_permissions(&full_path, fs::Permissions::from_mode(mode));
                }
            }
        }

        Ok(())
    }

    /// Validate that an installation directory contains the expected files.
    pub fn validate_installation(install_path: &str) -> Result<bool, AppError> {
        let path = Path::new(install_path);

        if !path.exists() {
            return Ok(false);
        }

        // Check for required executables
        let required_files = ["llama-cli.exe", "llama-server.exe"];

        for file in &required_files {
            if !path.join(file).exists() {
                return Ok(false);
            }
        }

        Ok(true)
    }

    /// Detect version info from an installed directory.
    pub fn detect_version_info(install_path: &str) -> Result<VersionInfo, AppError> {
        let path = Path::new(install_path);

        let has_cli = path.join("llama-cli.exe").exists();
        let has_server = path.join("llama-server.exe").exists();
        let has_quantize = path.join("llama-quantize.exe").exists();

        // Try to detect backend from available binaries
        let has_cuda = path.join("llama-bench.exe").exists()
            && path.join("llama-cli.exe").exists();
        let has_vulkan = path.join("llama-vulkan.exe").exists()
            || has_cuda; // simplified heuristic

        let backend = if has_vulkan {
            "Vulkan".to_string()
        } else if has_cuda {
            "CUDA".to_string()
        } else {
            "CPU".to_string()
        };

        // Try to extract build number from directory name
        let build_number = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        Ok(VersionInfo {
            build_number,
            backend,
            has_cli,
            has_server,
            has_quantize,
        })
    }

    /// Recursively delete a version directory.
    pub fn remove_version(install_path: &str) -> Result<(), AppError> {
        let path = Path::new(install_path);
        if path.exists() {
            fs::remove_dir_all(path)?;
        }
        Ok(())
    }

    /// Get the download directory path for storing temporary files.
    pub fn get_download_path(base: &Path, filename: &str) -> PathBuf {
        base.join("downloads").join(filename)
    }

    /// Get the installation directory for a given build and backend.
    pub fn get_install_path(base: &Path, build_number: &str, backend: &str) -> PathBuf {
        base.join("versions").join(format!("{}_{}", build_number, backend))
    }
}

/// Find the offset of the ZIP local file header signature in the data.
/// Returns 0 if the data starts with a ZIP signature, or the offset of the first occurrence.
fn find_zip_offset(data: &[u8]) -> usize {
    const ZIP_SIGNATURE: [u8; 4] = [0x50, 0x4B, 0x03, 0x04]; // "PK\x03\x04"

    if data.starts_with(&ZIP_SIGNATURE) {
        return 0;
    }

    // Search for the first occurrence of the ZIP signature
    // SFX stubs are typically small (< 64KB), so we limit the search
    let search_limit = std::cmp::min(data.len(), 64 * 1024);

    for i in 0..search_limit.saturating_sub(3) {
        if data[i..i + 4] == ZIP_SIGNATURE {
            return i;
        }
    }

    0
}
