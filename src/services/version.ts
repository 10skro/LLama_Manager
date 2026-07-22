import { invoke } from '@tauri-apps/api/core';
import type { InstalledVersion } from '@/types';

export async function getInstalledVersions(): Promise<InstalledVersion[]> {
  return invoke<InstalledVersion[]>('get_installed_versions') as Promise<InstalledVersion[]>;
}

export async function uninstallVersion(id: number): Promise<boolean> {
  return invoke<boolean>('uninstall_version', { id }) as Promise<boolean>;
}

export async function openFolder(path: string): Promise<void> {
  return invoke<void>('open_folder', { path }) as Promise<void>;
}
