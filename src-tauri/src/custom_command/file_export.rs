//! Export custom commands as portable JSON files in the config/ directory.
//! Each command is saved as a human-readable JSON file that users can copy,
//! backup, or transfer to another machine/application.

use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::models::types::{AppError, CustomCommand};

/// JSON representation of a custom command for file export.
/// Uses skip_serializing_if to omit null/empty optional fields from output.
#[derive(Serialize)]
struct ConfigExport {
    name: String,
    command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "String::is_empty")]
    color: String,
    created_at: String,
    updated_at: String,
}

/// Convert a config name to a URL-safe slug for use as a filename.
/// "My Model 7B" → "my-model-7b"
pub(crate) fn slugify_name(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<&str>>()
        .join("-")
}

/// Extract the last N bytes of an ASCII string for filename suffix.
fn last_bytes(s: &str, n: usize) -> &str {
    if s.len() <= n { s } else { &s[s.len() - n..] }
}

/// Generate a unique filename from slug + last 8 chars of the config UUID.
/// Ensures two configs with the same name never overwrite each other.
/// "my-model-7b" + "...a1b2c3d4" → "my-model-7b-a1b2c3d4.json"
fn filename_for_command(command: &CustomCommand) -> String {
    let slug = slugify_name(&command.name);
    let short_id = last_bytes(&command.id, 8);
    format!("{}-{}.json", slug, short_id)
}

/// Find all files that belong to a given config ID (by matching the UUID suffix).
fn find_files_for_id(id: &str, config_dir: &Path) -> Vec<std::path::PathBuf> {
    let short_id = last_bytes(id, 8);
    let suffix = format!("-{}.json", short_id);

    fs::read_dir(config_dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_str()
                .map(|n| n.ends_with(&suffix))
                .unwrap_or(false)
        })
        .map(|e| e.path())
        .collect()
}

/// Export a single custom command as a JSON file in the config directory.
/// Uses slug+UUID suffix so two configs with the same name get separate files.
/// On update (same ID), cleans old files for that ID before writing the new one.
/// Also removes legacy files without UUID suffix from previous versions.
pub fn export_command(
    command: &CustomCommand,
    config_dir: &Path,
) -> Result<(), AppError> {
    fs::create_dir_all(config_dir)?;

    // Delete any stale files for this specific config ID (handles name changes)
    let old_files = find_files_for_id(&command.id, config_dir);
    for path in old_files {
        let _ = fs::remove_file(&path);
    }

    // Clean up legacy file without UUID suffix (created by previous version)
    let slug = slugify_name(&command.name);
    let legacy_path = config_dir.join(format!("{}.json", slug));
    if legacy_path.exists() {
        let _ = fs::remove_file(&legacy_path);
    }

    let export = ConfigExport {
        name: command.name.clone(),
        command: command.command.clone(),
        description: command.description.clone(),
        color: command.color.clone(),
        created_at: command.created_at.clone(),
        updated_at: command.updated_at.clone(),
    };

    let json = serde_json::to_string_pretty(&export)?;
    let file_name = filename_for_command(command);
    let file_path = config_dir.join(&file_name);

    fs::write(&file_path, json)?;
    log::info!(
        "[CONFIG-EXPORT] Saved config: {}",
        file_name
    );

    Ok(())
}

/// Delete the JSON file for a custom command by its ID.
/// Uses the UUID suffix to find the exact file, so same-name configs don't collide.
/// Logs a warning if the file doesn't exist (not an error).
pub fn delete_command_file(id: &str, config_dir: &Path) -> Result<(), AppError> {
    let files = find_files_for_id(id, config_dir);

    if files.is_empty() {
        log::warn!(
            "[CONFIG-EXPORT] Config file not found for deletion (ID: {})",
            id
        );
        return Ok(());
    }

    for path in &files {
        fs::remove_file(path)?;
        log::info!(
            "[CONFIG-EXPORT] Deleted config: {}",
            path.file_name().map(|s| s.to_string_lossy()).unwrap_or_default()
        );
    }

    Ok(())
}

/// Migrate all existing custom commands to JSON files.
/// Idempotent: safe to run multiple times (overwrites existing exports).
pub fn migrate_existing_commands(
    commands: &[CustomCommand],
    config_dir: &Path,
) -> Result<(), AppError> {
    if commands.is_empty() {
        return Ok(());
    }

    fs::create_dir_all(config_dir)?;

    for command in commands {
        export_command(command, config_dir).map_err(|e| {
            log::warn!(
                "[CONFIG-MIGRATION] Failed to export '{}': {}",
                command.name,
                e
            );
            e
        })?;
    }

    log::info!(
        "[CONFIG-MIGRATION] Exported {} config(s) to JSON",
        commands.len()
    );

    Ok(())
}
