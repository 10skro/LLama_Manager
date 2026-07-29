mod app;
mod cards;
mod config;
mod custom_command;
mod db;
mod download;
mod favorites;
mod file;
mod github;
mod logging;
mod models;
mod setup;
mod terminal;
mod theme;
mod update;
mod utils;
mod version;

// ─── App Entry Point ───────────────────────────────────────────────────

pub fn run_tauri_app() {
    app::run();
}
