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
        display_order: None,
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

/// Bulk-update the display order of dashboard cards.
/// `orders` is a JSON array of `[version_id, display_order]` pairs.
pub fn bulk_set_display_order(
    state_db: State<'_, DbManager>,
    orders: Vec<(i64, i64)>,
) -> Result<(), String> {
    let mut conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::bulk_set_display_order(&mut conn, &orders).map_err(|e| e.to_string())
}

/// Reset all card display orders, returning to default id DESC ordering.
pub fn reset_display_order(state_db: State<'_, DbManager>) -> Result<(), String> {
    let conn = state_db.lock_conn().map_err(|e| e.to_string())?;
    repo::reset_display_order(&conn).map_err(|e| e.to_string())
}


