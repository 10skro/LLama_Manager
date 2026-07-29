use tauri::State;

use crate::db::connection::DbManager;
use crate::db::repo;
use crate::models::types::FavoriteBuild;

#[tauri::command]
pub fn get_favorite_builds(state: State<'_, DbManager>) -> Result<Vec<FavoriteBuild>, String> {
    let conn = state.lock_conn().map_err(|e| e.to_string())?;
    repo::get_favorite_builds(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_favorite_build(
    state: State<'_, DbManager>,
    build_number: String,
    backend: String,
    download_url: String,
    architecture: String,
) -> Result<bool, String> {
    let mut conn = state.lock_conn().map_err(|e| e.to_string())?;
    repo::toggle_favorite_build(&mut conn, &build_number, &backend, &download_url, &architecture).map_err(|e| e.to_string())
}


