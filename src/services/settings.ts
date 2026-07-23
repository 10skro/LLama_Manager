import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '@/types';

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('get_settings') as Promise<AppSettings>;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke<void>('save_settings', { settings }) as Promise<void>;
}

/**
 * Opens a system folder selection dialog.
 *
 * @returns A promise resolving to the selected folder path, or `null` if the user cancelled.
 * @throws Will reject if the dialog fails to open (e.g., backend error).
 */
export function selectFolder(): Promise<string | null> {
  return invoke<string | null>('open_folder_dialog') as Promise<string | null>;
}

/**
 * Changes the storage path with full migration.
 * Validates the new path, migrates existing files, updates the database,
 * and cleans up the old storage directory.
 *
 * @param oldPath - The current storage path.
 * @param newPath - The new storage path to migrate to.
 * @returns The new storage path on success.
 */
export async function changeStoragePath(oldPath: string, newPath: string): Promise<string> {
  return invoke<string>('change_storage_path', { oldPath, newPath }) as Promise<string>;
}
