import { invoke } from '@tauri-apps/api/core';
import type { InstalledVersion, CardCustomization } from '@/types';

export async function getInstalledVersions(): Promise<InstalledVersion[]> {
  return invoke<InstalledVersion[]>('get_installed_versions') as Promise<InstalledVersion[]>;
}

export async function uninstallVersion(id: number): Promise<boolean> {
  return invoke<boolean>('uninstall_version', { id }) as Promise<boolean>;
}

export async function openFolder(path: string): Promise<void> {
  return invoke<void>('open_folder', { path }) as Promise<void>;
}

export async function getCardCustomizations(): Promise<CardCustomization[]> {
  return invoke<CardCustomization[]>('get_card_customizations') as Promise<CardCustomization[]>;
}

export async function saveCardCustomization(
  versionId: number,
  title: string,
  headerColor: string,
  textColor: string,
): Promise<void> {
  return invoke<void>('save_card_customization', {
    versionId,
    title,
    headerColor,
    textColor,
  }) as Promise<void>;
}

export async function deleteCardCustomization(versionId: number): Promise<boolean> {
  return invoke<boolean>('delete_card_customization', { versionId }) as Promise<boolean>;
}
