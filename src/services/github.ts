import { invoke } from '@tauri-apps/api/core';
import type { Build } from '@/types';

export async function fetchBuilds(limit?: number): Promise<Build[]> {
  return invoke<Build[]>('fetch_builds', { limit }) as Promise<Build[]>;
}

export async function checkNewBuilds(): Promise<Build[]> {
  return invoke<Build[]>('check_new_builds') as Promise<Build[]>;
}

export async function fetchReleaseByTag(tag: string): Promise<Build[]> {
  return invoke<Build[]>('fetch_release_by_tag', { tag }) as Promise<Build[]>;
}

export async function searchBuilds(query: string): Promise<Build[]> {
  return invoke<Build[]>('search_builds', { query }) as Promise<Build[]>;
}

export async function fetchReleaseChangelog(tag: string): Promise<string | null> {
  return invoke<string | null>('fetch_release_changelog', { tag }) as Promise<string | null>;
}
