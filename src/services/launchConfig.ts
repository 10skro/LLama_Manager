import { invoke } from '@tauri-apps/api/core';
import type { LaunchConfig, ModelFile } from '@/types';

export async function scanModelFiles(folderPath: string): Promise<ModelFile[]> {
  return invoke<ModelFile[]>('scan_model_files', { folderPath }) as Promise<ModelFile[]>;
}

interface SaveLaunchConfigInput {
  name: string;
  shellType: 'cmd' | 'powershell';
  modelPath: string;
  args: Array<{ argKey: string; value: string }>;
  description?: string;
}

export async function saveLaunchConfig(config: SaveLaunchConfigInput): Promise<LaunchConfig> {
  const now = new Date().toISOString();

  const result = await invoke<{ id: string }>('save_launch_config', {
    config: {
      name: config.name,
      shellType: config.shellType,
      modelPath: config.modelPath,
      args: JSON.stringify(config.args),
      description: config.description || '',
    },
  });

  return {
    id: result.id,
    name: config.name,
    shellType: config.shellType,
    modelPath: config.modelPath,
    args: config.args,
    description: config.description,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getLaunchConfigs(): Promise<LaunchConfig[]> {
  return invoke<LaunchConfig[]>('get_launch_configs');
}

export async function deleteLaunchConfig(id: string): Promise<void> {
  await invoke('delete_launch_config', { id });
}
