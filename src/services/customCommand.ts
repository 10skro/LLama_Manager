import { invoke } from '@tauri-apps/api/core';
import type { CustomCommand } from '@/types';

export async function saveCustomCommand(config: { id?: string; name: string; command: string; description?: string; createdAt?: string }): Promise<CustomCommand> {
  const now = new Date().toISOString();

  const payload: Record<string, string> = {
    name: config.name,
    command: config.command,
    description: config.description || '',
  };
  if (config.id) {
    payload.id = config.id;
  }

  const result = await invoke<{ id: string }>('save_custom_command', { config: payload });
  return {
    id: result.id,
    name: config.name,
    command: config.command,
    description: config.description,
    createdAt: config.createdAt || now,
    updatedAt: now,
  };
}

export async function getCustomCommands(): Promise<CustomCommand[]> {
  return invoke<CustomCommand[]>('get_custom_commands');
}

export async function deleteCustomCommand(id: string): Promise<void> {
  await invoke('delete_custom_command', { id });
}
