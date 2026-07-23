use serde::{Deserialize, Serialize};

/// GitHub build from llama.cpp releases
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Build {
    pub build_number: String,    // "b10075"
    pub tag_name: String,
    pub published_at: String,
    pub platform: String,        // "windows"
    pub architecture: String,    // "x64", "arm64"
    pub backend: String,         // "CPU", "CUDA_12_X", "Vulkan", etc.
    pub download_url: String,
    pub file_size: u64,
    pub checksum: Option<String>,
}

/// Installed version record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledVersion {
    pub id: i64,
    pub build_number: String,
    pub backend: String,
    pub architecture: String,    // "x64", "arm64"
    pub install_path: String,
    pub installed_at: String,
    pub status: String,          // "installed", "corrupt", "pending"
}

/// Download tracking record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRecord {
    pub id: i64,
    pub build_number: String,
    pub download_url: String,
    pub file_path: Option<String>,
    pub total_size: u64,
    pub downloaded_size: u64,
    pub status: String,          // "pending", "downloading", "extracting", "completed", "failed", "cancelled"
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Real-time download progress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub download_id: i64,
    pub build_number: String,
    pub downloaded: u64,
    pub total: u64,
    pub speed: f64,              // bytes/sec
    pub percentage: f64,
    pub eta_seconds: f64,
    pub status: String,
}

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub storage_path: String,
    pub theme: String,
    pub last_fetch: Option<String>,
    pub auto_check_updates: bool,
    #[serde(default)]
    pub font_family: Option<String>,
    #[serde(default)]
    pub toast_duration: Option<i64>, // milliseconds, default 5000
}

/// Version info detected from an installed directory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub build_number: String,
    pub backend: String,
    pub has_cli: bool,
    pub has_server: bool,
    pub has_quantize: bool,
}

/// Favorite build record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoriteBuild {
    pub id: i64,
    pub build_number: String,
    pub backend: String,
    pub download_url: String,
}

/// Application error type
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Download cancelled")]
    Cancelled,
    #[error("Extraction error: {0}")]
    Extraction(String),
    #[error("Version already installed: {0}")]
    AlreadyInstalled(String),
    #[error("Version not found: {0}")]
    NotFound(String),
    #[error("Generic error: {0}")]
    Generic(String),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}
