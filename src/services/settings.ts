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
