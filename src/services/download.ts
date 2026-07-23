import { invoke } from '@tauri-apps/api/core';
import type { Build } from '@/types';

export async function cancelDownload(id: number): Promise<boolean> {
  return invoke<boolean>('cancel_download', { id }) as Promise<boolean>;
}

export async function installVersion(build: Build): Promise<number> {
  return invoke<number>('install_version', {
    buildNumber: build.build_number,
    backend: build.backend,
    architecture: build.architecture,
    url: build.download_url,
    totalSize: build.file_size,
  }) as Promise<number>;
}
