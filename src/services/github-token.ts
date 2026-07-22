import { invoke } from '@tauri-apps/api/core';

export async function saveGithubToken(token: string): Promise<void> {
  return invoke('save_github_token', { token });
}

export async function hasGithubToken(): Promise<boolean> {
  return invoke('has_github_token') as Promise<boolean>;
}

export async function deleteGithubToken(): Promise<void> {
  return invoke('delete_github_token');
}
