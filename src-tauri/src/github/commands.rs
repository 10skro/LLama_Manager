use tauri::State;

use crate::db::connection::DbManager;
use crate::github::api::{FetchMode, GithubClient};
use crate::models::types::Build;
use crate::version::manager::VersionManager;

const DEFAULT_RELEASE_LIMIT: usize = 50;
const SEARCH_MAX_RELEASES: usize = 100;

/// Fetch builds from GitHub API, using cache when possible.
pub async fn fetch_builds(
    state_github: State<'_, GithubClient>,
    state_db: State<'_, DbManager>,
    limit: Option<usize>,
    force_refresh: Option<bool>,
) -> Result<Vec<Build>, String> {
    let release_limit = limit.unwrap_or(DEFAULT_RELEASE_LIMIT);
    let mode = if force_refresh == Some(true) {
        FetchMode::ForceRefresh
    } else {
        FetchMode::Conditional
    };
    crate::github::api::fetch_builds_from_cache_or_api(&state_github, &state_db, release_limit, mode)
        .await
        .map_err(|e| e.to_string())
}

/// Check for new builds not yet installed.
pub async fn check_new_builds(
    state_github: State<'_, GithubClient>,
    state_db: State<'_, DbManager>,
) -> Result<Vec<Build>, String> {
    let installed = VersionManager::list_installed(&state_db).map_err(|e| e.to_string())?;
    let available_builds = crate::github::api::fetch_builds_from_cache_or_api(&state_github, &state_db, DEFAULT_RELEASE_LIMIT, FetchMode::Conditional)
        .await
        .map_err(|e| e.to_string())?;
    let new = crate::github::api::check_for_new_builds(&installed, &available_builds);
    Ok(new)
}

/// Fetch a specific release by its tag name.
pub async fn fetch_release_by_tag(
    state_github: State<'_, GithubClient>,
    tag: String,
) -> Result<Vec<Build>, String> {
    crate::github::api::fetch_release_by_tag(&state_github, tag)
        .await
        .map_err(|e| e.to_string())
}

/// Search builds by query string.
pub async fn search_builds(
    state_github: State<'_, GithubClient>,
    query: String,
) -> Result<Vec<Build>, String> {
    crate::github::api::search_builds(&state_github, query, SEARCH_MAX_RELEASES)
        .await
        .map_err(|e| e.to_string())
}

/// Fetch the changelog for a release tag.
pub async fn fetch_release_changelog(
    state_github: State<'_, GithubClient>,
    tag: String,
) -> Result<Option<String>, String> {
    crate::github::api::fetch_release_changelog(&state_github, tag)
        .await
        .map_err(|e| e.to_string())
}

/// Get the timestamp of the last successful catalog fetch.
pub fn get_catalog_last_fetched(
    state_db: State<'_, DbManager>,
) -> Result<Option<String>, String> {
    Ok(crate::github::api::get_catalog_last_fetched(&state_db))
}


