use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::{mpsc, Mutex};

use crate::models::types::{AppError, DownloadProgress};

/// Maximum number of concurrent downloads allowed.
const MAX_CONCURRENT_DOWNLOADS: usize = 3;

/// Commands that can be sent to a running download task.
pub enum DownloadCommand {
    /// Cancel the current download.
    Cancel,
}

/// Internal state for an active download.
struct ActiveDownload {
    cancel_tx: mpsc::Sender<DownloadCommand>,
    progress: DownloadProgress,
}

/// Manages concurrent downloads with progress tracking and cancellation.
pub struct DownloadManager {
    active_downloads: Arc<Mutex<HashMap<i64, ActiveDownload>>>,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            active_downloads: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start a download for the given URL to the specified file path.
    ///
    /// Emits progress updates via `progress_tx` which the caller should forward
    /// to the frontend (e.g., via Tauri event emission).
    pub async fn start_download(
        &self,
        download_id: i64,
        url: String,
        file_path: String,
        total_size: u64,
        build_number: String,
        progress_tx: mpsc::Sender<DownloadProgress>,
    ) -> Result<(), AppError> {
        // Enforce max concurrent download limit
        {
            let active = self.active_downloads.lock().await;
            if active.len() >= MAX_CONCURRENT_DOWNLOADS {
                return Err(AppError::Generic("Maximum concurrent downloads reached (limit: 3)".into()));
            }
        }

        let (cancel_tx, mut cancel_rx) = mpsc::channel::<DownloadCommand>(1);

        let initial_progress = DownloadProgress {
            download_id,
            build_number: build_number.clone(),
            downloaded: 0,
            total: total_size,
            speed: 0.0,
            percentage: 0.0,
            eta_seconds: 0.0,
            status: "downloading".to_string(),
        };

        // Register the active download
        {
            let mut active = self.active_downloads.lock().await;
            active.insert(
                download_id,
                ActiveDownload {
                    cancel_tx: cancel_tx.clone(),
                    progress: initial_progress.clone(),
                },
            );
        }

        // Spawn the actual download task
        let active_downloads = self.active_downloads.clone();
        tokio::spawn(async move {
            let result = run_download(
                download_id,
                &url,
                &file_path,
                total_size,
                &build_number,
                &progress_tx,
                &mut cancel_rx,
            )
            .await;

            // Clean up on completion
            let mut active = active_downloads.lock().await;
            active.remove(&download_id);

            // Send final status
            let final_status = match &result {
                Ok(_) => DownloadProgress {
                    download_id,
                    build_number: build_number.clone(),
                    downloaded: total_size,
                    total: total_size,
                    speed: 0.0,
                    percentage: 100.0,
                    eta_seconds: 0.0,
                    status: "completed".to_string(),
                },
                Err(AppError::Cancelled) => DownloadProgress {
                    download_id,
                    build_number: build_number.clone(),
                    downloaded: 0,
                    total: total_size,
                    speed: 0.0,
                    percentage: 0.0,
                    eta_seconds: 0.0,
                    status: "cancelled".to_string(),
                },
                Err(e) => DownloadProgress {
                    download_id,
                    build_number: build_number.clone(),
                    downloaded: 0,
                    total: total_size,
                    speed: 0.0,
                    percentage: 0.0,
                    eta_seconds: 0.0,
                    status: format!("failed: {}", e),
                },
            };
            let _ = progress_tx.send(final_status).await;

            result
        });

        Ok(())
    }

