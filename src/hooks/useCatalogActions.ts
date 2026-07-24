import { useMemo, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToast } from '@/hooks/use-toast';
import { installVersion } from '@/services/download';
import type { Build, InstalledVersion } from '@/types';
import { getRowKey, makeKey } from '@/utils/buildKey';

export function useCatalogActions(
  builds: Build[] | undefined,
  installed: InstalledVersion[] | undefined,
  downloadingKeys: Set<string>,
  favoriteKeys: Set<string>,
  installedKeys: Set<string>,
  searchState: { tag: string | null; builds: Build[] | null },
) {
  const { toast } = useToast();
  const { filters, setFilters } = useAppStore();

  // Filtered and sorted builds
  const filteredBuilds = useMemo(() => {
    let result = searchState.tag ? (searchState.builds || []) : (builds || []);

    if (!searchState.tag && filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(b =>
        b.build_number.toLowerCase().includes(search) ||
        b.backend.toLowerCase().includes(search) ||
        b.architecture.toLowerCase().includes(search) ||
        b.platform.toLowerCase().includes(search) ||
        b.tag_name.toLowerCase().includes(search)
      );
    }

    if (filters.backend.length > 0) {
      result = result.filter(b =>
        filters.backend.some(fb => b.backend.toLowerCase().includes(fb.toLowerCase()))
      );
    }

    if (filters.architecture) {
      result = result.filter(b => b.architecture === filters.architecture);
    }

    if (filters.favoritesOnly) {
      result = result.filter(b => favoriteKeys.has(getRowKey(b)));
    }

    if (filters.installedOnly) {
      result = result.filter(b => installedKeys.has(makeKey(b.build_number, b.backend, b.architecture)));
    }

    result = [...result].sort((a, b) => {
      if (filters.sortBy === 'date') {
        return filters.sortOrder === 'desc'
          ? new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
          : new Date(a.published_at).getTime() - new Date(b.published_at).getTime();
      }
      const numA = parseInt(a.build_number.replace('b', ''));
      const numB = parseInt(b.build_number.replace('b', ''));
      return filters.sortOrder === 'desc' ? numB - numA : numA - numB;
    });

    return result;
  }, [builds, filters, searchState.tag, searchState.builds, favoriteKeys, installedKeys]);

  // Group filtered builds by build_number
  const groupedBuilds = useMemo(() => {
    const groups = new Map<string, Build[]>();
    for (const build of filteredBuilds) {
      if (!groups.has(build.build_number)) {
        groups.set(build.build_number, []);
      }
      groups.get(build.build_number)!.push(build);
    }
    return groups;
  }, [filteredBuilds]);

  // Download handler
  const handleDownload = useCallback(async (build: Build) => {
    const hasActiveDownload = downloadingKeys.size > 0;
    if (hasActiveDownload) {
      toast({ title: 'Already downloading', description: 'Only one download at a time is allowed.' });
      return;
    }

    const alreadyInstalled = installed?.find(
      v => v.build_number === build.build_number && v.backend === build.backend && v.architecture === build.architecture && v.status === 'installed'
    );
    if (alreadyInstalled) {
      toast({ title: 'Already installed', description: `${build.build_number} (${build.backend} ${build.architecture}) is already installed.` });
      return;
    }

    try {
      const downloadId = await installVersion(build);
      const store = useAppStore.getState();
      store.updateDownloadProgress(build.build_number, build.backend, build.architecture, 0, downloadId, 'downloading');
      toast({ title: 'Download started', description: `Downloading ${build.build_number} (${build.backend} ${build.architecture})...` });
    } catch (err: any) {
      toast({ title: 'Download failed', description: err.message || 'Could not start download.' });
      const store = useAppStore.getState();
      store.clearDownload(build.build_number, build.backend, build.architecture);
    }
  }, [downloadingKeys, installed, toast]);

  // Toggle backend filter
  const toggleBackendFilter = useCallback((backend: string) => {
    const current = filters.backend;
    if (current.includes(backend)) {
      setFilters({ backend: current.filter(b => b !== backend) });
    } else {
      setFilters({ backend: [...current, backend] });
    }
  }, [filters.backend, setFilters]);

  return {
    filteredBuilds,
    groupedBuilds,
    handleDownload,
    toggleBackendFilter,
  };
}
