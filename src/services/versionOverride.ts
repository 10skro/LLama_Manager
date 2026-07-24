import { invoke } from '@tauri-apps/api/core';
import type { VersionOverride, ModelFile } from '@/types';

export async function getVersionOverride(versionId: number): Promise<VersionOverride | null> {
  const result = await invoke<VersionOverride | null>('get_version_override', { versionId });
  return result;
}

export async function saveVersionOverride(
  versionId: number,
  modelPath: string | null,
  mmprojPath: string | null,
): Promise<void> {
  await invoke('save_version_override', {
    versionId,
    modelPath,
    mmprojPath,
  });
}

export async function deleteVersionOverride(versionId: number): Promise<boolean> {
  return invoke<boolean>('delete_version_override', { versionId });
}

export async function scanMmprojFiles(folderPath: string): Promise<ModelFile[]> {
  return invoke<ModelFile[]>('scan_mmproj_files', { folderPath });
}
