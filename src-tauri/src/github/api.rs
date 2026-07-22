use std::collections::HashSet;
use std::sync::Mutex;
use std::sync::OnceLock;

use chrono::Local;
use regex::Regex;

use crate::db::repo::{cache_builds, get_cached_builds, get_setting, set_setting};
use crate::models::types::{AppError, Build, InstalledVersion};

const GITHUB_RELEASES_URL: &str = "https://api.github.com/repos/ggml-org/llama.cpp/releases";

/// Default cache TTL in minutes (1 hour).
const DEFAULT_CACHE_TTL_MINUTES: u64 = 60;

/// Settings keys for catalog cache metadata.
const SETTING_GITHUB_ETAG: &str = "github_etag";
const SETTING_CATALOG_LAST_FETCHED: &str = "catalog_last_fetched_at";
const SETTING_CATALOG_CACHE_TTL: &str = "catalog_cache_ttl_minutes";

/// Fetch mode controlling cache behavior for catalog requests.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FetchMode {
    /// Return cached DB data if fresh (< TTL). Fallback to ETag check if stale.
    CacheOnly,
    /// Default: if cache fresh → DB; if stale → ETag check → fetch if needed.
    Smart,
    /// Bypass TTL, always check ETag with GitHub.
    ForceRefresh,
}

/// Allowed (backend, architecture) pairs for Windows builds.
const ALLOWED_VARIANTS: [(&str, &str); 5] = [
    ("CPU", "x64"),
    ("CPU", "arm64"),
    ("CUDA_12", "x64"),
    ("CUDA_13", "x64"),
    ("Vulkan", "x64"),
];

/// Result of a fetch operation: either a cache hit (304) or fresh data.
#[derive(Debug)]
pub(crate) enum FetchResult {
    CacheHit,
    Fresh(Vec<Build>),
}

/// Singleton regex for standard llama.cpp build names.
static BUILD_NAME_RE: OnceLock<Regex> = OnceLock::new();

/// Shared HTTP client for GitHub API requests.
/// This singleton avoids creating a new reqwest::Client for every request.
pub struct GithubClient {
    client: reqwest::Client,
    github_token: Mutex<Option<String>>,
    /// Cached ETag for conditional requests (If-None-Match)
    etag: Mutex<Option<String>>,
}

impl GithubClient {
    /// Create a new GithubClient.
    /// If `persisted_etag` is provided, it initializes the in-memory ETag cache
    /// so that the first request can use a conditional request (If-None-Match).
    pub fn new(github_token: Option<String>, persisted_etag: Option<String>) -> Self {
        Self {
            client: reqwest::Client::builder()
                .user_agent("LlamaCpp-Manager/0.1.0")
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            github_token: Mutex::new(github_token),
            etag: Mutex::new(persisted_etag),
        }
    }

    /// Update the token at runtime (no restart needed).
    pub fn set_token(&self, token: Option<String>) {
        let mut gt = self.github_token.lock().unwrap();
        *gt = token;
    }

    /// Build a request with auth header if token is configured.
    /// If `skip_etag` is true, the If-None-Match header is omitted (used for search).
    fn build_request(&self, url: &str, skip_etag: bool) -> reqwest::RequestBuilder {
        let mut builder = self.client
            .get(url)
            .header("Accept", "application/vnd.github.v3+json");

        // Add Authorization header if token is present
        let token = self.github_token.lock().unwrap().clone();
        if let Some(ref t) = token {
            builder = builder.header("Authorization", format!("Bearer {}", t));
        }

        // Add If-None-Match header if we have a cached ETag (skip for search)
        if !skip_etag {
            let cached_etag = self.etag.lock().unwrap().clone();
            if let Some(etag) = cached_etag {
                builder = builder.header("If-None-Match", etag);
            }
        }

        builder
    }
}

/// Load the persisted ETag from the settings table.
/// Returns None if no ETag is stored or on any DB error.
fn load_persisted_etag(db: &crate::db::connection::DbManager) -> Option<String> {
    let conn = db.lock_conn().ok()?;
    get_setting(&conn, SETTING_GITHUB_ETAG).ok()?.clone()
}

/// Load the last fetched timestamp from the settings table.
/// Returns None if not set or on any DB error.
fn load_last_fetched_at(db: &crate::db::connection::DbManager) -> Option<String> {
    let conn = db.lock_conn().ok()?;
    get_setting(&conn, SETTING_CATALOG_LAST_FETCHED).ok()?.clone()
}

/// Save the ETag to the settings table.
fn save_etag_to_db(db: &crate::db::connection::DbManager, etag: &str) {
    if let Ok(mut conn) = db.lock_conn() {
        let _ = set_setting(&mut conn, SETTING_GITHUB_ETAG, etag);
    }
}

