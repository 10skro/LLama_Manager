import { invoke } from '@tauri-apps/api/core';
import type { CustomCommand } from '@/types';

export async function saveCustomCommand(config: { name: string; command: string; description?: string; shellType: 'cmd' | 'powershell' }): Promise<CustomCommand> {
  const now = new Date().toISOString();
  const result = await invoke<{ id: string }>('save_custom_command', {
    config: {
      name: config.name,
      command: config.command,
      description: config.description || '',
      shellType: config.shellType,
    },
  });
  return {
    id: result.id,
    name: config.name,
    command: config.command,
    description: config.description,
    shellType: config.shellType,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getCustomCommands(): Promise<CustomCommand[]> {
  return invoke<CustomCommand[]>('get_custom_commands');
}

export async function deleteCustomCommand(id: string): Promise<void> {
  await invoke('delete_custom_command', { id });
}
