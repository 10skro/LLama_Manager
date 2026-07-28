use crate::models::types::ModelFile;

/// Scan a folder for files matching given extensions.
/// Non-recursive: only files directly in the folder.
/// Returns files sorted by name (case-insensitive).
/// If extensions is empty, all files are included.
pub fn scan_files(folder_path: &str, extensions: &[&str]) -> Result<Vec<ModelFile>, String> {
    let path = std::path::Path::new(folder_path);

    if !path.exists() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", folder_path));
    }

    let mut files: Vec<ModelFile> = Vec::new();

    for entry in std::fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_path = entry.path();

        // Non-recursive: only files directly in the folder
        if !file_path.is_file() {
            continue;
        }

        // Filter by extensions (empty = all files)
        if !extensions.is_empty() {
            let file_ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if !extensions.contains(&file_ext) {
                continue;
            }
        }

        let metadata = entry.metadata().map_err(|e| format!("Failed to read metadata: {}", e))?;
        let name = file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        files.push(ModelFile {
            path: file_path.to_string_lossy().to_string(),
            name,
            size: metadata.len(),
        });
    }

    // Sort by name for consistent ordering
    files.sort_by_key(|a| a.name.to_lowercase());

    Ok(files)
}

/// Scan for model files (.gguf, .safetensors, etc.)
/// extensions: comma-separated list, e.g. "gguf,safetensors" or "" for all
pub fn scan_model_files(folder_path: String, extensions: String) -> Result<Vec<ModelFile>, String> {
    let exts: Vec<&str> = if extensions.is_empty() {
        Vec::new()
    } else {
        extensions.split(',').collect()
    };
    scan_files(&folder_path, &exts)
}

/// Scan for mmproj files (.gguf, .safetensors, .mmproj, etc.)
/// extensions: comma-separated list, e.g. "gguf,safetensors" or "" for all
pub fn scan_mmproj_files(folder_path: String, extensions: String) -> Result<Vec<ModelFile>, String> {
    let exts: Vec<&str> = if extensions.is_empty() {
        Vec::new()
    } else {
        extensions.split(',').collect()
    };
    scan_files(&folder_path, &exts)
}

/// Validate that a folder path exists and is accessible as a directory.
pub fn validate_folder(path: String) -> Result<bool, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(format!("Folder does not exist: {}", path));
    }
    if !p.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    Ok(true)
}


