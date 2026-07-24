use chrono::Local;
use uuid::Uuid;

use crate::db::connection::DbManager;
use crate::db::repo;
use crate::models::types::{AppError, CustomCommand};

/// Save a custom command to the database.
/// If the command has an existing ID, it will be updated.
/// Otherwise, a new ID is generated.
pub fn save_custom_command(
    db: &DbManager,
    config: serde_json::Value,
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

    let shell_type: String = config
        .get("shellType")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "cmd".to_string());

    let custom_command = CustomCommand {
        id: id.clone(),
        name,
        command,
        description,
        shell_type,
        created_at: now.clone(),
        updated_at: now,
    };

    if repo::custom_command_exists(&conn, &id)? {
        repo::update_custom_command(&conn, &custom_command)?;
    } else {
        repo::insert_custom_command(&conn, &custom_command)?;
    }

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
            "shellType": c.shell_type,
            "createdAt": c.created_at,
            "updatedAt": c.updated_at,
        })
    }).collect();

    Ok(json_commands)
}

/// Delete a custom command by ID.
pub fn delete_custom_command(db: &DbManager, id: &str) -> Result<bool, AppError> {
    let conn = db.lock_conn()?;
    repo::delete_custom_command_by_id(&conn, id)
}
