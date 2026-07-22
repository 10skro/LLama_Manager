use std::path::Path;

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
