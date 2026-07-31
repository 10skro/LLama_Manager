use std::path::Path;

use chrono::Local;
use uuid::Uuid;

use crate::custom_command::file_export;
use crate::db::connection::DbManager;
use crate::db::repo;
use crate::models::types::{AppError, CustomCommand};

/// Save a custom command to the database and export as JSON file.
/// If the command has an existing ID, it will be updated.
/// Otherwise, a new ID is generated.
pub fn save_custom_command(
    db: &DbManager,
    config: serde_json::Value,
    config_dir: &Path,
) -> Result<String, AppError> {
    let conn = db.lock_conn()?;
    let now = Local::now().to_rfc3339();

    let id: String = config
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let name: String = config
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_default();

    let command: String = config
        .get("command")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_default();

    let description: Option<String> = config
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let color: String = config
        .get("color")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_default();

    let custom_command = CustomCommand {
        id: id.clone(),
        name,
        command,
        description,
        color,
        created_at: now.clone(),
        updated_at: now,
    };

    if repo::custom_command_exists(&conn, &id)? {
        repo::update_custom_command(&conn, &custom_command)?;
    } else {
        repo::insert_custom_command(&conn, &custom_command)?;
    }

    // Export to JSON file after successful DB save
    file_export::export_command(&custom_command, config_dir).map_err(|e| {
        log::error!("[CONFIG-EXPORT] Failed to export '{}': {}", custom_command.name, e);
        e
    })?;

    Ok(id)
}

/// Get all custom commands from the database.
pub fn get_custom_commands(
    db: &DbManager,
) -> Result<Vec<serde_json::Value>, AppError> {
    let conn = db.lock_conn()?;
    let commands = repo::get_all_custom_commands(&conn)?;

    let json_commands: Vec<serde_json::Value> = commands.into_iter().map(|c| {
        serde_json::json!({
            "id": c.id,
            "name": c.name,
            "command": c.command,
            "description": c.description,
            "color": c.color,
            "createdAt": c.created_at,
            "updatedAt": c.updated_at,
        })
    }).collect();

    Ok(json_commands)
}

/// Delete a custom command by ID from both database and JSON file.
pub fn delete_custom_command(
    db: &DbManager,
    id: &str,
    config_dir: &Path,
) -> Result<bool, AppError> {
    let conn = db.lock_conn()?;

    // Check if the command exists before deleting
    if repo::get_custom_command_by_id(&conn, id)?.is_none() {
        return Ok(false);
    }

    // Delete from database
    let deleted = repo::delete_custom_command_by_id(&conn, id)?;

    // Delete JSON file — non-blocking: log error but don't fail the DB deletion
    if let Err(e) = file_export::delete_command_file(id, config_dir) {
        log::error!(
            "[CONFIG-EXPORT] Failed to delete file for ID '{}': {}",
            id,
            e
        );
    }

    Ok(deleted)
}
