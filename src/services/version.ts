import { invoke } from '@tauri-apps/api/core';
import type { InstalledVersion, CardCustomization } from '@/types';

export async function getInstalledVersions(): Promise<InstalledVersion[]> {
  return invoke<InstalledVersion[]>('get_installed_versions') as Promise<InstalledVersion[]>;
}

export async function uninstallVersion(id: number): Promise<boolean> {
  return invoke<boolean>('uninstall_version', { id }) as Promise<boolean>;
}

export async function getCardCustomizations(): Promise<CardCustomization[]> {
  return invoke<CardCustomization[]>('get_card_customizations') as Promise<CardCustomization[]>;
}

export async function saveCardCustomization(
  versionId: number,
  title: string,
  headerColor: string,
  textColor: string
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

export async function getStorageUsage(): Promise<number> {
  return invoke<number>('get_storage_usage') as Promise<number>;
}

export async function duplicateVersion(versionId: number, withSettings: boolean): Promise<number> {
  return invoke<number>('duplicate_version', {
    versionId,
    withSettings,
  }) as Promise<number>;
}

export async function bulkSetDisplayOrder(
  orders: { versionId: number; displayOrder: number }[]
): Promise<void> {
  return invoke<void>('bulk_set_display_order', {
    orders: orders.map((o) => [o.versionId, o.displayOrder]),
  }) as Promise<void>;
}

export async function resetDisplayOrder(): Promise<void> {
  return invoke<void>('reset_display_order') as Promise<void>;
}
