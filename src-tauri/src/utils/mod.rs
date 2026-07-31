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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_path_with_file() {
        let result = mask_path("/some/long/path/to/file.txt");
        assert_eq!(result, ".../file.txt");
    }

    #[test]
    fn test_mask_path_simple() {
        let result = mask_path("simple");
        assert_eq!(result, ".../simple");
    }

    #[test]
    fn test_mask_path_directory() {
        let result = mask_path("/path/to/dir/");
        assert_eq!(result, ".../dir");
    }
}

/// Create required application directories under the app data folder.
pub fn setup_directories(base: &Path) -> Result<(), AppError> {
    let dirs = ["versions", "database", "downloads", "logs", "config"];
    for dir in &dirs {
        let path = base.join(dir);
        std::fs::create_dir_all(&path)?;
    }
    Ok(())
}