/// Save the current timestamp to the settings table.
fn save_last_fetched_at(db: &crate::db::connection::DbManager) {
    let now = Local::now().to_rfc3339();
    if let Ok(mut conn) = db.lock_conn() {
        let _ = set_setting(&mut conn, SETTING_CATALOG_LAST_FETCHED, &now);
    }
}

/// Read the configured cache TTL in minutes from settings (fallback to default).
fn get_cache_ttl_minutes(db: &crate::db::connection::DbManager) -> u64 {
    let conn = match db.lock_conn() {
        Ok(c) => c,
        Err(_) => return DEFAULT_CACHE_TTL_MINUTES,
    };
    match get_setting(&conn, SETTING_CATALOG_CACHE_TTL) {
        Ok(Some(val)) => val.parse::<u64>().ok().unwrap_or(DEFAULT_CACHE_TTL_MINUTES),
        _ => DEFAULT_CACHE_TTL_MINUTES,
    }
}

/// Check whether the cached builds are still fresh (within TTL).
/// Returns true if `catalog_last_fetched_at` exists and is less than TTL minutes old.
fn is_cache_fresh(db: &crate::db::connection::DbManager) -> bool {
    let ttl_minutes = get_cache_ttl_minutes(db);
    let last_fetched = match load_last_fetched_at(db) {
        Some(ts) => ts,
        None => return false,
    };
    let fetched_datetime = match chrono::DateTime::parse_from_rfc3339(&last_fetched) {
        Ok(dt) => dt,
        Err(_) => return false,
    };
    let now = chrono::DateTime::<chrono::Local>::from(Local::now());
    let fetched_local = chrono::DateTime::<chrono::Local>::from(fetched_datetime);
    now.signed_duration_since(fetched_local).num_minutes() < ttl_minutes as i64
}

/// GitHub Release asset structure
#[derive(serde::Deserialize, Debug)]
struct GitHubRelease {
    tag_name: String,
    published_at: Option<String>,
    body: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(serde::Deserialize, Debug)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

/// Regex to parse standard llama.cpp build names:
/// llama-b10077-bin-win-cpu-x64.zip              -> CPU (x64)
/// llama-b10077-bin-win-cpu-arm64.zip            -> CPU (arm64)
/// llama-b10077-bin-win-opencl-adreno-arm64.zip  -> OpenCL (arm64)
/// llama-b10077-bin-win-cuda-12.4-x64.zip        -> CUDA_12 (x64)
/// llama-b10077-bin-win-cuda-13.3-x64.zip        -> CUDA_13 (x64)
/// llama-b10077-bin-win-vulkan-x64.zip           -> Vulkan (x64)
/// llama-b10077-bin-win-openvino-2026.2.1-x64.zip -> OpenVINO (x64)
/// llama-b10077-bin-win-sycl-x64.zip             -> SYCL (x64)
/// llama-b10077-bin-win-hip-radeon-x64.zip       -> HIP (x64)
fn build_name_regex() -> &'static Regex {
    BUILD_NAME_RE.get_or_init(|| {
        Regex::new(r"llama-b(\d+)-bin-win-(cpu|cuda-\d+\.\d+|vulkan|opencl-adreno|openvino-[\d.]+|sycl|hip-radeon)-(x64|arm64)\.zip$")
            .expect("regex must be valid")
    })
}

/// Extract backend and architecture from the matched build name
fn parse_build_info(captures: &regex::Captures) -> (String, String, String) {
    let num = captures.get(1).unwrap().as_str().to_string();
    let build_number = format!("b{}", num);

    let variant = captures.get(2).unwrap().as_str();
    let architecture = captures.get(3).unwrap().as_str().to_string();

    match variant {
        v if v.starts_with("cuda-12") => (build_number, architecture, "CUDA_12".to_string()),
        v if v.starts_with("cuda-13") => (build_number, architecture, "CUDA_13".to_string()),
        "vulkan" => (build_number, architecture, "Vulkan".to_string()),
        "opencl-adreno" => (build_number, architecture, "OpenCL".to_string()),
        v if v.starts_with("openvino-") => (build_number, architecture, "OpenVINO".to_string()),
        "sycl" => (build_number, architecture, "SYCL".to_string()),
        "hip-radeon" => (build_number, architecture, "HIP".to_string()),
        "cpu" => (build_number, architecture, "CPU".to_string()),
        _ => (build_number, architecture, "Unknown".to_string()),
    }
}

