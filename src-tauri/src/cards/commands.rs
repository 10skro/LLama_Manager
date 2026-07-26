use tauri::State;

use crate::db::connection::DbManager;
use crate::db::repo;
use crate::models::types::CardCustomization;

pub fn get_card_customizations(
    state_db: State<'_, DbManager>,
) -> Result<Vec<CardCustomization>, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::get_all_card_customizations(&conn).map_err(|e| e.to_string())
}

pub fn save_card_customization(
    state_db: State<'_, DbManager>,
    version_id: i64,
    title: String,
    header_color: String,
    text_color: String,
) -> Result<(), String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    let customization = CardCustomization {
        version_id,
        title,
        header_color,
        text_color,
    };
    repo::upsert_card_customization(&conn, &customization).map_err(|e| e.to_string())
}

pub fn delete_card_customization(
    state_db: State<'_, DbManager>,
    version_id: i64,
) -> Result<bool, String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::delete_card_customization(&conn, version_id).map_err(|e| e.to_string())
}


