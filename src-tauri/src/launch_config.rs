use chrono::Local;
use uuid::Uuid;

use crate::db::connection::DbManager;
use crate::models::types::AppError;

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

    // Check if config with this ID already exists
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM launch_configs WHERE id = ?",
            [&id],
            |row| row.get(0),
        )?;

    if exists {
        // Update existing
        conn.execute(
            "UPDATE launch_configs SET name = ?, shell_type = ?, model_path = ?, args_json = ?, description = ?, updated_at = ? WHERE id = ?",
            (&name, &shell_type, &model_path, &args_json, &description, &now, &id),
        )?;
    } else {
        // Insert new
        conn.execute(
            "INSERT INTO launch_configs (id, name, shell_type, model_path, args_json, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (&id, &name, &shell_type, &model_path, &args_json, &description, &now, &now),
        )?;
    }

    Ok(id)
}

/// Get all launch configurations from the database.
pub fn get_launch_configs(
    db: &DbManager,
) -> Result<Vec<serde_json::Value>, AppError> {
    let conn = db.lock_conn()?;

    let mut stmt = conn.prepare(
        "SELECT id, name, shell_type, model_path, args_json, description, created_at, updated_at FROM launch_configs ORDER BY updated_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "shellType": row.get::<_, String>(2)?,
            "modelPath": row.get::<_, String>(3)?,
            "args": row.get::<_, String>(4)?,
            "description": row.get::<_, Option<String>>(5)?,
            "createdAt": row.get::<_, String>(6)?,
            "updatedAt": row.get::<_, String>(7)?,
        }))
    })?;

    let configs: Result<Vec<serde_json::Value>, _> = rows.collect();
    Ok(configs?)
}

/// Delete a launch configuration by ID.
pub fn delete_launch_config(db: &DbManager, id: &str) -> Result<bool, AppError> {
    let conn = db.lock_conn()?;
    let rows_affected = conn
        .execute("DELETE FROM launch_configs WHERE id = ?", [id])?;
    Ok(rows_affected > 0)
}
