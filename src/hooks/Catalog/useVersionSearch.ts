import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useQueryClient } from '@tanstack/react-query';
import { fetchReleaseByTag, searchBuilds } from '@/services/github';
import type { Build } from '@/types';

interface SearchState {
  tag: string | null;
  builds: Build[] | null;
}

export function useVersionSearch() {
  const { filters, setFilters } = useAppStore();
  const queryClient = useQueryClient();

  const [searchingVersion, setSearchingVersion] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchState, setSearchState] = useState<SearchState>({ tag: null, builds: null });
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleVersionSearch = async () => {
    if (searchingVersion) return;
    const tag = filters.search.trim();
    if (!tag) return;

    // Validate input: only allow alphanumeric characters, hyphens, and underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
      setSearchError(
        'Invalid version format. Use alphanumeric characters only (e.g., b9976, 9976).'
      );
      setSearchingVersion(false);
      return;
    }

    // Abort any pending search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSearchError(null);
    setSearchingVersion(true);
    setSearchState({ tag, builds: null });
    try {
      // Strategy 1: Try exact tag match first
      try {
        const exactResults = await fetchReleaseByTag(tag);
        if (!controller.signal.aborted && exactResults.length > 0) {
          setSearchState({ tag, builds: exactResults });
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        // Exact tag not found, fall through
      }

      // Strategy 2: If tag starts with 'b', try without it
      if (tag.startsWith('b')) {
        try {
          const normalizedTag = tag.slice(1);
          const results = await fetchReleaseByTag(normalizedTag);
          if (!controller.signal.aborted && results.length > 0) {
            setSearchState({ tag, builds: results });
            return;
          }
        } catch {
          if (controller.signal.aborted) return;
          // Fall through
        }
      }

      // Strategy 3: Use search_builds API for partial match
      const searchResults = await searchBuilds(tag);
      if (!controller.signal.aborted) {
        if (searchResults.length > 0) {
          setSearchState({ tag, builds: searchResults });
        } else {
          setSearchError(`No builds found matching "${tag}".`);
          setSearchState({ tag, builds: [] });
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setSearchError(err instanceof Error ? err.message : `Failed to search for "${tag}".`);
      setSearchState({ tag, builds: [] });
    } finally {
      if (!controller.signal.aborted) {
        setSearchingVersion(false);
      }
      abortControllerRef.current = null;
    }
  };

  const handleClearSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSearchState({ tag: null, builds: null });
    setSearchError(null);
    setSearchingVersion(false);
    setFilters({ search: '' });
    // Query invalidation is handled by the reactive useEffect below,
    // which triggers on setFilters({ search: '' }). Removing duplicate call here.
  };

  // Reactive clearing: when search input becomes empty and an active tag exists, reset
  useEffect(() => {
    if (searchState.tag && filters.search === '') {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setSearchState({ tag: null, builds: null });
      setSearchError(null);
      setSearchingVersion(false);
      queryClient.invalidateQueries({ queryKey: ['builds'] });
    }
  }, [filters.search, searchState.tag, queryClient]);

  return {
    searchingVersion,
    searchError,
    searchState,
    handleVersionSearch,
    handleClearSearch,
  };
}