/// Parse a single GitHub release into filtered Build objects.
/// Returns only builds matching ALLOWED_VARIANTS, sorted by build number descending.
fn parse_release_into_builds(release: &GitHubRelease) -> Vec<Build> {
    let regex = build_name_regex();
    let tag = release.tag_name.clone();
    let published = release.published_at.clone().unwrap_or_else(|| Local::now().to_rfc3339());
    let mut builds: Vec<Build> = Vec::new();

    for asset in &release.assets {
        if let Some(captures) = regex.captures(&asset.name) {
            let (build_number, architecture, backend) = parse_build_info(&captures);
            let is_allowed = ALLOWED_VARIANTS.iter()
                .any(|(b, a)| b == &backend && a == &architecture);
            if is_allowed {
                builds.push(Build {
                    build_number,
                    tag_name: tag.clone(),
                    published_at: published.clone(),
                    platform: "windows".to_string(),
                    architecture,
                    backend,
                    download_url: asset.browser_download_url.clone(),
                    file_size: asset.size,
                    checksum: None,
                });
            }
        }
    }

    builds.sort_by(|a, b| {
        let num_a = a.build_number.trim_start_matches('b').parse::<u64>().unwrap_or(0);
        let num_b = b.build_number.trim_start_matches('b').parse::<u64>().unwrap_or(0);
        num_b.cmp(&num_a)
    });

    builds
}

/// Fetch latest builds from GitHub Releases API.
/// Returns builds from the `release_limit` most recent releases,
/// filtered to only the allowed variants.
pub async fn fetch_latest_builds(
    github_client: &GithubClient,
    release_limit: usize,
) -> Result<FetchResult, AppError> {
    log::info!("Fetching latest builds from GitHub API...");

    // Ensure per_page is at least as large as release_limit so we get enough releases
    // GitHub API defaults to 30 per page, which would cap results if release_limit > 30
    let per_page = release_limit.max(100);
    let url = format!("{}?per_page={}", GITHUB_RELEASES_URL, per_page);

    let response = github_client
        .build_request(&url, false)
        .send()
        .await?;

    let status = response.status();
    log::info!("GitHub API response status: {}", status);

    // Handle 304 Not Modified - use cached builds
    if status.as_u16() == 304 {
        log::info!("GitHub API returned 304 Not Modified, using cached builds.");
        return Ok(FetchResult::CacheHit);
    }

    let response = response.error_for_status()?;

    // Update cached ETag for next request
    if let Some(etag) = response.headers().get("ETag") {
        if let Ok(etag_str) = etag.to_str() {
            let mut cached_etag = github_client.etag.lock().unwrap();
            *cached_etag = Some(etag_str.to_string());
            log::info!("Cached ETag: {}", etag_str);
        }
    }

    let releases: Vec<GitHubRelease> = response.json().await?;
    log::info!("Fetched {} releases from GitHub API.", releases.len());

    // Take only the `release_limit` most recent releases
    // GitHub API returns releases sorted by published_at descending
    let mut builds: Vec<Build> = Vec::new();
    for release in releases.into_iter().take(release_limit) {
        builds.extend(parse_release_into_builds(&release));
    }

    log::info!("Parsed {} builds from {} releases (filtered to allowed variants).", builds.len(), release_limit);

    Ok(FetchResult::Fresh(builds))
}

