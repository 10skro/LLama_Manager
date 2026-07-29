import { useState, useMemo, useEffect, useCallback } from 'react';
import { useBuilds } from '@/hooks/useBuilds';
import { useInstalledVersions } from '@/hooks/useInstalledVersions';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAppStore } from '@/store/useAppStore';
import { makeKey } from '@/utils/buildKey';
import { formatRelativeTime } from '@/utils/format';
import { CatalogHeader } from '@/components/Catalog/CatalogHeader';
import { FilterBar } from '@/components/Catalog/FilterBar';
import { BuildsTable } from '@/components/Catalog/BuildsTable';
import { ChangelogModal } from '@/components/ChangelogModal';
import { AlertCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVersionSearch } from '@/hooks/useVersionSearch';
import { useCatalogRefresh } from '@/hooks/useCatalogRefresh';
import { useCatalogActions } from '@/hooks/useCatalogActions';

export function CatalogPage() {
  const { filters, setFilters } = useAppStore();
  const downloadingKeys = useAppStore((s) => s.downloadingKeys);
  const { data: builds = [], isLoading, isError: queryIsError, error: queryError } = useBuilds();
  const { data: installed } = useInstalledVersions();
  const [error, setError] = useState<string | null>(null);

  // Favorites
  const { data: favorites = [] } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favoriteKeys = useMemo(() => {
    const keys = new Set<string>();
    favorites?.forEach((f) => keys.add(f.download_url));
    return keys;
  }, [favorites]);

  // Changelog modal state
  const [changelogModal, setChangelogModal] = useState<{
    open: boolean;
    tag: string;
    build: string;
  }>({
    open: false,
    tag: '',
    build: '',
  });

  // Version search hook
  const { searchingVersion, searchError, searchState, handleVersionSearch, handleClearSearch } =
    useVersionSearch();

  // Catalog refresh hook
  const { handleRefreshClick, isRefreshing, canRefresh, secondsLeft, storeLastFetched } =
    useCatalogRefresh({
      onError: (message) => setError(message),
    });

  // Expanded/collapsed state for grouped builds
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  const toggleVersion = useCallback((buildNumber: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(buildNumber)) {
        next.delete(buildNumber);
      } else {
        next.add(buildNumber);
      }
      return next;
    });
  }, []);

  // Surface API errors to the user
  useEffect(() => {
    if (queryError) {
      const msg = queryError.message || '';
      if (msg.includes('429') || msg.includes('rate limit')) {
        setError(
          'GitHub API rate limit exceeded. Add a GitHub token in Settings to increase your limit.'
        );
      } else if (msg.includes('network') || msg.includes('connect') || msg.includes('timeout')) {
        setError(
          'Network error: Could not reach GitHub API. Check your connection or try again later.'
        );
      } else {
        setError(msg || 'Failed to fetch builds from GitHub API.');
      }
    }
  }, [queryError]);

  // Installed build keys for status check
  const installedKeys = useMemo(() => {
    const keys = new Set<string>();
    installed?.forEach((v) => keys.add(makeKey(v.build_number, v.backend, v.architecture)));
    return keys;
  }, [installed]);

  // Extracted catalog actions (filtering, sorting, grouping, download, backend filter)
  const { filteredBuilds, groupedBuilds, handleDownload, toggleBackendFilter } = useCatalogActions(
    builds,
    installed,
    downloadingKeys,
    favoriteKeys,
    installedKeys,
    searchState
  );

  // Count unique versions for display
  const versionCounts = useMemo(() => {
    const shown = new Set(filteredBuilds.map((b) => b.build_number)).size;
    const source = searchState.tag ? searchState.builds : builds;
    const total = new Set((source || []).map((b) => b.build_number)).size;
    return { shown, total };
  }, [filteredBuilds, builds, searchState.tag, searchState.builds]);

  // Auto-expand/collapse build groups based on backend filter
  useEffect(() => {
    if (filters.backend.length > 0) {
      setExpandedVersions(new Set(groupedBuilds.keys()));
    } else {
      // Preserve previously expanded versions when groupedBuilds reference changes
      // but version keys remain the same (e.g., after download completion or favorite toggle)
      setExpandedVersions((prev) => {
        return new Set([...prev].filter((key) => groupedBuilds.has(key)));
      });
    }
  }, [filters.backend, groupedBuilds]);

  // Available backend types from builds
  const availableBackends = useMemo(() => {
    const backends = new Set<string>();
    const source = searchState.tag ? searchState.builds || [] : builds || [];
    source.forEach((b) => backends.add(b.backend));
    return Array.from(backends);
  }, [builds, searchState.tag, searchState.builds]);

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <CatalogHeader
        onRefresh={handleRefreshClick}
        isRefreshing={isRefreshing}
        canRefresh={canRefresh}
        secondsLeft={secondsLeft}
        lastFetched={storeLastFetched}
        formatRelativeTime={formatRelativeTime}
      />

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Version Search Banner */}
      {searchState.tag && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <Search className="h-5 w-5 text-blue-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-blue-300">
              Showing builds for <span className="font-mono font-medium">{searchState.tag}</span>
            </p>
            {searchError && <p className="text-xs text-red-300 mt-1">{searchError}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={handleClearSearch}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        availableBackends={availableBackends}
        toggleBackendFilter={toggleBackendFilter}
        searchingVersion={searchingVersion}
        searchState={searchState}
        onVersionSearch={handleVersionSearch}
        onClearSearch={handleClearSearch}
      />

      {/* Builds Table */}
      <BuildsTable
        filteredBuilds={filteredBuilds}
        groupedBuilds={groupedBuilds}
        isLoading={isLoading}
        queryIsError={queryIsError}
        builds={builds}
        searchingVersion={searchingVersion}
        searchState={searchState}
        expandedVersions={expandedVersions}
        onToggleVersion={toggleVersion}
        installedKeys={installedKeys}
        downloadingKeys={downloadingKeys}
        favoriteKeys={favoriteKeys}
        onToggleFavorite={(build) =>
          toggleFavorite.mutate({
            downloadUrl: build.download_url,
            buildNumber: build.build_number,
            backend: build.backend,
            architecture: build.architecture,
          })
        }
        onShowChangelog={(build) =>
          setChangelogModal({ open: true, tag: build.tag_name, build: build.build_number })
        }
        onDownload={handleDownload}
      />

      {/* Results count */}
      {filteredBuilds.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {searchState.tag
            ? `${versionCounts.shown} version(s) for "${searchState.tag}"`
            : `${versionCounts.shown} version(s) shown of ${versionCounts.total} total`}
        </p>
      )}

      {/* Changelog Modal */}
      <ChangelogModal
        open={changelogModal.open}
        onOpenChange={(open) => setChangelogModal((prev) => ({ ...prev, open }))}
        tagName={changelogModal.tag}
        buildNumber={changelogModal.build}
      />
    </div>
  );
}
