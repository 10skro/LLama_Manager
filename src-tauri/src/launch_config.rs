use chrono::Local;
use uuid::Uuid;

use crate::db::connection::DbManager;
use crate::db::repo;
use crate::models::types::{AppError, LaunchConfig};

/// Save a launch configuration to the database.
/// If the config has an existing ID, it will be updated.
/// Otherwise, a new ID is generated.
pub fn save_launch_config(
    db: &DbManager,
    config: serde_json::Value,
) -> Result<String, AppError> {
    let conn = db.lock_conn()?;
    let now = Local::now().to_rfc3339();

    // Extract fields from the JSON
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

    let shell_type: String = config
        .get("shellType")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "cmd".to_string());

    let model_path: String = config
        .get("modelPath")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_default();

    let args_json: String = config
        .get("args")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "[]".to_string());

    let description: Option<String> = config
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let launch_config = LaunchConfig {
        id: id.clone(),
        name,
        shell_type,
        model_path,
        args_json,
        description,
        created_at: now.clone(),
        updated_at: now,
    };

    // Check if config with this ID already exists
    if repo::launch_config_exists(&conn, &id)? {
        repo::update_launch_config(&conn, &launch_config)?;
    } else {
        repo::insert_launch_config(&conn, &launch_config)?;
    }

    Ok(id)
}

/// Get all launch configurations from the database.
pub fn get_launch_configs(
    db: &DbManager,
) -> Result<Vec<serde_json::Value>, AppError> {
    let conn = db.lock_conn()?;
    let configs = repo::get_all_launch_configs(&conn)?;

    let json_configs: Vec<serde_json::Value> = configs.into_iter().map(|c| {
        serde_json::json!({
            "id": c.id,
            "name": c.name,
            "shellType": c.shell_type,
            "modelPath": c.model_path,
            "args": c.args_json,
            "description": c.description,
            "createdAt": c.created_at,
            "updatedAt": c.updated_at,
        })
    }).collect();

    Ok(json_configs)
}

/// Delete a launch configuration by ID.
pub fn delete_launch_config(db: &DbManager, id: &str) -> Result<bool, AppError> {
    let conn = db.lock_conn()?;
    repo::delete_launch_config_by_id(&conn, id)
}
