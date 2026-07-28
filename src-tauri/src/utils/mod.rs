use std::path::Path;

use crate::models::types::AppError;

/// Mask absolute paths in error messages to prevent information disclosure.
/// Returns a shortened version showing only the last directory and filename.
pub fn mask_path(path: &str) -> String {
    let p = Path::new(path);
    if let Some(parent) = p.parent() {
        if let (Some(_parent_name), Some(file_name)) = (parent.file_name(), p.file_name()) {
            return format!(".../{}", file_name.to_string_lossy());
        }
    }
    // If we can't extract components, try masking everything except the last segment
    if let Some(file_name) = p.file_name() {
        return format!(".../{}", file_name.to_string_lossy());
    }
    path.to_string()
}

/// Create required application directories under the app data folder.
pub fn setup_directories(base: &Path) -> Result<(), AppError> {
    let dirs = ["versions", "database", "downloads", "logs"];
    for dir in &dirs {
        let path = base.join(dir);
        std::fs::create_dir_all(&path)?;
    }
    Ok(())
}
