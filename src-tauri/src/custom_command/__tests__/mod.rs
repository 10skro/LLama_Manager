use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::custom_command::file_export::{
    delete_command_file, export_command, migrate_existing_commands, slugify_name,
};
use crate::models::types::CustomCommand;

/// Create a guaranteed-unique temp directory for filesystem tests.
static COUNTER: AtomicU64 = AtomicU64::new(0);

fn test_dir() -> PathBuf {
    let id = COUNTER.fetch_add(1, Ordering::Relaxed);
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("llama_config_test_{}_{}", id, ts));
    fs::create_dir_all(&dir).expect("Failed to create test directory");
    assert!(dir.is_dir(), "Test directory was not created: {:?}", dir);
    dir
}

// ─── slugify_name ─────────────────────────────────────────────

#[test]
fn slugify_name_basic() {
    assert_eq!(slugify_name("My Model 7B"), "my-model-7b");
}

#[test]
fn slugify_name_with_special_chars() {
    assert_eq!(slugify_name("Test / Config @ #"), "test-config");
}

#[test]
fn slugify_name_already_slug() {
    assert_eq!(slugify_name("my-model"), "my-model");
}

// ─── export_command ───────────────────────────────────────────

#[test]
fn export_command_creates_file() {
    let dir = test_dir();

    let command = CustomCommand {
        id: "test-uuid".to_string(),
        name: "Test Export".to_string(),
        command: "-c 2048".to_string(),
        description: Some("A test config".to_string()),
        color: "blue".to_string(),
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
    };

    let result = export_command(&command, &dir);
    assert!(result.is_ok(), "export_command failed: {:?}", result.err());

    // Filename is slug + last 8 chars of ID: test-export-est-uuid.json
    let expected = dir.join("test-export-est-uuid.json");
    assert!(expected.exists(), "Expected file not found: {:?}", expected);

    let content = fs::read_to_string(&expected).expect("Failed to read exported file");
    let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();
    assert_eq!(parsed["name"], "Test Export");
    assert_eq!(parsed["command"], "-c 2048");
    assert_eq!(parsed["description"], "A test config");

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn export_command_update_overwrites_own_file() {
    let dir = test_dir();

    // First export with old command value
    let mut command = CustomCommand {
        id: "my-config-id".to_string(),
        name: "Test Config".to_string(),
        command: "-c 2048".to_string(),
        description: None,
        color: String::new(),
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
    };

    export_command(&command, &dir).expect("first export failed");

    // Update the command value (same ID)
    command.command = "-c 4096".to_string();
    export_command(&command, &dir).expect("second export failed");

    // last_bytes("my-config-id", 8) = "onfig-id"
    let expected = dir.join("test-config-onfig-id.json");
    let content = fs::read_to_string(&expected).expect("Failed to read file after update");
    assert!(content.contains("-c 4096"));
    assert!(!content.contains("-c 2048"));

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn export_command_skips_null_fields() {
    let dir = test_dir();

    let command = CustomCommand {
        id: "test-uuid".to_string(),
        name: "Minimal".to_string(),
        command: "-c 2048".to_string(),
        description: None, // should be omitted
        color: String::new(), // should be omitted
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
    };

    export_command(&command, &dir).expect("export failed");

    let entries: Vec<_> = fs::read_dir(&dir)
        .expect("Failed to read test dir")
        .filter_map(|e| e.ok())
        .collect();
    assert!(!entries.is_empty(), "No files created in {:?}", dir);

    let content = fs::read_to_string(&entries[0].path()).expect("Failed to read file");
    assert!(!content.contains("description"));
    assert!(!content.contains("color"));

    let _ = fs::remove_dir_all(&dir);
}

/// Two configs with the same name but different IDs get separate files.
#[test]
fn export_same_name_different_ids_no_collision() {
    let dir = test_dir();

    let cmd_a = CustomCommand {
        id: "aaaaaaaa-1111".to_string(), // 13 chars, last_bytes(8): "aaa-1111"
        name: "Same Name".to_string(),
        command: "-c 2048".to_string(),
        description: None,
        color: String::new(),
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
    };

    let cmd_b = CustomCommand {
        id: "bbbbbbbb-2222".to_string(), // 13 chars, last_bytes(8): "bbb-2222"
        name: "Same Name".to_string(),
        command: "-c 4096".to_string(),
        description: None,
        color: String::new(),
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
    };

    export_command(&cmd_a, &dir).expect("export A failed");
    export_command(&cmd_b, &dir).expect("export B failed");

    // Both files should exist independently
    let file_a = dir.join("same-name-aaa-1111.json");
    let file_b = dir.join("same-name-bbb-2222.json");
    assert!(file_a.exists(), "File A not found");
    assert!(file_b.exists(), "File B not found");

    // Contents should be independent
    let content_a = fs::read_to_string(&file_a).expect("Failed to read file A");
    let content_b = fs::read_to_string(&file_b).expect("Failed to read file B");
    assert!(content_a.contains("-c 2048"));
    assert!(content_b.contains("-c 4096"));

    let _ = fs::remove_dir_all(&dir);
}

/// Export cleans up legacy files without UUID suffix from previous versions.
#[test]
fn export_cleans_legacy_file() {
    let dir = test_dir();

    // Simulate a legacy file created by the old version (no UUID suffix)
    let legacy_path = dir.join("my-config.json");
    fs::write(&legacy_path, "{\"name\":\"old\"}").expect("Failed to create legacy file");
    assert!(legacy_path.exists(), "Legacy file should exist before export");

    // Export with new format
    let command = CustomCommand {
        id: "some-uuid-here".to_string(),
        name: "My Config".to_string(),
        command: "-c 2048".to_string(),
        description: None,
        color: String::new(),
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
    };
    export_command(&command, &dir).expect("export failed");

    // Legacy file should be removed, new file should exist
    assert!(!legacy_path.exists(), "Legacy file should be cleaned up");

    let new_path = dir.join("my-config-uid-here.json");
    assert!(new_path.exists(), "New UUID-suffixed file should exist");

    let _ = fs::remove_dir_all(&dir);
}

// ─── delete_command_file (by ID) ──────────────────────────────

#[test]
fn delete_file_ok() {
    let dir = test_dir();

    // Create a file via export
    let command = CustomCommand {
        id: "my-config-id".to_string(),
        name: "My Config".to_string(),
        command: "-c 2048".to_string(),
        description: None,
        color: String::new(),
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
    };
    export_command(&command, &dir).expect("export failed");

    // last_bytes("my-config-id", 8) = "onfig-id"
    let expected = dir.join("my-config-onfig-id.json");
    assert!(expected.exists(), "Test file should exist before delete");

    // Delete by ID (not by name)
    let result = delete_command_file("my-config-id", &dir);
    assert!(result.is_ok());
    assert!(!expected.exists(), "File should be deleted");

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn delete_nonexistent_id_is_ok() {
    let dir = test_dir();

    let result = delete_command_file("nonexistent-id", &dir);
    assert!(result.is_ok()); // not an error if file doesn't exist

    let _ = fs::remove_dir_all(&dir);
}

// ─── migrate_existing_commands ────────────────────────────────

#[test]
fn migrate_existing_commands_works() {
    let dir = test_dir();

    let commands = vec![
        CustomCommand {
            id: "uuid-1".to_string(),
            name: "Config One".to_string(),
            command: "-c 2048".to_string(),
            description: None,
            color: String::new(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        },
        CustomCommand {
            id: "uuid-2".to_string(),
            name: "Config Two".to_string(),
            command: "-c 4096".to_string(),
            description: None,
            color: String::new(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        },
    ];

    let result = migrate_existing_commands(&commands, &dir);
    assert!(result.is_ok(), "Migration failed: {:?}", result.err());

    // Verify both files exist with UUID suffixes
    let entries: Vec<_> = fs::read_dir(&dir)
        .expect("Failed to read test dir")
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    assert!(entries.contains(&"config-one-uuid-1.json".to_string()), "config-one-uuid-1.json not found in {:?}", entries);
    assert!(entries.contains(&"config-two-uuid-2.json".to_string()), "config-two-uuid-2.json not found in {:?}", entries);

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn migrate_empty_is_safe() {
    let dir = test_dir();

    let result = migrate_existing_commands(&[], &dir);
    assert!(result.is_ok());

    let _ = fs::remove_dir_all(&dir);
}
