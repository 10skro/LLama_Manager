import { invoke } from '@tauri-apps/api/core';
import type { ModelFile } from '@/types';

export async function scanModelFiles(folder: string): Promise<ModelFile[]> {
  return invoke<ModelFile[]>('scan_model_files', { folder });
}
