import { invoke } from '@tauri-apps/api/core';
import type { VersionConfigLink } from '@/types';

export async function getVersionConfigLink(versionId: number): Promise<VersionConfigLink | null> {
  return invoke<VersionConfigLink | null>('get_version_config_link', { versionId }) as Promise<VersionConfigLink | null>;
}

export async function saveVersionConfigLink(
  versionId: number,
  configType: 'launch' | 'custom',
  configId: string,
): Promise<number> {
  return invoke<number>('save_version_config_link', {
    versionId,
    configType,
    configId,
  }) as Promise<number>;
}

export async function deleteVersionConfigLink(versionId: number): Promise<boolean> {
  return invoke<boolean>('delete_version_config_link', { versionId }) as Promise<boolean>;
}
