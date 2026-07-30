use std::path::PathBuf;

use crate::db::connection::DbManager;
use crate::models::types::InstalledVersion;
use crate::version::manager::VersionManager;

/// Helper: create an in-memory DbManager with initialized tables.
fn new_test_db() -> DbManager {
    let db = DbManager::new(PathBuf::from(":memory:").as_path()).expect("create in-memory DB");
    db.init_tables().expect("init tables");
    db
}

/// Helper: insert a test version into the database.
fn insert_test_version(db: &DbManager, id: i64) -> InstalledVersion {
    let version = InstalledVersion {
        id: 0,
        build_number: format!("test-build-{}", id),
        backend: "llama.cpp".to_string(),
        architecture: "x64".to_string(),
        install_path: format!("/fake/path/{}", id),
        installed_at: "2026-01-01T00:00:00Z".to_string(),
        status: "installed".to_string(),
        download_id: None,
    };
    let conn = db.lock_conn().expect("lock conn");
    let inserted_id = crate::db::repo::insert_version(&conn, &version).expect("insert version");
    InstalledVersion {
        id: inserted_id,
        ..version
    }
}

// ─── list_installed tests ───

#[test]
fn list_installed_returns_empty_on_fresh_db() {
    let db = new_test_db();
    let versions = VersionManager::list_installed(&db).expect("list installed");
    assert!(versions.is_empty());
}

#[test]
fn list_installed_returns_all_versions() {
    let db = new_test_db();
    insert_test_version(&db, 1);
    insert_test_version(&db, 2);

    let versions = VersionManager::list_installed(&db).expect("list installed");
    assert_eq!(versions.len(), 2);
    assert_eq!(versions[0].build_number, "test-build-1");
    assert_eq!(versions[1].build_number, "test-build-2");
}

// ─── uninstall_version tests ───

#[test]
fn uninstall_version_removes_from_db() {
    let db = new_test_db();
    let version = insert_test_version(&db, 42);

    let result = VersionManager::uninstall_version(&db, version.id);
    assert!(result.is_ok());

    let remaining = VersionManager::list_installed(&db).expect("list installed");
    assert!(remaining.is_empty());
}

#[test]
fn uninstall_version_returns_not_found_for_missing_id() {
    let db = new_test_db();
    let result = VersionManager::uninstall_version(&db, 9999);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("not found"));
}

// ─── duplicate_version tests ───

#[test]
fn duplicate_version_creates_independent_copy() {
    let db = new_test_db();
    let source = insert_test_version(&db, 10);

    let new_id = VersionManager::duplicate_version(&db, source.id, false).expect("duplicate");
    assert_ne!(new_id, source.id);

    let versions = VersionManager::list_installed(&db).expect("list installed");
    assert_eq!(versions.len(), 2);
    // Both share the same build_number and install_path
    assert_eq!(versions[0].build_number, versions[1].build_number);
    assert_eq!(versions[0].install_path, versions[1].install_path);
}

#[test]
fn duplicate_version_returns_not_found_for_missing_id() {
    let db = new_test_db();
    let result = VersionManager::duplicate_version(&db, 9999, false);
    assert!(result.is_err());
}

// ─── calculate_storage_usage tests ───

#[test]
fn calculate_storage_usage_returns_zero_for_nonexistent_dir() {
    let db = new_test_db();
    let usage = VersionManager::calculate_storage_usage(&db, "/nonexistent/path/fallback")
        .expect("calculate storage");
    assert_eq!(usage, 0);
}
