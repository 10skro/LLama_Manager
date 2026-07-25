import { invoke } from '@tauri-apps/api/core';
import type { ModelFile } from '@/types';

export type FileExtensionFilter = 'all' | 'gguf' | 'safetensors' | string;

export async function scanModelFiles(
  folder: string,
  extensions: FileExtensionFilter = 'all',
): Promise<ModelFile[]> {
  const extString = extensions === 'all' ? '' : extensions;
  return invoke<ModelFile[]>('scan_model_files', { folderPath: folder, extensions: extString });
}