    /// Cancel a running download by ID.
    pub async fn cancel_download(&self, download_id: i64) -> Result<bool, AppError> {
        let mut active = self.active_downloads.lock().await;
        if let Some(active_download) = active.get(&download_id) {
            let _ = active_download.cancel_tx.send(DownloadCommand::Cancel).await;
            // Update status in our tracking
            if let Some(ad) = active.get_mut(&download_id) {
                ad.progress.status = "cancelling".to_string();
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Get current progress for a download.
    pub async fn get_progress(&self, download_id: i64) -> Option<DownloadProgress> {
        let active = self.active_downloads.lock().await;
        active.get(&download_id).map(|ad| ad.progress.clone())
    }
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Validate that the download URL points to github.com only.
fn validate_download_url(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url)
        .map_err(|e| format!("Invalid download URL: {}", e))?;

    // Enforce HTTP(S) scheme only
    if !["http", "https"].contains(&parsed.scheme()) {
        return Err("Only HTTP(S) download URLs are allowed".to_string());
    }

    // Enforce github.com host
    if parsed.host_str() != Some("github.com") {
        return Err("Downloads are restricted to github.com only".to_string());
    }

    Ok(())
}

/// Internal: perform the actual HTTP download with progress tracking.
async fn run_download(
    _download_id: i64,
    url: &str,
    file_path: &str,
    total_size: u64,
    build_number: &str,
    progress_tx: &mpsc::Sender<DownloadProgress>,
    cancel_rx: &mut mpsc::Receiver<DownloadCommand>,
) -> Result<(), AppError> {
    // Validate URL before making any request
    validate_download_url(url).map_err(AppError::Generic)?;
    let client = reqwest::Client::builder()
        .user_agent("LlamaCpp-Manager/1.0")
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| AppError::Generic(format!("Failed to create HTTP client: {}", e)))?;

    let response = tokio::select! {
        res = client.get(url).send() => match res {
            Ok(r) => r.error_for_status().map_err(|e| AppError::Generic(format!("HTTP error: {}", e)))?,
            Err(e) => return Err(AppError::Generic(format!("Request failed: {}", e))),
        },
        _ = cancel_rx.recv() => return Err(AppError::Cancelled),
    };

    // Ensure parent directory exists
    if let Some(parent) = Path::new(file_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Generic(format!("Failed to create directory {}: {}", crate::utils::mask_path(file_path), e)))?;
    }

    // Open file for writing
    let file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(file_path)
        .map_err(|e| AppError::Generic(format!("Failed to open file {}: {}", crate::utils::mask_path(file_path), e)))?;
    let mut writer = std::io::BufWriter::new(file);

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let _start_time = Instant::now();

    // Speed tracking: keep a sliding window of (bytes, timestamp) samples
    let mut speed_samples: Vec<(u64, Instant)> = Vec::new();
    const MAX_SAMPLES: usize = 10;

    use futures::StreamExt;

    let mut cancelled = false;

    while !cancelled {
        let chunk_result = tokio::select! {
            chunk = stream.next() => chunk,
            _ = cancel_rx.recv() => {
                cancelled = true;
                break;
            }
        };

        let Some(chunk_result) = chunk_result else { break };
        let chunk = chunk_result.map_err(|e| AppError::Generic(format!("Stream error: {}", e)))?;
        let chunk_len = chunk.len() as u64;

        writer.write_all(&chunk).map_err(|e| {
            AppError::Generic(format!("Write error: {}", e))
        })?;
        downloaded += chunk_len;

        // Track speed sample
        speed_samples.push((downloaded, Instant::now()));
        if speed_samples.len() > MAX_SAMPLES {
            speed_samples.remove(0);
        }

        // Calculate speed using moving average
        let speed = calculate_speed(&speed_samples);
        let percentage = if total_size > 0 {
            (downloaded as f64 / total_size as f64) * 100.0
        } else {
            0.0
        };

        // Calculate ETA
        let remaining = total_size.saturating_sub(downloaded);
        let eta_seconds = if speed > 0.0 {
            remaining as f64 / speed
        } else {
            0.0
        };

        let progress = DownloadProgress {
            download_id: _download_id,
            build_number: build_number.to_string(),
            downloaded,
            total: total_size,
            speed,
            percentage,
            eta_seconds,
            status: "downloading".to_string(),
        };

        let _ = progress_tx.send(progress).await;
    }

    writer.flush().map_err(|e| {
        AppError::Generic(format!("Failed to flush file: {}", e))
    })?;

    // Check if we were cancelled
    if cancelled {
        // Clean up partial file
        let _ = std::fs::remove_file(file_path);
        return Err(AppError::Cancelled);
    }

    // Verify we downloaded the expected amount
    if total_size > 0 && downloaded != total_size {
        return Err(AppError::Generic(format!(
            "Download incomplete: got {} bytes, expected {}",
            downloaded, total_size
        )));
    }

    Ok(())
}

/// Calculate download speed in bytes/sec from sliding window samples.
fn calculate_speed(samples: &[(u64, Instant)]) -> f64 {
    if samples.len() < 2 {
        let elapsed = samples.first().map(|(_, t)| Instant::now().duration_since(*t).as_secs_f64())
            .unwrap_or(1.0);
        if elapsed <= 0.0 {
            return 0.0;
        }
        return samples.first().map(|(b, _)| *b as f64 / elapsed).unwrap_or(0.0);
    }

    let (first_bytes, first_time) = samples.first().unwrap();
    let (last_bytes, last_time) = samples.last().unwrap();
    let elapsed = last_time.duration_since(*first_time).as_secs_f64();

    if elapsed <= 0.0 {
        return 0.0;
    }

    (last_bytes - first_bytes) as f64 / elapsed
}
