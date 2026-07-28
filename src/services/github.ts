import { invoke } from '@tauri-apps/api/core';
import type { Build } from '@/types';

export interface FetchBuildsOptions {
  limit?: number;
  forceRefresh?: boolean;
}

// Dedup guard: prevent concurrent fetch_builds calls
let pendingFetch: Promise<Build[]> | null = null;

export async function fetchBuilds(options?: FetchBuildsOptions): Promise<Build[]> {
  // If a non-force fetch is already in progress, reuse it
  // Force refresh always goes through
  if (!options?.forceRefresh && pendingFetch) {
    return pendingFetch;
  }

  const promise = invoke<Build[]>('fetch_builds', {
    limit: options?.limit,
    forceRefresh: options?.forceRefresh,
  }) as Promise<Build[]>;

  if (!options?.forceRefresh) {
    pendingFetch = promise.finally(() => {
      if (pendingFetch === promise) pendingFetch = null;
    });
  }

  return promise;
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

export async function getCatalogLastFetched(): Promise<string | null> {
  return invoke<string | null>('get_catalog_last_fetched') as Promise<string | null>;
}
