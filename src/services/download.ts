import { invoke } from '@tauri-apps/api/core';
import type { Build, Download } from '@/types';

export async function startDownload(build: Build): Promise<number> {
  return invoke<number>('start_download', {
    buildNumber: build.build_number,
    backend: build.backend,
    url: build.download_url,
    totalSize: build.file_size,
  }) as Promise<number>;
}

export async function cancelDownload(id: number): Promise<boolean> {
  return invoke<boolean>('cancel_download', { id }) as Promise<boolean>;
}

export async function getDownloadStatus(id: number): Promise<Download | null> {
  const result = await invoke<any>('get_download_status', { id });
  return result as Download | null;
}

export async function installVersion(build: Build): Promise<number> {
  return invoke<number>('install_version', {
    buildNumber: build.build_number,
    backend: build.backend,
    url: build.download_url,
    totalSize: build.file_size,
  }) as Promise<number>;
}