/// Fetch builds from API, cache them, and fall back to cache on failure.
///
/// The `mode` parameter controls cache behavior:
/// - `CacheOnly`: Return cached DB data if fresh (< TTL). Fallback to ETag check if stale.
/// - `Smart` (default): If cache fresh → DB; if stale → ETag check → fetch if needed.
/// - `ForceRefresh`: Bypass TTL, always check ETag with GitHub.
///
/// This function takes the connection lock briefly for caching, then releases it
/// before the async API call to avoid holding the lock across .await.
pub async fn fetch_builds_from_cache_or_api(
    github_client: &GithubClient,
    db: &crate::db::connection::DbManager,
    release_limit: usize,
    mode: FetchMode,
) -> Result<Vec<Build>, AppError> {
    // For CacheOnly and Smart modes, check if DB cache is fresh
    if mode != FetchMode::ForceRefresh {
        if is_cache_fresh(db) {
            log::info!("Cache is fresh (within TTL), returning cached builds from database.");
            let conn = db.lock_conn()?;
            match get_cached_builds(&conn) {
                Ok(cached) if !cached.is_empty() => {
                    log::info!("Returned {} cached builds (cache fresh).", cached.len());
                    return Ok(cached);
                }
                Ok(_) => {
                    log::warn!("Cache timestamp is fresh but no builds found in cache.");
                }
                Err(e) => {
                    log::warn!("Failed to read cached builds: {}", e);
                }
            }
        } else {
            log::info!("Cache is stale or missing, will check with GitHub API.");
        }
    }

    // Cache is stale/missing or ForceRefresh mode: do ETag check via API
    match fetch_latest_builds(github_client, release_limit).await {
        Ok(FetchResult::Fresh(builds)) => {
            // 200 OK with fresh data - update cache and persist metadata
            log::info!("Caching {} builds to database.", builds.len());

            // Persist ETag and timestamp to DB (brief lock, no await after)
            let current_etag = github_client.etag.lock().unwrap().clone();
            if let Some(ref etag) = current_etag {
                save_etag_to_db(db, etag);
            }
            save_last_fetched_at(db);

            // Cache the builds
            let mut conn = db.lock_conn()?;
            let _ = cache_builds(&mut conn, &builds);
            Ok(builds)
        }
        Ok(FetchResult::CacheHit) => {
            // 304 Not Modified - use cached builds
            log::info!("GitHub API returned 304 Not Modified, using cached builds.");
            let conn = db.lock_conn()?;
            match get_cached_builds(&conn) {
                Ok(cached) if !cached.is_empty() => {
                    // Update last_fetched_at timestamp since we verified freshness with GitHub
                    save_last_fetched_at(db);
                    Ok(cached)
                }
                Ok(_) => Err(AppError::Generic("No cached builds available".to_string())),
                Err(cache_err) => {
                    log::error!("Cache fetch failed after 304: {}", cache_err);
                    Err(AppError::Generic("No cached builds available".to_string()))
                }
            }
        }
        Err(api_err) => {
            log::warn!("GitHub API fetch failed: {}. Trying cache.", api_err);
            // Fall back to cache (brief DB lock, no await after)
            let conn = db.lock_conn()?;
            match get_cached_builds(&conn) {
                Ok(cached) if !cached.is_empty() => {
                    log::info!("Fell back to {} cached builds.", cached.len());
                    Ok(cached)
                }
                Ok(_) => Err(AppError::Generic("No cached builds available".to_string())),
                Err(cache_err) => {
                    log::error!("Cache fetch also failed: {}", cache_err);
                    Err(api_err)
                }
            }
        }
    }
}

/// Get the last fetched timestamp from settings.
/// Returns None if no timestamp is stored.
pub fn get_catalog_last_fetched(db: &crate::db::connection::DbManager) -> Option<String> {
    load_last_fetched_at(db)
}

/// Fetch builds for a specific release tag from GitHub.
/// Calls `GET /repos/{owner}/{repo}/releases/tags/{tag}` which returns a single release.
pub async fn fetch_release_by_tag(
    github_client: &GithubClient,
    tag_name: String,
) -> Result<Vec<Build>, AppError> {
    let url = format!(
        "https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/{}",
        tag_name
    );
    log::info!("Fetching release by tag '{}' from GitHub API...", tag_name);

    let response = github_client
        .build_request(&url, false)
        .send()
        .await?;

    let status = response.status();
    log::info!("GitHub API response status: {}", status);

    // Handle 404 - tag not found
    if status.as_u16() == 404 {
        return Err(AppError::Generic(format!(
            "Release tag '{}' not found on GitHub.",
            tag_name
        )));
    }

    let response = response.error_for_status()?;

    let release: GitHubRelease = response.json().await?;
    log::info!(
        "Fetched release '{}' with {} assets from GitHub API.",
        release.tag_name,
        release.assets.len()
    );

    let builds = parse_release_into_builds(&release);

    log::info!(
        "Parsed {} builds from release '{}' (filtered to allowed variants).",
        builds.len(),
        release.tag_name
    );

    Ok(builds)
}

