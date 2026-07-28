//! Session-based file logging with automatic rotation.
//!
//! Each app session gets its own log file: `app-<timestamp>.log`.
//! Keeps a maximum of MAX_SESSION_LOGS files, deleting the oldest first.
//! In debug builds, also logs warn+ to stdout for developer convenience.

use crate::models::types::AppError;

pub const MAX_SESSION_LOGS: usize = 20;

/// Initialize tracing-subscriber with session-based file logging.
/// Must be called after the log directory has been created.
pub fn init(app_dir: &std::path::Path) -> Result<(), AppError> {
    use tracing_subscriber::prelude::*;

    let log_dir = app_dir.join("logs");
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| AppError::Generic(format!("Failed to create log directory {:?}: {}", log_dir, e)))?;

    // Create session-specific log file: app-2025-07-28T14-30-22.log
    let timestamp = chrono::Local::now().format("%Y-%m-%dT%H-%M-%S");
    let log_file_name = format!("app-{}.log", timestamp);
    let log_path = log_dir.join(&log_file_name);
    let log_file = std::fs::File::create(&log_path)
        .map_err(|e| AppError::Generic(format!("Failed to create log file at {:?}: {}", log_path, e)))?;

    // Rotate: delete oldest session logs if we exceed MAX_SESSION_LOGS
    rotate_session_logs(&log_dir, MAX_SESSION_LOGS);

    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| {
            #[cfg(debug_assertions)]
            {
                tracing_subscriber::EnvFilter::new("debug")
            }
            #[cfg(not(debug_assertions))]
            {
                tracing_subscriber::EnvFilter::new("info")
            }
        });

    // File logging layer
    let file_layer = tracing_subscriber::fmt::layer()
        .with_writer(log_file)
        .with_filter(env_filter);

    // Build subscriber with registry (supports .with() for layers)
    let registry = tracing_subscriber::registry().with(file_layer);

    #[cfg(debug_assertions)]
    {
        // Console: only show warn+error in debug builds (file still gets everything)
        let console_filter = tracing_subscriber::EnvFilter::new("warn");
        let console_layer = tracing_subscriber::fmt::layer()
            .with_writer(std::io::stdout)
            .with_filter(console_filter);
        registry
            .with(console_layer)
            .try_init()
            .map_err(|e| AppError::Generic(format!("Failed to set global tracing subscriber: {}", e)))?;
    }
    #[cfg(not(debug_assertions))]
    {
        registry
            .try_init()
            .map_err(|e| AppError::Generic(format!("Failed to set global tracing subscriber: {}", e)))?;
    }

    // Bridge `log` crate macros (log::info!, log::warn!, etc.) to the tracing subscriber.
    // Tauri may have already initialized the logger before .setup() runs —
    // in that case LogTracer::init() fails silently, which is fine since
    // Tauri's own bridge handles log → tracing already.
    let _ = tracing_log::LogTracer::init();

    // Log session header: version, build mode, platform, log file
    let build_mode = if cfg!(debug_assertions) { "DEV" } else { "RELEASE" };
    log::info!("=== Session started ===");
    log::info!("Version: {}", env!("CARGO_PKG_VERSION"));
    log::info!("Build: {}", build_mode);
    log::info!("Platform: {}-{}", std::env::consts::OS, std::env::consts::ARCH);
    log::info!("Log file: {:?}", log_path);

    Ok(())
}

/// Delete the oldest session log files when the count exceeds `max_logs`.
/// Session files match the pattern `app-*.log`.
fn rotate_session_logs(log_dir: &std::path::Path, max_logs: usize) {
    let mut session_files: Vec<_> = match std::fs::read_dir(log_dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                name.starts_with("app-") && e.path().extension().map(|ext| ext == "log").unwrap_or(false)
            })
            .collect(),
        Err(_) => return,
    };

    // Sort by modification time ascending (oldest first)
    session_files.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());

    // Delete oldest files until we're at max_logs
    while session_files.len() > max_logs {
        let oldest = session_files.remove(0);
        let path = oldest.path();
        if let Err(e) = std::fs::remove_file(&path) {
            eprintln!("Warning: could not delete old log {:?}: {}", path, e);
        }
    }
}
