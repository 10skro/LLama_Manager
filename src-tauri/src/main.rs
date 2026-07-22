#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    llamacpp_manager_lib::run_tauri_app();
}