/// Search for builds by build number prefix across recent GitHub releases.
/// Fetches up to `max_releases` releases and filters builds whose build number
/// contains the normalized query string. Does not use ETag caching to ensure
/// fresh data for search results.
///
/// E.g., "9976" will find "b9976", "b99760", etc.
pub async fn search_builds(
    github_client: &GithubClient,
    query: String,
    max_releases: usize,
) -> Result<Vec<Build>, AppError> {
    // Normalize query: strip leading 'b' if present, make it case-insensitive
    let lower = query.trim().to_lowercase();
    let normalized = lower.trim_start_matches('b').to_string();

    if normalized.is_empty() {
        return Ok(Vec::new());
    }

    log::info!("Searching for builds matching '{}' (normalized: '{}')...", query, normalized);

    // Fetch releases from GitHub (skip ETag caching to ensure fresh data for search)
    // Ensure per_page is at least as large as max_releases so we get enough releases
    let per_page = max_releases.max(100);
    let url = format!("{}?per_page={}", GITHUB_RELEASES_URL, per_page);

    let response = github_client
        .build_request(&url, true)
        .send()
        .await?;

    let status = response.status();
    log::info!("GitHub API search response status: {}", status);

    let response = response.error_for_status()?;
    let releases: Vec<GitHubRelease> = response.json().await?;
    log::info!("Fetched {} releases for search.", releases.len());

    let mut matching_builds: Vec<Build> = Vec::new();
    let mut seen_keys: HashSet<(String, String)> = HashSet::new();

    for release in releases.into_iter().take(max_releases) {
        let builds = parse_release_into_builds(&release);
        for build in builds {
            // Extract the numeric part of the build number
            let build_num = build.build_number.trim_start_matches('b').to_lowercase();
            if build_num.contains(&normalized) {
                // Deduplicate by (build_number, backend) to avoid duplicates
                // when the same build appears across multiple releases
                let key = (build.build_number.clone(), build.backend.clone());
                if seen_keys.insert(key) {
                    matching_builds.push(build);
                }
            }
        }
    }

    // Sort by build number descending
    matching_builds.sort_by(|a, b| {
        let num_a = a.build_number.trim_start_matches('b').parse::<u64>().unwrap_or(0);
        let num_b = b.build_number.trim_start_matches('b').parse::<u64>().unwrap_or(0);
        num_b.cmp(&num_a)
    });

    log::info!("Found {} builds matching '{}'.", matching_builds.len(), query);
    Ok(matching_builds)
}

/// Fetch the release changelog (body) for a specific tag.
/// Strips the version header and download links, keeping only the changelog content.
pub async fn fetch_release_changelog(
    github_client: &GithubClient,
    tag_name: String,
) -> Result<Option<String>, AppError> {
    let url = format!(
        "https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/{}",
        tag_name
    );
    log::info!("Fetching changelog for tag '{}' from GitHub API...", tag_name);

    let response = github_client
        .build_request(&url, true) // skip etag for changelog
        .send()
        .await?;

    let status = response.status();
    if status.as_u16() == 404 {
        return Ok(None);
    }

    let response = response.error_for_status()?;
    let release: GitHubRelease = response.json().await?;

    // Parse the release body to extract only changelog content
    if let Some(body) = &release.body {
        let cleaned = extract_changelog_content(body);
        Ok(Some(cleaned))
    } else {
        Ok(None)
    }
}

/// Extract only the changelog content from a GitHub release body.
/// Strips platform download sections (Website, macOS, Linux, Windows, etc.).
fn extract_changelog_content(body: &str) -> String {
    let lines: Vec<&str> = body.lines().collect();

    // Keywords that indicate the start of platform/download sections
    const STOP_KEYWORDS: &[&str] = &[
        "website",
        "macos",
        "ios",
        "linux",
        "android",
        "windows",
        "openeuler",
        "ui",
        "download",
    ];

    let mut end_idx = lines.len();

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();

        // Skip empty lines
        if trimmed.is_empty() {
            continue;
        }

        let lower = trimmed.to_lowercase();

        // Stop at standalone URLs (lines that are just http/https links with no spaces)
        if (lower.starts_with("http://") || lower.starts_with("https://"))
            && !trimmed.contains(' ')
        {
            end_idx = i;
            break;
        }

        // Stop at section headers: short lines (≤30 chars) that are markdown bold headers
        // GitHub uses format: "**Website:**", "**macOS/iOS:**", "**Linux:**", "**Windows:**", "**UI:**"
        // These end with ":**" (colon + closing bold markers)
        let is_header = trimmed.len() <= 30
            && (trimmed.ends_with(':') || trimmed.ends_with(":**"));

        if is_header {
            for keyword in STOP_KEYWORDS {
                if lower.contains(keyword) {
                    end_idx = i;
                    break;
                }
            }
            if end_idx < lines.len() {
                break;
            }
        }
    }

    // Trim trailing blank lines
    while end_idx > 0 && lines[end_idx - 1].trim().is_empty() {
        end_idx -= 1;
    }

    let result = lines[..end_idx].join("\n");
    result
}

/// Check which available builds are not yet installed.
pub fn check_for_new_builds(
    installed: &[InstalledVersion],
    available: &[Build],
) -> Vec<Build> {
    let installed_keys: HashSet<(String, String)> = installed
        .iter()
        .map(|v| (v.build_number.clone(), v.backend.clone()))
        .collect();

    available
        .iter()
        .filter(|b| !installed_keys.contains(&(b.build_number.clone(), b.backend.clone())))
        .cloned()
        .collect()
}
